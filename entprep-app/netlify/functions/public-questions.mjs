// Public read-only questions API for external partners.
//
// Access model: NOT Supabase-direct. Partners never see the Supabase key.
// They call THIS endpoint with a header `x-api-key: <key>` that you generate
// and store in the Netlify env var PARTNER_API_KEYS (comma-separated).
//   - One key per partner → revoke any single partner by removing its key.
//   - Read-only: this function only does SELECT on the questions table.
//   - Answers ARE included (c, correct_indices, e) per product decision.
//
// Generate a key:   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
// Then set in Netlify:  PARTNER_API_KEYS= key1,key2,key3
//
// Endpoints (all GET, require x-api-key):
//   ?subject=math&mode=list&limit=100&offset=0   → paged export (ordered by idx)
//   ?subject=math&mode=random&count=20           → N random questions
//   ?subject=math&mode=counts                    → {total, topics, subtopics}
// Optional:  &topic=<topicId>   &lang=ru|kk|all   (ru = default; all = both langs)

import { VALID_SUBJECTS } from "./utils/constants.mjs";
import { createRateLimiter } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

// Public API: allow any origin (auth is the api-key, not a cookie/session).
const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// 120 req/min per partner key (own bucket, separate from the app's questions.mjs).
const rateLimit = createRateLimiter("public-questions", { max: 120, windowSec: 60 });

function parseKeys() {
  return new Set(
    (process.env.PARTNER_API_KEYS || "")
      .split(",")
      .map(k => k.trim())
      .filter(Boolean)
  );
}

const json = (body, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { ...PUBLIC_CORS, ...extra } });

// Columns. ru is always returned; kk/all add the _kk variants.
const BASE_COLS = "idx,subject,topic,subtopic,q,o,c,e,type,correct_indices,pairs,difficulty,block,passage_group,passage_title,passage_text";
const KK_COLS = "q_kk,o_kk,e_kk,pairs_kk,passage_title_kk,passage_text_kk";

function selectCols(lang) {
  if (lang === "kk" || lang === "all") return `${BASE_COLS},${KK_COLS}`;
  return BASE_COLS;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: PUBLIC_CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!SB_URL || !SB_KEY) return json({ error: "Server misconfigured" }, 500);

  // ── Auth: partner api-key ──
  const keys = parseKeys();
  if (keys.size === 0) return json({ error: "API not enabled" }, 503);
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !keys.has(apiKey)) return json({ error: "Invalid or missing x-api-key" }, 401);

  // Rate limit per key (don't leak the full key into the bucket id beyond memory)
  const wait = rateLimit(apiKey);
  if (wait) return json({ error: "Too many requests" }, 429, { "Retry-After": String(wait) });

  const url = new URL(req.url, `https://${req.headers.get("host") || "localhost"}`);
  const subject = url.searchParams.get("subject");
  const mode = url.searchParams.get("mode") || "list";
  const topic = url.searchParams.get("topic") || null;
  const lang = url.searchParams.get("lang") || "ru";

  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return json({ error: "Invalid or missing subject", valid: VALID_SUBJECTS }, 400);
  }

  const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const subjFilter = `subject=eq.${encodeURIComponent(subject)}`;
  const topicFilter = topic ? `&topic=eq.${encodeURIComponent(topic)}` : "";

  try {
    // ── counts mode ──
    if (mode === "counts") {
      const allRows = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(
          `${SB_URL}/rest/v1/questions?${subjFilter}${topicFilter}&select=topic,subtopic&order=idx&limit=${PAGE}&offset=${offset}`,
          { headers: sbHeaders }
        );
        if (!res.ok) break;
        const page = await res.json();
        if (!page?.length) break;
        allRows.push(...page);
        if (page.length < PAGE) break;
      }
      const topics = {};
      const subtopics = {};
      for (const r of allRows) {
        if (r.topic) topics[r.topic] = (topics[r.topic] || 0) + 1;
        if (r.subtopic) subtopics[r.subtopic] = (subtopics[r.subtopic] || 0) + 1;
      }
      return json(
        { subject, total: allRows.length, topics, subtopics },
        200,
        { "Cache-Control": "public, max-age=3600" }
      );
    }

    const cols = selectCols(lang);

    // ── list mode (paged export, ordered) ──
    if (mode === "list") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1000);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
      const res = await fetch(
        `${SB_URL}/rest/v1/questions?${subjFilter}${topicFilter}&select=${cols}&order=idx&limit=${limit}&offset=${offset}`,
        { headers: { ...sbHeaders, Prefer: "count=exact" } }
      );
      if (!res.ok) return json({ error: "Failed to fetch questions" }, 502);
      const questions = await res.json();
      // PostgREST returns total in Content-Range: "0-99/12345"
      const range = res.headers.get("content-range") || "";
      const total = parseInt(range.split("/")[1], 10);
      const nextOffset = offset + questions.length;
      return json({
        subject,
        questions,
        count: questions.length,
        total: Number.isFinite(total) ? total : null,
        offset,
        limit,
        hasMore: Number.isFinite(total) ? nextOffset < total : questions.length === limit,
        nextOffset,
      });
    }

    // ── random mode ──
    if (mode === "random") {
      const count = Math.min(parseInt(url.searchParams.get("count") || "20", 10) || 20, 50);
      // Step 1: all idx (tiny payload)
      const allIdx = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(
          `${SB_URL}/rest/v1/questions?${subjFilter}${topicFilter}&select=idx&order=idx&limit=${PAGE}&offset=${offset}`,
          { headers: sbHeaders }
        );
        if (!res.ok) break;
        const page = await res.json();
        if (!page?.length) break;
        allIdx.push(...page);
        if (page.length < PAGE) break;
      }
      if (allIdx.length === 0) return json({ subject, questions: [], total: 0 });
      // Step 2: shuffle + pick
      const indices = allIdx.map(r => r.idx);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const picked = indices.slice(0, count);
      // Step 3: fetch full rows
      const res = await fetch(
        `${SB_URL}/rest/v1/questions?${subjFilter}&idx=in.(${picked.join(",")})&select=${cols}`,
        { headers: sbHeaders }
      );
      if (!res.ok) return json({ error: "Failed to fetch questions" }, 502);
      const questions = await res.json();
      return json({ subject, questions, count: questions.length, total: allIdx.length });
    }

    return json({ error: "Invalid mode", valid: ["list", "random", "counts"] }, 400);
  } catch (err) {
    console.error("public-questions error:", err);
    return json({ error: "Internal error" }, 500);
  }
}

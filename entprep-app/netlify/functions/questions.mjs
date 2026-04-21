// Fast question endpoint: returns N random questions for a subject
// Used as fallback when client cache is empty (first visit, slow internet)

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";
import { VALID_SUBJECTS } from "./utils/constants.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const rateLimit = createRateLimiter("questions", { max: 60, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }
  if (!SB_URL || !SB_KEY) {
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS_HEADERS });
  }

  // Auth required — prevent answer scraping
  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const wait = rateLimit(user.id);
  if (wait) return rateLimitResponse(wait);

  const url = new URL(req.url, `https://${req.headers.get("host") || "localhost"}`);
  const subject = url.searchParams.get("subject");
  const count = Math.min(parseInt(url.searchParams.get("count") || "20", 10) || 20, 50);
  const topic = url.searchParams.get("topic") || null;
  const lang = url.searchParams.get("lang") || null;

  const mode = url.searchParams.get("mode") || "random";

  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
  }

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // Fast topic counts mode — returns {total, topics: {topicId: count}}
  if (mode === "counts") {
    try {
      const allRows = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(
          `${SB_URL}/rest/v1/questions?subject=eq.${encodeURIComponent(subject)}&select=topic,subtopic&order=idx&limit=${PAGE}&offset=${offset}`,
          { headers }
        );
        if (!res.ok) break;
        const page = await res.json();
        if (!page || page.length === 0) break;
        allRows.push(...page);
        if (page.length < PAGE) break;
      }
      const topics = {};
      const subtopics = {};
      for (const r of allRows) {
        if (r.topic) topics[r.topic] = (topics[r.topic] || 0) + 1;
        if (r.subtopic) subtopics[r.subtopic] = (subtopics[r.subtopic] || 0) + 1;
      }
      return Response.json(
        { total: allRows.length, topics, subtopics },
        { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } }
      );
    } catch (err) {
      return Response.json({ error: "Failed to fetch counts" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  try {
    // Reading: return complete passages (groups of 5 questions), not random individual questions
    if (subject === "reading") {
      const cols = "idx,topic,subtopic,q,o,c,e,type,correct_indices,passage_group,passage_title,passage_text,passage_title_kk,passage_text_kk,q_kk,o_kk,e_kk";
      const allRows = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(
          `${SB_URL}/rest/v1/questions?subject=eq.reading&select=${cols}&order=idx&limit=${PAGE}&offset=${offset}`,
          { headers }
        );
        if (!res.ok) break;
        const page = await res.json();
        if (!page || page.length === 0) break;
        allRows.push(...page);
        if (page.length < PAGE) break;
      }
      // Group by passage_group
      const groups = {};
      for (const row of allRows) {
        const g = row.passage_group ?? 0;
        if (!groups[g]) groups[g] = [];
        groups[g].push(row);
      }
      const groupKeys = Object.keys(groups);
      // Shuffle and pick enough passages
      for (let i = groupKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [groupKeys[i], groupKeys[j]] = [groupKeys[j], groupKeys[i]];
      }
      const needPassages = Math.ceil(count / 5);
      const pickedKeys = groupKeys.slice(0, needPassages);
      const questions = [];
      for (const k of pickedKeys) {
        questions.push(...groups[k]);
      }
      return Response.json(
        { questions: questions.slice(0, count), total: allRows.length },
        { headers: { ...CORS_HEADERS, "Cache-Control": "no-cache" } }
      );
    }

    // Step 1: get all idx values for this subject+topic (tiny payload: just integers)
    // Paginate to get past Supabase default 1000 row limit
    let allIdx = [];
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      let idxQuery = `${SB_URL}/rest/v1/questions?subject=eq.${encodeURIComponent(subject)}&select=idx&order=idx&limit=${PAGE}&offset=${offset}`;
      if (topic) idxQuery += `&topic=eq.${encodeURIComponent(topic)}`;
      const idxRes = await fetch(idxQuery, { headers });
      if (!idxRes.ok) break;
      const page = await idxRes.json();
      if (!page || page.length === 0) break;
      allIdx.push(...page);
      if (page.length < PAGE) break;
    }
    if (allIdx.length === 0) {
      return Response.json({ questions: [], total: 0 }, { headers: CORS_HEADERS });
    }

    // Step 2: shuffle and pick N random indices
    const indices = allIdx.map(r => r.idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const picked = indices.slice(0, count);

    // Step 3: fetch full question data for picked indices
    const cols = "idx,topic,subtopic,q,o,c,e,type,correct_indices,pairs,difficulty,block,passage_group,passage_title,passage_text";
    const langCols = lang === "kk" ? ",q_kk,o_kk,e_kk,pairs_kk,passage_title_kk,passage_text_kk" : "";
    const qRes = await fetch(
      `${SB_URL}/rest/v1/questions?subject=eq.${encodeURIComponent(subject)}&idx=in.(${picked.join(",")})&select=${cols}${langCols}`,
      { headers }
    );

    if (!qRes.ok) {
      return Response.json({ error: "Failed to fetch questions" }, { status: 500, headers: CORS_HEADERS });
    }

    const questions = await qRes.json();

    // Return with total count for UI
    return Response.json(
      { questions, total: allIdx.length },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-cache" } }
    );
  } catch (err) {
    console.error("Questions endpoint error:", err);
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}

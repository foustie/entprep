// Pacing stats: anonymous per-subject × difficulty answer-time aggregates.
//
// POST /api/pacing  (auth required, rate-limited)
//   Body: { subject, samples: [{ df: 'easy'|'medium'|'hard', tms: 1..600 }] }
//   Folds samples into running sums in pacing_stats (n, sum_sec, sum_sq).
//   Aggregation strategy: read-modify-write per (subject, difficulty) row via
//   Supabase REST upsert. Concurrent writers can race and drop a batch, but
//   for band-level statistics (mean ± sd over thousands of samples) an
//   occasional lost batch is acceptable — no RPC needed.
//
// GET /api/pacing?subject=X  (public, no auth)
//   Returns { easy: {n, mean, sd}, medium: {...}, hard: {...} } computed from
//   the row sums; sd = sqrt(max(0, sum_sq/n - mean^2)). Cached ~5 min.

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";
import { VALID_SUBJECTS } from "./utils/constants.mjs";

const checkRate = createRateLimiter("pacing", { max: 10, windowSec: 60 });

const SUBJECTS = new Set(VALID_SUBJECTS);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const MAX_SAMPLES = 200;
const MAX_TMS = 600;

function getSbConfig() {
  return { url: process.env.VITE_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY };
}

function statsFromRow(row) {
  if (!row || !(row.n > 0)) return { n: 0, mean: 0, sd: 0 };
  const n = Number(row.n);
  const mean = row.sum_sec / n;
  const sd = Math.sqrt(Math.max(0, row.sum_sq / n - mean * mean));
  return { n, mean, sd };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const { url: SB_URL, key: SB_KEY } = getSbConfig();
  if (!SB_URL || !SB_KEY) {
    console.error("pacing: missing env vars");
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS_HEADERS });
  }
  const authHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // ── GET: public aggregates for one subject ────────────────────────────────
  if (req.method === "GET") {
    const u = new URL(req.url, `https://${req.headers.get("host") || "localhost"}`);
    const subject = u.searchParams.get("subject");
    if (!subject || !SUBJECTS.has(subject)) {
      return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
    }
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/pacing_stats?subject=eq.${encodeURIComponent(subject)}&select=difficulty,n,sum_sec,sum_sq`,
        { headers: authHeaders },
      );
      if (!res.ok) {
        console.error("pacing GET db error:", res.status, await res.text());
        return Response.json({ error: "DB error" }, { status: 500, headers: CORS_HEADERS });
      }
      const rows = await res.json();
      const byDiff = new Map(rows.map(r => [r.difficulty, r]));
      const out = {
        easy: statsFromRow(byDiff.get("easy")),
        medium: statsFromRow(byDiff.get("medium")),
        hard: statsFromRow(byDiff.get("hard")),
      };
      return Response.json(out, {
        headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
      });
    } catch (err) {
      console.error("pacing GET error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // ── POST: ingest samples (auth + rate limit) ──────────────────────────────
  if (req.method === "POST") {
    const user = await verifyAuth(req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const rl = checkRate(user.id);
    if (rl) return rateLimitResponse(rl);

    let body;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
    }

    const { subject, samples } = body || {};
    if (!subject || !SUBJECTS.has(subject)) {
      return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!Array.isArray(samples) || samples.length === 0 || samples.length > MAX_SAMPLES) {
      return Response.json({ error: "Invalid samples" }, { status: 400, headers: CORS_HEADERS });
    }
    for (const s of samples) {
      if (!s || !DIFFICULTIES.has(s.df) || !Number.isInteger(s.tms) || s.tms < 1 || s.tms > MAX_TMS) {
        return Response.json({ error: "Invalid sample" }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // Fold samples into per-difficulty deltas
    const deltas = new Map(); // df -> { n, sumSec, sumSq }
    for (const s of samples) {
      const d = deltas.get(s.df) || { n: 0, sumSec: 0, sumSq: 0 };
      d.n += 1;
      d.sumSec += s.tms;
      d.sumSq += s.tms * s.tms;
      deltas.set(s.df, d);
    }

    try {
      for (const [df, d] of deltas) {
        // Read current sums for this (subject, difficulty)
        const getRes = await fetch(
          `${SB_URL}/rest/v1/pacing_stats?subject=eq.${encodeURIComponent(subject)}&difficulty=eq.${df}&select=n,sum_sec,sum_sq`,
          { headers: authHeaders },
        );
        if (!getRes.ok) throw new Error(`read failed: ${getRes.status}`);
        const [row] = await getRes.json();

        // Upsert updated sums (merge-duplicates handles both insert and update)
        const upRes = await fetch(`${SB_URL}/rest/v1/pacing_stats`, {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            subject,
            difficulty: df,
            n: Number(row?.n || 0) + d.n,
            sum_sec: (row?.sum_sec || 0) + d.sumSec,
            sum_sq: (row?.sum_sq || 0) + d.sumSq,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!upRes.ok) throw new Error(`upsert failed: ${upRes.status} ${await upRes.text()}`);
      }
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    } catch (err) {
      console.error("pacing POST error:", err);
      return Response.json({ error: "Failed to save" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
}

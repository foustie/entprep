// Leaderboard: submit scores + fetch rankings
// Uses service key to bypass RLS

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";

const checkRate = createRateLimiter("leaderboard", { max: 10, windowSec: 60 });

// Subject whitelist — only valid subject IDs
const VALID_SUBJECTS = new Set([
  "math", "reading", "history", "geography", "english", "math_profile",
  "physics", "biology", "chemistry", "world_history", "informatics", "law", "literature",
]);

function getSbConfig() {
  return {
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const { url: SB_URL, key: SB_KEY } = getSbConfig();
  if (!SB_URL || !SB_KEY) {
    console.error("Missing env vars:", { SB_URL: !!SB_URL, SB_KEY: !!SB_KEY });
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS_HEADERS });
  }

  const authHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // GET = fetch scores
  if (req.method === "GET") {
    const u = new URL(req.url, `https://${req.headers.get("host") || "localhost"}`);
    const period = u.searchParams.get("period") || "all";
    const subject = u.searchParams.get("subject") || "all";

    if (subject !== "all" && !VALID_SUBJECTS.has(subject)) {
      return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
    }

    // Check if request is authenticated (for user_id stripping)
    const authUser = await verifyAuth(req).catch(() => null);

    let query = "select=id,user_id,user_name,subject,score,created_at&order=created_at.desc&limit=5000";

    if (period !== "all") {
      const d = new Date();
      if (period === "week") d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      query += `&created_at=gte.${d.toISOString()}`;
    }
    if (subject !== "all") {
      query += `&subject=eq.${subject}`;
    }

    // Filter by specific user IDs (for friends/group leaderboard tabs)
    const userIds = u.searchParams.get("user_ids");
    if (userIds) {
      const ids = userIds.split(",").filter(id => /^[a-f0-9-]{36}$/.test(id)).slice(0, 100);
      if (ids.length > 0) {
        query += `&user_id=in.(${ids.join(",")})`;
      }
    }

    try {
      const res = await fetch(`${SB_URL}/rest/v1/leaderboard?${query}`, { headers: authHeaders });
      if (!res.ok) {
        const text = await res.text();
        console.error("LB GET error:", res.status, text);
        return Response.json({ error: "DB error" }, { status: 500, headers: CORS_HEADERS });
      }
      const data = await res.json();

      // Aggregate per user on server (prevents one user flooding the list)
      const userMap = new Map();
      for (const r of data) {
        const entry = userMap.get(r.user_id);
        if (entry) { entry.total++; entry.sum += r.score; }
        else userMap.set(r.user_id, { user_id: r.user_id, user_name: r.user_name, total: 1, sum: r.score });
      }
      const aggregated = Array.from(userMap.values())
        .map(u => ({ ...u, avgScore: Math.round(u.sum / u.total), testCount: u.total }))
        .sort((a, b) => b.avgScore - a.avgScore || b.testCount - a.testCount)
        .slice(0, 50);

      // Enrich with nicknames from profiles table
      const uids = aggregated.map(r => r.user_id);
      if (uids.length > 0) {
        try {
          const pRes = await fetch(
            `${SB_URL}/rest/v1/profiles?id=in.(${uids.join(",")})&select=id,nickname,avatar_url`,
            { headers: authHeaders }
          );
          if (pRes.ok) {
            const profiles = await pRes.json();
            const pm = new Map(profiles.map(p => [p.id, p]));
            for (const row of aggregated) {
              const p = pm.get(row.user_id);
              if (p) {
                row.nickname = p.nickname;
                row.avatar_url = p.avatar_url;
              }
            }
          }
        } catch (e) {
          console.warn("Failed to enrich leaderboard with profiles:", e.message);
        }
      }

      // Strip user_id from unauthenticated responses
      if (!authUser) {
        for (const row of aggregated) {
          delete row.user_id;
        }
      }

      return Response.json(aggregated, { headers: CORS_HEADERS });
    } catch (err) {
      console.error("LB GET fetch error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // POST = submit score (server-verified)
  if (req.method === "POST") {
    const user = await verifyAuth(req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    let body;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
    }

    // Rate limit per user
    const rl = checkRate(user.id);
    if (rl) return rateLimitResponse(rl);

    const { subject, question_indices, answers } = body;

    // Reject old clients that send raw score without verification data
    if (!question_indices || !answers) {
      return Response.json({ error: "Missing question_indices and answers. Please update the app." }, { status: 400, headers: CORS_HEADERS });
    }

    if (!subject || !VALID_SUBJECTS.has(subject)) {
      return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
    }

    // Validate question_indices: array of integers, reasonable count (10-120)
    if (!Array.isArray(question_indices) || question_indices.length < 10 || question_indices.length > 120) {
      return Response.json({ error: "Invalid question_indices length" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!question_indices.every(idx => typeof idx === "number" && Number.isInteger(idx) && idx >= 0)) {
      return Response.json({ error: "Invalid question_indices values" }, { status: 400, headers: CORS_HEADERS });
    }

    // Validate answers: array matching question_indices length
    if (!Array.isArray(answers) || answers.length !== question_indices.length) {
      return Response.json({ error: "Answers length must match question_indices" }, { status: 400, headers: CORS_HEADERS });
    }

    // Fetch the actual questions from Supabase using service key (bypasses RLS, accesses `c` field)
    let dbQuestions;
    try {
      const indicesParam = question_indices.join(",");
      const qRes = await fetch(
        `${SB_URL}/rest/v1/questions?subject=eq.${encodeURIComponent(subject)}&idx=in.(${indicesParam})&select=idx,c,type,correct_indices`,
        { headers: authHeaders }
      );
      if (!qRes.ok) {
        console.error("LB question fetch error:", qRes.status, await qRes.text());
        return Response.json({ error: "Failed to verify questions" }, { status: 500, headers: CORS_HEADERS });
      }
      dbQuestions = await qRes.json();
    } catch (err) {
      console.error("LB question fetch error:", err);
      return Response.json({ error: "Failed to verify questions" }, { status: 500, headers: CORS_HEADERS });
    }

    // Build lookup: idx -> question data
    const qMap = new Map();
    for (const q of dbQuestions) {
      qMap.set(q.idx, q);
    }

    // Verify all submitted question_indices exist in the DB for this subject
    const missingCount = question_indices.filter(idx => !qMap.has(idx)).length;
    if (missingCount > question_indices.length * 0.1) {
      // Allow up to 10% missing (static fallback questions might not be in DB)
      return Response.json({ error: "Too many invalid question indices" }, { status: 400, headers: CORS_HEADERS });
    }

    // Calculate score server-side by comparing answers to correct answers
    let correctCount = 0;
    let verifiableCount = 0;
    for (let i = 0; i < question_indices.length; i++) {
      const idx = question_indices[i];
      const userAnswer = answers[i];
      const dbQ = qMap.get(idx);
      if (!dbQ) continue; // Skip questions not found in DB (static fallback)
      verifiableCount++;

      if (userAnswer === null || userAnswer === undefined) continue; // Unanswered

      const qType = dbQ.type || "single";

      if (qType === "single") {
        // Single choice: userAnswer (number) must match dbQ.c (number)
        if (typeof userAnswer === "number" && userAnswer === dbQ.c) {
          correctCount++;
        }
      } else if (qType === "multiple") {
        // Multiple choice: userAnswer (number[]) vs correct_indices (number[])
        const correctArr = dbQ.correct_indices || [dbQ.c];
        if (Array.isArray(userAnswer)) {
          const missed = correctArr.filter(c => !userAnswer.includes(c));
          const extra = userAnswer.filter(a => !correctArr.includes(a));
          if (missed.length === 0 && extra.length === 0) {
            correctCount++;
          }
        }
      } else if (qType === "matching") {
        // Matching: userAnswer is Record<number, number>, correct when all map[i] === i
        if (userAnswer && typeof userAnswer === "object" && !Array.isArray(userAnswer)) {
          const keys = Object.keys(userAnswer);
          const allCorrect = keys.length >= 5 && keys.every(k => userAnswer[k] === Number(k));
          if (allCorrect) correctCount++;
        }
      }
    }

    // Must have verified at least 80% of questions against the DB
    if (verifiableCount < question_indices.length * 0.8) {
      return Response.json({ error: "Not enough questions could be verified" }, { status: 400, headers: CORS_HEADERS });
    }

    // Calculate percentage score based on total question count
    const totalQuestions = question_indices.length;
    const calculatedScore = Math.min(100, Math.round(correctCount / totalQuestions * 100));

    // Prevent rapid duplicate submissions (same user+subject+score within 30s)
    try {
      const since = new Date(Date.now() - 30000).toISOString();
      const dupRes = await fetch(
        `${SB_URL}/rest/v1/leaderboard?user_id=eq.${user.id}&subject=eq.${encodeURIComponent(subject)}&score=eq.${calculatedScore}&created_at=gte.${since}&limit=1`,
        { headers: authHeaders }
      );
      if (dupRes.ok) {
        const dups = await dupRes.json();
        if (dups.length > 0) return Response.json({ ok: true, duplicate: true }, { headers: CORS_HEADERS });
      }
    } catch {}

    // Prefer nickname from profiles, fall back to Google name
    let userName = user.user_metadata?.full_name || user.email || "Anonymous";
    try {
      const pRes = await fetch(
        `${SB_URL}/rest/v1/profiles?id=eq.${user.id}&select=nickname`,
        { headers: authHeaders }
      );
      if (pRes.ok) {
        const [profile] = await pRes.json();
        if (profile?.nickname && !profile.nickname.startsWith("user_")) userName = profile.nickname;
      }
    } catch {}

    try {
      const res = await fetch(`${SB_URL}/rest/v1/leaderboard`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ subject, user_name: userName, score: calculatedScore, user_id: user.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("LB POST error:", res.status, text);
        return Response.json({ error: "Failed to save" }, { status: 500, headers: CORS_HEADERS });
      }
      return Response.json({ ok: true, score: calculatedScore }, { headers: CORS_HEADERS });
    } catch (err) {
      console.error("LB POST error:", err);
      return Response.json({ error: "Failed to save" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
}

// Analytics API: aggregate growth stats across all users
// Used for: minister pitch, B2B sales, internal metrics
import { CORS_HEADERS, corsResponse } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

// Cache for 1 hour — heavy query, no need to recalculate every request
let cache = { data: null, ts: 0 };
const CACHE_TTL = 3600_000;

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const url = new URL(req.url, "https://entprep.org");
  const action = url.searchParams.get("action");

  try {
    switch (action) {
      case "growth": {
        // Return cached if fresh
        if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
          return Response.json(cache.data, { headers: CORS_HEADERS });
        }

        // Fetch all user histories from Supabase
        // Only select id and hist to minimize data transfer
        const res = await fetch(
          `${SB_URL}/rest/v1/user_data?select=id,hist&hist=not.is.null`,
          { headers: sbHeaders }
        );
        if (!res.ok) throw new Error(await res.text());
        const users = await res.json();

        // Process growth stats
        const stats = calculateGrowthStats(users);
        cache = { data: stats, ts: Date.now() };

        return Response.json(stats, { headers: CORS_HEADERS });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (err) {
    console.error("Analytics error:", err);
    return Response.json({ error: "Analytics failed" }, { status: 500, headers: CORS_HEADERS });
  }
}

function calculateGrowthStats(users) {
  const subjectStats = {};
  let totalUsers = users.length;
  let activeUsers = 0; // 3+ tests
  let improvedUsers = 0;
  let totalImprovement = 0;
  let usersWithImprovement = 0;
  let totalTests = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const user of users) {
    const hist = user.hist;
    if (!hist || !Array.isArray(hist) || hist.length < 2) continue;

    // Only count regular tests, not fullent
    const tests = hist.filter(h => h.type !== 'fullent' && h.su && h.sc != null);
    if (tests.length < 2) continue;

    activeUsers++;
    totalTests += tests.length;
    totalCorrect += tests.reduce((s, t) => s + (t.co || 0), 0);
    totalQuestions += tests.reduce((s, t) => s + (t.to || 0), 0);

    // Per-subject: first score vs latest score
    const subjects = {};
    for (const t of tests) {
      if (!subjects[t.su]) subjects[t.su] = { first: null, latest: null, scores: [] };
      const entry = subjects[t.su];
      if (!entry.first) entry.first = t.sc;
      entry.latest = t.sc;
      entry.scores.push(t.sc);
    }

    let userImproved = false;
    for (const [sid, data] of Object.entries(subjects)) {
      if (data.scores.length < 2) continue;

      const improvement = data.latest - data.first;

      if (!subjectStats[sid]) {
        subjectStats[sid] = {
          users: 0, improved: 0,
          totalFirst: 0, totalLatest: 0,
          totalImprovement: 0,
        };
      }
      subjectStats[sid].users++;
      subjectStats[sid].totalFirst += data.first;
      subjectStats[sid].totalLatest += data.latest;
      subjectStats[sid].totalImprovement += improvement;

      if (improvement > 0) {
        subjectStats[sid].improved++;
        userImproved = true;
      }
    }

    if (userImproved) {
      improvedUsers++;
      // Average improvement across this user's subjects
      const userSubjects = Object.values(subjects).filter(s => s.scores.length >= 2);
      if (userSubjects.length > 0) {
        const avgImp = userSubjects.reduce((s, d) => s + (d.latest - d.first), 0) / userSubjects.length;
        totalImprovement += avgImp;
        usersWithImprovement++;
      }
    }
  }

  // Build per-subject summary
  const bySubject = {};
  for (const [sid, s] of Object.entries(subjectStats)) {
    if (s.users === 0) continue;
    bySubject[sid] = {
      users: s.users,
      avgFirst: Math.round(s.totalFirst / s.users),
      avgLatest: Math.round(s.totalLatest / s.users),
      avgImprovement: Math.round(s.totalImprovement / s.users),
      improvedPct: Math.round((s.improved / s.users) * 100),
    };
  }

  return {
    totalUsers,
    activeUsers,
    improvedUsers,
    improvementRate: activeUsers > 0 ? Math.round((improvedUsers / activeUsers) * 100) : 0,
    avgImprovement: usersWithImprovement > 0 ? Math.round(totalImprovement / usersWithImprovement) : 0,
    totalTests,
    avgAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    bySubject,
    generatedAt: new Date().toISOString(),
  };
}

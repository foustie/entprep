// Teacher Dashboard API: create class, join class, get class data
// Uses service key to bypass RLS for cross-user reads

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sbGet(table, query) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbInsert(table, row) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409 || text.includes("duplicate") || text.includes("unique")) {
      throw Object.assign(new Error("duplicate"), { status: 409 });
    }
    throw new Error(text);
  }
  return res.json();
}

async function sbDelete(table, filter) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: sbHeaders,
  });
  if (!res.ok) throw new Error(await res.text());
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 confusion
  let code = "ENT-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rateLimit = createRateLimiter("teacher", { max: 30, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const wait = rateLimit(user.id);
  if (wait) return rateLimitResponse(wait);

  const url = new URL(req.url, "https://entprep.org");
  const action = url.searchParams.get("action");

  try {
    switch (action) {
      // ── Get teacher's class + students ──────────────────────────────
      case "get_class": {
        // Find teacher's class
        const classes = await sbGet("classes", `teacher_id=eq.${user.id}&select=*`);
        if (!classes.length) return Response.json({ class: null }, { headers: CORS_HEADERS });

        const cls = classes[0];

        // Get members
        const members = await sbGet("class_members", `class_id=eq.${cls.id}&select=student_id,joined_at`);
        if (!members.length) {
          return Response.json({ class: cls, students: [] }, { headers: CORS_HEADERS });
        }

        const studentIds = members.map(m => m.student_id);

        // Get profiles
        const profiles = await sbGet("profiles", `id=in.(${studentIds.join(",")})&select=id,nickname,avatar_url,xp,level,streak`);

        // Get user_data (test history)
        const userData = await sbGet("user_data", `id=in.(${studentIds.join(",")})&select=id,hist`);

        // Merge data
        const students = studentIds.map(sid => {
          const profile = profiles.find(p => p.id === sid) || {};
          const data = userData.find(d => d.id === sid);
          const hist = data?.hist || [];
          const member = members.find(m => m.student_id === sid);

          // Compute stats from history (exclude fullent simulations)
          const totalTests = hist.filter(h => h.type !== 'fullent').length;
          const totalCorrect = hist.reduce((s, h) => s + (h.co || 0), 0);
          const totalQuestions = hist.reduce((s, h) => s + (h.to || 0), 0);
          const avgScore = totalTests > 0 ? Math.round(hist.reduce((s, h) => s + (h.sc || 0), 0) / totalTests) : 0;
          const lastActive = hist.length > 0 ? hist.reduce((latest, h) => (h.dt || '') > (latest || '') ? h.dt : latest, hist[0]?.dt || null) : null;

          // Sort hist chronologically for correct slicing
          const sortedHist = [...hist].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

          // Predicted ENT score (weighted average of last 15 tests → ×1.4)
          const regular = sortedHist.filter(t => t.type !== 'fullent' && t.sc != null);
          let predictedScore = null;
          if (regular.length >= 3) {
            const recent = regular.slice(-15);
            let wSum = 0, wTot = 0;
            for (let i = 0; i < recent.length; i++) {
              const w = 1 + (i / recent.length);
              wSum += (recent[i].sc || 0) * w;
              wTot += w;
            }
            predictedScore = Math.round((wSum / wTot) * 1.4);
          }

          // Topic-level weak spots (from last 20 tests with qd, sorted)
          const topicMap = {};
          const recentWithQd = sortedHist.filter(h => h.qd?.length).slice(-20);
          for (const h of recentWithQd) {
            for (const q of h.qd) {
              if (!q.tp) continue;
              if (!topicMap[q.tp]) topicMap[q.tp] = { correct: 0, total: 0 };
              topicMap[q.tp].total++;
              if (q.ok) topicMap[q.tp].correct++;
            }
          }
          // Bottom 5 weakest topics (min 3 questions attempted)
          const weakTopics = Object.entries(topicMap)
            .filter(([, v]) => v.total >= 3)
            .map(([tp, v]) => ({ tp, correct: v.correct, total: v.total, pct: Math.round((v.correct / v.total) * 100) }))
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 5);

          // Per-subject breakdown
          const bySubject = {};
          for (const h of hist) {
            if (!bySubject[h.su]) bySubject[h.su] = { tests: 0, correct: 0, total: 0, scores: [] };
            bySubject[h.su].tests++;
            bySubject[h.su].correct += h.co || 0;
            bySubject[h.su].total += h.to || 0;
            bySubject[h.su].scores.push(h.sc || 0);
          }
          // Average scores per subject + growth (first 3 vs latest 3)
          for (const subKey of Object.keys(bySubject)) {
            const s = bySubject[subKey];
            s.avgScore = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
            if (s.scores.length >= 3) {
              const first3 = s.scores.slice(0, 3);
              const latest3 = s.scores.slice(-3);
              s.firstAvg = Math.round(first3.reduce((a, b) => a + b, 0) / first3.length);
              s.latestAvg = Math.round(latest3.reduce((a, b) => a + b, 0) / latest3.length);
              s.growth = s.latestAvg - s.firstAvg;
            }
            delete s.scores;
          }

          // Overall growth: first 3 tests avg vs latest 3
          let growth = null;
          if (hist.length >= 3) {
            const sorted = [...hist].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
            const first3 = sorted.slice(0, 3);
            const latest3 = sorted.slice(-3);
            const firstAvg = Math.round(first3.reduce((s, h) => s + (h.sc || 0), 0) / first3.length);
            const latestAvg = Math.round(latest3.reduce((s, h) => s + (h.sc || 0), 0) / latest3.length);
            growth = latestAvg - firstAvg;
          }

          return {
            id: sid,
            nickname: profile.nickname || "Ученик",
            avatar_url: profile.avatar_url,
            xp: profile.xp || 0,
            level: profile.level || 1,
            streak: profile.streak || 0,
            joined_at: member?.joined_at,
            totalTests,
            totalCorrect,
            totalQuestions,
            avgScore,
            lastActive,
            bySubject,
            growth,
            predictedScore,
            weakTopics,
          };
        });

        return Response.json({ class: cls, students }, { headers: CORS_HEADERS });
      }

      // ── Create class ────────────────────────────────────────────────
      case "create_class": {
        const body = await req.json();
        const { name, school } = body;
        if (!name || !school) return Response.json({ error: "name and school required" }, { status: 400, headers: CORS_HEADERS });

        // Check if teacher already has a class
        const existing = await sbGet("classes", `teacher_id=eq.${user.id}&select=id`);
        if (existing.length) return Response.json({ error: "У вас уже есть класс" }, { status: 409, headers: CORS_HEADERS });

        // Generate unique invite code (retry on collision)
        let invite_code;
        for (let attempt = 0; attempt < 5; attempt++) {
          invite_code = generateInviteCode();
          try {
            const result = await sbInsert("classes", {
              teacher_id: user.id,
              name: name.trim().slice(0, 20),
              school: school.trim().slice(0, 100),
              invite_code,
            });
            return Response.json({ class: result[0] }, { status: 201, headers: CORS_HEADERS });
          } catch (e) {
            if (e.status === 409) continue; // code collision, retry
            throw e;
          }
        }
        return Response.json({ error: "Failed to generate unique code" }, { status: 500, headers: CORS_HEADERS });
      }

      // ── Join class (student) ────────────────────────────────────────
      case "join_class": {
        const body = await req.json();
        const { code } = body;
        if (!code) return Response.json({ error: "code required" }, { status: 400, headers: CORS_HEADERS });

        const classes = await sbGet("classes", `invite_code=eq.${encodeURIComponent(code.trim().toUpperCase())}&select=id,name,school`);
        if (!classes.length) return Response.json({ error: "Класс не найден" }, { status: 404, headers: CORS_HEADERS });

        const cls = classes[0];

        try {
          await sbInsert("class_members", { class_id: cls.id, student_id: user.id });
        } catch (e) {
          if (e.status === 409) return Response.json({ class: cls, already: true }, { headers: CORS_HEADERS });
          throw e;
        }

        return Response.json({ class: cls, joined: true }, { status: 201, headers: CORS_HEADERS });
      }

      // ── Get student's class info ────────────────────────────────────
      case "my_class": {
        const memberships = await sbGet("class_members", `student_id=eq.${user.id}&select=class_id`);
        if (!memberships.length) return Response.json({ class: null }, { headers: CORS_HEADERS });

        const classId = memberships[0].class_id;
        const classes = await sbGet("classes", `id=eq.${classId}&select=name,school,invite_code`);

        return Response.json({ class: classes[0] || null }, { headers: CORS_HEADERS });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (err) {
    console.error(`Teacher API error [${action}]:`, err);
    return Response.json({ error: "Произошла ошибка. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
  }
}

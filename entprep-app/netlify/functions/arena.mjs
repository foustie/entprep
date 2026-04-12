// Arena API: multiplayer quiz sessions (Kahoot-style, up to 30 players)
// Actions: create, join, start, submit_answer, check_advance, get_state

import { randomBytes } from "node:crypto";
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
    method: "POST", headers: sbHeaders, body: JSON.stringify(Array.isArray(row) ? row : [row]),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbUpdate(table, filter, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: sbHeaders, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Rate limiters
const createLimit = createRateLimiter("arena_create", { max: 3, windowSec: 60 });
const joinLimit = createRateLimiter("arena_join", { max: 10, windowSec: 60 });
const answerLimit = createRateLimiter("arena_answer", { max: 60, windowSec: 60 });
const generalLimit = createRateLimiter("arena_general", { max: 30, windowSec: 60 });

// Fisher-Yates shuffle
function shuffle(arr) {
  const bytes = randomBytes(arr.length * 4);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = bytes.readUInt32BE(i * 4) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

function stripQuestions(questions) {
  return questions.map(q => ({ idx: q.idx, q: q.q, o: q.o, _topic: q.topic || null }));
}

// Speed bonus: faster answer = more bonus points
function calcSpeedBonus(answerTimeSec) {
  if (answerTimeSec < 5) return 3;
  if (answerTimeSec < 15) return 2;
  if (answerTimeSec < 25) return 1;
  return 0;
}

const QUESTION_TIME = 30; // seconds per question
const LEADERBOARD_TIME = 3; // seconds to show leaderboard
const VALID_COUNTS = [5, 10, 15];
const VALID_SUBJECTS = ["math","reading","history","geography","english","math_profile","physics","biology","chemistry","world_history","informatics","law","literature_russian","literature_kazakh"];

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  if (!SB_URL || !SB_KEY) return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS_HEADERS });

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const { action } = body;

  try {
    switch (action) {

      // ── Create Arena ────────────────────────────────────────────────
      case "create_arena": {
        const rl = createLimit(user.id);
        if (rl) return rateLimitResponse(rl);

        const { subject, question_count = 10 } = body;
        if (!subject || !VALID_SUBJECTS.includes(subject)) {
          return Response.json({ error: "Invalid subject" }, { status: 400, headers: CORS_HEADERS });
        }
        if (!VALID_COUNTS.includes(question_count)) {
          return Response.json({ error: "Invalid question count" }, { status: 400, headers: CORS_HEADERS });
        }

        // Pick random single-choice questions
        const passageRe = /(?:according to|based on|in the (?:text|passage)|прочитайте|на основе текста|по тексту|из текста)/i;
        const pool = await sbGet("questions",
          `select=idx,q,o,c,topic,type,passage_group,passage_title&subject=eq.${encodeURIComponent(subject)}&passage_group=is.null&passage_title=is.null&limit=500`
        );
        const singles = pool.filter(q =>
          (!q.type || q.type === "single") &&
          Array.isArray(q.o) && q.o.length >= 2 &&
          typeof q.c === "number" &&
          !passageRe.test(q.q)
        );
        if (singles.length < question_count) {
          return Response.json({ error: "Недостаточно вопросов" }, { status: 400, headers: CORS_HEADERS });
        }
        const questions = shuffle(singles).slice(0, question_count);

        // Generate unique code
        let code;
        for (let attempt = 0; attempt < 5; attempt++) {
          code = genCode();
          const existing = await sbGet("arenas", `select=id&code=eq.${code}&status=eq.lobby&limit=1`);
          if (existing.length === 0) break;
          if (attempt === 4) throw new Error("Failed to generate unique code");
        }

        const questionIds = questions.map(q => q.idx);

        const [arena] = await sbInsert("arenas", {
          code, subject, host_id: user.id,
          question_ids: questionIds, question_count,
        });

        // Add host as first player
        const profiles = await sbGet("profiles", `select=id,nickname,display_name,avatar_url,level&id=eq.${user.id}&limit=1`);
        const profile = profiles[0];

        await sbInsert("arena_players", {
          arena_id: arena.id, user_id: user.id,
          nickname: profile?.display_name || profile?.nickname || null,
          avatar_url: profile?.avatar_url || null,
        });

        return Response.json({
          arena_id: arena.id, code: arena.code,
          questions: stripQuestions(questions),
        }, { headers: CORS_HEADERS });
      }

      // ── Join Arena ──────────────────────────────────────────────────
      case "join_arena": {
        const rl = joinLimit(user.id);
        if (rl) return rateLimitResponse(rl);

        const { code } = body;
        if (!code || typeof code !== "string" || code.length !== 6) {
          return Response.json({ error: "Invalid code" }, { status: 400, headers: CORS_HEADERS });
        }

        const arenas = await sbGet("arenas", `select=*&code=eq.${code.toUpperCase()}&status=eq.lobby&limit=1`);
        if (arenas.length === 0) {
          return Response.json({ error: "Арена не найдена или уже началась" }, { status: 404, headers: CORS_HEADERS });
        }
        const arena = arenas[0];

        // Check expiry
        if (new Date(arena.expires_at) < new Date()) {
          await sbUpdate("arenas", `id=eq.${arena.id}`, { status: "expired" });
          return Response.json({ error: "Арена истекла" }, { status: 410, headers: CORS_HEADERS });
        }

        // Check player count
        const players = await sbGet("arena_players", `select=id&arena_id=eq.${arena.id}`);
        if (players.length >= arena.max_players) {
          return Response.json({ error: "Арена заполнена" }, { status: 409, headers: CORS_HEADERS });
        }

        // Add player (unique constraint prevents double-join)
        const profiles = await sbGet("profiles", `select=id,nickname,display_name,avatar_url,level&id=eq.${user.id}&limit=1`);
        const profile = profiles[0];

        try {
          await sbInsert("arena_players", {
            arena_id: arena.id, user_id: user.id,
            nickname: profile?.display_name || profile?.nickname || null,
            avatar_url: profile?.avatar_url || null,
          });
        } catch (e) {
          if (e.message.includes("duplicate") || e.message.includes("23505")) {
            // Already joined — that's fine
          } else throw e;
        }

        // Fetch questions
        const qIds = arena.question_ids;
        const questions = await sbGet("questions",
          `select=idx,q,o,topic&subject=eq.${encodeURIComponent(arena.subject)}&idx=in.(${qIds.join(",")})&limit=${qIds.length}`
        );
        const qMap = new Map(questions.map(q => [q.idx, q]));
        const ordered = qIds.map(idx => qMap.get(idx)).filter(Boolean);

        // Fetch all current players
        const allPlayers = await sbGet("arena_players",
          `select=user_id,nickname,avatar_url,score&arena_id=eq.${arena.id}&order=joined_at`
        );

        return Response.json({
          arena_id: arena.id, code: arena.code,
          subject: arena.subject, question_count: arena.question_count,
          host_id: arena.host_id,
          questions: stripQuestions(ordered),
          players: allPlayers,
        }, { headers: CORS_HEADERS });
      }

      // ── Start Arena (host only) ─────────────────────────────────────
      case "start_arena": {
        const { arena_id } = body;
        if (typeof arena_id !== "number") {
          return Response.json({ error: "Missing arena_id" }, { status: 400, headers: CORS_HEADERS });
        }

        const arenas = await sbGet("arenas", `select=*&id=eq.${arena_id}&limit=1`);
        if (arenas.length === 0) return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
        const arena = arenas[0];

        if (arena.host_id !== user.id) {
          return Response.json({ error: "Only host can start" }, { status: 403, headers: CORS_HEADERS });
        }
        if (arena.status !== "lobby") {
          return Response.json({ error: "Arena already started" }, { status: 400, headers: CORS_HEADERS });
        }

        const players = await sbGet("arena_players", `select=id&arena_id=eq.${arena.id}`);
        if (players.length < 2) {
          return Response.json({ error: "Нужно минимум 2 игрока" }, { status: 400, headers: CORS_HEADERS });
        }

        await sbUpdate("arenas", `id=eq.${arena.id}`, {
          status: "question_0",
          current_question: 0,
          question_started_at: new Date().toISOString(),
        });

        return Response.json({ ok: true, status: "question_0" }, { headers: CORS_HEADERS });
      }

      // ── Submit Answer ───────────────────────────────────────────────
      case "submit_answer": {
        const rl = answerLimit(user.id);
        if (rl) return rateLimitResponse(rl);

        const { arena_id, question_index, answer } = body;
        if (typeof arena_id !== "number" || typeof question_index !== "number") {
          return Response.json({ error: "Invalid params" }, { status: 400, headers: CORS_HEADERS });
        }

        const arenas = await sbGet("arenas", `select=*&id=eq.${arena_id}&limit=1`);
        if (arenas.length === 0) return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
        const arena = arenas[0];

        // Must be on current question
        if (arena.current_question !== question_index) {
          return Response.json({ error: "Wrong question" }, { status: 400, headers: CORS_HEADERS });
        }
        if (!arena.status.startsWith("question_")) {
          return Response.json({ error: "Not in question phase" }, { status: 400, headers: CORS_HEADERS });
        }

        // Get player
        const playerRows = await sbGet("arena_players",
          `select=*&arena_id=eq.${arena.id}&user_id=eq.${user.id}&limit=1`
        );
        if (playerRows.length === 0) return Response.json({ error: "Not in this arena" }, { status: 403, headers: CORS_HEADERS });
        const player = playerRows[0];

        // Check if already answered this question
        if (player.answers[String(question_index)] !== undefined) {
          return Response.json({ error: "Already answered" }, { status: 409, headers: CORS_HEADERS });
        }

        // Get correct answer
        const qIdx = arena.question_ids[question_index];
        const questions = await sbGet("questions",
          `select=idx,c&subject=eq.${encodeURIComponent(arena.subject)}&idx=eq.${qIdx}&limit=1`
        );
        if (questions.length === 0) return Response.json({ error: "Question not found" }, { status: 500, headers: CORS_HEADERS });

        const correctAnswer = questions[0].c;
        const correct = answer !== null && answer === correctAnswer;

        // Calculate speed bonus
        const elapsed = (Date.now() - new Date(arena.question_started_at).getTime()) / 1000;
        const speedBonus = correct ? calcSpeedBonus(elapsed) : 0;
        const points = correct ? 1 + speedBonus : 0;

        // Update player
        const newAnswers = { ...player.answers, [String(question_index)]: answer };
        const newTimes = { ...(player.answer_times || {}), [String(question_index)]: Math.round(elapsed * 10) / 10 };
        const newScore = player.score + points;

        await sbUpdate("arena_players", `id=eq.${player.id}`, {
          answers: newAnswers,
          score: newScore,
          answer_times: newTimes,
        });

        return Response.json({
          correct, correct_answer: correctAnswer,
          points, speed_bonus: speedBonus,
          your_score: newScore, elapsed: Math.round(elapsed * 10) / 10,
        }, { headers: CORS_HEADERS });
      }

      // ── Check & Advance ─────────────────────────────────────────────
      case "check_advance": {
        const rl = generalLimit(user.id);
        if (rl) return rateLimitResponse(rl);

        const { arena_id } = body;
        if (typeof arena_id !== "number") {
          return Response.json({ error: "Missing arena_id" }, { status: 400, headers: CORS_HEADERS });
        }

        const arenas = await sbGet("arenas", `select=*&id=eq.${arena_id}&limit=1`);
        if (arenas.length === 0) return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
        const arena = arenas[0];

        const players = await sbGet("arena_players",
          `select=user_id,answers,score,nickname,avatar_url&arena_id=eq.${arena.id}&order=score.desc`
        );

        // Currently showing a question
        if (arena.status.startsWith("question_")) {
          const qi = arena.current_question;
          const elapsed = (Date.now() - new Date(arena.question_started_at).getTime()) / 1000;
          const allAnswered = players.every(p => p.answers[String(qi)] !== undefined);

          if (allAnswered || elapsed >= QUESTION_TIME + 2) {
            // Move to leaderboard — use WHERE status= to prevent double-advance
            const updated = await sbUpdate("arenas", `id=eq.${arena.id}&status=eq.question_${qi}`, {
              status: `leaderboard_${qi}`,
            });
            if (!updated || updated.length === 0) {
              // Already advanced by another client
              const fresh = await sbGet("arenas", `select=status&id=eq.${arena.id}&limit=1`);
              return Response.json({ status: fresh[0]?.status || arena.status }, { headers: CORS_HEADERS });
            }
            return Response.json({
              status: `leaderboard_${qi}`,
              leaderboard: players.map(p => ({
                user_id: p.user_id, nickname: p.nickname,
                avatar_url: p.avatar_url, score: p.score,
              })),
            }, { headers: CORS_HEADERS });
          }

          // Not ready to advance yet
          const answeredCount = players.filter(p => p.answers[String(qi)] !== undefined).length;
          return Response.json({
            status: arena.status,
            answered: answeredCount, total: players.length,
          }, { headers: CORS_HEADERS });
        }

        // Currently showing leaderboard
        if (arena.status.startsWith("leaderboard_")) {
          const qi = parseInt(arena.status.split("_")[1]);
          const nextQ = qi + 1;

          if (nextQ >= arena.question_count) {
            // Game over
            await sbUpdate("arenas", `id=eq.${arena.id}`, { status: "finished" });
            return Response.json({
              status: "finished",
              leaderboard: players.map(p => ({
                user_id: p.user_id, nickname: p.nickname,
                avatar_url: p.avatar_url, score: p.score,
              })),
            }, { headers: CORS_HEADERS });
          }

          // Next question
          await sbUpdate("arenas", `id=eq.${arena.id}`, {
            status: `question_${nextQ}`,
            current_question: nextQ,
            question_started_at: new Date().toISOString(),
          });
          return Response.json({ status: `question_${nextQ}` }, { headers: CORS_HEADERS });
        }

        // Return current state
        return Response.json({
          status: arena.status,
          leaderboard: players.map(p => ({
            user_id: p.user_id, nickname: p.nickname,
            avatar_url: p.avatar_url, score: p.score,
          })),
        }, { headers: CORS_HEADERS });
      }

      // ── Get Arena State ─────────────────────────────────────────────
      case "get_state": {
        const rl = generalLimit(user.id);
        if (rl) return rateLimitResponse(rl);

        const { arena_id } = body;
        if (typeof arena_id !== "number") {
          return Response.json({ error: "Missing arena_id" }, { status: 400, headers: CORS_HEADERS });
        }

        const arenas = await sbGet("arenas", `select=*&id=eq.${arena_id}&limit=1`);
        if (arenas.length === 0) return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
        const arena = arenas[0];

        const players = await sbGet("arena_players",
          `select=user_id,nickname,avatar_url,score,answers&arena_id=eq.${arena.id}&order=score.desc`
        );

        return Response.json({
          arena: {
            id: arena.id, code: arena.code, status: arena.status,
            subject: arena.subject, host_id: arena.host_id,
            current_question: arena.current_question,
            question_count: arena.question_count,
            question_started_at: arena.question_started_at,
          },
          players: players.map(p => ({
            user_id: p.user_id, nickname: p.nickname,
            avatar_url: p.avatar_url, score: p.score,
            answered_current: p.answers[String(arena.current_question)] !== undefined,
          })),
        }, { headers: CORS_HEADERS });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (err) {
    console.error("Arena action error:", action, err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/arena" };

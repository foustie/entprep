/**
 * Study-plan AI "focus" endpoint (Phase 4).
 *
 * Adds a short AI-written weekly FOCUS line + a few task-title TIPS on top of the
 * deterministic rule-based plan produced client-side by utils/studyPlanGenerator.
 * This is purely ADDITIVE and GRACEFUL: the plan already renders without it, so on
 * any failure (AI unavailable / not configured / bad JSON / network) this endpoint
 * returns `{ weeks: [] }` with status 200 and NEVER blocks the plan.
 *
 * Provider-agnostic via utils/ai.mjs (OpenRouter Qwen by default, reasoning off).
 * Long plans (> 14 weeks) are chunked into 2-3 sequential calls and merged so a
 * single response can't overflow max_tokens.
 */

import {
  corsResponse,
  CORS_HEADERS,
  verifyAuth,
  createRateLimiter,
  rateLimitResponse,
} from "./utils/shared.mjs";
import { callAI, aiConfigured } from "./utils/ai.mjs";
import { parseLooseJson, sanitizeMath } from "./utils/text.mjs";

// Max weeks per AI call. Plans longer than this are chunked (sequential) so the
// minified JSON response can't overflow max_tokens (worst on token-dense Kazakh).
export const MAX_WEEKS_PER_CALL = 14;

const checkRate = createRateLimiter("focus", { max: 5, windowSec: 60 });

const VALID_TRENDS = new Set(["improving", "declining", "stable", "none"]);
const VALID_PHASES = new Set(["foundation", "build", "review"]);

// Strip prompt-injection / structural chars from any user-provided text field.
const sanitizeText = (s) => (typeof s === "string" ? s.replace(/[{}[\]<>]/g, "").slice(0, 80) : "");
const sanitizeNum = (n) =>
  typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
// Target is an ENT goal score (80-140) — must NOT be clamped to the 0-100 pct range.
const sanitizeTarget = (n) =>
  typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(200, Math.round(n))) : 0;

// ── Input validation ──────────────────────────────────────────────────────────

export function validateFocusInput(body) {
  if (!body || typeof body !== "object") return "Invalid body";
  const { lang, target, examDate, weeks, weak, strong } = body;
  if (lang !== "ru" && lang !== "kk") return "Invalid lang";
  if (typeof target !== "number" || target < 80 || target > 140) return "Invalid target";
  if (typeof examDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(examDate)) return "Invalid examDate";
  if (!Array.isArray(weeks) || weeks.length < 2 || weeks.length > 26) return "Invalid weeks";
  for (const w of weeks) {
    if (!w || typeof w.weekNum !== "number") return "Invalid week";
    if (!VALID_PHASES.has(w.phase)) return "Invalid week phase";
    if (!Array.isArray(w.subjects) || !Array.isArray(w.topics)) return "Invalid week subjects/topics";
  }
  if (!Array.isArray(weak)) return "Invalid weak";
  if (!Array.isArray(strong)) return "Invalid strong";
  return null;
}

// ── Prompt building ───────────────────────────────────────────────────────────

function trendWord(trend, isKk) {
  const t = VALID_TRENDS.has(trend) ? trend : "stable";
  if (isKk) return t === "declining" ? "төмендеп барады" : t === "improving" ? "өсіп келеді" : "тұрақты";
  return t === "declining" ? "падает" : t === "improving" ? "растёт" : "стабильно";
}

/**
 * Build the { system, user } messages for one batch of weeks. All student text is
 * sanitized + length-capped before interpolation.
 */
export function buildFocusMessages({ lang, target, examDate, weeks, weak, strong }) {
  const isKk = lang === "kk";

  const weeksText = (weeks || [])
    .map((w) => {
      const subs = (w.subjects || []).map(sanitizeText).filter(Boolean).slice(0, 8).join(", ") || "—";
      const tops = (w.topics || []).map(sanitizeText).filter(Boolean).slice(0, 8).join(", ") || "—";
      const phase = sanitizeText(w.phase);
      return isKk
        ? `Апта ${Number(w.weekNum)} (${phase}): пәндер ${subs}; тақырыптар ${tops}`
        : `Неделя ${Number(w.weekNum)} (${phase}): предметы ${subs}; темы ${tops}`;
    })
    .join("\n");

  const weakText = (weak || [])
    .slice(0, 12)
    .map((s) =>
      isKk
        ? `${sanitizeText(s.name)}: орташа ${sanitizeNum(s.avg)}%, ${trendWord(s.trend, true)}`
        : `${sanitizeText(s.name)}: средний ${sanitizeNum(s.avg)}%, тренд ${trendWord(s.trend, false)}`,
    )
    .join("\n");

  const strongText = (strong || [])
    .slice(0, 12)
    .map((s) => `${sanitizeText(s.name)}: ${sanitizeNum(s.avg)}%`)
    .join(", ");

  const system = isKk
    ? `Сен ҰБТ (Ұлттық бірыңғай тестілеу, Қазақстан) репетиторысың. Оқушының апталық дайындық жоспарына әр аптаға қысқа "фокус" пен бірнеше кеңес жаз. Қазақ тілінде жаз.

Тек минифицирленген JSON қайтар (markdown-сыз, LaTeX-сіз, $ белгісінсіз, бір жолда):
{"weeks":[{"weekNum":1,"focus":"1-2 сөйлем — осы аптаның басты мақсаты","tips":[{"text":"Қысқа тапсырма атауы"}]}]}

Ережелер:
- Әр аптаға 2-3 кеңес (tips), әрқайсысы — қысқа тапсырма атауы (бір жолдық), сөйлем емес.
- focus — 1-2 сөйлем, осы аптаның фазасы мен әлсіз жерлерге сай.
- Берілген апта нөмірлерін ғана қолдан, жаңа апта ойлап таппа.
- Қарапайым мәтін: формула, markdown, эмодзи жоқ.`
    : `Ты репетитор ЕНТ (Единое национальное тестирование, Казахстан). Для недельного плана подготовки напиши краткий «фокус» и несколько советов на каждую неделю. Пиши на русском языке.

Верни ТОЛЬКО минифицированный JSON (без markdown, без LaTeX, без знаков $, одной строкой):
{"weeks":[{"weekNum":1,"focus":"1-2 предложения — главная цель этой недели","tips":[{"text":"Короткое название задачи"}]}]}

Правила:
- На каждую неделю 2-3 совета (tips), каждый — короткое название задачи (одна строка), а не предложение.
- focus — 1-2 предложения, с учётом фазы недели и слабых мест.
- Используй только переданные номера недель, не придумывай новые.
- Обычный текст: без формул, markdown и эмодзи.`;

  const user = isKk
    ? `Оқушы туралы:
Мақсат балл: ${sanitizeTarget(target)}
Емтихан күні: ${examDate.slice(0, 10)}

Әлсіз пәндер:
${weakText || "деректер жоқ"}

Күшті пәндер: ${strongText || "деректер жоқ"}

Апталар:
${weeksText}`
    : `Об ученике:
Целевой балл: ${sanitizeTarget(target)}
Дата экзамена: ${examDate.slice(0, 10)}

Слабые предметы:
${weakText || "нет данных"}

Сильные предметы: ${strongText || "нет данных"}

Недели:
${weeksText}`;

  return { system, user };
}

// ── Response parsing / validation ─────────────────────────────────────────────

/**
 * Parse a Qwen focus response defensively. Runs parseLooseJson (strips fences,
 * sanitizes leaked LaTeX, escapes stray backslashes) + sanitizeMath on every text
 * field. Throws on genuinely malformed JSON / shape so the caller can retry.
 * Returns { weeks: [{ weekNum, focus, tips: [{ text, subject:null, topic:null }] }] }.
 */
export function parseFocusResponse(text) {
  const parsed = parseLooseJson(text);
  if (!parsed || !Array.isArray(parsed.weeks)) throw new Error("bad_shape");
  const weeks = [];
  for (const w of parsed.weeks) {
    if (!w || typeof w.weekNum !== "number") continue;
    const focus = sanitizeMath(w.focus == null ? "" : String(w.focus)).trim().slice(0, 300);
    const rawTips = Array.isArray(w.tips) ? w.tips : [];
    const tips = [];
    for (const tp of rawTips.slice(0, 6)) {
      const raw = tp && typeof tp === "object" ? tp.text : tp;
      const txt = sanitizeMath(raw == null ? "" : String(raw)).trim().slice(0, 160);
      if (txt) tips.push({ text: txt, subject: null, topic: null });
    }
    weeks.push({ weekNum: w.weekNum, focus, tips });
  }
  return { weeks };
}

// ── Chunking + merging ────────────────────────────────────────────────────────

/** Split weeks into chunks of <= `size`, balanced into 2-3 near-equal batches. */
export function chunkWeeks(weeks, size = MAX_WEEKS_PER_CALL) {
  if (!Array.isArray(weeks) || weeks.length <= size) return [weeks || []];
  const batches = Math.ceil(weeks.length / size); // 2 or 3
  const per = Math.ceil(weeks.length / batches);
  const out = [];
  for (let i = 0; i < weeks.length; i += per) out.push(weeks.slice(i, i + per));
  return out;
}

/** Merge several parsed { weeks } responses into one (first weekNum wins, sorted). */
export function mergeFocusResponses(parts) {
  const byNum = new Map();
  for (const p of parts || []) {
    for (const w of (p && p.weeks) || []) {
      if (!byNum.has(w.weekNum)) byNum.set(w.weekNum, w);
    }
  }
  return { weeks: Array.from(byNum.values()).sort((a, b) => a.weekNum - b.weekNum) };
}

/**
 * Canonical client-side merge contract (also implemented inline in Adaptive.tsx):
 * set Week.focus and prepend one display-only `tip` StudyTask per focus tip.
 * Pure — exported for unit-testing the merge shape without server deps.
 */
export function mergeFocusIntoWeeks(planWeeks, focusWeeks) {
  const byNum = new Map((focusWeeks || []).map((w) => [w.weekNum, w]));
  return (planWeeks || []).map((week) => {
    const f = byNum.get(week.weekNum);
    if (!f) return week;
    const tipTasks = (f.tips || []).map((tip, m) => ({
      id: `week_${week.weekNum}_tip_${m}`,
      date: week.startDate,
      type: "tip",
      subject: undefined,
      topic: undefined,
      title: tip.text,
      durationMin: 3,
      premium: false,
    }));
    return { ...week, focus: f.focus || week.focus, tasks: [...tipTasks, ...week.tasks] };
  });
}

// ── AI call (retry once) ──────────────────────────────────────────────────────

async function callFocusBatch({ lang, target, examDate, weeks, weak, strong }) {
  const { system, user } = buildFocusMessages({ lang, target, examDate, weeks, weak, strong });
  async function attempt() {
    const ai = await callAI({
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 3000,
      temperature: 0.5,
    });
    if (!ai.ok) throw new Error("ai_unavailable");
    return parseFocusResponse(ai.text); // throws on bad JSON → triggers retry
  }
  try {
    return await attempt();
  } catch {
    return await attempt(); // one retry; a second failure bubbles to the graceful handler
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const retryAfter = checkRate(user.id);
  if (retryAfter) return rateLimitResponse(retryAfter);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const err = validateFocusInput(body);
  if (err) return Response.json({ error: err }, { status: 400, headers: CORS_HEADERS });

  // GRACEFUL: focus is optional polish on top of an already-rendered plan. If AI is
  // not configured, never error — just return empty focus so the client moves on.
  if (!aiConfigured()) return Response.json({ weeks: [] }, { status: 200, headers: CORS_HEADERS });

  const { lang, target, examDate, weeks, weak, strong } = body;

  try {
    const batches = chunkWeeks(weeks);
    const parts = [];
    for (const batch of batches) {
      parts.push(await callFocusBatch({ lang, target, examDate, weeks: batch, weak, strong }));
    }
    return Response.json(mergeFocusResponses(parts), { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    // GRACEFUL: any AI / parse failure → empty focus, status 200. NEVER block.
    console.warn("study-plan-focus: returning empty focus —", e?.message);
    return Response.json({ weeks: [] }, { status: 200, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/study-plan-focus" };

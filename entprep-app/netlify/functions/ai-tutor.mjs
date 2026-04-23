// AI Tutor: Socratic method, personalized, caring, RAG-powered
// Streaming response for fast UX

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, checkPremium } from "./utils/shared.mjs";
import { ANTHROPIC_API_URL, VALID_SUBJECTS } from "./utils/constants.mjs";

// Sonnet for tutor — smarter, better Socratic reasoning
const TUTOR_MODEL = "claude-sonnet-4-20250514";

// Free tier matches client-side limit in src/utils/aiLimits.ts (DAILY_TUTOR_LIMIT)
// so cheaters who clear localStorage hit the same ceiling as honest users.
const TUTOR_FREE_DAILY = 10;
const TUTOR_PREMIUM_DAILY = 50;

// Single shared bucket — tier cap is applied per-request via maxOverride.
// This prevents free→premium (or premium→free) transitions mid-window from resetting the counter.
const checkRate = createRateLimiter("tutor", { max: TUTOR_PREMIUM_DAILY, windowSec: 86400 });

const SITE_URL = process.env.URL || "https://entprep.org";
const summaryCache = new Map();

async function fetchSummary(sid, topicId, lang) {
  if (!sid || !topicId) return "";
  const cacheKey = `${sid}:${topicId}:${lang || 'ru'}`;
  if (summaryCache.has(cacheKey)) return summaryCache.get(cacheKey);

  try {
    const subjectKey = `_subject:${sid}`;
    let all = summaryCache.get(subjectKey);
    if (!all) {
      const res = await fetch(`${SITE_URL}/data/summaries/${sid}.json`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
        summaryCache.set(cacheKey, ""); return "";
      }
      all = await res.json();
      summaryCache.set(subjectKey, all);
    }
    const entry = all[topicId];
    if (!entry) { summaryCache.set(cacheKey, ""); return ""; }
    const text = (lang === 'kk' && entry.kk) ? entry.kk : entry.ru || "";
    const trimmed = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
    summaryCache.set(cacheKey, trimmed);
    return trimmed;
  } catch {
    summaryCache.set(cacheKey, ""); return "";
  }
}

function buildSystemPrompt(profile, summary, lang, mode) {
  const isKk = lang === 'kk';
  const sanitize = (s) => String(s || '').replace(/[\n\r`]/g, ' ').slice(0, 100);
  const weakList = (profile?.weakTopics || []).slice(0, 5).map(w => `${sanitize(w.name)} (${Math.round(w.pct || 0)}%)`).join(', ');

  const modeInstructions = {
    chat: 'Веди свободную беседу.',
    explain: 'Объясни тему используя Сократовский метод. Задавай вопросы.',
    quiz: 'Задай 5 вопросов по теме. После ответа — объяснение.',
    plan: 'Составь план подготовки на основе слабых тем.',
    errors: 'Проанализируй паттерн ошибок и объясни как исправить.',
    support: 'Ученик нервничает. Поддержи. Практические советы + вера в него.',
  };

  return `${isKk ? 'Сен ҰБТ репетиторысың. Қазақша жауап бер.' : 'Ты репетитор ЕНТ. Отвечай на русском.'}

СТИЛЬ: Тёплый, терпеливый. Сократовский метод — СПРАШИВАЙ, не давай готовых ответов.
${weakList ? `Слабые темы ученика: ${weakList}` : ''}
${profile?.prediction ? `Прогноз: ${Math.round(Number(profile.prediction) || 0)}/140` : ''}
${summary ? `\nКОНСПЕКТ:\n${summary}` : ''}

${modeInstructions[mode] || modeInstructions.chat}

Будь КРАТОК: 2-3 абзаца макс. Используй **жирный** для акцентов. Формулы текстом.
Отвечай из своих знаний. Если дан конспект — используй как справочник. Если не уверен в чём-то специфичном для ЕНТ — честно скажи "я не уверен, лучше проверь в учебнике".`;
}

const STREAM_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const isPremium = await checkPremium(user.id);
  const dailyLimit = isPremium ? TUTOR_PREMIUM_DAILY : TUTOR_FREE_DAILY;

  const retryAfter = checkRate(user.id, dailyLimit);
  if (retryAfter) return Response.json({
    error: `Лимит сообщений на сегодня исчерпан. Завтра у тебя будет ещё ${dailyLimit} — ты справишься!`,
  }, { status: 429, headers: CORS_HEADERS });

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const { messages, profile, subject, topicId, lang, mode, stream } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400, headers: CORS_HEADERS });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "AI not configured" }, { status: 500, headers: CORS_HEADERS });

  // Fetch summary (parallel-safe, cached after first call)
  const summary = await fetchSummary(subject, topicId, lang);
  const systemPrompt = buildSystemPrompt(profile, summary, lang, mode || 'chat');

  const recentMessages = messages.slice(-8).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: typeof m.content === 'string' ? m.content : String(m.content),
  }));

  // Streaming mode
  if (stream) {
    try {
      const aiRes = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: TUTOR_MODEL,
          max_tokens: 600,
          temperature: 0.7,
          stream: true,
          system: systemPrompt,
          messages: recentMessages,
        }),
      });

      if (!aiRes.ok) {
        return Response.json({ error: "AI временно недоступен" }, { status: 500, headers: CORS_HEADERS });
      }

      // Pass through the SSE stream
      return new Response(aiRes.body, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return Response.json({ error: "AI service unavailable" }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // Non-streaming fallback
  try {
    const aiRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: TUTOR_MODEL,
        max_tokens: 600,
        temperature: 0.7,
        system: systemPrompt,
        messages: recentMessages,
      }),
    });

    if (!aiRes.ok) {
      return Response.json({ error: "AI временно недоступен" }, { status: 500, headers: CORS_HEADERS });
    }

    const data = await aiRes.json();
    const text = data.content?.[0]?.text?.trim() || "";
    return Response.json({ text }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ error: "AI service unavailable" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/ai-tutor" };

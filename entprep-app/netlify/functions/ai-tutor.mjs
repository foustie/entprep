// AI Tutor: Socratic method, personalized, caring, RAG-powered
// Streaming response for fast UX

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, checkPremium } from "./utils/shared.mjs";
import { callAI, aiConfigured, buildAIRequest } from "./utils/ai.mjs";

// Free tier matches client-side limit in src/utils/aiLimits.ts (DAILY_TUTOR_LIMIT)
// so cheaters who clear localStorage hit the same ceiling as honest users.
const TUTOR_FREE_DAILY = 10;
const TUTOR_PREMIUM_DAILY = 50;

// Single shared bucket — tier cap is applied per-request via maxOverride.
// This prevents free→premium (or premium→free) transitions mid-window from resetting the counter.
const checkRate = createRateLimiter("tutor", { max: TUTOR_PREMIUM_DAILY, windowSec: 86400 });

// Vision turns cost ~10x a text turn — a separate daily sub-cap (premium-only) on
// top of the text cap bounds image spend. Counts only image-bearing requests.
const VISION_DAILY = 20;
const checkVisionRate = createRateLimiter("tutor-vision", { max: VISION_DAILY, windowSec: 86400 });

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
    chat: 'Свободная беседа. По тексту сообщения пойми, что нужно ученику: объяснить/дать конспект, решить задачу или просто поговорить — и действуй по ГЛАВНОМУ ПРИНЦИПУ ниже.',
    explain: 'Запрос на объяснение/конспект. Сразу дай полное объяснение по СТРУКТУРЕ ОБЪЯСНЕНИЯ. Не начинай со встречных вопросов.',
    quiz: 'Задавай по ОДНОМУ вопросу за раз (до 5). После каждого ответа — короткий разбор: верно или нет и почему.',
    plan: 'Составь конкретный план по слабым темам: что, в каком порядке, сколько времени. В конце спроси, с чего начнём.',
    errors: 'Разбери паттерн ошибок: где именно ошибка, почему возникает, как не повторять. Дай правило и один короткий пример с числами.',
    support: 'Ученик нервничает. Сначала поддержи по-человечески, потом дай 2-3 практических шага и закончи верой в него. Без формата разбора.',
  };

  return `${isKk
    ? 'Сен — Дияр, ҰБТ-ға дайындайтын AI-репетиторсың. ТЕК қазақша жауап бер. Төмендегі барлық ережелер қазақша жауапқа да қолданылады.'
    : 'Ты — Дияр, AI-репетитор по подготовке к ЕНТ. Отвечай на русском; если ученик пишет на казахском — переходи на казахский.'}

ГЛАВНЫЙ ПРИНЦИП — СНАЧАЛА НАУЧИ, ПОТОМ СПРОСИ.
Когда ученик просит объяснить тему, разобрать, рассказать или дать конспект — ты СРАЗУ даёшь полное понятное объяснение своими словами. Когда просит решить задачу — решаешь пошагово с числами до ответа. Никогда не отвечай на просьбу объяснить встречным вопросом и не выпытывай, что ученик уже знает. Проверочный вопрос — ровно ОДИН и только в самом конце.

СТРУКТУРА ОБЪЯСНЕНИЯ / КОНСПЕКТА:
1. Суть — 1-2 фразы простыми словами: главная идея.
2. Ключевые пункты — 3-5 пунктов списком: что обязательно знать к ЕНТ.
3. Формула или пример — конкретный, с числами и пошаговым разбором. Математику и физику ВСЕГДА считай по шагам, а не словами. Для гуманитарных тем — один конкретный пример (дата, имя, событие).
4. Один проверочный вопрос в конце — лёгкий, чтобы применить тему. Только один.
${isKk ? 'Қазақша жауапта тақырыпшаларды аудар: Мәні / Негізгісі / Формула немесе мысал / Сұрақ.' : ''}

ЧЕСТНОСТЬ (ВАЖНО):
- НИКОГДА не говори, что уже дал конспект, объяснение или ответ, если в ЭТОМ диалоге ты его не давал. Не ссылайся на несуществующие прошлые сообщения. Просят — дай прямо сейчас.
- Не уверен в факте, дате или формуле — честно скажи «тут лучше перепроверь в учебнике», но всё равно дай свою лучшую версию.

СТИЛЬ:
- Тёплый и спокойный, как друг, который шарит в предмете. Без воды и канцелярита.
- Кратко по форме, но полно по сути: реальное содержание, не отписка. Обычно 150-250 слов, без стен текста.
- **Жирным** выделяй главное. Формулы и расчёты пиши ОБЫЧНЫМ текстом и Unicode-символами (², ³, √, π, ×, ÷, ≈, →). ЗАПРЕЩЕНО использовать LaTeX и знаки $ \\frac \\text \\times — только простой текст, например: «4 см × 200000 = 800000 см = 8 км».
- Лёгкие уточняющие вопросы можно, но ТОЛЬКО после того как объяснил суть. Сначала ответ — потом, при желании, один вопрос. Никогда не прячь основной ответ за вопросами.
${weakList ? `\nСлабые темы ученика: ${weakList}` : ''}${profile?.prediction ? `\nПрогноз ЕНТ: ${Math.round(Number(profile.prediction) || 0)}/140` : ''}${summary ? `\n\nСПРАВОЧНЫЙ КОНСПЕКТ (опирайся как на источник, но переформулируй своими словами по структуре выше — НЕ зачитывай дословно и НЕ выдавай за «уже отправленный»):\n${summary}` : ''}

РЕЖИМ: ${modeInstructions[mode] || modeInstructions.chat}

Если ученик прислал скрин теста — не давай готовый ответ, а разбери логику решения, чтобы он понял, а не списал.`;
}

const STREAM_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

// ── Vision ────────────────────────────────────────────────────────────────────
// Server-side guard: client size/MIME checks are bypassable on a paid backend.
// Accept only jpeg/png/webp base64 data URLs (heic/heif dropped — unreliable OCR),
// and reject payloads decoding to more than ~5MB.
const MAX_IMG_BYTES = 5 * 1024 * 1024;
export function isVisionDataUrl(u) {
  if (typeof u !== "string") return false;
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(u);
  return !!m && (m[2].length * 3) / 4 <= MAX_IMG_BYTES;
}

// Map raw client messages to provider-ready messages. A user message carrying
// valid images becomes an OpenAI-style multimodal content array (text + image_url
// parts); everything else stays a plain string. Returns hasImage so the caller can
// reinforce "solve from the photo" in the system prompt for the current turn.
export function buildRecentMessages(messages, { allowImages = true } = {}) {
  let hasImage = false;
  const recentMessages = messages.slice(-8).map(m => {
    const role = m.role === "user" ? "user" : "assistant";
    const text = typeof m.content === "string" ? m.content : String(m.content ?? "");
    const imgs = allowImages && role === "user" && Array.isArray(m.images) ? m.images.filter(isVisionDataUrl).slice(0, 4) : [];
    if (imgs.length) {
      hasImage = true;
      return {
        role,
        content: [
          ...(text ? [{ type: "text", text }] : []),
          ...imgs.map(url => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }
    return { role, content: text };
  });
  return { recentMessages, hasImage };
}

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

  if (!aiConfigured()) return Response.json({ error: "AI not configured" }, { status: 500, headers: CORS_HEADERS });

  // Fetch summary (parallel-safe, cached after first call)
  const summary = await fetchSummary(subject, topicId, lang);
  // Vision is a premium feature — enforce server-side (camera is client-gated only,
  // so a non-premium user could POST images directly to the expensive vision path).
  const { recentMessages, hasImage } = buildRecentMessages(messages, { allowImages: isPremium });

  // Vision-specific daily sub-cap (only image-bearing turns count toward it).
  if (hasImage) {
    const vRetry = checkVisionRate(user.id);
    if (vRetry) return Response.json({
      error: lang === 'kk'
        ? 'Бүгінге сурет бойынша талдау лимиті бітті. Ертең қайтадан!'
        : 'Лимит разборов по фото на сегодня исчерпан. Завтра снова!',
    }, { status: 429, headers: CORS_HEADERS });
  }

  const systemPrompt = buildSystemPrompt(profile, summary, lang, mode || 'chat')
    + (hasImage ? '\n\nНа фото — задача ученика: прочитай условие с изображения и реши пошагово с числами до финального ответа.' : '');

  // Streaming mode (currently unused: client forces stream:false because Netlify
  // buffers SSE — see tutorHelpers.ts. Kept provider-correct in case it's re-enabled.
  // NOTE: the passed-through SSE is the active provider's native event format.)
  if (stream) {
    try {
      const { url, headers, body } = buildAIRequest({
        system: systemPrompt,
        messages: recentMessages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true,
      });
      const aiRes = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

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

  // Non-streaming (the live path)
  try {
    const ai = await callAI({
      system: systemPrompt,
      messages: recentMessages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    if (!ai.ok) {
      return Response.json({ error: "AI временно недоступен" }, { status: 500, headers: CORS_HEADERS });
    }

    return Response.json({ text: ai.text }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ error: "AI service unavailable" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/ai-tutor" };

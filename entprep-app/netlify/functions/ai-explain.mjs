import { corsResponse, CORS_HEADERS, verifyAuth, createRateLimiter, rateLimitResponse, validateExplain, checkPremium } from "./utils/shared.mjs";
import { callAI, aiConfigured } from "./utils/ai.mjs";
import { getContext } from "./utils/rag.mjs";

const checkRate = createRateLimiter("explain", { max: 30, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  // Auth
  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  // AI explanations now free for all authenticated users (rate-limited below)

  // Rate limit
  const retryAfter = checkRate(user.id);
  if (retryAfter) return rateLimitResponse(retryAfter);

  // Parse + validate
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS }); }

  const err = validateExplain(body);
  if (err) return Response.json({ error: err }, { status: 400, headers: CORS_HEADERS });

  const { question, options, userAnswer, correctAnswer, explanation, questionType, pairs, lang, subject } = body;

  // AI provider key (OpenRouter by default — see utils/ai.mjs)
  if (!aiConfigured()) return Response.json({ error: "AI not configured" }, { status: 500, headers: CORS_HEADERS });

  // RAG: fetch textbook context for supported subjects
  const ragContext = subject ? await getContext(subject, question).catch(() => null) : null;

  // Build prompt text based on question type
  const qType = questionType || 'single';
  let userContent;

  if (qType === 'matching' && pairs) {
    const pairsText = pairs.map((p, i) => `${i + 1}) ${p[0]} — ${p[1]}`).join("\n");
    const userPairsText = typeof userAnswer === 'object' && userAnswer !== null
      ? Object.entries(userAnswer).map(([li, ri]) => `${pairs[li]?.[0] || '?'} → ${pairs[ri]?.[1] || '?'}`).join(", ")
      : "пропущен";
    userContent = `Вопрос на соответствие: ${question}\n\nПравильные пары:\n${pairsText}\n\nУченик сопоставил: ${userPairsText}\n\nКраткое пояснение: ${explanation || "нет"}`;
  } else if (qType === 'multiple') {
    const optionsText = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
    const correctArr = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const userArr = Array.isArray(userAnswer) ? userAnswer : [];
    const userAnsText = userArr.length > 0 ? userArr.map(i => options[i]).join(", ") : "пропущен";
    const correctAnsText = correctArr.map(i => options[i]).join(", ");
    userContent = `Вопрос с множественным выбором: ${question}\n\nВарианты:\n${optionsText}\n\nУченик выбрал: ${userAnsText}\nПравильные ответы: ${correctAnsText}\n\nКраткое пояснение: ${explanation || "нет"}`;
  } else {
    const optionsText = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
    const userAnsText = userAnswer !== undefined && userAnswer !== null ? options[userAnswer] : "пропущен";
    const correctIdx = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer;
    const correctAnsText = options[correctIdx];
    userContent = `Вопрос: ${question}\n\nВарианты:\n${optionsText}\n\nУченик ответил: ${userAnsText}\nПравильный ответ: ${correctAnsText}\n\nКраткое пояснение: ${explanation || "нет"}`;
  }

  // Append textbook context if available
  if (ragContext) {
    userContent += `\n\n--- КОНТЕКСТ ИЗ УЧЕБНИКА ---\n${ragContext}`;
  }

  const isKk = lang === 'kk';
  const systemPrompt = isKk
    ? 'Сен ҰБТ (Ұлттық бірыңғай тестілеу, Қазақстан) репетиторысың. Қазақ тілінде жауап бер. Сұрақ мәтінін қайталама. Markdown-сыз қатаң JSON қайтар: {"short":"1 сөйлем — неге бұл жауап дұрыс","detailed":"3-5 сөйлем — толық талдау, оқушы қателессе — қатені түсіндір, қарапайым тілмен"}'
    : 'Ты репетитор ЕНТ (Единое национальное тестирование, Казахстан). Ответь на русском. Не повторяй текст вопроса. Верни строго JSON без markdown: {"short":"1 предложение — суть почему этот ответ правильный","detailed":"3-5 предложений — подробный разбор, если ученик ошибся — объясни ошибку, простым языком"}';

  try {
    const ai = await callAI({
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      max_tokens: 500,
      temperature: 0.7,
    });

    if (!ai.ok) {
      console.error("AI error:", ai.status, ai.errorText);
      return Response.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
    }

    let raw = ai.text;
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const parsed = JSON.parse(raw);
      return Response.json({ short: parsed.short || raw, detailed: parsed.detailed || raw }, { headers: CORS_HEADERS });
    } catch {
      return Response.json({ short: raw, detailed: raw }, { headers: CORS_HEADERS });
    }
  } catch (fetchErr) {
    console.error("AI fetch error:", fetchErr);
    return Response.json({ error: "AI service unavailable" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/ai-explain" };

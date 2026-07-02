import { corsResponse, CORS_HEADERS, verifyAuth, createRateLimiter, rateLimitResponse, validateExplain, checkPremium, checkDailyLimit, dailyLimitResponse } from "./utils/shared.mjs";
import { callAI, aiConfigured } from "./utils/ai.mjs";
import { getContext } from "./utils/rag.mjs";
import { STEM_SUBJECTS, getTemperature, getSTEMPrefix } from "./utils/constants.mjs";
import { parseLooseJson, sanitizeMath } from "./utils/text.mjs";

// Per-minute burst guard (in-memory, best-effort — OPS-7). Distinct from the durable
// daily free quota below.
const checkRate = createRateLimiter("explain", { max: 30, windowSec: 60 });

// PAY-9: free users get DAILY_EXPLAIN_FREE AI explanations/day, enforced SERVER-SIDE on the
// durable usage_limits store. The client cap in src/utils/aiLimits.ts (also 2/day) is
// bypassable by clearing localStorage; this closes that bypass at strict PARITY — an honest
// free user sees no change, only the bypass is blocked. Premium users are uncapped.
// Orchestrator-ratified (PAY-9 default, _ORCHESTRATOR.md).
const DAILY_EXPLAIN_FREE = 2;

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  // Auth
  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  // Premium gate is applied after validation (see DAILY_EXPLAIN_FREE below) so a
  // malformed request never consumes a quota unit.

  // Rate limit (per-minute burst)
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

  // PAY-9 server gate: free users are capped at DAILY_EXPLAIN_FREE/day on the durable
  // store (premium uncapped). Checked AFTER aiConfigured so a server-side AI outage never
  // burns a user's quota. checkDailyLimit consumes one unit atomically and fails OPEN on a
  // DB hiccup (never blocks a paying user). 402 = free daily allowance used up.
  const isPremium = await checkPremium(user.id);
  if (!isPremium) {
    const { allowed } = await checkDailyLimit(user.id, "explain", DAILY_EXPLAIN_FREE);
    if (!allowed) {
      return dailyLimitResponse(
        lang === "kk"
          ? "Бүгінге тегін AI-түсіндірмелер бітті. Жалғастыру үшін Premium қажет."
          : "Бесплатные AI-объяснения на сегодня закончились. Оформи Premium, чтобы продолжить.",
        402,
      );
    }
  }

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
  const baseSystemPrompt = isKk
    ? 'Сен ҰБТ (Ұлттық бірыңғай тестілеу, Қазақстан) репетиторысың. Қазақ тілінде жауап бер. Сұрақ мәтінін қайталама. Markdown-сыз қатаң JSON қайтар: {"short":"1 сөйлем — неге бұл жауап дұрыс","detailed":"3-5 сөйлем — толық талдау, оқушы қателессе — қатені түсіндір, қарапайым тілмен"}'
    : 'Ты репетитор ЕНТ (Единое национальное тестирование, Казахстан). Ответь на русском. Не повторяй текст вопроса. Верни строго JSON без markdown: {"short":"1 предложение — суть почему этот ответ правильный","detailed":"3-5 предложений — подробный разбор, если ученик ошибся — объясни ошибку, простым языком"}';

  // STEM hardening (audit #7): Qwen runs with reasoning DISABLED, so it does no
  // internal chain-of-thought — its one-shot arithmetic is the only guard on STEM
  // explanations. For STEM subjects, prepend the solve-and-verify scaffold so the
  // model re-derives the answer and checks arithmetic + units BEFORE emitting JSON,
  // and lower the temperature. The verification is SILENT: the final visible output
  // must stay ONLY the strict {short,detailed} JSON object — no steps, no markdown.
  const stemPrefix = getSTEMPrefix(subject);
  const systemPrompt = stemPrefix
    ? `${stemPrefix}\n\nВАЖНО: всю проверку и решение выполни про себя, НЕ выводи шаги. Итоговый ответ — ТОЛЬКО JSON-объект указанного ниже формата, без markdown и без какого-либо текста до или после JSON.\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  // Non-STEM keeps the original 0.7 (getTemperature would bump it to 0.8 — avoid
  // changing established non-STEM behavior). STEM uses getTemperature → 0.5.
  const temperature = STEM_SUBJECTS.has(subject) ? getTemperature(subject) : 0.7;

  try {
    const ai = await callAI({
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      max_tokens: 500,
      temperature,
    });

    if (!ai.ok) {
      console.error("AI error:", ai.status, ai.errorText);
      return Response.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
    }

    try {
      // parseLooseJson repairs the lone-backslash LaTeX (\cdot etc.) that Qwen leaks
      // and otherwise crashes JSON.parse into a raw-blob fallback; sanitizeMath cleans
      // any residual $...$ / \frac so the student never sees broken markup.
      const parsed = parseLooseJson(ai.text);
      return Response.json({
        short: sanitizeMath(parsed.short || ai.text),
        detailed: sanitizeMath(parsed.detailed || ai.text),
      }, { headers: CORS_HEADERS });
    } catch {
      const clean = sanitizeMath(ai.text);
      return Response.json({ short: clean, detailed: clean }, { headers: CORS_HEADERS });
    }
  } catch (fetchErr) {
    console.error("AI fetch error:", fetchErr);
    return Response.json({ error: "AI service unavailable" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/ai-explain" };

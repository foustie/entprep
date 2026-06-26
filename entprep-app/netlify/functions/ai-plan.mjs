import { corsResponse, CORS_HEADERS, verifyAuth, createRateLimiter, rateLimitResponse, validatePlan, checkPremium } from "./utils/shared.mjs";
import { callAI, aiConfigured } from "./utils/ai.mjs";
import { VALID_SUBJECTS } from "./utils/constants.mjs";
import { parseLooseJson } from "./utils/text.mjs";

// Known hallucinated subject ids -> real ids (Qwen invents these); anything else is dropped.
const SUBJECT_ALIASES = { math_literacy: "math", math_lit: "math", history_kz: "history", kazakh_history: "history" };

const checkRate = createRateLimiter("plan", { max: 5, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  // Auth
  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  // AI plan now free for all authenticated users (rate-limited below)

  // Rate limit
  const retryAfter = checkRate(user.id);
  if (retryAfter) return rateLimitResponse(retryAfter);

  // Parse + validate
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS }); }

  const err = validatePlan(body);
  if (err) return Response.json({ error: err }, { status: 400, headers: CORS_HEADERS });

  const { weak, strong, overall, totalTests, streak, lang } = body;

  // AI provider key (OpenRouter by default — see utils/ai.mjs)
  if (!aiConfigured()) return Response.json({ error: "AI not configured" }, { status: 500, headers: CORS_HEADERS });

  // Sanitize user-provided text fields to prevent prompt injection
  const sanitize = (s) => typeof s === 'string' ? s.replace(/[{}\[\]<>]/g, '').slice(0, 100) : '';
  const sanitizeNum = (n) => typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  const VALID_TRENDS = new Set(['improving', 'declining', 'stable', 'none']);

  const weakText = (weak || []).map(s => {
    const name = sanitize(s.name);
    const avg = sanitizeNum(s.avg);
    const trend = VALID_TRENDS.has(s.trend) ? s.trend : 'stable';
    let line = `${name}: средний ${avg}%, тренд ${trend === "declining" ? "падает" : trend === "improving" ? "растёт" : "стабильно"}`;
    if (s.topics && Array.isArray(s.topics)) {
      line += ". Темы: " + s.topics.slice(0, 10).map(t => `${sanitize(t.name)} (${sanitizeNum(t.pct)}%)`).join(", ");
    }
    return line;
  }).join("\n");

  const strongText = (strong || []).map(s => `${sanitize(s.name)}: ${sanitizeNum(s.avg)}%`).join(", ");

  const isKk = lang === 'kk';
  const systemPrompt = isKk
    ? `Сен ҰБТ (Ұлттық бірыңғай тестілеу, Қазақстан) репетиторысың. Жеке 7 күндік дайындық жоспарын қазақ тілінде құр.

Markdown-сыз қатаң JSON қайтар:
{
  "summary": "1-2 сөйлем — негізгі мәселелер мен стратегия",
  "days": [
    {
      "day": 1,
      "title": "Дүйсенбі — Күннің негізгі тақырыбы",
      "tasks": [
        {"type":"test","subject":"subject_id","topic":"topic_id","text":"Тапсырма сипаттамасы"},
        {"type":"review","text":"Нені қайталау керек"},
        {"type":"tip","text":"Күннің кеңесі"}
      ]
    }
  ]
}

Ережелер:
- Әлсіз пәндер мен тақырыптарға баса назар аудар, бірақ күштілерді де қос
- Күн сайын: 2-4 тапсырма (тест, қайталау, кеңес)
- type "test" — әрқашан subject (пән ID) және topic (белгілі болса) көрсет
- type "review" және "tip" — subject-сіз
- Кеңестер нақты және пайдалы болсын
- Пәндерді кезектестір, қиындарды қатарынан қойма
- Демалыс күндері — жеңілірек, қайталау`
    : `Ты репетитор ЕНТ (Единое национальное тестирование, Казахстан). Составь персональный 7-дневный план подготовки на русском языке.

Верни строго JSON без markdown:
{
  "summary": "1-2 предложения — основные проблемы и стратегия",
  "days": [
    {
      "day": 1,
      "title": "Понедельник — Основная тема дня",
      "tasks": [
        {"type":"test","subject":"subject_id","topic":"topic_id","text":"Описание задания"},
        {"type":"review","text":"Что повторить"},
        {"type":"tip","text":"Совет дня"}
      ]
    }
  ]
}

Правила:
- Делай упор на слабые предметы и темы, но включай и сильные для поддержки
- Каждый день: 2-4 задания (тест, повторение, совет)
- type "test" — всегда указывай subject (ID предмета) и topic (если известна)
- type "review" и "tip" — без subject
- Советы должны быть конкретными и полезными
- Чередуй предметы, не ставь сложные подряд
- В выходные — легче, повторение`;

  // Constrain output: a valid subject-id enum (Qwen invented math_lit/history_kz that
  // broke the 'Start test' button) + MINIFIED JSON (pretty-printed plans overflowed
  // max_tokens and truncated -> JSON.parse 500, worst on token-dense Kazakh).
  const constraints = isKk
    ? `\n\nМАҢЫЗДЫ:\n- subject өрісінде ТЕК осы ID-лерді қолдан (дәл солай жаз): ${VALID_SUBJECTS.join(', ')}. Басқа ID ойлап таппа.\n- Жауапты бір жолда, минифицирленген JSON-мен қайтар: шегініссіз, жолбасынсыз, markdown-сыз.`
    : `\n\nВАЖНО:\n- В поле subject используй ТОЛЬКО эти ID (дословно): ${VALID_SUBJECTS.join(', ')}. Не придумывай другие.\n- Верни МИНИФИЦИРОВАННЫЙ JSON одной строкой: без отступов, без переносов строк, без markdown.`;

  const userMessage = `Данные ученика:
Общий средний балл: ${overall}%
Всего тестов: ${totalTests}
Серия дней: ${streak || 0}

Слабые предметы:
${weakText || "нет данных"}

Сильные предметы: ${strongText || "нет данных"}`;

  // Generate + parse, with one retry — Qwen at temperature occasionally emits
  // malformed JSON. Lower temp (0.4) for determinism; clip to the outermost {...}
  // in case of stray prose; bad shape or parse error throws so the caller retries.
  async function attemptPlan() {
    const ai = await callAI({
      system: systemPrompt + constraints,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 3000,
      temperature: 0.4,
    });
    if (!ai.ok) { const e = new Error("ai_unavailable"); e.unavailable = true; throw e; }
    const parsed = parseLooseJson(ai.text);
    if (!parsed.summary || !Array.isArray(parsed.days)) throw new Error("bad_shape");
    return parsed;
  }

  try {
    let parsed;
    try {
      parsed = await attemptPlan();
    } catch (firstErr) {
      if (firstErr.unavailable) {
        console.error("AI error (plan): unavailable");
        return Response.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
      }
      console.warn("Plan parse failed, retrying once:", firstErr.message);
      parsed = await attemptPlan(); // one retry; a second failure falls to the outer catch
    }

    // Repair hallucinated subject ids: map known aliases, drop the rest so a 'test'
    // task can't route the 'Start test' button (nav('test', subject)) to an empty pool.
    const validSet = new Set(VALID_SUBJECTS);
    for (const day of parsed.days) {
      if (!day || !Array.isArray(day.tasks)) continue;
      for (const task of day.tasks) {
        if (!task || !task.subject) continue;
        const sid = validSet.has(task.subject) ? task.subject : (SUBJECT_ALIASES[task.subject] || null);
        if (sid) task.subject = sid;
        else { delete task.subject; delete task.topic; if (task.type === "test") task.type = "review"; }
      }
    }
    return Response.json(parsed, { headers: CORS_HEADERS });
  } catch (err) {
    if (err.unavailable) {
      return Response.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
    }
    console.error("Plan generation failed:", err.message);
    return Response.json({ error: "Не удалось сформировать план. Попробуйте ещё раз." }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/ai-plan" };

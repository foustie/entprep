// AI question generation via the active provider (see utils/ai.mjs)
// Strict quality rules for ENT-level questions
// Post-generation validation: self-answer, trivial, short, weak explanation, dedup

import { corsResponse, CORS_HEADERS, verifyAuth, createRateLimiter, rateLimitResponse, validateGenerate } from "./utils/shared.mjs";
import { checkGenerated, tokenize, jaccard } from "./utils/quality.mjs";
import { SUBJECT_NAMES, getTemperature, getSTEMPrefix, JACCARD_THRESHOLD, QUALITY_RULES, STEM_SUBJECTS } from "./utils/constants.mjs";
import { callAI, aiConfigured } from "./utils/ai.mjs";
import { parseLooseJson } from "./utils/text.mjs";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
const checkRate = createRateLimiter("generate", { max: 10, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  // Auth
  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  // Admin-only
  if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes((user.email || '').toLowerCase())) return Response.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS });

  // Rate limit
  const retryAfter = checkRate(user.id);
  if (retryAfter) return rateLimitResponse(retryAfter);

  // Parse + validate
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS }); }

  const err = validateGenerate(body);
  if (err) return Response.json({ error: err }, { status: 400, headers: CORS_HEADERS });

  const { subject, topic, examples } = body;
  const subjectName = SUBJECT_NAMES[subject] || subject;

  // AI provider key (OpenRouter by default — see utils/ai.mjs)
  if (!aiConfigured()) return Response.json({ error: "AI not configured (provider API key missing)" }, { status: 500, headers: CORS_HEADERS });

  const examplesText = examples
    .map((ex, i) => `Пример ${i + 1}:\nВопрос: ${ex.q}\nА) ${ex.o[0]}\nБ) ${ex.o[1]}\nВ) ${ex.o[2]}\nГ) ${ex.o[3]}\nПравильный: ${["А", "Б", "В", "Г"][ex.c]}\nОбъяснение: ${ex.e}`)
    .join("\n\n");

  const topicHint = topic ? ` по теме "${topic}"` : "";
  const stemCoT = getSTEMPrefix(subject);

  const systemPrompt = `Ты опытный составитель ЕНТ (Единое национальное тестирование, Казахстан). Создавай вопросы уровня реального ЕНТ 2025-2026.

Предмет: "${subjectName}"${topicHint}
${stemCoT}
${QUALITY_RULES}

ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА:
- Для точных наук — задачи с конкретными числами, формулами, расчётами. Формулы в Unicode (², √, π, ×)
- Для гуманитарных — причинно-следственные связи, сравнение явлений, анализ ситуаций
- Все 4 варианта должны быть ПОХОЖИ по длине и стилю
- Правильный ответ НЕ должен быть самым длинным или самым коротким
- Объяснение должно УЧИТЬ: объяснить ПОЧЕМУ правильный ответ верен и ПОЧЕМУ другие неверны
- Вопрос должен быть УНИКАЛЬНЫМ — не повторять примеры

ЗАПРЕЩЕНО:
- "Все вышеперечисленное" / "Ничего из вышеперечисленного"
- Вопросы с отрицанием ("Какой НЕ является...")
- Тривиальные факты из первой главы учебника
- Правильный ответ, который можно угадать без знания предмета

Верни строго JSON (без markdown, без \`\`\`):
{"q":"текст вопроса","o":["вариант А","вариант Б","вариант В","вариант Г"],"c":0,"e":"подробное объяснение"}
Поле c — индекс правильного ответа (0-3).`;

  const userMessage = `Примеры существующих вопросов (для образца стиля, НЕ повторяй их):\n\n${examplesText}\n\nСоздай 1 новый аналитический вопрос повышенной сложности. Верни только JSON.`;

  // Helper: call the active AI provider and parse response
  async function callModel(messages) {
    const ai = await callAI({
      system: systemPrompt,
      messages,
      max_tokens: 800,
      temperature: getTemperature(subject),
    });

    if (!ai.ok) {
      throw new Error(`API ${ai.status}: ${(ai.errorText || "").slice(0, 200)}`);
    }

    const parsed = parseLooseJson(ai.text);
    if (!parsed.q || !Array.isArray(parsed.o) || parsed.o.length !== 4 || typeof parsed.c !== "number" || parsed.c < 0 || parsed.c > 3 || !parsed.e) {
      throw new Error("Invalid format");
    }
    return parsed;
  }

  // Dedup check: compare generated question against the examples (which represent existing questions)
  function isDuplicateOfExamples(question) {
    const newTokens = tokenize(question.q);
    for (const ex of examples) {
      const sim = jaccard(newTokens, tokenize(ex.q));
      if (sim >= JACCARD_THRESHOLD) return true;
    }
    return false;
  }

  // Strip "А) / Б) / В) / Г)" letter prefixes Qwen sometimes prepends to o_kk items.
  const KK_LETTER_PREFIX = /^\s*[АаБбВвГгӘә]\s*[).\]]\s*/;

  // Parse + validate the Kazakh translation sub-call into the exact
  // {q_kk, o_kk(array of 4 non-empty strings), e_kk} schema. Throws on shape failure.
  function parseTranslation(text) {
    const tr = parseLooseJson(text);
    if (!tr || typeof tr.q_kk !== "string" || !tr.q_kk.trim() ||
        !Array.isArray(tr.o_kk) || tr.o_kk.length !== 4 ||
        !tr.o_kk.every(o => typeof o === "string" && o.trim()) ||
        typeof tr.e_kk !== "string" || !tr.e_kk.trim()) {
      throw new Error("Invalid translation format");
    }
    return {
      q_kk: tr.q_kk.trim(),
      o_kk: tr.o_kk.map(o => o.replace(KK_LETTER_PREFIX, "").trim()),
      e_kk: tr.e_kk.trim(),
    };
  }

  // Heuristic: does this look like a calculation question (vs. a conceptual one)?
  // The wrong-key defect we verify against is a numeric slip, so only verify those.
  function looksNumeric(question) {
    const hasDigit = s => /\d/.test(s || "");
    const numericOpts = question.o.filter(hasDigit).length;
    return numericOpts >= 2 || (hasDigit(question.q) && numericOpts >= 1);
  }

  // STEM wrong-key guard: one independent re-derivation of the numeric answer.
  // Returns the option index (0-3) the model computes, or null when it can't
  // decide / the call fails (fail-open — never block on verifier flakiness).
  async function verifyStemAnswer(question) {
    const optsText = question.o.map((o, i) => `${i}) ${o}`).join("\n");
    const vAi = await callAI({
      system: `Ты эксперт по точным наукам. Реши задачу с нуля сам, шаг за шагом, НЕ доверяя готовому ответу. Проверь арифметику и единицы измерения. Затем выбери вариант, ТОЧНО совпадающий с твоим результатом. Если задача не вычислительная — верни -1. Ответь СТРОГО JSON без markdown: {"idx": N}, где N — индекс варианта (0-3) или -1.`,
      messages: [{ role: "user", content: `Задача: ${question.q}\nВарианты (индекс) значение:\n${optsText}` }],
      max_tokens: 600,
      temperature: 0,
    });
    if (!vAi.ok) return null;
    try {
      const raw = vAi.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const v = JSON.parse(raw);
      if (typeof v.idx === "number" && v.idx >= 0 && v.idx <= 3) return v.idx;
    } catch { /* unparseable — fail open */ }
    return null;
  }

  try {
    // Attempt 1 — retry once if the first response is malformed JSON / wrong shape
    // (a parse throw used to fall straight through to a hard HTTP 500).
    let parsed;
    try {
      parsed = await callModel([{ role: "user", content: userMessage }]);
    } catch (parseErr) {
      console.log("Attempt 1 parse/format failed:", parseErr.message, "— retrying once");
      parsed = await callModel([{ role: "user", content: `${userMessage}\n\nВАЖНО: верни СТРОГО валидный JSON в формате {"q":...,"o":[...4...],"c":0-3,"e":...} — без markdown, без пояснений.` }]);
    }

    // Quality gate: check for issues
    let issues = checkGenerated(parsed.q, parsed.o, parsed.c, parsed.e, subject);

    // Dedup gate: check against provided examples
    if (issues.length === 0 && isDuplicateOfExamples(parsed)) {
      issues.push("Вопрос слишком похож на существующий");
    }

    if (issues.length > 0) {
      console.log("Quality issues in generated question:", issues.join("; "));

      // Attempt 2: retry with feedback about what was wrong
      try {
        const retryMessage = `Предыдущий вопрос отклонён из-за проблем с качеством:\n${issues.map(i => `- ${i}`).join("\n")}\n\nОтклонённый вопрос: "${parsed.q}"\n\nСоздай ДРУГОЙ вопрос, избегая этих проблем. Верни только JSON.`;
        parsed = await callModel([
          { role: "user", content: userMessage },
          { role: "assistant", content: JSON.stringify(parsed) },
          { role: "user", content: retryMessage },
        ]);

        const retryIssues = checkGenerated(parsed.q, parsed.o, parsed.c, parsed.e, subject);
        if (retryIssues.length > 0 || isDuplicateOfExamples(parsed)) {
          const allIssues = retryIssues.length > 0 ? retryIssues : ["Дубликат"];
          console.log("Retry also has issues:", allIssues.join("; "), "— rejecting");
          return Response.json(
            { error: "Не удалось сгенерировать качественный вопрос. Попробуйте ещё раз." },
            { status: 422, headers: CORS_HEADERS }
          );
        }
      } catch (retryErr) {
        console.log("Retry failed:", retryErr.message, "— returning original");
      }
    }

    // STEM wrong-key guard: one extra independent re-derivation catches the
    // self-consistent numeric slips (e.g. ×100 unit errors) the mismatch gate
    // can't — explanation and key agree but both are wrong. STEM + numeric only,
    // a single extra call, to bound cost.
    if (STEM_SUBJECTS.has(subject) && looksNumeric(parsed)) {
      const verifyIdx = await verifyStemAnswer(parsed);
      if (verifyIdx !== null && verifyIdx !== parsed.c) {
        console.log(`STEM verify mismatch: model computed option ${verifyIdx}, key is ${parsed.c} — rejecting`);
        return Response.json(
          { error: "Не удалось сгенерировать качественный вопрос. Попробуйте ещё раз." },
          { status: 422, headers: CORS_HEADERS }
        );
      }
    }

    // Auto-translate to Kazakh. Validate the exact {q_kk, o_kk[4], e_kk} schema
    // and retry ONCE on shape failure — Qwen drops/garbles the shape often enough
    // that KK silently went missing without this.
    try {
      const trSystem = `Ты профессиональный переводчик учебных материалов с русского на казахский. Переводи точно и полностью. Числа, формулы, Unicode символы (², √, π) — без изменений. Количество вариантов ответа ТОЧНО совпадает с оригиналом. НЕ добавляй буквенные метки (А)/Б)) к вариантам. Верни строго JSON (без markdown): {"q_kk":"...","o_kk":["...","...","...","..."],"e_kk":"..."}`;
      const trUser = { role: "user", content: `Переведи на казахский:\nВопрос: ${parsed.q}\nВарианты: ${parsed.o.map((o, i) => `${["А","Б","В","Г"][i]}) ${o}`).join("; ")}\nОбъяснение: ${parsed.e}` };
      let tr = null;
      for (let attempt = 0; attempt < 2 && !tr; attempt++) {
        const trAi = await callAI({ system: trSystem, messages: [trUser], max_tokens: 800, temperature: 0.3 });
        if (!trAi.ok) break;
        try {
          tr = parseTranslation(trAi.text);
        } catch (shapeErr) {
          if (attempt === 1) console.log("KK translation shape invalid after retry:", shapeErr.message);
        }
      }
      if (tr) {
        parsed.q_kk = tr.q_kk;
        parsed.o_kk = tr.o_kk;
        parsed.e_kk = tr.e_kk;
      }
    } catch (trErr) {
      console.log("Auto-translate failed (non-critical):", trErr.message);
    }

    return Response.json(parsed, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("AI error:", err.message);
    const isFormat = err.message.includes("Invalid format") || err instanceof SyntaxError;
    return Response.json(
      { error: isFormat ? "AI returned invalid question format" : "AI service unavailable" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = { path: "/api/ai-generate" };

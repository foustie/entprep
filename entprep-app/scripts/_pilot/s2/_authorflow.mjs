export const meta = {
  name: 's2-author',
  description: 'Author + independently verify original bilingual ЕНТ questions for one subject; write per-cluster JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

// args = { subject, round, formatKind: 'translate'|'english', subjectLabel, clusters:[{id,n,focus,pairs}] }
if (!args || !args.subject || !args.clusters) throw new Error('args.subject and args.clusters required')
const SUBJECT = args.subject
const ROUND = args.round || 1
const KIND = args.formatKind || 'translate'
const LABEL = args.subjectLabel || SUBJECT.toUpperCase()
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const Q_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          q: { type: 'string' },
          o: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          c: { type: 'integer', minimum: 0, maximum: 3 },
          e: { type: 'string' },
          q_kk: { type: 'string' },
          o_kk: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          e_kk: { type: 'string' },
          topic: { type: 'string' },
          subtopic: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: ['q', 'o', 'c', 'e', 'q_kk', 'o_kk', 'e_kk', 'topic', 'subtopic', 'difficulty'],
      },
    },
  },
  required: ['questions'],
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    file: { type: 'string' },
    authored: { type: 'integer' },
    kept: { type: 'integer' },
    dropped: { type: 'integer' },
    dropReasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'authored', 'kept', 'dropped', 'dropReasons'],
}

const FORMAT_TRANSLATE = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ${LABEL} questions. Author exam-quality ORIGINAL single-choice questions.

Each question object MUST have these fields:
- q: Russian question stem. Frame it precisely like a real ЕНТ item; for analytical subjects prefer a short context/scenario then a precise question. 1–3 sentences. No "А)/Б)" letter prefixes anywhere.
- o: exactly 4 Russian options, plausible and similar in length/category, EXACTLY ONE correct; the 3 distractors must be clearly wrong to an expert but believable to a student.
- c: integer 0–3, index of the correct option. VARY c across your batch — use all of 0,1,2,3 roughly evenly.
- e: Russian explanation, 1–3 sentences, stating WHY the answer is correct. Do NOT start with "Правильный ответ".
- q_kk: faithful Kazakh translation of q.
- o_kk: the 4 options in the SAME ORDER as o (so c still points to the correct one). Translate WORD options to Kazakh; keep formulas, numbers, chemical symbols, units, and Latin/English tokens IDENTICAL across o and o_kk.
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: choose from the ALLOWED PAIRS for your cluster — use the EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them (~30% easy, 45% medium, 25% hard).

HARD RULES:
- ACCURACY IS PARAMOUNT. Include a question ONLY if you are certain of the answer. Never invent facts, dates, or values. If unsure, write a different question you ARE sure of. For calculation questions, the four options must be numerically distinct and the correct value provably right.
- ORIGINALITY. Do not reproduce or lightly reword any published test item. Write fresh stems and vary the angle. Avoid the single most clichéd question per topic.
- Distinct options, no duplicates, no letter prefixes, no "all of the above", and do NOT let the correct answer's exact wording appear in the question stem.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

const FORMAT_ENGLISH = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ENGLISH-language questions. Author exam-quality ORIGINAL single-choice questions following the ЕНТ bilingual convention.

CONVENTION: the INSTRUCTION is bilingual but the English-language content stays in English.
- q: a Russian instruction + the English material. Example: "Выберите правильный вариант: She ___ to school every day." or "Выберите слово, наиболее близкое по значению к подчёркнутому: The journey was exhausting." Keep the English sentence/word in English.
- o: exactly 4 English options (words or forms), EXACTLY ONE correct. Distractors must be plausible (common learner errors). No letter prefixes.
- c: integer 0–3 of the correct option. VARY c across the batch (use all of 0,1,2,3).
- e: Russian explanation of the grammar/vocabulary rule, 1–3 sentences. Do NOT start with "Правильный ответ".
- q_kk: the SAME item with a Kazakh instruction (translate only the Russian instruction part; keep the English material identical). Example: "Дұрыс нұсқаны таңдаңыз: She ___ to school every day."
- o_kk: for grammar/usage/word-choice questions the options are English — put the SAME 4 English options as o, in the SAME ORDER (so o_kk === o). Only if the options are Russian translations of an English word should o_kk be the Kazakh translations (same order).
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS — exact ids.
- difficulty: "easy" | "medium" | "hard" — mix them.

HARD RULES:
- ACCURACY IS PARAMOUNT. Only one option is unambiguously correct under standard English grammar/usage. Avoid items where two options are both acceptable. If unsure, write a different item.
- ORIGINALITY. Fresh sentences, varied vocabulary and structures; do not reword published items.
- The blank/target must have exactly one correct completion. No letter prefixes, distinct options.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

const FORMAT = KIND === 'english' ? FORMAT_ENGLISH : FORMAT_TRANSLATE

phase('Author')
const results = await pipeline(
  args.clusters,
  (cl) => agent(
    `${FORMAT}\n\nYOUR CLUSTER: author ${cl.n} questions on:\n${cl.focus}\n\nALLOWED (topic/subtopic) PAIRS for every question (pick the best fit per question, use EXACT ids):\n${cl.pairs}\n\nAuthor exactly ${cl.n} questions now.`,
    { label: `author:${SUBJECT}:${cl.id}`, phase: 'Author', schema: Q_SCHEMA }
  ),
  (authored, cl) => {
    if (!authored || !authored.questions || !authored.questions.length) return null
    const outFile = `${OUT}/${SUBJECT}_r${ROUND}_${cl.id}.json`
    const kkRule = KIND === 'english'
      ? 'o_kk equals o for grammar/word-choice (English options identical); for translation items o_kk is the Kazakh translation in the same order.'
      : 'o_kk is the same order as o; word options translated to Kazakh, formulas/numbers/symbols/units identical.'
    return agent(
      `You are an INDEPENDENT ЕНТ ${LABEL} verifier. Below is a JSON batch of single-choice questions authored by someone else. Re-solve EACH question yourself from scratch, IGNORING the marked answer, then decide keep/drop.

KEEP a question ONLY if ALL hold:
1. You independently reach exactly the same correct option as marked c, with certainty.
2. Exactly one option is unambiguously correct; the other three are clearly wrong (for English: no second acceptable answer).
3. Factually/grammatically accurate — no invented facts, values, or non-standard usage.
4. o has 4 distinct options, no letter prefixes; e is a real 1–3 sentence explanation; correct answer wording does not leak into the stem.
5. q_kk, o_kk, e_kk present; ${kkRule} Kazakh is faithful.
6. topic/subtopic are among the ALLOWED PAIRS for this cluster: ${cl.pairs}
Otherwise DROP. When in doubt, DROP — precision over volume.

You MAY lightly fix obvious Kazakh translation slips and trim an over-long explanation. You may NOT change which option is correct; if c looks wrong, DROP the question.

After filtering, WRITE the surviving questions to this EXACT file path using the Write tool:
${outFile}
Write valid UTF-8 JSON shaped EXACTLY as: {"questions":[ {"q":...,"o":[4],"c":int,"e":...,"q_kk":...,"o_kk":[4],"e_kk":...,"topic":...,"subtopic":...,"difficulty":...}, ... ]}
No markdown fences, no trailing commas. If zero survive, write {"questions":[]}.

Then return via StructuredOutput: {file:"${outFile}", authored:<count in>, kept:<count written>, dropped:<authored-kept>, dropReasons:[short reasons]}.

BATCH TO VERIFY (${authored.questions.length} questions):
${JSON.stringify(authored.questions)}`,
      { label: `verify:${SUBJECT}:${cl.id}`, phase: 'Verify', schema: VERIFY_SCHEMA }
    )
  }
)

const summary = results.filter(Boolean)
const totalKept = summary.reduce((s, r) => s + (r.kept || 0), 0)
const totalAuthored = summary.reduce((s, r) => s + (r.authored || 0), 0)
log(`${LABEL} R${ROUND}: authored ${totalAuthored}, kept ${totalKept} across ${summary.length} clusters`)
return { subject: SUBJECT, round: ROUND, files: summary.map(r => r.file), totalAuthored, totalKept, perCluster: summary }

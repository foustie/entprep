export const meta = {
  name: 's2-english-r1',
  description: 'Author + independently verify original bilingual ЕНТ english questions; write per-cluster JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'english'
const ROUND = 3
const LABEL = 'ENGLISH'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 16, focus: "Vocabulary and word choice: choose the synonym closest in meaning to an underlined word in an English sentence; antonyms; easily confused words (affect/effect, lose/loose, advice/advise, its/it's, then/than); collocations (make/do a decision, heavy rain, strong coffee); the correct word for a context.",
    pairs: 'vocabulary_orthography/vocabulary_orthography' },
  { id: 'c01', n: 16, focus: "Articles, prepositions and word formation: a/an/the/zero-article usage; prepositions of time (in/on/at), place and movement (in/on/at/to/into/onto); dependent prepositions after verbs and adjectives (good at, interested in, depend on, afraid of, listen to); word formation by adding a prefix or suffix (-ness, -tion, -ment, -ful, -less, un-, dis-, im-) to fill a blank.",
    pairs: 'morphology/articles_prepositions_word_formation' },
  { id: 'c02', n: 16, focus: "Parts of speech and verb forms: tenses (Present/Past/Future Simple, Continuous, Perfect, Perfect Continuous), correct auxiliary, irregular verb forms (V2/V3), modal verbs (can/could/must/should/have to/may/might), pronouns (personal/possessive/reflexive/relative), quantifiers (much/many/few/little/some/any), comparatives and superlatives of adjectives and adverbs.",
    pairs: 'morphology/parts_of_speech' },
  { id: 'c03', n: 15, focus: "Sentence-level grammar: conditional sentences (zero/first/second/third), reported (indirect) speech, question formation and tag questions, subject-verb agreement, word order, there is/there are, so/such, too/enough.",
    pairs: 'syntax/sentences' },
  { id: 'c04', n: 15, focus: "Constructions: passive voice (across main tenses), gerund vs infinitive after verbs (enjoy doing, want to do, stop doing/to do, remember doing/to do), used to / be used to / get used to, relative clauses (who/which/that/whose/where), complex object (want somebody to do), causative (have/get something done).",
    pairs: 'syntax/constructions' },
  { id: 'c05', n: 14, focus: "Speech norms and reading: phrasal verbs (give up, look after, put off, take off, look for, run out of) and their meaning; common idioms; choosing the most appropriate word/phrase in context; linking words (however, although, because, therefore, despite); and reading-style items asking the best synonym or the meaning of a word/phrase as used in a short English sentence.",
    pairs: 'synthesis_analysis/speech_norms ; reading/text_work' },
]

const Q_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          q: { type: 'string' }, o: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          c: { type: 'integer', minimum: 0, maximum: 3 }, e: { type: 'string' },
          q_kk: { type: 'string' }, o_kk: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          e_kk: { type: 'string' }, topic: { type: 'string' }, subtopic: { type: 'string' },
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
    file: { type: 'string' }, authored: { type: 'integer' }, kept: { type: 'integer' },
    dropped: { type: 'integer' }, dropReasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'authored', 'kept', 'dropped', 'dropReasons'],
}

const FORMAT = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ENGLISH-language questions. Author exam-quality ORIGINAL single-choice questions following the ЕНТ bilingual convention.

This is round 3 — two prior rounds already exist. Use entirely FRESH sentences, varied vocabulary, names, and real-life contexts; test less-common but standard points (e.g. less-usual irregular verbs, dependent prepositions, conditionals mixed types, reported-speech shifts, tricky gerund/infinitive verbs); avoid the most clichéd textbook example per rule.

CONVENTION: the INSTRUCTION is bilingual but the English-language content stays in English.
- q: a Russian instruction + the English material. Examples: "Выберите правильный вариант: She ___ to school every day." OR "Выберите слово, наиболее близкое по значению к подчёркнутому слову: The journey was exhausting." Keep the English sentence/word in English.
- o: exactly 4 English options (words or grammatical forms), EXACTLY ONE correct; distractors must be plausible common learner errors. No letter prefixes.
- c: integer 0–3 of the correct option. VARY c across the batch (use all of 0,1,2,3).
- e: Russian explanation of the grammar/vocabulary rule, 1–3 sentences. Do NOT start with "Правильный ответ".
- q_kk: the SAME item with a Kazakh instruction (translate only the Russian instruction part; keep the English material identical). Example: "Дұрыс нұсқаны таңдаңыз: She ___ to school every day."
- o_kk: for grammar/usage/word-choice items the options are English — put the SAME 4 English options as o, in the SAME ORDER (so o_kk EQUALS o). Only if the options are Russian translations of an English word should o_kk be the Kazakh translations (same order).
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS for your cluster — EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them.

HARD RULES:
- ACCURACY IS PARAMOUNT. Exactly one option must be correct under standard (British/American) English; reject any item where two options are both acceptable. If unsure, write a different item.
- ORIGINALITY. Fresh sentences, varied vocabulary and structures; do not reword published items.
- The blank/target must have exactly one correct completion. No letter prefixes; 4 distinct options.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

phase('Author')
const results = await pipeline(
  CLUSTERS,
  (cl) => agent(
    `${FORMAT}\n\nYOUR CLUSTER: author ${cl.n} questions on:\n${cl.focus}\n\nALLOWED (topic/subtopic) PAIRS (pick best fit per question, EXACT ids):\n${cl.pairs}\n\nAuthor exactly ${cl.n} questions now.`,
    { label: `author:${SUBJECT}:${cl.id}`, phase: 'Author', schema: Q_SCHEMA }
  ),
  (authored, cl) => {
    if (!authored || !authored.questions || !authored.questions.length) return null
    const outFile = `${OUT}/${SUBJECT}_r${ROUND}_${cl.id}.json`
    return agent(
      `You are an INDEPENDENT ЕНТ ENGLISH verifier. Below is a JSON batch of single-choice questions authored by someone else. Re-solve EACH question yourself from scratch, IGNORING the marked answer, then decide keep/drop.

KEEP a question ONLY if ALL hold:
1. You independently reach exactly the same correct option as marked c, with certainty, under standard English grammar/usage.
2. EXACTLY ONE option is correct — there must be NO second acceptable answer (be strict: reject items where another option also works).
3. Grammatically/lexically accurate; the English material is natural and unambiguous.
4. o has 4 distinct English options, no letter prefixes; e is a real 1–3 sentence rule explanation.
5. q_kk present with a Kazakh instruction and identical English material; o_kk follows the convention (EQUALS o for grammar/word-choice items; Kazakh translations only for translation items); e_kk faithful.
6. topic/subtopic among the ALLOWED PAIRS: ${cl.pairs}
Otherwise DROP. When in doubt, DROP — precision over volume.

You MAY lightly fix an obvious Kazakh-instruction slip, fix o_kk to equal o when it should, and trim an over-long explanation. You may NOT change which option is correct; if c looks wrong or two answers work, DROP.

After filtering, WRITE the survivors to this EXACT path using the Write tool:
${outFile}
Valid UTF-8 JSON shaped EXACTLY as {"questions":[ {"q":...,"o":[4],"c":int,"e":...,"q_kk":...,"o_kk":[4],"e_kk":...,"topic":...,"subtopic":...,"difficulty":...}, ... ]}. No markdown fences, no trailing commas. If zero survive, write {"questions":[]}.

Then return via StructuredOutput: {file:"${outFile}", authored:<in>, kept:<written>, dropped:<in-kept>, dropReasons:[short]}.

BATCH TO VERIFY (${authored.questions.length}):
${JSON.stringify(authored.questions)}`,
      { label: `verify:${SUBJECT}:${cl.id}`, phase: 'Verify', schema: VERIFY_SCHEMA }
    )
  }
)

const summary = results.filter(Boolean)
const totalKept = summary.reduce((s, r) => s + (r.kept || 0), 0)
const totalAuthored = summary.reduce((s, r) => s + (r.authored || 0), 0)
log(`${LABEL} R${ROUND}: authored ${totalAuthored}, kept ${totalKept} across ${summary.length} clusters`)
return { subject: SUBJECT, round: ROUND, totalAuthored, totalKept, perCluster: summary }

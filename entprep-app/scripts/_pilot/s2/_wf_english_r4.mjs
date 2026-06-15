export const meta = {
  name: 's2-english-r4',
  description: 'Round 4: advanced grammar/vocabulary english; author+verify bilingual ЕНТ; write JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'english'
const ROUND = 4
const LABEL = 'ENGLISH'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 16, focus: "Vocabulary (advanced): synonyms of less-common words in context, formal vs informal register, academic words, more confused pairs (economic/economical, sensible/sensitive, historic/historical, classic/classical, continual/continuous, beside/besides), strong collocations (do research, make progress, pay attention, take part). Options are English words; o_kk equals o.",
    pairs: 'vocabulary_orthography/vocabulary_orthography' },
  { id: 'c01', n: 16, focus: "Articles, prepositions, word formation (advanced): zero article with abstract/uncountable/plural generalisations, 'the' with superlatives/rivers/oceans/unique nouns, fixed prepositional phrases (by mistake, on purpose, in time vs on time, at last, in charge of), dependent prepositions (succeed in, accuse of, congratulate on, insist on), negative prefixes (un-, in-, im-, ir-, il-, dis-) and noun/adjective suffixes to fill a blank. Options English; o_kk equals o.",
    pairs: 'morphology/articles_prepositions_word_formation' },
  { id: 'c02', n: 16, focus: "Verb forms & modals (advanced): Future Perfect, Past Perfect Continuous, mixed tense choice in context, modal perfects (must have done, can't have done, should have done, needn't have done), reflexive vs reciprocal pronouns (each other/one another), quantifiers (a few vs few, a little vs little, each vs every, neither/either), irregular comparatives (good/better/best, bad/worse, far/further). Options English; o_kk equals o.",
    pairs: 'morphology/parts_of_speech' },
  { id: 'c03', n: 15, focus: "Sentence grammar (advanced): mixed conditionals, inversion in conditionals (Had I known, Were I you, Should you need), reported questions and commands with backshift, wish/if only (+past/past perfect/would), subject-verb agreement with tricky subjects (each, everyone, the news, neither...nor), question tags with tricky subjects (I am → aren't I, let's → shall we). Options English; o_kk equals o.",
    pairs: 'syntax/sentences' },
  { id: 'c04', n: 15, focus: "Constructions (advanced): causative (have/get something done), passive with reporting verbs (is said/believed/thought to + infinitive/perfect infinitive), gerund vs infinitive with meaning change (stop/remember/forget/regret/try/go on), participle clauses (Having finished..., Walking down...), would rather/had better (+bare infinitive), 'it's (high) time + past', so/such...that. Options English; o_kk equals o.",
    pairs: 'syntax/constructions' },
  { id: 'c05', n: 14, focus: "Phrasal verbs, idioms, linkers, reading (advanced): phrasal verbs (carry out, bring up, come across, get along with, look forward to, put up with, run out of, take after, call off, look into), common idioms, contrast/cause linkers (nevertheless, in spite of/despite + noun, although + clause, owing to, therefore), choosing the meaning of a word/phrase as used in a short English context, simple inference. Options English; o_kk equals o.",
    pairs: 'synthesis_analysis/speech_norms ; reading/text_work' },
]

const Q_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { questions: { type: 'array', items: { type: 'object', additionalProperties: false,
    properties: { q: { type: 'string' }, o: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 }, c: { type: 'integer', minimum: 0, maximum: 3 }, e: { type: 'string' }, q_kk: { type: 'string' }, o_kk: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 }, e_kk: { type: 'string' }, topic: { type: 'string' }, subtopic: { type: 'string' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] } },
    required: ['q', 'o', 'c', 'e', 'q_kk', 'o_kk', 'e_kk', 'topic', 'subtopic', 'difficulty'] } } },
  required: ['questions'],
}
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { file: { type: 'string' }, authored: { type: 'integer' }, kept: { type: 'integer' }, dropped: { type: 'integer' }, dropReasons: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'authored', 'kept', 'dropped', 'dropReasons'],
}

const FORMAT = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ENGLISH-language questions. Author exam-quality ORIGINAL single-choice questions following the ЕНТ bilingual convention.

This is round 4 — use entirely FRESH sentences, varied vocabulary, names, contexts; test the ADVANCED points named in your cluster.

CONVENTION: instruction bilingual, English content stays English.
- q: Russian instruction + English material (e.g. "Выберите правильный вариант: Had I known, I ___ earlier.").
- o: exactly 4 English options, EXACTLY ONE correct; distractors are plausible learner errors. No letter prefixes.
- c: integer 0–3, VARY across batch (use all of 0,1,2,3).
- e: Russian explanation of the rule, 1–3 sentences, not starting with "Правильный ответ".
- q_kk: same item with a Kazakh instruction (English material identical).
- o_kk: the SAME 4 English options as o, SAME ORDER (o_kk equals o for these grammar/word-choice items).
- e_kk: faithful Kazakh of e.
- topic + subtopic: from ALLOWED PAIRS, EXACT ids.
- difficulty: easy|medium|hard, mixed.

HARD RULES: EXACTLY ONE option correct under standard English — reject any item with a second acceptable answer; originality (fresh sentences); 4 distinct options, no letter prefixes. If unsure, write a different item.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

phase('Author')
const results = await pipeline(
  CLUSTERS,
  (cl) => agent(`${FORMAT}\n\nYOUR CLUSTER: author ${cl.n} questions on:\n${cl.focus}\n\nALLOWED (topic/subtopic) PAIRS (EXACT ids):\n${cl.pairs}\n\nAuthor exactly ${cl.n} questions now.`,
    { label: `author:${SUBJECT}:${cl.id}`, phase: 'Author', schema: Q_SCHEMA }),
  (authored, cl) => {
    if (!authored || !authored.questions || !authored.questions.length) return null
    const outFile = `${OUT}/${SUBJECT}_r${ROUND}_${cl.id}.json`
    return agent(`You are an INDEPENDENT ЕНТ ENGLISH verifier. Re-solve EACH question below from scratch, IGNORING the marked answer, then keep/drop.

KEEP only if ALL hold:
1. You independently reach exactly the marked c, with certainty, under standard English.
2. EXACTLY ONE option correct — NO second acceptable answer (be strict).
3. Grammatically/lexically accurate; English material natural and unambiguous.
4. 4 distinct English options, no letter prefixes; real 1–3 sentence rule explanation in e.
5. q_kk present (Kazakh instruction, identical English material); o_kk equals o; e_kk faithful.
6. topic/subtopic among ALLOWED PAIRS: ${cl.pairs}
Else DROP. When in doubt, DROP.

You MAY fix a Kazakh-instruction slip, fix o_kk to equal o, trim explanation; you may NOT change which option is correct (if c wrong or two answers work, DROP).

WRITE survivors to this EXACT path via Write tool:
${outFile}
Valid UTF-8 JSON: {"questions":[ ... ]}. No fences, no trailing commas. If zero survive write {"questions":[]}.
Return via StructuredOutput: {file:"${outFile}", authored:<in>, kept:<written>, dropped:<in-kept>, dropReasons:[short]}.

BATCH (${authored.questions.length}):
${JSON.stringify(authored.questions)}`,
      { label: `verify:${SUBJECT}:${cl.id}`, phase: 'Verify', schema: VERIFY_SCHEMA })
  }
)
const summary = results.filter(Boolean)
const totalKept = summary.reduce((s, r) => s + (r.kept || 0), 0)
const totalAuthored = summary.reduce((s, r) => s + (r.authored || 0), 0)
log(`${LABEL} R${ROUND}: authored ${totalAuthored}, kept ${totalKept} across ${summary.length} clusters`)
return { subject: SUBJECT, round: ROUND, totalAuthored, totalKept, perCluster: summary }

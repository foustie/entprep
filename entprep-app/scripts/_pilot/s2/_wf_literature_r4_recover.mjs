export const meta = {
  name: 's2-literature-r4-recover',
  description: 'Recover the 6 literature r4 clusters whose verify failed (socket errors); author+verify, write JSON to s2/',
  phases: [
    { title: 'Author', detail: '6 missing topic-cluster agents' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'literature'
const ROUND = 4
const LABEL = 'ЛИТЕРАТУРА (Russian literature)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c07', n: 16, focus: 'Pushkin «Повести Белкина», «Дубровский» and more Lermontov: Пушкин «Дубровский» (Владимир Дубровский, Маша Троекурова, Кирила Троекуров, Архип-кузнец), «Барышня-крестьянка» (Лиза/Акулина, Алексей Берестов), «Метель», «Выстрел» (Сильвио, граф); Лермонтов «Три пальмы», «Листок», «Беглец», «Узник», «Тучи». Сюжет, герои, мотивы.',
    pairs: 'children_adults_love_dreams/love_and_honor ; heroic_epic_tales/byliny_pushkin_lermontov' },
  { id: 'c08', n: 16, focus: "Gorky's autobiographical trilogy and early works: «Детство» (Алёша Пешков, бабушка Акулина Ивановна, дед Каширин, Цыганок, «свинцовые мерзости жизни»), «В людях», «Мои университеты», романтический рассказ «Челкаш» (Челкаш и Гаврила). Герои, тема становления личности.",
    pairs: 'children_adults_love_dreams/children_and_adults ; love_little_man_satire_soul/little_man_theme' },
  { id: 'c10', n: 16, focus: 'Silver Age (deeper) — movements and poets: символизм (Блок, Брюсов, Бальмонт), акмеизм (Гумилёв «Жираф», «Капитаны»; Ахматова; Мандельштам), футуризм (Маяковский, Северянин, Хлебников); признаки направлений; Куприн «Поединок», Бунин «Лёгкое дыхание». Поэты, манифесты, образы.',
    pairs: 'epoch_change_war_morality/epoch_change ; reading_text_work/text_work' },
  { id: 'c11', n: 16, focus: 'Soviet prose and satire: Ильф и Петров «Двенадцать стульев» и «Золотой телёнок» (Остап Бендер, «великий комбинатор», Киса Воробьянинов), Зощенко сатирические рассказы («Аристократка», «Галоша», «Баня»), Н. Островский «Как закалялась сталь» (Павел Корчагин), Фадеев «Молодая гвардия», Платонов «Котлован». Сатира, герой эпохи.',
    pairs: 'love_little_man_satire_soul/society_satire ; epoch_change_war_morality/totalitarian_regime ; epoch_change_war_morality/war_in_lives' },
  { id: 'c12', n: 16, focus: 'Great Patriotic War poetry and prose: Симонов («Жди меня, и я вернусь», «Ты помнишь, Алёша, дороги Смоленщины...»), Твардовский «Я убит подо Ржевом», Ахматова «Мужество», Окуджава, Б. Полевой «Повесть о настоящем человеке» (лётчик Алексей Мересьев), Кондратьев «Сашка», Воробьёв «Убиты под Москвой». Подвиг, память, человек на войне.',
    pairs: 'epoch_change_war_morality/war_in_lives ; epoch_change_war_morality/moral_choice_modern' },
  { id: 'c13', n: 16, focus: 'Literary theory (advanced): системы стихосложения (силлабическая, силлабо-тоническая, тоническая), тропы (синекдоха, перифраз, символ, аллегория, гипербола, литота, ирония), виды комического (юмор, ирония, сатира, сарказм, гротеск), лирические жанры (послание, элегия, эпиграмма, эпитафия, ода, сонет), эпические жанры (рассказ, новелла, повесть, роман, очерк, притча, поэма), драматические жанры (комедия, трагедия, драма), понятия (конфликт, сюжет и фабула, лирический герой, психологизм, говорящие фамилии, антитеза).',
    pairs: 'reading_text_work/text_work' },
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

const FORMAT = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ${LABEL} questions. Author exam-quality ORIGINAL single-choice questions using the works named in YOUR cluster.

Each question MUST have: q (Russian stem naming the work/author, 1–3 sentences, no letter prefixes); o (exactly 4 Russian options, EXACTLY ONE correct, plausible distractors of the same kind); c (0–3, VARY across batch); e (Russian, 1–3 sentences, not starting with "Правильный ответ"); q_kk (faithful Kazakh of q); o_kk (4 options SAME ORDER as o, Kazakh, transliterate names); e_kk (faithful Kazakh of e); topic+subtopic from ALLOWED PAIRS (EXACT ids); difficulty easy|medium|hard mixed.

HARD RULES: accuracy paramount — only certain canonical facts, never invent/misattribute plots/quotes/authors; originality — fresh stems; 4 distinct options, no letter prefixes; answer wording not in the stem.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

phase('Author')
const results = await pipeline(
  CLUSTERS,
  (cl) => agent(`${FORMAT}\n\nYOUR CLUSTER: author ${cl.n} questions on:\n${cl.focus}\n\nALLOWED (topic/subtopic) PAIRS (EXACT ids):\n${cl.pairs}\n\nAuthor exactly ${cl.n} questions now.`,
    { label: `author:${SUBJECT}:${cl.id}`, phase: 'Author', schema: Q_SCHEMA }),
  (authored, cl) => {
    if (!authored || !authored.questions || !authored.questions.length) return null
    const outFile = `${OUT}/${SUBJECT}_r${ROUND}_${cl.id}.json`
    return agent(`You are an INDEPENDENT ЕНТ ${LABEL} verifier. Re-solve EACH question below from scratch, IGNORING the marked answer, then keep/drop.

KEEP only if ALL hold: (1) you independently reach exactly the marked c with certainty; (2) exactly one option unambiguously correct; (3) factually accurate, no invented/misattributed plot/quote/author; (4) 4 distinct Russian options, no letter prefixes, real 1–3 sentence e; (5) q_kk/o_kk/e_kk present, o_kk SAME ORDER as o, Kazakh faithful; (6) topic/subtopic among ALLOWED PAIRS: ${cl.pairs}. Else DROP. When in doubt, DROP. Be strict about author↔work↔quote attribution.

You MAY fix Kazakh slips / trim explanation; you may NOT change which option is correct (if c wrong, DROP).

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
log(`${LABEL} R${ROUND} recover: authored ${totalAuthored}, kept ${totalKept} across ${summary.length} clusters`)
return { subject: SUBJECT, round: ROUND, totalAuthored, totalKept, perCluster: summary }

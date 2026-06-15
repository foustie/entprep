export const meta = {
  name: 's2-literature-r4',
  description: 'Round 4: 18th-20th c. canon (Fonvizin..Simonov) + theory; author+verify bilingual ЕНТ literature; write JSON to s2/',
  phases: [
    { title: 'Author', detail: '14 topic-cluster agents, ~16 questions each' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'literature'
const ROUND = 4
const LABEL = 'ЛИТЕРАТУРА (Russian literature)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 16, focus: '18th c. and sentimentalism: Фонвизин «Недоросль» (Митрофанушка, госпожа Простакова, Стародум, Правдин, Скотинин, Софья, «Не хочу учиться, хочу жениться», говорящие фамилии, классицизм), Карамзин «Бедная Лиза» (Лиза, Эраст, «и крестьянки любить умеют», сентиментализм), Державин «Памятник», Радищев «Путешествие из Петербурга в Москву». Авторы, герои, направления.',
    pairs: 'love_little_man_satire_soul/society_satire ; reading_text_work/text_work' },
  { id: 'c01', n: 16, focus: 'Zhukovsky and the romantic ballad: «Светлана» (гадание, сон, жених), «Людмила», «Лесной царь» (вольный перевод Гёте), «Кубок», «Спящая царевна»; признаки баллады и романтизма (фантастика, рок, двоемирие). Сюжеты, образы, жанр.',
    pairs: 'myths_christmas_moral/myth_fairy_elements ; reading_text_work/text_work' },
  { id: 'c02', n: 16, focus: 'Gogol — «Тарас Бульба» and «Вечера на хуторе близ Диканьки»: Тарас Бульба (Остап, Андрий, измена Андрия из-за панночки, гибель Остапа, «Нет уз святее товарищества!», Запорожская Сечь), «Майская ночь, или Утопленница», «Вий» (Хома Брут), «Сорочинская ярмарка», «Страшная месть». Сюжет, герои, фольклорность.',
    pairs: 'epoch_change_war_morality/war_in_lives ; myths_christmas_moral/christmas_theme ; superfluous_hero_law_family/family_values_lit' },
  { id: 'c03', n: 16, focus: 'Ostrovsky: «Гроза» (Катерина, Кабаниха, Тихон, Борис, Дикой, Кулигин, Варвара, «тёмное царство», «луч света в тёмном царстве», гибель Катерины) и «Бесприданница» (Лариса Огудалова, Карандышев, Паратов, Кнуров, «вещь»). Конфликт, характеры, символика.',
    pairs: 'love_little_man_satire_soul/society_satire ; love_little_man_satire_soul/human_soul_secrets' },
  { id: 'c04', n: 16, focus: 'Nekrasov: поэма «Кому на Руси жить хорошо» (семь мужиков-странников, спор о счастье, Яким Нагой, Ермил Гирин, Матрёна Тимофеевна, Савелий — богатырь святорусский, Гриша Добросклонов), «Железная дорога» («Был ты ребёнком...»), «Размышления у парадного подъезда», «Крестьянские дети», «Мороз, Красный нос». Народ, тема страдания.',
    pairs: 'epoch_change_war_morality/epoch_change ; parables_nature_satire_morals/morals_ethics_values ; love_little_man_satire_soul/society_satire' },
  { id: 'c05', n: 16, focus: 'Leskov and the Russian «сказ»: «Левша» (тульский косой левша, подкованная блоха, англичане, атаман Платов, «мы, русские, со своим значением никуда не годимся» — наоборот, мастерство народа, трагизм судьбы мастера), «Очарованный странник» (Иван Северьяныч Флягин). Сказовая форма, герой-праведник.',
    pairs: 'love_little_man_satire_soul/little_man_theme ; parables_nature_satire_morals/parables_legends' },
  { id: 'c06', n: 16, focus: 'Tyutchev and Fet lyric poetry: Тютчев («Silentium!», «Не то, что мните вы, природа», «Умом Россию не понять», «Весенняя гроза» — «Люблю грозу в начале мая», философская лирика, природа как живое), Фет («Шёпот, робкое дыханье», «Я пришёл к тебе с приветом», «Вечер», безглагольность, импрессионизм, культ красоты). Темы, образы, особенности.',
    pairs: 'parables_nature_satire_morals/man_and_nature ; reading_text_work/text_work' },
  { id: 'c07', n: 16, focus: 'Pushkin «Повести Белкина», «Дубровский» and more Lermontov: Пушкин «Дубровский» (Владимир Дубровский, Маша Троекурова, Кирила Троекуров, Архип), «Барышня-крестьянка» (Лиза/Акулина, Алексей), «Метель», «Выстрел» (Сильвио); Лермонтов «Три пальмы», «Листок», «Беглец», «Узник», «Тучи». Сюжет, герои, мотивы.',
    pairs: 'children_adults_love_dreams/love_and_honor ; heroic_epic_tales/byliny_pushkin_lermontov' },
  { id: 'c08', n: 16, focus: "Gorky's autobiographical trilogy and early works: «Детство» (Алёша Пешков, бабушка Акулина Ивановна, дед Каширин, Цыганок, «свинцовые мерзости жизни»), «В людях», «Мои университеты», романтический рассказ «Челкаш» (Челкаш и Гаврила). Герои, тема становления личности.",
    pairs: 'children_adults_love_dreams/children_and_adults ; love_little_man_satire_soul/little_man_theme' },
  { id: 'c09', n: 16, focus: 'Late Tolstoy and Dostoevsky: Толстой «Анна Каренина» (Анна, Вронский, Каренин, Лёвин и Кити, «Все счастливые семьи похожи друг на друга...»), «Севастопольские рассказы», «Хаджи-Мурат»; Достоевский «Идиот» (князь Мышкин, Настасья Филипповна, Рогожин, Аглая), «Братья Карамазовы» (Дмитрий, Иван, Алёша, Фёдор, Смердяков, «Великий инквизитор», «Если Бога нет, то всё позволено»). Идеи, герои.',
    pairs: 'love_little_man_satire_soul/human_soul_secrets ; superfluous_hero_law_family/crime_law ; superfluous_hero_law_family/family_values_lit' },
  { id: 'c10', n: 16, focus: 'Silver Age (deeper) — movements and poets: символизм (Блок, Брюсов, Бальмонт), акмеизм (Гумилёв «Жираф», «Капитаны»; Ахматова; Мандельштам), футуризм (Маяковский, Северянин, Хлебников); признаки направлений; Куприн «Поединок», Бунин «Лёгкое дыхание». Поэты, манифесты, образы.',
    pairs: 'epoch_change_war_morality/epoch_change ; reading_text_work/text_work' },
  { id: 'c11', n: 16, focus: 'Soviet prose and satire: Ильф и Петров «Двенадцать стульев» и «Золотой телёнок» (Остап Бендер, «великий комбинатор», Киса Воробьянинов), Зощенко сатирические рассказы («Аристократка», «Галоша», «Баня»), Н. Островский «Как закалялась сталь» (Павел Корчагин, «Самое дорогое у человека — это жизнь...»), Фадеев «Молодая гвардия», Платонов «Котлован». Сатира, герой эпохи.',
    pairs: 'love_little_man_satire_soul/society_satire ; epoch_change_war_morality/totalitarian_regime ; epoch_change_war_morality/war_in_lives' },
  { id: 'c12', n: 16, focus: 'Great Patriotic War poetry and prose: Симонов («Жди меня, и я вернусь», «Ты помнишь, Алёша, дороги Смоленщины...»), Твардовский «Я убит подо Ржевом», Ахматова «Мужество», Окуджава, Б. Полевой «Повесть о настоящем человеке» (лётчик Алексей Мересьев), Кондратьев «Сашка», Воробьёв «Убиты под Москвой». Подвиг, память, человек на войне.',
    pairs: 'epoch_change_war_morality/war_in_lives ; epoch_change_war_morality/moral_choice_modern' },
  { id: 'c13', n: 16, focus: 'Literary theory (advanced): системы стихосложения (силлабическая, силлабо-тоническая, тоническая), тропы (синекдоха, перифраз, символ, аллегория, гипербола, литота, ирония), виды комического (юмор, ирония, сатира, сарказм, гротеск), лирические жанры (послание, элегия, эпиграмма, эпитафия, ода, сонет), эпические жанры (рассказ, новелла, повесть, роман, очерк, притча, поэма), драматические жанры (комедия, трагедия, драма), понятия (конфликт, сюжет и фабула, лирический герой, психологизм, говорящие фамилии, антитеза, гипербола).',
    pairs: 'reading_text_work/text_work' },
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

const FORMAT = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ${LABEL} questions. Author exam-quality ORIGINAL single-choice questions.

This is round 4 — earlier rounds covered the core canon. Use the works named in YOUR cluster (mostly NOT yet covered). Favor certain facts: main and secondary characters, key plot turns, the idea/meaning of a scene, author↔work and character↔work matching, genre/направление/device identification, famous lines correctly attributed. Avoid the single most clichéd question per work.

Each question object MUST have these fields:
- q: Russian question stem, framed precisely like a real ЕНТ item — name the work/author in the stem, then ask. 1–3 sentences. No "А)/Б)" letter prefixes.
- o: exactly 4 Russian options, plausible, similar in length/category, EXACTLY ONE correct; distractors are other real characters/works/terms of the same kind.
- c: integer 0–3, index of the correct option. VARY c across your batch — use all of 0,1,2,3.
- e: Russian explanation, 1–3 sentences, WHY it is correct. Do NOT start with "Правильный ответ".
- q_kk: faithful Kazakh translation of q.
- o_kk: the 4 options translated to Kazakh, SAME ORDER as o. Transliterate proper names; don't invent.
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS for your cluster — EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them.

HARD RULES:
- ACCURACY IS PARAMOUNT. Only certain canonical facts. Never invent or misattribute plots, dates, quotes, characters, authors. Be careful with WHO wrote/said what. If unsure, write a different one you ARE sure of.
- ORIGINALITY. Do not reproduce or lightly reword any published or obvious item. Fresh stems, varied angle.
- Distinct options, no letter prefixes, no "all of the above"; the correct answer's wording must not appear in the stem.
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
      `You are an INDEPENDENT ЕНТ ${LABEL} verifier. Below is a JSON batch of single-choice questions. Re-solve EACH from scratch, IGNORING the marked answer, then keep/drop.

KEEP only if ALL hold:
1. You independently reach exactly the same correct option as marked c, with certainty, from well-known canonical facts.
2. Exactly one option is unambiguously correct; the other three clearly wrong.
3. Factually accurate — no invented or MISATTRIBUTED plot, date, quote, character, author (check who wrote/said what).
4. o has 4 distinct Russian options, no letter prefixes; e is a real 1–3 sentence explanation.
5. q_kk, o_kk, e_kk present; o_kk SAME ORDER as o; Kazakh faithful.
6. topic/subtopic among the ALLOWED PAIRS: ${cl.pairs}
Otherwise DROP. When in doubt, DROP. Be especially strict about author↔work↔quote attribution.

You MAY lightly fix obvious Kazakh slips and trim an over-long explanation. You may NOT change which option is correct; if c looks wrong, DROP.

After filtering, WRITE the survivors to this EXACT path using the Write tool:
${outFile}
Valid UTF-8 JSON shaped EXACTLY as {"questions":[ ... ]}. No markdown fences, no trailing commas. If zero survive, write {"questions":[]}.

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

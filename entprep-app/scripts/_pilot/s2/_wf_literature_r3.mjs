export const meta = {
  name: 's2-literature-r3',
  description: 'Round 3: broader canon (Turgenev..Aitmatov) bilingual ЕНТ literature questions; author+verify, write JSON to s2/',
  phases: [
    { title: 'Author', detail: '14 topic-cluster agents, ~16 questions each' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'literature'
const ROUND = 3
const LABEL = 'ЛИТЕРАТУРА (Russian literature)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 16, focus: 'Pushkin and Lermontov lyric poetry and «Капитанская дочка»: Пушкин лирика («Узник», «Анчар», «Пророк», «Я памятник себе воздвиг», «Я вас любил», «Зимнее утро», «К***» (Я помню чудное мгновенье), «Туча», «Во глубине сибирских руд»), повесть «Капитанская дочка» (Гринёв, Маша Миронова, Пугачёв, Швабрин, эпиграф «Береги честь смолоду»); Лермонтов лирика («Парус», «Тучи», «Родина», «Смерть поэта», «И скучно и грустно»). Themes and imagery.',
    pairs: 'heroic_epic_tales/byliny_pushkin_lermontov ; reading_text_work/text_work' },
  { id: 'c01', n: 16, focus: 'Turgenev: «Отцы и дети» (Базаров, нигилизм, Аркадий, братья Кирсановы, Одинцова, конфликт поколений), «Муму» (Герасим, барыня, Татьяна, собачка), «Ася», «Записки охотника» («Бирюк», «Хорь и Калиныч»). Characters, conflicts, ideas.',
    pairs: 'superfluous_hero_law_family/superfluous_people ; love_little_man_satire_soul/little_man_theme ; parables_nature_satire_morals/man_and_nature' },
  { id: 'c02', n: 16, focus: 'Chekhov short stories: «Хамелеон» (Очумелов, щенок), «Толстый и тонкий», «Человек в футляре» (Беликов, «как бы чего не вышло»), «Смерть чиновника» (Червяков), «Ионыч» (Старцев), «Крыжовник», «Злоумышленник», «Лошадиная фамилия». Satire of чинопочитание, пошлость, футлярность.',
    pairs: 'love_little_man_satire_soul/society_satire ; love_little_man_satire_soul/little_man_theme ; love_little_man_satire_soul/human_soul_secrets' },
  { id: 'c03', n: 16, focus: 'Chekhov plays and Gorky «На дне»: «Вишнёвый сад» (Раневская, Лопахин, Гаев, Аня, Петя Трофимов, продажа сада, звук лопнувшей струны), «Чайка» (Треплев, Нина Заречная), «Три сестры»; Горький «На дне» (ночлежка, Лука, Сатин «Человек — это звучит гордо!», Актёр, Васька Пепел, Костылёв) — спор о правде и лжи.',
    pairs: 'epoch_change_war_morality/epoch_change ; love_little_man_satire_soul/society_satire ; love_little_man_satire_soul/human_soul_secrets' },
  { id: 'c04', n: 16, focus: 'Dostoevsky «Преступление и наказание» in depth: Родион Раскольников, теория «тварь ли я дрожащая или право имею», «наполеоны» и «твари», убийство старухи-процентщицы и Лизаветы, Соня Мармеладова и её жертва, Порфирий Петрович, Свидригайлов, Лужин, Мармеладов, путь к раскаянию. Ideas, characters, moral message.',
    pairs: 'superfluous_hero_law_family/crime_law ; love_little_man_satire_soul/human_soul_secrets' },
  { id: 'c05', n: 16, focus: 'Tolstoy «Война и мир» and «После бала»: Наташа Ростова, Андрей Болконский (небо Аустерлица, дуб), Пьер Безухов, Кутузов и Наполеон, Платон Каратаев, семья Ростовых и Болконских, «мысль народная», Бородинское сражение; «После бала» (Иван Васильевич, полковник, контраст бала и наказания). Themes and characters.',
    pairs: 'epoch_change_war_morality/war_in_lives ; superfluous_hero_law_family/family_values_lit ; epoch_change_war_morality/moral_choice_modern' },
  { id: 'c06', n: 16, focus: 'Bunin and Kuprin: Бунин «Господин из Сан-Франциско» (безымянный богач, «Атлантида», смерть), «Тёмные аллеи», «Антоновские яблоки», «Цифры»; Куприн «Гранатовый браслет» (Желтков, Вера Шеина, гранатовый браслет, соната Бетховена), «Олеся», «Куст сирени», «Чудесный доктор». Themes of love, fate, dignity.',
    pairs: 'love_little_man_satire_soul/love_strangeness ; love_little_man_satire_soul/human_soul_secrets ; children_adults_love_dreams/love_and_honor' },
  { id: 'c07', n: 16, focus: 'Silver Age poetry: Блок («Незнакомка», поэма «Двенадцать», цикл «Стихи о Прекрасной Даме»), Есенин («Письмо матери», «Берёза», «Гой ты, Русь моя родная», «Отговорила роща золотая», образ родины и природы), Маяковский («Послушайте!», «Хорошее отношение к лошадям», новаторство, лесенка), Ахматова («Реквием», «Мужество»), Цветаева, Пастернак. Поэты, образы, средства.',
    pairs: 'epoch_change_war_morality/epoch_change ; reading_text_work/text_work' },
  { id: 'c08', n: 16, focus: 'Bulgakov: «Собачье сердце» (профессор Преображенский, доктор Борменталь, Шариков, Швондер, пёс Шарик, эксперимент), «Мастер и Маргарита» (Воланд и свита — Коровьев, Бегемот, Азазелло, Гелла; Мастер, Маргарита, роман о Понтии Пилате и Иешуа Га-Ноцри, Берлиоз, Иван Бездомный, бал у сатаны). Plot, characters, satire.',
    pairs: 'epoch_change_war_morality/totalitarian_regime ; love_little_man_satire_soul/society_satire' },
  { id: 'c09', n: 16, focus: 'World War II prose and the moral choice of war: Шолохов «Тихий Дон» (Григорий Мелехов, Аксинья) и «Судьба человека» (deeper), Васильев «А зори здесь тихие» (старшина Васков, пять зенитчиц — Рита, Женя, Лиза, Соня, Галя), Быков «Сотников» (Сотников и Рыбак), Некрасов «В окопах Сталинграда», Твардовский «Василий Тёркин». Подвиг, предательство, нравственный выбор.',
    pairs: 'epoch_change_war_morality/war_in_lives ; epoch_change_war_morality/moral_choice_modern' },
  { id: 'c10', n: 16, focus: 'Village prose and moral lessons: Распутин «Уроки французского» (мальчик, учительница Лидия Михайловна, игра на деньги, посылка) и «Прощание с Матёрой» (Дарья, затопление деревни), Астафьев «Конь с розовой гривой» (пряник, бабушка, обман) и «Васюткино озеро», Шукшин «Чудик», «Микроскоп», «Срезал». Совесть, доброта, память.',
    pairs: 'myths_christmas_moral/moral_choice ; children_adults_love_dreams/children_and_adults ; parables_nature_satire_morals/morals_ethics_values' },
  { id: 'c11', n: 16, focus: 'Chingiz Aitmatov and humanistic prose: «Белый пароход» (мальчик, легенда о Рогатой матери-оленихе), «Первый учитель» (Дюйшен, Алтынай), «Материнское поле» (Толгонай), «Плаха», «И дольше века длится день» (легенда о манкурте — человеке без памяти), «Прощай, Гульсары!». Memory, conscience, nature, humanity.',
    pairs: 'epoch_change_war_morality/moral_choice_modern ; parables_nature_satire_morals/morals_ethics_values ; children_adults_love_dreams/children_and_adults' },
  { id: 'c12', n: 16, focus: 'Parables, legends and romantic allegory: Горький «Старуха Изергиль» (Данко — горящее сердце во имя людей; Ларра — сын орла, наказанный одиночеством) и «Песня о Соколе» («Безумству храбрых поём мы песню!»); библейские притчи (о блудном сыне, о добром самаритянине, о сеятеле, о талантах); восточные и народные легенды. Идея, аллегория, мораль.',
    pairs: 'parables_nature_satire_morals/parables_legends ; myths_christmas_moral/myths_world ; myths_christmas_moral/moral_choice' },
  { id: 'c13', n: 16, focus: 'Literary theory and analysis (deeper): жанры (роман, повесть, рассказ, поэма, баллада, ода, элегия, сонет, эпиграмма, басня, комедия, трагедия, драма), литературные направления (классицизм, сентиментализм, романтизм, реализм, модернизм, символизм, футуризм, акмеизм), элементы композиции (пролог, экспозиция, завязка, развитие действия, кульминация, развязка, эпилог), виды рифмовки (перекрёстная, парная/смежная, кольцевая/опоясывающая), стихотворные размеры (ямб, хорей, дактиль, амфибрахий, анапест), стилистические фигуры (анафора, эпифора, инверсия, градация, оксюморон, антитеза, риторический вопрос, параллелизм).',
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

This is round 3 — the mainstream questions already exist. Draw on the BROADER canon named in your cluster. Favor specific-but-certain facts: secondary characters, key plot turns, the idea/meaning of a scene, author↔work and character↔work matching, genre/device identification. Avoid the single most clichéd question per work.

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
- ACCURACY IS PARAMOUNT. Only certain canonical facts. Never invent plots, dates, quotes, characters, or authors. If unsure, write a different one you ARE sure of.
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
3. Factually accurate — no invented or misattributed plot, date, quote, character, author.
4. o has 4 distinct Russian options, no letter prefixes; e is a real 1–3 sentence explanation.
5. q_kk, o_kk, e_kk present; o_kk SAME ORDER as o; Kazakh faithful.
6. topic/subtopic among the ALLOWED PAIRS: ${cl.pairs}
Otherwise DROP. When in doubt, DROP. Be especially strict about author↔work attribution.

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

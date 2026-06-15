export const meta = {
  name: 's2-literature-r2',
  description: 'Round 2: author + verify deeper bilingual ЕНТ literature questions across the canon; write per-cluster JSON to s2/',
  phases: [
    { title: 'Author', detail: '14 topic-cluster agents, ~16 questions each' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'literature'
const ROUND = 2
const LABEL = 'ЛИТЕРАТУРА (Russian literature)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 16, focus: 'Russian былины in depth: Добрыня Никитич (бой со Змеем Горынычем, спасение Забавы), Алёша Попович и Тугарин Змеевич, Святогор и его смерть, Вольга Святославич и Микула Селянинович (соха), Новгородский цикл — Садко (гусли, морской царь) и Василий Буслаев. Specific feats, weapons, epithets, epic devices (гипербола, постоянный эпитет, троекратный повтор).',
    pairs: 'heroic_epic_tales/byliny_pushkin_lermontov ; heroic_epic_tales/folklore_elements' },
  { id: 'c01', n: 16, focus: 'Pushkin narrative poems and lyric: «Песнь о вещем Олеге» (волхв, конь, змея — мотив судьбы), «Руслан и Людмила» (Черномор, голова, Наина, Финн), «Полтава», «Медный всадник» (Евгений, наводнение), themes of free will, fate, poetry. Match plot details and characters precisely.',
    pairs: 'heroic_epic_tales/byliny_pushkin_lermontov' },
  { id: 'c02', n: 16, focus: 'Pushkin verse fairy tales in depth: «Сказка о попе и о работнике его Балде», «Сказка о золотом петушке» (царь Дадон, Шамаханская царица, звездочёт), «Сказка о мёртвой царевне и о семи богатырях» (Чернавка, зеркальце, королевич Елисей), «Сказка о рыбаке и рыбке» (старуха, корыто, желания), «Сказка о царе Салтане» (Гвидон, царевна Лебедь, три чуда — белка, богатыри, царевна). Morals and motifs.',
    pairs: 'heroic_epic_tales/fairy_tales_verse' },
  { id: 'c03', n: 16, focus: 'Lermontov in depth: «Мцыри» (три дня свободы, бой с барсом, исповедь, монастырь), «Бородино» (солдат-рассказчик, «Скажи-ка, дядя…», редут), «Песня про купца Калашникова» (Кирибеевич, Алёна Дмитриевна, кулачный бой, царь), «Демон» (Тамара). Themes of freedom, motherland, honour.',
    pairs: 'heroic_epic_tales/byliny_pushkin_lermontov' },
  { id: 'c04', n: 16, focus: 'Literary and folk prose/verse fairy tales: Ершов «Конёк-Горбунок» (Иван-дурак, Жар-птица, Царь-девица, кит), Аксаков «Аленький цветочек» (купец, чудище, младшая дочь), Жуковский «Спящая царевна» (сон на ТРИСТА лет, злая чародейка, веретено), Погорельский «Чёрная курица» (Алёша, Чернушка, конопляное семечко), типы народных сказок (волшебные, бытовые, о животных) and structure.',
    pairs: 'heroic_epic_tales/fairy_tales_prose ; heroic_epic_tales/folklore_elements' },
  { id: 'c05', n: 16, focus: 'Greek/world mythology in depth: конкретные подвиги Геракла (Немейский лев, Лернейская гидра, Авгиевы конюшни, Стимфалийские птицы, пояс Ипполиты, яблоки Гесперид, пёс Цербер), Тесей и Минотавр (нить Ариадны), Персей и Медуза Горгона, Ясон и аргонавты (золотое руно), Дедал и Икар, Сизифов труд, муки Тантала, ящик Пандоры, Нарцисс, царь Мидас. Meaning of each myth.',
    pairs: 'myths_christmas_moral/myths_world ; myths_christmas_moral/myth_fairy_elements' },
  { id: 'c06', n: 16, focus: 'Christmas theme and moral choice: Гоголь «Ночь перед Рождеством» (кузнец Вакула, Оксана, чёрт, черевички царицы), Достоевский «Мальчик у Христа на ёлке», Куприн «Чудесный доктор» (доктор Пирогов, семья Мерцаловых), Андерсен «Девочка со спичками», Диккенс «Рождественская песнь» (Скрудж). Themes of mercy, conscience, compassion.',
    pairs: 'myths_christmas_moral/christmas_theme ; myths_christmas_moral/moral_choice' },
  { id: 'c07', n: 16, focus: 'Krylov fables in depth: «Слон и Моська», «Зеркало и Обезьяна», «Свинья под Дубом», «Мартышка и очки», «Кукушка и Петух», «Тришкин кафтан», «Демьянова уха», «Лебедь, Щука и Рак», «Стрекоза и Муравей», «Ворона и Лисица», «Волк на псарне». Identify the moral (мораль), allegory, and which human vice each satirizes.',
    pairs: 'parables_nature_satire_morals/satire_humor_fables ; parables_nature_satire_morals/parables_legends' },
  { id: 'c08', n: 16, focus: 'Saltykov-Shchedrin and satire: «Премудрый пискарь» (трусость), «Дикий помещик», «Повесть о том, как один мужик двух генералов прокормил», «Карась-идеалист», «Медведь на воеводстве»; приёмы — гротеск, гипербола, эзопов язык, фантастика; сатирическое обличение. Match work to its target/idea.',
    pairs: 'parables_nature_satire_morals/satire_humor_fables ; love_little_man_satire_soul/society_satire' },
  { id: 'c09', n: 16, focus: 'Man and nature: Тургенев «Бежин луг» и «Записки охотника», Пришвин «Кладовая солнца» (Настя, Митраша, Травка) и «Тёплый хлеб», Паустовский «Мещёрская сторона», Астафьев «Васюткино озеро» (мальчик в тайге), Бианки; themes of harmony with nature, человек и природа, responsibility.',
    pairs: 'parables_nature_satire_morals/man_and_nature ; parables_nature_satire_morals/morals_ethics_values' },
  { id: 'c10', n: 16, focus: 'Children, adults, love and honour: Чехов «Ванька» (письмо «на деревню дедушке»), «Мальчики», «Лошадиная фамилия»; Толстой «Кавказский пленник» (Жилин и Костылин, Дина) и «Детство»; Короленко «В дурном обществе» (Вася, Валек, Маруся, судья); Грин «Алые паруса» (Ассоль, Грэй, Эгль); Платонов «Юшка». Plot and theme.',
    pairs: 'children_adults_love_dreams/children_and_adults ; children_adults_love_dreams/love_and_honor ; children_adults_love_dreams/dreams_reality' },
  { id: 'c11', n: 16, focus: 'The "little man" and Gogol: «Шинель» (Акакий Акакиевич Башмачкин, новая шинель, «значительное лицо», призрак), Пушкин «Станционный смотритель» (Самсон Вырин, Дуня, Минский), Достоевский «Бедные люди» (Макар Девушкин, Варенька); Гоголь «Ревизор» (Хлестаков, городничий Сквозник-Дмухановский, немая сцена, «К нам едет ревизор») и «Мёртвые души» (Чичиков, Манилов, Коробочка, Ноздрёв, Собакевич, Плюшкин, птица-тройка).',
    pairs: 'love_little_man_satire_soul/little_man_theme ; love_little_man_satire_soul/society_satire ; love_little_man_satire_soul/human_soul_secrets' },
  { id: 'c12', n: 16, focus: 'The "superfluous man", «Горе от ума» and «Обломов»: Пушкин «Евгений Онегин» (письмо Татьяны, дуэль с Ленским, Ольга, именины, финальное объяснение), Лермонтов «Герой нашего времени» (Печорин, Бэла, Максим Максимыч, Грушницкий, княжна Мери, «Фаталист»), Грибоедов «Горе от ума» (Чацкий, Фамусов, Софья, Молчалин, Скалозуб, «Карету мне, карету!», «А судьи кто?»), Гончаров «Обломов» (обломовщина, Штольц, Ольга Ильинская, халат, диван).',
    pairs: 'superfluous_hero_law_family/superfluous_people ; superfluous_hero_law_family/hero_of_our_time ; superfluous_hero_law_family/family_values_lit' },
  { id: 'c13', n: 16, focus: 'War, the changing era, totalitarianism, and literary theory: Шолохов «Судьба человека» (Андрей Соколов, Ванюшка, плен), Твардовский «Василий Тёркин», Замятин «Мы» (Д-503, I-330, Единое Государство, Благодетель), Солженицын «Один день Ивана Денисовича» (Шухов, лагерь). PLUS literary theory: роды литературы (эпос, лирика, драма), жанры (поэма, ода, элегия, комедия, роман-эпопея), тропы (метафора, метонимия, гипербола, литота, эпитет, сравнение, олицетворение, антитеза, ирония, аллегория), стихотворные размеры (ямб, хорей, дактиль, амфибрахий, анапест), рифма, строфа.',
    pairs: 'epoch_change_war_morality/war_in_lives ; epoch_change_war_morality/totalitarian_regime ; epoch_change_war_morality/epoch_change ; reading_text_work/text_work' },
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

This is a LATER authoring round — the most obvious questions for these works already exist. Favor LESS-common but still 100%-certain facts: secondary characters, specific plot turns, genre/device identification, matching author↔work or character↔work, the meaning/moral of a scene. Avoid the single most clichéd question per work.

Each question object MUST have these fields:
- q: Russian question stem, framed precisely like a real ЕНТ item — name the work/author in the stem, then ask. 1–3 sentences. No "А)/Б)" letter prefixes anywhere.
- o: exactly 4 Russian options, plausible and similar in length/category, EXACTLY ONE correct; the 3 distractors clearly wrong to an expert but believable to a student (other real characters/works/terms of the same kind).
- c: integer 0–3, index of the correct option. VARY c across your batch — use all of 0,1,2,3 roughly evenly.
- e: Russian explanation, 1–3 sentences, stating WHY the answer is correct. Do NOT start with "Правильный ответ".
- q_kk: faithful Kazakh translation of q.
- o_kk: the 4 options translated to Kazakh, SAME ORDER as o. Keep proper names/titles recognizable (transliterate, don't invent).
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS for your cluster — EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them.

HARD RULES:
- ACCURACY IS PARAMOUNT. Include a question ONLY if certain from well-known canonical facts. Never invent plots, dates, quotes, or characters. If unsure, write a different one you ARE sure of.
- ORIGINALITY. Do not reproduce or lightly reword any published or obvious item. Fresh stems, varied angle.
- Distinct options, no letter prefixes, no "all of the above"; do not let the correct answer's wording appear in the stem.
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
3. Factually accurate — no invented plot, date, quote, character, author.
4. o has 4 distinct Russian options, no letter prefixes; e is a real 1–3 sentence explanation.
5. q_kk, o_kk, e_kk present; o_kk SAME ORDER as o; Kazakh faithful.
6. topic/subtopic among the ALLOWED PAIRS: ${cl.pairs}
Otherwise DROP. When in doubt, DROP.

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

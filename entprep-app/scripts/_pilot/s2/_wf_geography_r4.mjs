export const meta = {
  name: 's2-geography-r4',
  description: 'Round 4: specific named features + Kazakhstan geography; author+verify bilingual ЕНТ; write JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'geography'
const ROUND = 4
const LABEL = 'ГЕОГРАФИЯ (Geography)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 15, focus: 'Cartography with concrete tasks: converting numeric ↔ named scale and computing real ground distance from map distance at a given scale; reading topographic maps (горизонтали/изогипсы, абсолютная vs относительная высота, заложение, крутизна склона); азимут and direction; specific map projections and the distortions they minimise/cause (цилиндрическая Меркатора, коническая, азимутальная); types of remote sensing (аэрофото-, космическая съёмка) and GIS layers.',
    pairs: 'research_methods/research_methods ; cartography_geoinformatics/cartography ; cartography_geoinformatics/geoinformatics' },
  { id: 'c01', n: 16, focus: 'Named lithosphere/atmosphere facts: highest peaks (Джомолунгма/Эверест 8848 м, Эльбрус — высшая точка Европы/России, Хан-Тенгри, Белуха — Алтай), plate-boundary types (расхождение/срединно-океанические хребты, столкновение/складчатые пояса, разломы), the Pacific Ring of Fire, rock examples by origin (магматические — гранит/базальт, осадочные — известняк/песчаник, метаморфические — мрамор/гнейс), weathering types; climate belts and transitional belts, пассаты vs муссоны mechanism, warm/cold atmospheric fronts and the weather they bring, температурная инверсия, типы воздушных масс.',
    pairs: 'physical_geography/lithosphere ; physical_geography/atmosphere' },
  { id: 'c02', n: 16, focus: 'Named hydrosphere/biosphere facts: major ocean currents (Гольфстрим, Куросио, Северо-Атлантическое, Перуанское/Гумбольдта, Лабрадорское, Канарское — warm vs cold) and their climatic effect; superlatives (Нил/Амазонка — длиннейшие реки, Амазонка — полноводнейшая, Байкал — глубочайшее озеро, Каспий — крупнейшее, Танганьика, Виктория); lake origins (тектонические, ледниковые, вулканические, старицы, бессточные); natural zones flora/fauna (тундра, тайга, смешанные леса, степь, саванна, влажный экваториальный лес, пустыня) and the correct order of высотная поясность; soil types by zone (тундрово-глеевые, подзолистые, чернозёмы, серозёмы).',
    pairs: 'physical_geography/hydrosphere ; physical_geography/biosphere ; physical_geography/natural_territorial_complexes ; physical_geography/geoecological_research' },
  { id: 'c03', n: 15, focus: 'Population specifics incl. Kazakhstan: типы воспроизводства населения (1-й/традиционный, 2-й/современный) by region, демографический взрыв vs кризис, страны-лидеры по численности (Индия, Китай, США, Индонезия), уровни урбанизации by region, крупнейшие агломерации (Токио, Дели, Шанхай), главные миграционные потоки, типы половозрастных пирамид (прогрессивная/стационарная/регрессивная); Казахстан — низкая плотность, доля городского населения, многонациональный/многоконфессиональный состав, внутренняя миграция (село→город, на север/юг).',
    pairs: 'social_geography/population_geography' },
  { id: 'c04', n: 15, focus: 'Economic geography specifics incl. Kazakhstan: страны-лидеры по добыче нефти (Саудовская Аравия, США, Россия) и члены ОПЕК, угольные и металлургические районы, типы электростанций (ТЭС/ГЭС/АЭС/ВИЭ) и страны-лидеры, отрасли специализации сельского хозяйства по природным зонам, машиностроение и химическая промышленность центры, международное разделение труда, ТНК; Казахстан — отрасли специализации (нефть Атырау/Мангистау, уголь Караганды, металлы), главные месторождения (Тенгиз, Кашаган, Карачаганак), ЭГП.',
    pairs: 'economic_geography/natural_resources ; economic_geography/socioeconomic_resources ; economic_geography/world_economy_structure ; economic_geography/geoeconomics' },
  { id: 'c05', n: 16, focus: 'Country studies specifics: less-obvious capitals (Канберра, Оттава, Бразилиа, Веллингтон, Анкара, Исламабад, Абуджа, Претория/Кейптаун), формы правления (конституционные монархии — Великобритания, Япония, Швеция; абсолютные — Саудовская Аравия; республики), федеративные (США, Германия, Индия, РФ) vs унитарные государства, микрогосударства (Ватикан, Монако, Сан-Марино, Лихтенштейн), страны без выхода к морю (Монголия, Непал, Боливия, Казахстан — крупнейшее), субрегионы (Бенилюкс, Скандинавия, Магриб, Андские страны), integration blocs membership (ЕС, АСЕАН, ОПЕК, ЕАЭС, МЕРКОСУР).',
    pairs: 'country_studies/countries_world ; country_studies/world_regions ; country_studies/country_comparison ; country_studies/geopolitics' },
  { id: 'c06', n: 14, focus: 'Global problems & Kazakhstan ecology: опустынивание (Сахель, Приаралье), парниковые газы (CO2, метан) и парниковый эффект, разрушение озонового слоя (фреоны), кислотные дожди (SO2, NOx), обезлесение (Амазония, тайга), деградация почв, нехватка пресной воды, Киотский протокол/Парижское соглашение, концепция устойчивого развития (ЦУР); Казахстан — высыхание Аральского моря и его последствия, проблемы Каспия и Балхаша, Семипалатинский полигон, опустынивание и пыльные бури.',
    pairs: 'global_problems/global_problems_solutions ; physical_geography/geoecological_research ; physical_geography/hydrosphere' },
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

const FORMAT = `You are an expert author of Kazakhstan ЕНТ (Unified National Testing) ${LABEL} questions. Author exam-quality ORIGINAL single-choice questions.

This is round 4 — three prior rounds exist. Use the SPECIFIC named features/countries/processes in YOUR cluster. Test concrete, certain facts; avoid the most clichéd question per topic.

Each question MUST have:
- q: Russian stem, precise, 1–3 sentences, no letter prefixes.
- o: exactly 4 options, EXACTLY ONE correct, plausible similar distractors.
- c: integer 0–3, VARY across batch (use all of 0,1,2,3).
- e: Russian explanation, 1–3 sentences, not starting with "Правильный ответ".
- q_kk: faithful Kazakh of q.
- o_kk: 4 options SAME ORDER as o; translate words to Kazakh, keep numbers/units/proper-noun forms natural.
- e_kk: faithful Kazakh of e.
- topic + subtopic: from ALLOWED PAIRS, EXACT ids.
- difficulty: easy|medium|hard, mixed.

HARD RULES: accuracy paramount (correct capitals, locations, processes — never invent or use likely-stale figures); originality (fresh stems); 4 distinct options, no letter prefixes; answer wording not in the stem.
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

KEEP only if ALL hold:
1. You independently reach exactly the marked c, with certainty.
2. Exactly one option unambiguously correct; others clearly wrong.
3. Correct capitals, locations, processes, relationships; no invented or stale-likely figures.
4. 4 distinct options, no letter prefixes; real 1–3 sentence e; answer not leaked into stem.
5. q_kk, o_kk, e_kk present; o_kk same order; Kazakh faithful.
6. topic/subtopic among ALLOWED PAIRS: ${cl.pairs}
Else DROP. When in doubt, DROP.

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
log(`${LABEL} R${ROUND}: authored ${totalAuthored}, kept ${totalKept} across ${summary.length} clusters`)
return { subject: SUBJECT, round: ROUND, totalAuthored, totalKept, perCluster: summary }

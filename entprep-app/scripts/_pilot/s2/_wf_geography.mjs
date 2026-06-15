export const meta = {
  name: 's2-geography-r1',
  description: 'Author + independently verify original bilingual ЕНТ geography questions; write per-cluster JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'geography'
const ROUND = 3
const LABEL = 'ГЕОГРАФИЯ (Geography)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 15, focus: 'Research methods and cartography: geographic research methods (descriptive, comparative, cartographic, aerospace/remote sensing, statistical, GIS), map scale (numeric/named/linear) and computing real distance, map projections and distortions, legend/conventional signs, contour lines and relative height, geographic coordinates (latitude/longitude), azimuth and direction, types of maps (topographic, thematic), geoinformation systems (ГИС), GPS.',
    pairs: 'research_methods/research_methods ; cartography_geoinformatics/cartography ; cartography_geoinformatics/geoinformatics' },
  { id: 'c01', n: 16, focus: "Lithosphere and atmosphere: Earth's internal structure (core, mantle, oceanic vs continental crust), lithospheric plates and movement, earthquakes and seismic belts, volcanism, rock types (igneous, sedimentary, metamorphic) with examples, landforms (mountains, plains); atmosphere composition and layers (troposphere, stratosphere), temperature change with altitude, atmospheric pressure, global winds (passat/trade winds, westerlies), air masses, cyclones/anticyclones, climate-forming factors, climatic belts.",
    pairs: 'physical_geography/lithosphere ; physical_geography/atmosphere' },
  { id: 'c02', n: 16, focus: 'Hydrosphere, biosphere and landscapes: the World Ocean and its parts, salinity, ocean currents (warm/cold) and their climatic effect, rivers (basin, watershed, regime, питание), lakes (tectonic/glacial/endorheic), groundwater, glaciers; soils and soil-forming factors, soil types (чернозём, подзол); natural zones (тундра, тайга, степь, пустыня, саванна, влажные экваториальные леса), latitudinal zonality and altitudinal belts (высотная поясность), protected areas (заповедники), rational nature management.',
    pairs: 'physical_geography/hydrosphere ; physical_geography/biosphere ; physical_geography/natural_territorial_complexes ; physical_geography/nature_management ; physical_geography/geoecological_research' },
  { id: 'c03', n: 15, focus: "Population geography: world population size and growth, birth/death rate and natural increase, types of reproduction (traditional/modern), demographic transition, age-sex structure and pyramids, population density and distribution, urbanization and agglomerations, migration (internal/external, push/pull factors), ethnic and religious composition; Kazakhstan's population features (density, urbanization, migration).",
    pairs: 'social_geography/population_geography' },
  { id: 'c04', n: 15, focus: 'Economic geography: natural resources classification (exhaustible/renewable), mineral and fuel resources, world energy (oil, gas, coal, hydro, nuclear, renewables), agriculture (crop and livestock branches and zones), industry sectors (mining, manufacturing, machine-building, chemical, metallurgy), transport types, the structure of the world economy, international division of labour (МРТ), transnational corporations (ТНК), economic integration, primary/secondary/tertiary sectors.',
    pairs: 'economic_geography/natural_resources ; economic_geography/socioeconomic_resources ; economic_geography/world_economy_structure ; economic_geography/world_economy_trends ; economic_geography/geoeconomics' },
  { id: 'c05', n: 16, focus: 'Country studies and political geography: capitals and major countries by continent, largest countries by area and by population, microstates, landlocked vs maritime countries, forms of government and administrative-territorial structure, regions of the world (Зарубежная Европа, Азия, Африка, Латинская Америка, etc.), economic-geographic comparison of countries, integration groupings (ЕС/EU, АСЕАН/ASEAN, ОПЕК/OPEC, НАФТА, ЕАЭС), geopolitics.',
    pairs: 'country_studies/countries_world ; country_studies/world_regions ; country_studies/country_comparison ; country_studies/geopolitics' },
  { id: 'c06', n: 14, focus: 'Global problems and geoecology: classification of global problems (экологическая, демографическая, продовольственная, энергетическая, сырьевая, мира/разоружения, North-South gap), climate change and the greenhouse effect, ozone-layer depletion, desertification and land degradation, deforestation, freshwater scarcity, pollution of air/water/soil, the Aral Sea and Caspian ecological issues, the sustainable-development concept, ways to solve global problems.',
    pairs: 'global_problems/global_problems_solutions ; physical_geography/geoecological_research ; physical_geography/hydrosphere' },
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

This is round 3 — two prior rounds already cover the mainstream AND the moderately-deep questions for every topic. Assume the obvious facts are TAKEN. Generate only genuinely NEW items on the REMAINING less-common-but-certain facts: specific named countries/regions/rivers/ranges, distinctive cause–effect chains, comparisons, and processes a typical textbook would not foreground. Do not re-test the same specific fact already obvious in rounds 1–2.

Each question object MUST have these fields:
- q: Russian question stem, precise like a real ЕНТ item; an analytical scenario then a precise question works well. 1–3 sentences. No "А)/Б)" letter prefixes anywhere.
- o: exactly 4 Russian options, plausible and similar in length/category, EXACTLY ONE correct; the 3 distractors clearly wrong to a geographer but believable to a student.
- c: integer 0–3, index of the correct option. VARY c across your batch — use all of 0,1,2,3 roughly evenly.
- e: Russian explanation, 1–3 sentences, stating WHY the answer is correct. Do NOT start with "Правильный ответ".
- q_kk: faithful Kazakh translation of q.
- o_kk: the 4 options in the SAME ORDER as o. Translate word options to Kazakh; keep numbers, units, and proper-noun abbreviations identical where natural.
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS for your cluster — EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them (~30/45/25).

HARD RULES:
- ACCURACY IS PARAMOUNT. Include a question ONLY if you are certain of the answer (capitals, locations, figures, processes). Never invent facts or figures. If a statistic could be dated, prefer stable facts (relative size, location, process) over precise changing numbers.
- ORIGINALITY. Do not reproduce or lightly reword any published item. Fresh stems, varied angle.
- Distinct options, no letter prefixes, no "all of the above"; do not let the correct answer's exact wording appear in the stem.
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
      `You are an INDEPENDENT ЕНТ ${LABEL} verifier. Below is a JSON batch of single-choice questions authored by someone else. Re-solve EACH question yourself from scratch, IGNORING the marked answer, then decide keep/drop.

KEEP a question ONLY if ALL hold:
1. You independently reach exactly the same correct option as marked c, with certainty.
2. Exactly one option is unambiguously correct; the other three are clearly wrong.
3. Factually accurate — correct capitals, locations, processes, relationships. No invented or stale-likely figures.
4. o has 4 distinct options, no letter prefixes; e is a real 1–3 sentence explanation; the answer wording does not leak into the stem.
5. q_kk, o_kk, e_kk present; o_kk same order as o; Kazakh faithful.
6. topic/subtopic among the ALLOWED PAIRS: ${cl.pairs}
Otherwise DROP. When in doubt, DROP — precision over volume.

You MAY lightly fix obvious Kazakh slips and trim an over-long explanation. You may NOT change which option is correct; if c looks wrong, DROP.

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

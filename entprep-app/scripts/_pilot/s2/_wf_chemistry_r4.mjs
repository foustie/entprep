export const meta = {
  name: 's2-chemistry-r4',
  description: 'Round 4: named processes/reactions chemistry; author+verify bilingual ЕНТ; write JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'chemistry'
const ROUND = 4
const LABEL = 'ХИМИЯ (Chemistry)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 15, focus: 'Structure/periodicity — fresh angles: types of crystal lattices (ионная, атомная, молекулярная, металлическая) with concrete examples (NaCl, алмаз, лёд/CO2, металлы) and resulting properties; allotropes (O2/O3, алмаз/графит/фуллерен, белый/красный фосфор, ромбическая/моноклинная сера); electron configurations of IONS (Fe2+ vs Fe3+, Cu+ vs Cu2+, S2-, Al3+); comparison of atomic/ionic radii and electronegativity of specific element pairs; σ- and π-bonds count in molecules (N2, CO2, C2H4, C2H2); polar vs nonpolar molecules.',
    pairs: 'particle_structure/atom_structure_bonding ; particle_structure/periodic_law' },
  { id: 'c01', n: 15, focus: 'Redox/electrolysis/kinetics — named species: strong oxidizers (KMnO4 in acidic/neutral/basic medium → Mn2+/MnO2/MnO4 2-, K2Cr2O7 → Cr3+, конц. HNO3, H2O2) and reducers; products of electrolysis of specific aqueous solutions (CuSO4, NaCl, KNO3, AgNO3) with inert electrodes (cathode/anode); industrial named catalysts (V2O5 — контактный, Fe — синтез аммиака, Ni — гидрирование); writing the equilibrium-constant expression for a given reaction; whether a catalyst shifts equilibrium (it does not).',
    pairs: 'reaction_patterns/redox_electrolysis ; reaction_patterns/kinetics_equilibrium' },
  { id: 'c02', n: 15, focus: 'Ionic equilibria — specifics: ionic (молекулярно-ионные) equations of hydrolysis for named salts (Na2CO3, K2S, NH4Cl, Al2(SO4)3, FeCl3, CH3COONa) and the resulting medium and ион causing it; amphoteric hydroxides (Al(OH)3, Zn(OH)2, Cr(OH)3) reacting with BOTH acid and alkali; comparison of acid strength (HF<HCl<HBr<HI; H2CO3<CH3COOH? no — be careful, use safe comparisons); thermochemical equation: compute heat released/absorbed for a given amount from a given ΔH.',
    pairs: 'reaction_energetics/ionic_equilibria_hydrolysis' },
  { id: 'c03', n: 16, focus: 'Applied inorganic & industry: industrial processes (синтез аммиака Габера, контактный способ H2SO4 via SO2→SO3, доменный процесс получения чугуна/железа, электролитическое получение алюминия из глинозёма); жёсткость воды (временная/постоянная, способы устранения — кипячение, сода); compounds of calcium (негашёная CaO, гашёная Ca(OH)2, известняк/мел/мрамор CaCO3, гипс) and sodium (сода Na2CO3, питьевая сода NaHCO3) — formulas and uses; alloys (чугун, сталь, бронза, латунь, дюралюминий) composition; коррозия и защита.',
    pairs: 'chemistry_life/metals_nonmetals_general ; chemistry_life/group_1_2_3_elements ; chemistry_life/group_14_elements ; chemistry_life/group_16_sulfuric_acid ; chemistry_life/transition_metals_complexes' },
  { id: 'c04', n: 16, focus: 'Organic — named reactions and tests: реакция Кучерова (гидратация ацетилена → уксусный альдегид), правило Марковникова и Зайцева, реакция Вюрца, синтез Лебедева (дивинил→каучук), этерификация и гидролиз сложных эфиров/жиров (омыление), реакция «серебряного зеркала» (альдегиды + Ag2O аммиачный), окисление Cu(OH)2 (альдегиды, многоатомные спирты — глицерин), обесцвечивание бромной воды и KMnO4 (непредельные); качественное определение глюкозы, крахмала (йод → синий), белков (биуретовая, ксантопротеиновая); мономеры конкретных полимеров (капрон, лавсан, ПВХ, каучук).',
    pairs: 'organic_chemistry/hydrocarbons ; organic_chemistry/oxygen_containing_organic ; organic_chemistry/carbohydrates ; organic_chemistry/nitrogen_containing_organic ; organic_chemistry/polymers_petroleum' },
  { id: 'c05', n: 14, focus: 'Calculation types not yet used, with FRESH substances/numbers: выход продукта реакции в % (practical vs theoretical), задачи на избыток и недостаток (лимитирующий реагент), массовая доля примесей в образце, объёмные отношения газов и объём газа по уравнению, молярная концентрация раствора (моль/л) and переход к массовой доле, расчёт по термохимическому уравнению. Each problem self-contained, one provably-correct numeric answer, three plausible distinct wrong numbers; the answer must not appear verbatim in the stem.',
    pairs: 'calculations/molecular_formula_calculations ; calculations/calculations_kinetics_electrolysis' },
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

This is round 4 — three prior rounds exist. Use the SPECIFIC named processes/reactions/species in YOUR cluster. Assume basic facts are taken; test concrete, certain specifics. Use FRESH substances and numbers for every calculation.

Each question MUST have:
- q: Russian stem, precise, 1–3 sentences, no letter prefixes.
- o: exactly 4 options, EXACTLY ONE correct, plausible similar distractors.
- c: integer 0–3, VARY across batch (use all of 0,1,2,3).
- e: Russian explanation, 1–3 sentences, not starting with "Правильный ответ".
- q_kk: faithful Kazakh of q.
- o_kk: 4 options SAME ORDER as o; translate words to Kazakh, keep formulas/numbers/symbols identical.
- e_kk: faithful Kazakh of e.
- topic + subtopic: from ALLOWED PAIRS, EXACT ids.
- difficulty: easy|medium|hard, mixed.

HARD RULES: accuracy paramount (correct formulas, products, arithmetic — never invent); originality (fresh stems, no reworded items); 4 distinct options, no letter prefixes; answer value/wording not in the stem.
Return ONLY via the StructuredOutput tool as {questions:[...]}.`

phase('Author')
const results = await pipeline(
  CLUSTERS,
  (cl) => agent(`${FORMAT}\n\nYOUR CLUSTER: author ${cl.n} questions on:\n${cl.focus}\n\nALLOWED (topic/subtopic) PAIRS (EXACT ids):\n${cl.pairs}\n\nAuthor exactly ${cl.n} questions now.`,
    { label: `author:${SUBJECT}:${cl.id}`, phase: 'Author', schema: Q_SCHEMA }),
  (authored, cl) => {
    if (!authored || !authored.questions || !authored.questions.length) return null
    const outFile = `${OUT}/${SUBJECT}_r${ROUND}_${cl.id}.json`
    return agent(`You are an INDEPENDENT ЕНТ ${LABEL} verifier. Re-solve EACH question below from scratch (recompute every calculation), IGNORING the marked answer, then keep/drop.

KEEP only if ALL hold:
1. You independently reach exactly the marked c, with certainty.
2. Exactly one option unambiguously correct; others clearly wrong.
3. Correct formulas, valences, products, arithmetic; no invented values.
4. 4 distinct options, no letter prefixes; real 1–3 sentence e; answer not leaked into stem.
5. q_kk, o_kk, e_kk present; o_kk same order (formulas/numbers identical, words translated); Kazakh faithful.
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

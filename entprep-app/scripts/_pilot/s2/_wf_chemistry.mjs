export const meta = {
  name: 's2-chemistry-r1',
  description: 'Author + independently verify original bilingual ЕНТ chemistry questions; write per-cluster JSON to s2/',
  phases: [
    { title: 'Author', detail: 'one agent per topic cluster' },
    { title: 'Verify', detail: 'independent re-solve, drop unconfirmable, write JSON to disk' },
  ],
}

const SUBJECT = 'chemistry'
const ROUND = 3
const LABEL = 'ХИМИЯ (Chemistry)'
const OUT = 'C:/Users/adlet/OneDrive/Документы/entprep/entprep-app/scripts/_pilot/s2'

const CLUSTERS = [
  { id: 'c00', n: 15, focus: 'Atomic structure and periodic law: electron configurations (incl. less-trivial cases like Cr/Cu exceptions, P, Cl, Ca, Fe, and ions), periodic trends (atomic/ionic radius, electronegativity, ionization energy, metallic character along group/period), chemical bond types (ionic, covalent polar/nonpolar, metallic, hydrogen), valence and oxidation-state determination, isotopes, counts of protons/neutrons/electrons, sp/sp2/sp3 hybridization and molecular geometry.',
    pairs: 'particle_structure/atom_structure_bonding ; particle_structure/periodic_law' },
  { id: 'c01', n: 15, focus: 'Reaction patterns: identifying oxidizer and reducer, change in oxidation state, balancing simple redox by electron count, electrolysis products at cathode/anode (molten vs aqueous: NaCl, CuSO4, water, etc.), factors affecting reaction rate (concentration, temperature, surface area, catalyst), Le Chatelier principle (shifts on pressure/temperature/concentration change), reversible reactions and equilibrium.',
    pairs: 'reaction_patterns/redox_electrolysis ; reaction_patterns/kinetics_equilibrium' },
  { id: 'c02', n: 15, focus: 'Energetics and ionic equilibria: exothermic vs endothermic (sign of enthalpy), thermochemical reasoning, strong vs weak acids and bases, the pH/pOH scale and acidity comparison, salt hydrolysis and the resulting medium (acidic/basic/neutral) for salts like Na2CO3, NH4Cl, NaCl, CH3COONa, AlCl3; ionic equations of neutralization and exchange reactions; indicator colours (лакмус, фенолфталеин, метилоранж) in acid/base.',
    pairs: 'reaction_energetics/ionic_equilibria_hydrolysis' },
  { id: 'c03', n: 16, focus: 'Descriptive inorganic chemistry of elements: properties and characteristic reactions of alkali and alkaline-earth metals (Na, K, Ca, Mg) and aluminium; carbon and silicon (group IV); nitrogen, phosphorus and their oxides/acids (group V); oxygen, sulfur and sulfuric acid (concentrated vs dilute) (group VI); halogens F, Cl, Br, I and their relative activity (group VII); transition metals Fe, Cu, Zn, Cr and amphoteric oxides/hydroxides; qualitative reactions — flame colours (Na yellow, K violet, Ca brick-red), ion tests (Cl- with AgNO3, SO4(2-) with BaCl2, CO3(2-) with acid).',
    pairs: 'chemistry_life/metals_nonmetals_general ; chemistry_life/group_1_2_3_elements ; chemistry_life/group_14_elements ; chemistry_life/group_15_elements ; chemistry_life/group_16_sulfuric_acid ; chemistry_life/group_17_halogens ; chemistry_life/transition_metals_complexes' },
  { id: 'c04', n: 16, focus: 'Organic chemistry: homologous series and general formulas (alkanes CnH2n+2, alkenes, alkynes, arenes), structural isomerism, IUPAC nomenclature, characteristic reactions (substitution for alkanes; addition/hydrogenation/halogenation/hydration with Markovnikov for alkenes-alkynes; combustion), functional groups and classes (alcohols, phenols, aldehydes, carboxylic acids, esters, ethers), carbohydrates (glucose, fructose, sucrose, starch, cellulose), nitrogen compounds (amines, amino acids, proteins), polymers and their monomers, petroleum and natural-gas products.',
    pairs: 'organic_chemistry/hydrocarbons ; organic_chemistry/oxygen_containing_organic ; organic_chemistry/carbohydrates ; organic_chemistry/nitrogen_containing_organic ; organic_chemistry/polymers_petroleum' },
  { id: 'c05', n: 14, focus: 'Quantitative chemistry word problems with clean numeric answers: molar mass, amount of substance n=m/M, molar gas volume 22.4 L/mol at н.у., percent composition by mass, deriving empirical/molecular formula from percentage composition, simple stoichiometry (mass or volume of product from a balanced equation), mass fraction of solute in a solution. Each problem must contain all needed data, have a single provably-correct numeric answer and three plausible distinct wrong numeric options; never let the answer value appear verbatim in the stem.',
    pairs: 'calculations/molecular_formula_calculations ; calculations/calculations_kinetics_electrolysis' },
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

This is round 3 — two prior rounds already cover the mainstream AND the moderately-deep questions for every topic. Assume the obvious facts are TAKEN. Generate only genuinely NEW items on the REMAINING less-common-but-certain facts: specific named compounds and their distinctive reactions/colours, less-usual comparisons, applied/industrial contexts, and calculations with FRESH substances and numbers (do not re-use a standard worked example). Do not re-test the same specific fact a typical textbook would.

Each question object MUST have these fields:
- q: Russian question stem, precise like a real ЕНТ item. 1–3 sentences. No "А)/Б)" letter prefixes anywhere.
- o: exactly 4 Russian/formula options, plausible and similar in length/category, EXACTLY ONE correct; the 3 distractors clearly wrong to a chemist but believable to a student.
- c: integer 0–3, index of the correct option. VARY c across your batch — use all of 0,1,2,3 roughly evenly.
- e: Russian explanation, 1–3 sentences, stating WHY the answer is correct. Do NOT start with "Правильный ответ".
- q_kk: faithful Kazakh translation of q.
- o_kk: the 4 options in the SAME ORDER as o. Translate WORD options to Kazakh; keep chemical formulas, numbers, symbols, and units IDENTICAL across o and o_kk.
- e_kk: faithful Kazakh translation of e.
- topic + subtopic: from the ALLOWED PAIRS for your cluster — EXACT ids.
- difficulty: "easy" | "medium" | "hard" — mix them (~30/45/25).

HARD RULES:
- ACCURACY IS PARAMOUNT. Include a question ONLY if you are certain of the answer. Never invent facts or values. For calculations, the four options must be numerically distinct and the correct value provably right.
- ORIGINALITY. Do not reproduce or lightly reword any published item. Fresh stems, varied angle.
- Distinct options, no letter prefixes, no "all of the above"; do not let the correct answer's exact wording/value appear in the stem.
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
1. You independently reach exactly the same correct option as marked c, with certainty (recompute every calculation yourself).
2. Exactly one option is unambiguously correct; the other three are clearly wrong.
3. Factually accurate — correct formulas, valences, products, and arithmetic. No invented values.
4. o has 4 distinct options, no letter prefixes; e is a real 1–3 sentence explanation; the answer value/wording does not leak into the stem.
5. q_kk, o_kk, e_kk present; o_kk same order as o (formulas/numbers identical, words translated); Kazakh faithful.
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

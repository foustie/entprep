# ENTprep Question Quality Standards

## Quality Tiers (from audit of 14 static files)

### Strong (follow these patterns)
- **math_literacy** — Kazakh context (tenge, ЕНТ), concise, good numeric distractors, step-by-step explanations
- **math_profile** — Clean formulas, systematic coverage, no bugs
- **physics** — Good numeric alternatives, formulas in explanations
- **history_kz** — Broad coverage, good historical distractors, informative explanations

### Good
- **geography** — Balanced KZ/world, informative (minor: outdated timezone info)
- **chemistry** — Good formula-based questions (minor: "A and C correct" pattern)
- **world_history** — Chronological coverage (minor: long option uточнения)
- **informatics** — Practical tracing tasks (minor: Pascal/Python mixed)

### Needs Work
- **biology** — Correct answer often longest. Distractor length imbalance
- **law** — Q131 has WRONG answer index (c:2 should be c:1). Long verbose distractors
- **english** — BUGS: Russian text in English options (Q25, Q44). Needs cleanup
- **literature_russian** — Only 115q (need 150). Mixed content (Russian + world + Kazakh + theory)
- **reading_passages** — WEAKEST. Only factual recall ("what number?"), no analysis/inference

### Incomplete
- **literature_kazakh** — Only 43 questions. Needs ~107 more

## Rules for Good Questions

### DO
1. Keep question text < 120 chars for factual, < 200 for context/problem
2. Make all 4 options similar length (max 2x variance)
3. Use Kazakh context (tenge, cities, realia) where possible
4. Include step-by-step solution in explanation (for math/physics/chemistry)
5. Include additional facts in explanation (for history/geography/literature)
6. Make distractors plausible — common mistakes, adjacent values, similar concepts
7. Randomize correct answer position (not always index 0 or 1)

### DON'T
1. Make correct answer the longest/most detailed option
2. Add parenthetical clarifications only to correct answer
3. Use "A and C are correct" as an option
4. Put Russian text in English questions
5. Ask only factual recall for reading passages — add analysis/inference
6. Mix Pascal and Python without clear labeling
7. Write verbose "watery" questions when 50 chars would suffice

## Subject-Specific Notes

### Math (literacy + profile)
- Numeric distractors: ±10-20% of correct, include common calculation errors
- Always show formula in explanation
- Use real-world KZ context for literacy

### Sciences (physics, chemistry, biology)
- Formula-based questions: keep options as numbers/formulas, not text
- Biology: equalize option lengths — biggest problem area
- Chemistry: avoid "both A and C" patterns

### Humanities (history, world_history, literature, law)
- Include dates and context in explanations
- Distractors should be real historical alternatives, not random
- Law: cite specific KZ law articles

### Languages (english, reading)
- English: ALL options must be in English (no Russian)
- Reading: mix factual (30%) + inference (40%) + analysis (30%)
- Reading explanations should explain WHY, not just quote text

## Bloom's Taxonomy Distribution for ENT
- ~20% Запоминание (факты, даты, определения)
- ~30% Понимание (объяснение, сравнение, обобщение)
- ~50% Применение + Анализ (решение задач, выводы, причинно-следственные связи)

## MCQ Quality Checklist (per question)
- [ ] Tests ONE specific concept
- [ ] Stem is clear without reading options
- [ ] No negative phrasing (NOT, EXCEPT) — if needed, CAPITALIZE
- [ ] No opinion words (important, main, best)
- [ ] All distractors plausible and homogeneous
- [ ] All options similar length (max 2x variance)
- [ ] All options grammatically consistent with stem
- [ ] No clue words repeated between stem and correct answer
- [ ] No absolute words (always, never, only, all)
- [ ] No "all of the above" / "none of the above"
- [ ] Correct answer position randomized
- [ ] Difficulty level tagged (easy/medium/hard)
- [ ] Topic tagged from TOPIC_MAP

## Distractor Rules
1. Based on REAL student mistakes and common misconceptions
2. Same category as correct answer (all dates, all formulas, all names)
3. Same length as correct answer
4. Grammatically consistent with stem
5. Logical order: numbers ascending, dates chronological
6. If nobody picks a distractor — it's broken, replace it
7. NEVER: two options that imply each other

## Matching Questions (5 per profile subject, 2pts each)
- Max 6 premises in left column
- RIGHT column has MORE items than left (extra distractors)
- Each premise → exactly one correct match
- Both columns need headers
- All items in column B must be plausible for any item in A

## Multiple Answer (5 per profile subject, 2pts each)
- Up to 3 correct from 6 options
- Partial credit possible

## Context Questions (5 per profile subject, 1pt each)
- Based on shared text/situation/diagram
- Tests APPLICATION not recall
- Example: "Construction company needs a conical roof with diameter 6m, height 2m..."

## Format Reference (from ent-specs.mjs)
- Profile subjects: 25 single + 5 context + 5 multiple + 5 matching
- Difficulty: 50% easy / 30% medium / 20% hard
- Mandatory: math(10q), reading(10q), history(20q)
- Passing scores: Law/Pedagogy 75, Medicine 70, National unis 65, Others 50

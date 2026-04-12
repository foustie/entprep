# ENTprep Training Intelligence

## What We Know (April 5, 2026)

### ENT 2026 Format (CONFIRMED — no changes until 2027)
- 120 questions, 5 subjects, 240 min, max 140 points
- Mandatory: History KZ (20q/20pts), Math Literacy (10q/10pts), Reading (10q/10pts)
- Profile (x2): 40q/50pts each
  - 25 single choice (1pt each)
  - 5 context-based (1pt each) — shared text/diagram
  - 5 multiple answer (2pts each) — up to 3 correct from 6 options
  - 5 matching (2pts each) — 2 correct pairs
- Difficulty: 50% easy / 30% medium / 20% hard

### Root Cause of "Watery" Questions
**AI generated 30K questions WITHOUT reference material.** The generation prompt only provided:
- Subject name + topic name
- 3 random example questions
- Quality rules (anti-patterns)

NO textbook content, NO factual data, NO formulas. AI invented from memory → repetitive, shallow, verbose.

### Reference Sources (FREE)
1. **okulyk.kz** — All KZ textbooks grades 1-11, PDF/EPUB, FREE
2. **testcenter.kz** — Official ENT specs, recommended textbook lists, demo tests (602₸)
3. **Our ent-specs.mjs** — All 13 subjects fully specified (topics, weights, question types)
4. **Our static fallbacks** — 150q × 13 subjects, manually curated (varying quality)
5. **Our summaries** — 341 topics × 2 languages (shallow but useful for context)

### Competitor Landscape
| Competitor | Questions | Quality | Unique Feature |
|-----------|-----------|---------|----------------|
| iTest.kz | 60,000 | High (by ENT creators) | Lecture-linked questions |
| EdooX | 40,000+ | Medium-High | AI tutor, 1.5M users |
| ENTprep (us) | 28,593 | Mixed | Free, AI explain, Arena |
| TestHub.kz | ? | Medium | Generative unique tests |
| ymnik.kz | ~3,000 | Medium | Free, solutions |

### What We're Missing vs Competitors
1. **Context questions depth** — iTest has 33 context variants per physics alone
2. **Multiple answer format** — need proper 6-option questions (up to 3 correct)
3. **Matching format** — need proper pair-matching questions
4. **Video explanations** — competitors have video, we have AI text (our advantage is AI)
5. **Question-lecture linkage** — iTest links each question to a lecture. We have summaries but they're not linked in generation

### Quality Audit Results (static fallbacks)
**Strong:** math_literacy, math_profile, physics, history_kz
**Good:** geography, chemistry, world_history, informatics
**Needs Work:** biology (distractor length), law (wrong answer Q131), english (Russian in English options)
**Weak:** reading_passages (factual only, no analysis), literature_russian (115q not 150)
**Incomplete:** literature_kazakh (43q, needs 107 more)

### Anti-Patterns Found
1. Correct answer is always the longest option (biology, law, informatics)
2. "A and C are correct" options (chemistry)
3. Russian text in English questions (english Q25, Q44)
4. Parenthetical clarifications only in correct answer
5. 5,663 questions have no topic tag
6. 2,400+ questions are unnecessarily long (>200 chars)
7. Reading questions are 90% factual recall, no analysis/inference

### Key Decisions Made
- Literature split into literature_russian + literature_kazakh (code done, awaiting deploy)
- AI Tutor model fixed: claude-haiku-4-5-20251001 → claude-sonnet-4-20250514
- Free for students forever. B2B (schools pay) for revenue.
- No API spending until Diyar gets funds (tomorrow)

## Architecture: Grade-aware from Day 1
All content must be organized as: **grade → subject → quarter → section → topic**
Current content = grade 11 only, but structure must support grades 5-11.
- Questions: add `grade` field (default 11 for existing 30K)
- Summaries: organize as `summaries/{grade}/{subject}.json`
- Pipeline: `--grade=11 --subject=physics --quarter=3`
- Supabase: add `grade` column to questions table (nullable, default 11)
- This prevents rework when expanding to СОР/СОЧ after June

## Tomorrow's Plan (with API tokens)
1. Download textbooks from okulyk.kz for all 13 subjects
2. Build enhanced generation prompt: textbook content + golden examples + anti-patterns
3. Tag 5,663 untagged questions (Claude classifies → TOPIC_MAP)
4. Trim 2,400 watery questions (Claude shortens with golden standard examples)
5. Fix known bugs (english Russian options, law Q131)
6. Split literature in Supabase (keyword-based → kazakh/russian)
7. Generate missing questions (literature_kazakh needs 107+)
8. Deploy everything

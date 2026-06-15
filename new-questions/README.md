# New ENTprep questions — generation effort (June 2026)

**Total new questions: 6780**

All are original, bilingual (RU + KK), 4-option single-choice (reading = passage groups), each independently re-solved by a verifier and deduped (Jaccard 0.70) before insert. They are live in the Supabase question bank.

Source markers: `ai_gen_2026-06`, `ai_gen_s2_2026-06`
- `ai_gen_2026-06` — math, reading, history, math_profile, physics, biology, chemistry(part), geography(part), world_history, informatics, law, literature(part)
- `ai_gen_s2_2026-06` — literature, chemistry, geography, english (parallel session)

| Subject | New questions |
|---|--:|
| math | 350 |
| reading | 435 |
| history | 446 |
| math_profile | 266 |
| physics | 363 |
| biology | 810 |
| chemistry | 543 |
| geography | 590 |
| english | 344 |
| world_history | 437 |
| informatics | 385 |
| law | 769 |
| literature | 1042 |
| **TOTAL** | **6780** |

## Files
- `<subject>.json` — new questions for that subject
- `all-new-questions.json` — every new question combined

## Rollback (if ever needed)
```
DELETE FROM questions WHERE source IN ('ai_gen_2026-06','ai_gen_s2_2026-06');
```
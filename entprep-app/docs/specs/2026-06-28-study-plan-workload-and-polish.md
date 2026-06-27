# Study Plan — workload survey, denser days, design polish (2026-06-28)

Owner-approved follow-up to the v1 Study Plan (phases 1–4). Three asks from live review:
**(1)** fix the design, **(2)** more tasks per day, **(3)** a survey so the student picks their own workload.
(2)+(3) merge: the survey **is** the density control.

## 1. Workload survey (the "опрос")
Student picks one of **3 levels** at plan creation (and on regenerate). Default **medium**.

| Level | weekday tasks/day | weekend tasks/day | ≈ avg/day |
|-------|------|------|------|
| `light` (Лёгкая)     | 2 | 1 | ~2 |
| `medium` (Средняя)   | 4 | 2 | ~3–4 |
| `intense` (Интенсивная) | 6 | 3 | ~5–6 |

- `StudyWorkload = 'light' | 'medium' | 'intense'` added to `types/index.ts`.
- `GenerateStudyPlanInput.workload?` (default `'medium'`); persisted on `StudyPlan.workload` so regenerate pre-selects it.
- UI: a single modal `WorkloadPicker` reused for create **and** regenerate (regenerate variant shows the
  "progress will be wiped" warning — replaces the standalone regen-confirm modal). One level card per option
  (ink border + hard shadow, current level pre-highlighted). Picking a level → `handleGenerate(level)`.

## 2. Denser days (generator)
Today: `perWeekCount = 4 + rng()*3` (4–6/week) **and each task on a distinct day** → ≤1 task/day.
New: build tasks **per day-offset** using the workload quota → multiple tasks per day.
- Mon–Fri get `weekday` content tasks, Sat–Sun get `weekend`. Subjects rotate via the existing per-week shuffle;
  type still phase-driven (foundation lesson/practice, build practice, review review).
- `fullent` (review weeks + cold-start wk1) stands alone on **Saturday** (mock-exam day).
- Exactly **one challenge/week** on **Sunday** (premium), unchanged.
- Still pure/deterministic (seeded mulberry32; no Date.now/Math.random).

## 3. Design polish (design-system compliance)
Fixes the violations seen in the live screenshots:
- **Remove `filter: blur(3px)`** on locked rows (rule: *no blur*; it read as "broken/half-loaded").
- **Quiet, unified Start buttons** — one style (card bg + ink border + hard ink shadow), subject colour only as
  the small Play-icon tint. Removes the blue/purple/pink bright-button rainbow (rule: *one bright splash/screen*).
- **Subject identity → left border** on each task card (`borderLeft: 4px solid subjColor`), matching `SubjectCard`.
- **Locked premium week (wk ≥ 3, free user):** skip the day list; render **one** clean card —
  Lock + "Полный план — в Premium" + "{n} заданий · …" + "Открыть Premium". No N blurred rows.
- **Locked challenge in a free week (wk 1–2):** clean compact teaser row (Lock + title + PRO pill, tap → paywall).
  No blur, no overlay.

## Verify
typecheck + lint + new generator test (workload changes counts; multi-per-day). Playwright both themes @ 390/1440,
logged-out (create card) and a generated plan (light vs intense density; locked-week card; challenge teaser).
No prod deploy without explicit per-action authorization.

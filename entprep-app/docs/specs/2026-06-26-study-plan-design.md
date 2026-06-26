# Study Plan v1 — Design Spec

**Date:** 2026-06-26 · **Status:** approved (brainstorm) · **Inspired by:** oneprep.xyz "My Study Plan"

## Goal
Replace ENTprep's localStorage-cached **7-day AI plan** with a **long-horizon, week-by-week structured study plan** ("Мой план") that spans from today to the ЕНТ date. Students get a clear roadmap (Week X of N), dated weekly tasks with a **Start** button that deep-links into the real activity, progress checkboxes, and week navigation — like oneprep, but built on ENTprep's question-based content and design system.

## Locked decisions
| Decision | Choice |
|---|---|
| Generation | **Hybrid** — deterministic rule-based skeleton (v1); AI weekly "focus"/tips later (phase 4) |
| Plan length | **Derived from days-until-ЕНТ** (`GoalSettings.date` / `ENT_SCHEDULE`), clamped to [2, 26] weeks — not a fixed 24 |
| Placement | The **«Анализ» (Adaptive)** tab; opens the **current week** by default + week nav. The old 7-day ai-plan block is removed |
| PRO gating | **Weeks 1–2 free; week 3+ = Premium; Weekly Challenge task = Premium (all weeks)** |
| Calendar sync | **Deferred** (phase 5) |
| v1 scope | **Phases 1–3** (skeleton + persistence + UI). AI focus = phase 4, Calendar = phase 5 |

## Task types (oneprep → ENTprep mapping)
| Type | Maps to | Start action |
|---|---|---|
| `lesson` | read the topic **конспект** (`public/data/summaries/{sid}.json`) | open summary view / tutor in explain mode |
| `practice` | topic **test** | `nav('test', subject, topic)` |
| `review` | **разбор ошибок** | error-review flow (`navToErrorTest`) |
| `fullent` | **пробный Full ЕНТ** | `nav('fullent')` |
| `challenge` | **weekly challenge** (Premium) | challenge flow |
| `tip` | AI "focus of the week" / advice (phase 4) | display-only |

No `vocab` type (ENTprep has no vocab feature); English lexis is covered via normal `practice`.

## Data model
```ts
StudyPlan = {            // snapshot at creation → stable, never silently regenerates
  id: string
  createdAt: string      // ISO; also the deterministic seed
  examDate: string       // ISO
  target: number         // ЕНТ goal score
  weeksCount: number     // clamp(weeksUntil(examDate), 2, 26)
  weeks: Week[]
}
Week = {
  weekNum: number        // 1..N
  startDate: string; endDate: string
  phase: 'foundation' | 'build' | 'review'
  premium: boolean       // true for weekNum >= 3
  focus?: string         // AI, phase 4
  tasks: Task[]
}
Task = {
  id: string
  date: string           // ISO day this task falls on
  type: 'lesson'|'practice'|'review'|'fullent'|'challenge'|'tip'
  subject?: string; topic?: string
  title: string          // localized title (ru/kk)
  durationMin: number    // estimate, e.g. 3 / 10 / 15
  premium: boolean       // true for challenge tasks (and any task in a premium week)
}
Completion = Record<string /*taskId*/, { done: boolean; completedAt?: string; resultId?: string }>
```

**Persistence:** new Supabase table `study_plans` (`user_id`, `plan` JSONB snapshot, `completion` JSONB, `updated_at`) — OR embed `plan`/`planCompletion` into the existing `user_data` row reused by `cloudSync.ts`. Default: **embed in `user_data`** (reuses the load/save/merge + new-device-safety already built; one fewer table). LocalStorage cache mirrors the current `entprep_plan` pattern.

## Generation rules — `utils/studyPlanGenerator.ts` (pure, deterministic, unit-tested)
Inputs: `examDate`, `target`, profile subjects, weak/strong topics (`adaptiveHelpers` / `buildStudentProfile`), `today`, a seed (= `createdAt`).
1. `weeksCount = clamp(weeksBetween(today, examDate), 2, 26)`.
2. Phase split: first ~40% **foundation**, next ~40% **build**, last ~20% **review**.
3. Topic distribution weighted by weakness: cover mandatory (math/reading/history) + profile subjects; each weak topic gets `lesson → practice` in foundation, repeated `practice` in build; `fullent` sims + `review` (error review) concentrated in the review phase; one `challenge` per week.
4. 4–6 tasks/week spread across weekdays (weekends lighter); alternate subjects so hard subjects aren't back-to-back.
5. `premium` flags: `weekNum >= 3` → whole week premium; every `challenge` task premium.
6. Deterministic given the same inputs+seed (no `Math.random` — seed-based pick) so the layout is stable and reproducible.
7. Edge cases: `reading` has no subtopics (`TOPIC_MAP.reading === null`) → topic-less practice; very short runway (< 2 weeks to exam) → still produce a 2-week crash plan; no history yet → start with a diagnostic Full ЕНТ + foundation on mandatory subjects.

## Progress tracking
- Manual checkbox toggles `Completion[taskId].done`.
- **Auto-complete:** when `AppContext.addHist` records a `TestResult`, mark the earliest matching pending `practice`/`fullent` task done (match by `subject` (+`topic` when present), task `date <= result date`, within a window) and store `resultId`.
- Progress bar = % tasks done (current week) + overall %.

## UI — `«Анализ»` tab (follow the oneprep screenshot in ENTprep's design system)
- Header: **«Мой план»**, **«Неделя X из N»**, date range, ‹ › week nav (Previous/Next). Default = current week by date.
- Tasks grouped by day (`Пт 26 июн`): checkbox + **title** + `Предмет / Тип / ~N мин` + **Start** button (deep-link per task type above).
- Top: progress bar; **«Пересоздать план»** entry (enabled when no plan, or `examDate`/`target` changed).
- **PRO lock:** weeks 3+ render as a locked/blurred preview with a paywall CTA; `challenge` tasks show a PRO badge + paywall. Reuse `PaywallScreen` / `isPremium`.
- Design rules: tokens only (`COLORS`/`TYPE`/`FF`/`FS`/`SP`/`R`), CSS vars, no raw hex/arbitrary sizes; verify both themes at 390px and 1440px; every string through `useT()` (ru + kk).

## Build phases
- **Phase 1 (v1):** types + `studyPlanGenerator.ts` + unit tests (length from exam date, phase split, distribution, determinism, PRO flags, edge cases).
- **Phase 2 (v1):** persistence — `plan`/`planCompletion` in `user_data` + `cloudSync` + localStorage cache + completion auto-mark hook in `AppContext.addHist`.
- **Phase 3 (v1):** UI in the «Анализ» tab — replace the 7-day plan block with the week view, week nav, task list, Start deep-links, progress bar, PRO locks, ru+kk locales.
- **Phase 4 (later):** AI weekly `focus` + tips via `utils/ai.mjs` adapter (one batched call at creation; `parseLooseJson`/`sanitizeMath`).
- **Phase 5 (later):** Google Calendar sync (OAuth Calendar scope + Calendar API; all-day events).

## Out of scope (v1)
AI weekly focus (phase 4), Google Calendar (phase 5), drag-to-reschedule, manual task editing, multi-plan history.

## Risks / notes
- Removing the 7-day plan: keep the Adaptive **weakness analysis**; only the plan-generation/render block changes. Audit existing `entprep_plan` cache + `aiLimits` plan-limit logic and replace with plan-create gating.
- Plan stability: snapshot at creation; regenerate only on explicit user action or `examDate`/`target` change.
- A premium user who downgrades keeps a snapshot with premium weeks → gate at render by live `isPremium`, not by what was generated.

## Testing
- **Unit:** generator — weeks count from exam date (incl. < 2 weeks and far-future clamp), phase boundaries, topic coverage, determinism (same input+seed → same output), premium flags, `reading`/no-history edge cases.
- **Integration:** completion auto-mark on a matching `TestResult`; persistence round-trip (save → cloud → load → merge).
- **Manual:** «Анализ» week nav, every Start deep-link lands correctly, free user sees weeks 1–2 + PRO lock on week 3 / challenge, ru + kk, both themes, 390 / 1440.

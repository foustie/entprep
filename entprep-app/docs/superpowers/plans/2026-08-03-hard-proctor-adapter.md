# Hard Proctor Adapter Stub + Teacher Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Approach A — `HardProctorAdapter` + local camera/consent stub on Full ENT, teacher journal labels, and a 30–60 min teacher onboarding doc — without blocking exams on camera failure.

**Architecture:** FullENT talks only to `HardProctorAdapter`. Local stub handles consent UI hooks, `getUserMedia` PIP, and camera event logging via existing `logProctorEvent`. Soft tab/blur stays as-is. New migration file extends event_type CHECK (not applied until requested).

**Tech Stack:** React 18, Vite, existing Netlify `proctor.mjs`, Supabase `proctor_events`.

## Global Constraints

- Warn+log only — never auto-fail or change scoring
- Decline/deny camera → exam still allowed
- No photo/video upload in stub
- No Netlify deploy / migration apply unless user asks
- School tenant OR `VITE_HARD_PROCTOR=true` enables hard stub

---

## File map

| File | Responsibility |
|------|----------------|
| `src/utils/hardProctor/types.ts` | Adapter interface |
| `src/utils/hardProctor/noop.ts` | No-op when disabled |
| `src/utils/hardProctor/localStub.ts` | Camera + PIP + lifecycle |
| `src/utils/hardProctor/index.ts` | Factory |
| `src/utils/proctorHelpers.ts` | Event types + `isHardProctorEnabled` |
| `src/components/ui/HardProctorConsent.tsx` | Consent sheet |
| `src/components/FullENT.tsx` | Gate before test + adapter start/stop |
| `src/components/TeacherDashboard.tsx` | Event labels + stub caption |
| `netlify/functions/proctor.mjs` | Allow new event types |
| `supabase/migrations/20260803_proctor_hard_events.sql` | ALTER CHECK |
| `docs/WL-125-TEACHER-ONBOARDING.md` | Onboarding script |
| locales | Consent + labels |
| `.env.school125.example` | `VITE_HARD_PROCTOR` |

---

### Task 1: Event types + migration + API allowlist

- [ ] Extend `ProctorEventType` with camera_* types
- [ ] Add `isHardProctorEnabled()`
- [ ] Update `proctor.mjs` ALLOWED_TYPES
- [ ] Add migration `20260803_proctor_hard_events.sql` (drop/recreate CHECK)
- [ ] Commit

### Task 2: Adapter interface + stub + tests

- [ ] Write failing unit test for factory enable/disable
- [ ] Implement types, noop, localStub, index
- [ ] Tests pass (mock getUserMedia)
- [ ] Commit

### Task 3: Consent UI + FullENT wire-up

- [ ] `HardProctorConsent.tsx` + locale strings
- [ ] FullENT: before entering test, if hard enabled show consent; then `startSession`; on finish `stopSession`
- [ ] Commit

### Task 4: Teacher journal + onboarding

- [ ] Human labels for camera events in TeacherDashboard
- [ ] Optional first-visit coach banner
- [ ] `docs/WL-125-TEACHER-ONBOARDING.md`
- [ ] Update `.env.school125.example` + PROGRESS doc
- [ ] Typecheck + full tests
- [ ] Commit + push `wl/125`

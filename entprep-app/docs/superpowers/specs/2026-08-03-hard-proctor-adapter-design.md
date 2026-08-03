# Hard proctor adapter (vendor-ready stub) — Design

**Date:** 2026-08-03  
**Branch:** `wl/125`  
**Status:** Awaiting user review before implementation  
**Related:** Soft proctor (WS6) already logs tab/blur; КП stage 3 listed hard/camera as later / vendor.

## Goal

Ship a **vendor-ready stub** so School 125 Full ENT can show consent + optional camera PIP + journal events today, and swap in Proctorio (or similar) later **without rewriting FullENT**.

Policy stays **warn + log only** — never auto-fail, never change scoring.

## Non-goals (this iteration)

- Face detection / liveness / continuous video upload
- Auto-fail or score penalties
- Applying Supabase migrations or Netlify deploy (unless requested separately)
- Binding a real third-party SDK yet

## Approaches considered

| | Approach | Decision |
|---|----------|----------|
| **A** | `HardProctorAdapter` + local stub (consent, optional `getUserMedia` PIP, events) | **Chosen** |
| B | Full snapshot pipeline now | Deferred (privacy/storage) |
| C | Consent badge only, no camera API | Rejected (too fake; weak vendor seam) |

## Architecture

```
FullENT (school / VITE_HARD_PROCTOR)
    │
    ▼
HardProctorAdapter  (interface)
    ├── LocalHardProctorStub   ← MVP
    └── (later) ProctorioAdapter / other vendor
    │
    ├── soft events (existing): visibility_hidden, blur, focus, session_*
    └── hard events (new): camera_consent_accepted|declined, camera_start,
                           camera_denied, camera_stopped
```

Teacher journal (existing `proctor_events` + TeacherDashboard) shows soft + hard event types.

### Adapter interface (sketch)

```ts
interface HardProctorAdapter {
  /** Whether this build should run the hard-proctor gate before Full ENT test phase. */
  isEnabled(): boolean;
  /** Show consent UI; resolve true if student may proceed into test. */
  ensureConsent(): Promise<{ ok: boolean; reason?: 'declined' | 'error' }>;
  /** Start session (stub: getUserMedia + PIP). Called when phase → test. */
  startSession(ctx: { sessionId: string }): Promise<void>;
  /** Stop tracks, tear down PIP, log camera_stopped / session cleanup. */
  stopSession(): Promise<void>;
}
```

Soft tab/blur listeners remain in FullENT (or thin helpers) and keep calling `logProctorEvent` as today. The adapter owns **camera/consent only**; soft and hard share the same session id and event log.

### Enablement

```ts
isHardProctorEnabled() =
  isSchoolTenant() || import.meta.env.VITE_HARD_PROCTOR === 'true'
```

Stub still requires soft logging path (`isSoftProctorEnabled` or hard implies soft logging).

## Student UX (Full ENT)

1. Intro screen unchanged until **Start**.
2. If hard enabled → **Consent sheet** (RU/KK):
   - Exam may use camera for school integrity monitoring.
   - Warn+log only; results not auto-voided by this system.
   - Accept → proceed; Decline → log `camera_consent_declined`, toast, **still allow exam** (same philosophy as soft) unless product later requires block (not in this stub).
3. On accept → enter `test` phase; stub requests `getUserMedia({ video: true, audio: false })`.
   - Success → PIP self-view (corner), log `camera_start`.
   - Failure / deny OS prompt → log `camera_denied`, toast, exam continues.
4. If stream ends mid-exam → log `camera_stopped`, toast once; exam continues.
5. On finish → `stopSession()` (stop tracks, remove PIP), existing `session_end`.

No photos uploaded; no recording to disk/network in the stub.

## Teacher UX

- Expand student → proctor journal lists new camera event types with human labels.
- Optional small caption: «Прокторинг: stub (камера)» when hard enabled on this build.
- No snapshot gallery (out of scope).

## Teacher onboarding (WS7 parallel)

Deliverable: `docs/WL-125-TEACHER-ONBOARDING.md` — 30–60 min script:

1. Open Settings → Учительская панель  
2. Create / switch class, share `ENT-XXXX`  
3. Import sample pack (`public/tenant/sample-school-pack.json`), assign, run  
4. Read roster / weak topics  
5. Soft + hard journal: what each event means; warn+log policy  
6. Q&A / WhatsApp escalation  

Optional: one-time dismissible coach banner on TeacherDashboard first visit (`localStorage`).

## Data / API

Extend `proctor_events.event_type` CHECK (new migration file, **not applied** until requested):

- `camera_consent_accepted`
- `camera_consent_declined`
- `camera_start`
- `camera_denied`
- `camera_stopped`

Reuse `netlify/functions/proctor.mjs` allowlist. No new tables for stub.

## Config

| Env | Purpose |
|-----|---------|
| `VITE_HARD_PROCTOR=true` | Force hard stub on non-school builds |
| School tenant | Hard stub on by default with soft |
| `.env.school125.example` | Document both soft + hard flags |

## Files (expected)

| Path | Change |
|------|--------|
| `src/utils/hardProctor/types.ts` | Adapter interface |
| `src/utils/hardProctor/localStub.ts` | Consent helpers + camera/PIP |
| `src/utils/hardProctor/index.ts` | Factory `getHardProctorAdapter()` |
| `src/utils/proctorHelpers.ts` | New event types; hard enable helper |
| `src/components/FullENT.tsx` | Consent gate + adapter lifecycle |
| `src/components/ui/HardProctorConsent.tsx` | Consent sheet UI |
| `src/components/TeacherDashboard.tsx` | Labels for camera events |
| `netlify/functions/proctor.mjs` | Allow new event types |
| `supabase/migrations/20260803_proctor_hard_events.sql` | ALTER CHECK |
| `docs/WL-125-TEACHER-ONBOARDING.md` | Onboarding script |
| locales `ru` / `kk` | Consent + labels |

## Testing

- Unit: factory returns stub when enabled; disabled → no-op adapter.
- Manual: school env → consent → PIP → deny OS camera → events in journal (after migration applied).
- Existing suite must stay green; no flaky getUserMedia in CI (mock adapter in tests).

## Success criteria

- [ ] FullENT only depends on `HardProctorAdapter`, not vendor SDK
- [ ] Stub: consent + optional PIP + event log; exam never blocked by camera failure
- [ ] Soft proctor unchanged
- [ ] Teacher onboarding doc shipped
- [ ] Migration file present; apply/deploy still explicit follow-up

## Open follow-ups (post-MVP)

- Real `ProctorioAdapter` (or chosen vendor) implementing the same interface
- Optional “require camera or cannot start” school policy flag
- Snapshot / recording if school demands evidence beyond presence

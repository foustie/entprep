# ENTprep Audit — June 2026

> **Generated: 2026-06-06** by a fresh full-codebase review (supersedes the 2026-03 audit, preserved in git history).
> Legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW · ✅ verified OK
>
> **How this audit was produced** (ground-truth, not guesses):
> - `tsc --noEmit` → ✅ clean (0 type errors)
> - `eslint src/` → ❌ **3 errors, 74 warnings** (`npm run lint` fails CI — see L-group)
> - `vitest run` → ❌ **1 of 345 tests failing** (`npm run test` fails CI — see T1)
> - `npm audit` → **27 vulns (3 critical, 17 high, 7 moderate)** — all build/dev-time
> - Manual read of all 14 Netlify functions, the 13 highest-risk components/contexts, all config files, and both doc files.

---

## Table of Contents
1. [Build & CI Health (tooling ground-truth)](#1-build--ci-health)
2. [Security](#2-security)
3. [Correctness Bugs](#3-correctness-bugs)
4. [Code Hygiene](#4-code-hygiene)
5. [Documentation & Config Drift](#5-documentation--config-drift)
6. [Dead Code](#6-dead-code)
7. [UX / Accessibility](#7-ux--accessibility)
8. [Prioritized Action Plan](#8-prioritized-action-plan)
9. [Verified OK](#9-verified-ok)

---

## 1. Build & CI Health

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| **B1** | 🟠 | **`npm run lint` fails** — 3 `react-hooks/rules-of-hooks` errors | `Test.tsx:156` `useExplain()`, `Adaptive.tsx:115` `usePlanLimit/usePlan`, `Calc.tsx:16` `useMemoHelper()` | These are **false positives**: `useExplain`/`usePlan`/`useFreeFullEnt` (`utils/aiLimits.ts`) and `useMemoHelper` (`Calc.tsx:18`, returns a city list) are **plain utility functions, not React hooks** — the `use` prefix collides with the linter rule. **Rename** to non-`use` verbs (`consumeExplain`, `spendPlanCredit`, `getCities`). This is what's actually breaking lint. |
| **B2** | 🟠 | **`npm run test` fails** — time-bomb test | `utils/__tests__/competitionHelpers.test.ts:140` expects `daysLeft > 0`, but the test hardcodes goal date `2026-06-01` which is now in the past (today 2026-06-06) → `daysLeft` clamps to `0` | Use a relative future date in the test (e.g. `today + 30d`) or `vi.useFakeTimers()`. Not a product bug — but the suite is red. |
| **B3** | 🟡 | **27 npm vulnerabilities** (3 critical, 17 high) | `vite`, `vitest`, `esbuild`, `ws` advisories | **All are build/dev-time only** (not shipped to users). `npm audit fix` resolves most; the critical vitest-UI one only affects local dev. Low urgency, but keep current. |
| **B4** | 🟢 | 74 lint warnings | mostly unused vars in tests, 2 unused `eslint-disable` directives (`AppContext.tsx:80`, `MatchingCard.tsx:29`), unused imports | `npm run lint:fix` clears 35; remove the dead `eslint-disable` lines. |

---

## 2. Security

> Note on premium context: the paywall is currently **unreachable** (see DC1), so premium is effectively free for everyone right now. That *lowers the practical impact* of the referral/premium-grant bugs below today — but they become CRITICAL the moment paywall gating is re-enabled. Rated on that basis.

### 🔴 / 🟠 High-impact

| # | Sev | Issue | File:Line | Detail & Fix |
|---|-----|-------|-----------|--------------|
| **S1** | 🟠→🔴 | **PostgREST `ilike` injection in referral lookup → grant Premium to arbitrary/matched users** | `referral.mjs:46` | `nickname=ilike.${encodeURIComponent(referrer_nickname)}`. `encodeURIComponent` does **not** escape `*` (PostgREST wildcard), `(`, `)`. Only validation is `length >= 3` (`:39`). A value like `"ab*"` matches any nick starting `ab` → resolves an arbitrary referrer and grants 7d Premium to both. **Fix:** validate against strict nick regex `^[a-zA-Z0-9_]{3,20}$` before interpolating (the pattern `social.mjs` set_nickname already uses). |
| **S2** | 🟠 | **PostgREST `ilike` injection in user search / nickname resolve** | `social.mjs:106` (`search_users`), `social.mjs:306` (`resolve_nickname`), `promo.mjs:48` | Same `encodeURIComponent`-doesn't-cover-operators issue. `query` validated only as 2–30 chars. Allows altering the filter (enumerate profiles, bypass `id=neq.self`). Read-only, service key not leaked → HIGH not CRIT. **Fix:** regex-validate / strip non-alphanumerics before building the filter. |
| **S3** | 🟠 | **Prompt injection in `ai-explain` — user input concatenated raw into prompt** | `ai-explain.mjs:42,49,55` | Unlike `ai-plan.mjs:34` (which has a `sanitize()` stripping `{}[]<>` + length cap), `ai-explain` injects `question`, `options[]`, `explanation`, `pairs[]` verbatim. Enables system-prompt exfiltration / output steering and wastes paid tokens. **Fix:** reuse `ai-plan`'s `sanitize()` and clear instruction boundaries. |
| **S4** | 🟠 | **`teacher.mjs create_class` has no teacher-role check → cross-user history exposure** | `teacher.mjs:142-169` (create), `:70-135` (`get_class`) | Any authenticated user can create a "class" and become a teacher; `get_class` then returns **other students' full `user_data.hist` and per-subject stats** to anyone with the invite code. No role gate. **Fix:** gate on a verified teacher role (profiles column / allowlist), not mere authentication. |

### 🟡 / 🟢 Lower-impact

| # | Sev | Issue | File:Line | Detail & Fix |
|---|-----|-------|-----------|--------------|
| **S5** | 🟡 | **In-memory rate limiter is per-instance, non-persistent** | `utils/shared.mjs:40-71` | Module-level `Map` resets on cold start and isn't shared across concurrent Netlify instances → effective limit = `max × instances`. For abuse-sensitive endpoints (`referral`, `promo`) back the limiter with a Supabase row/atomic counter. |
| **S6** | 🟡 | **`set_nickname` uniqueness check is racy (TOCTOU)** | `social.mjs:121,125` | Two concurrent requests can both pass the pre-check and write. **Fix:** rely on a case-insensitive `UNIQUE` DB constraint + handle the 409, rather than the read-then-write pre-check. |
| **S7** | 🟢 | **RC webhook: static bearer secret, no replay/idempotency protection** | `revenuecat-webhook.mjs:113-119` | `timingSafeEqual` itself is correct, but it validates a static secret (not an HMAC of the body) and there's no `event.id` idempotency → a captured valid request can be replayed. **Fix:** add idempotency on `event.id`; use RC body-signature if available. |
| **S8** | 🟢 | **Public leaderboard GET may expose emails** | `leaderboard.mjs:33-110`, POST fallback `:244` | GET is intentionally unauthenticated and strips `user_id` for anon callers (good), but `user_name` falls back to `user.email` on POST (`:244`). Any historical row storing an email as `user_name` leaks it publicly. **Fix:** never persist email into `user_name`. |
| **S9** | 🟢 | **No admin audit logging** | `admin-action.mjs` | Admins can delete/modify questions with no trail. **Fix:** `audit_logs` table. (Carried from prior audit — still open.) |

---

## 3. Correctness Bugs

| # | Sev | Issue | File:Line | Detail & Fix |
|---|-----|-------|-----------|--------------|
| **C1** | 🟠 | **Duel: `setState` called during render** | `Duel.tsx:643-646` | `if (!q ...) { if (q && duelId && !submittingRef.current) handleSubmit(null); ... }` — `handleSubmit` calls `setState` **during render** → React "cannot update during render" / potential loop. **Fix:** move into a `useEffect`. |
| **C2** | 🟠 | **Duel: stale-closure timer/submit can desync or hang at "waiting"** | `Duel.tsx:280-296` (timer), `:314-335` (`handleSubmit`) | Per-question interval calls `handleSubmit(null)` and `handleSubmit` branches on `oppDone` captured from an old render. Mitigated by a recovery effect (`:349-360`) but fragile. **Fix:** make `handleSubmit` a `useCallback` with correct deps and/or read `oppDone` via a ref; re-fetch via `getDuel` on done. |
| **C3** | 🟡 | **Exam mode from SubjectDetail ignores language → Kazakh users get Russian questions** | `SubjectDetail.tsx:76` | `assembleProfileSection(sid, PROFILE_BLOCKS, true)` omits the `lang` arg that `FullENT.tsx:71-72` passes. Real localization bug. **Fix:** pass `st.lang`. |
| **C4** | 🟡 | **cloudSync dedup silently drops same-day identical results** | `cloudSync.ts:57-63` | Dedup key uses day-granular `dt` + `su/sc/tm/tp/co/to`. Two genuine same-day tests with identical subject/score/time collapse to one → lost from history, skews streak/XP. **Fix:** add a unique id/timestamp to `TestResult` and key on it. |
| **C5** | 🟡 | **Test.tsx: 300ms auto-finish `setTimeout` not cleared on unmount** | `Test.tsx:149-151` | If the component unmounts within 300ms of the last answer, `setFin`/`setCur` fire on an unmounted component (state lost / warning). **Fix:** store the timeout id in a ref and clear in cleanup. |
| **C6** | 🟡 | **AppContext: cross-tab `storage` handler overwrites unsynced local state** | `AppContext.tsx:93-106` | A storage event from tab B calls `setHist(fresh.hist)` etc., clobbering newer in-memory state in tab A not yet flushed. **Fix:** merge instead of overwrite. |
| **C7** | 🟡 | **Scoring: matching questions are all-or-nothing (no partial credit)** | `scoringEngine.ts:41-51` | `allCorrect ? maxPts : 0`. Multiple-answer gets partial credit but matching doesn't. **Verify against the official ЕНТ rubric** — if ЕНТ awards per-pair partial credit, this under-scores users. |
| **C8** | 🟢 | **AuthContext: duplicate premium/profile fetch race on mount** | `AuthContext.tsx:65-74` & `:76-110` | Eager `getSession` and `onAuthStateChange(INITIAL_SESSION)` both call `refreshProfile()` + `checkSubscription()`; later resolver wins → wasted calls + possible flicker. **Fix:** dedupe/gate the eager restore. |
| **C9** | 🟢 | **srEngine: interval can be 0 for an edge-case card** | `srEngine.ts:36-39` | `else` branch uses `card.interval` (0 for a fresh card) → "due today forever". **Fix:** `Math.max(1, ...)`. |

---

## 4. Code Hygiene

| # | Sev | Issue | File:Line | Detail |
|---|-----|-------|-----------|--------|
| **H1** | 🟡 | Unsafe `as Record<string,string>` casts on typed i18n object | `Test.tsx:138-139,344-345`, `FullENT.tsx:119-120,417-418` | Bypasses the `Translations` type → missing keys render `undefined` silently. Add the keys to the typed locale interface instead. |
| **H2** | 🟡 | Duel.tsx complexity | `Duel.tsx` (~895 lines, 15+ state vars, manual realtime) | High bug surface (root of C1/C2). Consider `useReducer` + extracting the realtime sync hook. |
| **H3** | 🟢 | Variable shadowing of i18n `t` by loop vars | `Adaptive.tsx:103,164-208` | `.map(t => ...)` shadows `const t = useT()`. Works today, footgun for future edits. Rename loop vars. |
| **H4** | 🟢 | `getPool` partial-fetch handling | `questionStore.ts:126-147` | On a mid-pagination network failure it returns partial rows but (correctly) skips caching/count-write when `!complete`. Verify UI doesn't treat a partial pool as authoritative within the session. |
| **H5** | 🟢 | 26 components still have no tests | `src/components/` | Core untested: Test, FullENT, Adaptive, SubjectDetail, Home, Progress, Settings (Duel/Friends/Leaderboard now have tests). |

---

## 5. Documentation & Config Drift

> These are **verified** mismatches between the docs and the actual code.

| # | Where | Doc says | Code actually says |
|---|-------|----------|--------------------|
| **DOC1** | Old AUDIT.md (pre-fix) | yearly = **4990₸** | `config/payment.ts:5-8` → **9990₸** (CLAUDE.md was right). Fixed in this rewrite. |
| **DOC2** | CLAUDE.md | "**33** components, **19** UI primitives" | Actual: **35** components, **20** UI (`Landing`, `TeacherDashboard`, the 6 `Home*` split files not counted). |
| **DOC3** | CLAUDE.md functions list | omits 3 functions | Actual extras: `delete-account.mjs`, `promo.mjs`, `teacher.mjs`. |
| **DOC4** | Old AUDIT.md I4 | "dead **Kaspi** code in `payment.ts` + `payment-webhook.mjs`" | **False** — no Kaspi code exists; `payment.ts` is pure RevenueCat; `payment-webhook.mjs` doesn't exist. Only a legacy `kaspiTxId` DB column name lingers. Removed that claim. |
| **DOC5** | Old AUDIT.md "free AI for all" | implied unlimited | AI explain still capped **10/day for everyone** (`aiLimits.ts:31`), AI plan capped **1 lifetime** — caps are no longer premium-gated but still enforced. |
| **DOC6** | `.env.example` | — | Missing vars that ARE used: `VITE_RC_API_KEY_APPLE`/`_GOOGLE` (`purchases.ts:4-5`), `REVENUECAT_WEBHOOK_SECRET` (`revenuecat-webhook.mjs:7`), `SUPABASE_SERVICE_KEY`, bare `SUPABASE_URL` (scripts). |

**Action:** update CLAUDE.md counts (DOC2/DOC3) and `.env.example` (DOC6) this session per the repo's own "keep docs up to date" rule.

---

## 6. Dead Code

| # | Item | Evidence |
|---|------|----------|
| **DC1** | **Entire paywall trigger path is unreachable** | `openPaywall(...)` is **destructured in 5 components** (`FullENT.tsx:51`, `HomeNavCards.tsx:14`, `Settings.tsx:52`, `Adaptive.tsx:66`, `Test.tsx:51`) but **called in none**. `paywallReason` (`NavigationContext.tsx:46`) only ever set by that unused fn → `PaywallModal` (`App.tsx:361`) can never open via normal flow. **Decide:** either re-wire gating or remove the dead path + modal. |
| **DC2** | **Dead imports in FullENT** | `FullENT.tsx:32` imports `canUseFreeFullEnt`/`useFreeFullEnt`, `:51-52` destructures `openPaywall`/`isPremium` — **none used** in the body. |
| **DC3** | **`FREE_PREMIUM` constant is inert** | `AuthContext.tsx:115` `= false`, but with paywall removed, `isPremium` only affects streak-freeze + cosmetic badges. No feature is locked. |
| **DC4** | **RevenueCat purchase flow orphaned on web** | `PaywallModal` purchase buttons fire only on native; with DC1 the whole RC flow is unreachable on web build. Keep for native, but document it. |

---

## 7. UX / Accessibility

| # | Sev | Issue | File:Line |
|---|-----|-------|-----------|
| **U1** | 🟡 | MatchingCard `<select>` dropdowns lack `aria-label` | `ui/MatchingCard.tsx` |
| **U2** | 🟡 | Inconsistent icon sizes (10–44px, no scale) | multiple — add `sm/md/lg/xl` constants |
| **U3** | 🟢 | Close buttons use generic `aria-label={t.close}` (no context for screen readers) | `Home.tsx` |
| **U4** | 🟢 | Keyboard nav can't change a selected answer in Test | `Test.tsx` |
| ✅ | — | **theme-color now updates for light theme** (`index.html:87`) — prior audit's D11 is resolved | — |
| ✅ | — | viewport-fit=cover + safe areas present (`index.html:5`) | — |

---

## 8. Prioritized Action Plan

**Now (CI is red — fixes are quick):**
1. **B1** — rename `useExplain`/`usePlan`/`useFreeFullEnt`/`useMemoHelper` → non-`use` names. Unblocks `npm run lint`.
2. **B2** — make the competitionHelpers test date relative. Unblocks `npm run test`.
3. **DOC2/DOC3/DOC6** — sync CLAUDE.md counts + function list + `.env.example`.

**This week (security + real bugs):**
4. **S1, S2** — strict regex-validate nicknames/queries before PostgREST `ilike` (free Premium / profile enumeration).
5. **S4** — add teacher-role gate (cross-user data exposure).
6. **S3** — sanitize `ai-explain` input.
7. **C1, C2** — fix Duel render-phase setState + stale-closure timer.
8. **C3** — pass `lang` in SubjectDetail exam mode.

**Decide (product call):**
9. **DC1** — re-enable paywall gating *or* delete the dead paywall path. Current state ("wired but unreachable") is the worst of both.
10. **C7** — confirm matching-question scoring vs official ЕНТ rubric.

**Backlog:**
11. **S5/S6/S7/S9** server hardening · **C4/C5/C6** data-integrity · **B3** `npm audit fix` · **H1–H5** hygiene · **U1–U4** a11y.

---

## 9. Verified OK

These were checked and are sound (no action needed):
- `tsc --noEmit` clean — no type errors.
- **Leaderboard POST** computes scores server-side from DB `c` values, regex-filters `user_ids` (`leaderboard.mjs:60`) — strong design.
- **Duel** strips correct answers before sending to client, validates question IDs as integers, enforces creator/opponent ownership.
- **Social friend ops** UUID-validate `friend_id`, enforce ownership on respond/remove.
- **Admin gating** — case-insensitive email allowlist checked after JWT verify (`ai-generate.mjs:21`, `admin-action.mjs:66`).
- **Service-role key** never returned to clients in any function.
- **`ai-plan.mjs`** properly sanitizes + clamps user input (the pattern `ai-explain` should copy).
- `questionStore` Supabase fetch has a 15s AbortController timeout and graceful localStorage→static fallback.
- iOS safe areas + light-theme status bar handled in `index.html`.

---

## Stats Summary

| Category | Items | 🔴/🟠 | 🟡 | 🟢 | ✅ |
|----------|------:|:----:|:--:|:--:|:--:|
| Build/CI | 4 | 2 | 1 | 1 | — |
| Security | 9 | 4 | 2 | 3 | 7 |
| Correctness | 9 | 2 | 5 | 2 | — |
| Hygiene | 5 | — | 2 | 3 | — |
| Doc/Config drift | 6 | — | 6 | — | — |
| Dead code | 4 | — | 4 | — | — |
| UX/a11y | 4 | — | 2 | 2 | 2 |
| **Total** | **41** | **8** | **22** | **11** | — |

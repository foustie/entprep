# ENTprep Full Audit & Roadmap

> Generated: 2026-03-08 | Updated: 2026-03-18
> Use this file as context for any Claude session working on ENTprep.
> ✅ = fixed, ⚠️ = partially fixed, ❌ = not fixed

---

## Table of Contents

1. [Security](#1-security)
2. [Code Hygiene & Logic Bugs](#2-code-hygiene--logic-bugs)
3. [UX & Design](#3-ux--design)
4. [App Store Readiness](#4-app-store-readiness)
5. [Incomplete Integrations](#5-incomplete-integrations)
6. [Prioritized Roadmap](#6-prioritized-roadmap)

---

## 1. Security

### CRITICAL

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| S1 | ✅ **Payment system disabled** | `AuthContext.tsx:84` | Fixed: RevenueCat IAP active, `FREE_PREMIUM = false`, premium checks DB + native |
| S2 | ✅ **Rate limiter broken in push-subscribe** | `netlify/functions/push-subscribe.mjs:17` | Fixed: uses `user.id` after auth verification |
| S3 | ✅ **Leaderboard score not validated** | `netlify/functions/leaderboard.mjs:127-272` | Fixed: server-side verification — fetches questions, verifies answers, calculates score |

### HIGH

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| S4 | ✅ **Duel question IDs not sanitized** | `netlify/functions/duel.mjs:200` | Fixed: explicit integer validation `qIds.every(id => Number.isInteger(id))` |
| S5 | ✅ **Duel fetched questions not validated** | `netlify/functions/duel.mjs:213` | Fixed: validates `ordered.length === qIds.length` |
| S6 | ✅ **Webhook timing attack** | `netlify/functions/revenuecat-webhook.mjs:112` | Fixed: uses `crypto.timingSafeEqual()` |

### MEDIUM

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| S7 | **In-memory rate limiter not persistent** | `netlify/functions/utils/shared.mjs:42` | Each Netlify Function instance has own store. Effective rate = `max × instances`. Fix: move to Supabase table or Redis |
| S8 | ✅ **Admin email check case-sensitive** | `netlify/functions/ai-generate.mjs:21` | Fixed: `.toLowerCase()` on both sides |
| S9 | **No admin audit logging** | `netlify/functions/admin-action.mjs` | Admin can delete/modify questions with no trail. Fix: add `audit_logs` table |

### LOW

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| S10 | ✅ **Android keystore passwords in plaintext** | `android/app/build.gradle:22` | Fixed: uses `System.getenv()` with fallback to project properties |
| S11 | **npm audit: 12 vulnerabilities** | `package.json` | 1 moderate, 11 high (rollup, serialize-javascript, minimatch, tar). Build-time only. Fix: `npm audit fix` |
| S12 | **AI endpoint returns raw text on parse failure** | `netlify/functions/ai-explain.mjs:96` | If Claude returns bad JSON, raw text shown as explanation. Fix: return proper error |

---

## 2. Code Hygiene & Logic Bugs

### HIGH

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| C1 | ✅ **Unsafe type coercion** | `NavigationContext.tsx:85` | Fixed: `navToErrorTest()` accepts `Question[]` properly |
| C2 | ✅ **SubjectDetail shows wrong count** | `SubjectDetail.tsx:106` | Fixed: shows `poolSize` (actual from Supabase) |
| C3 | ✅ **Timer not cleared on unmount** | `Test.tsx:141`, `FullENT.tsx:110` | Fixed: cleanup functions call `clearInterval()` |
| C4 | ✅ **Pool size mismatch Home vs SubjectDetail** | `SubjectDetail.tsx:32` | Fixed: uses `getPoolSize(sid)` |

### MEDIUM

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| C5 | ✅ **Debounce race condition** | `AppContext.tsx:47` | Fixed: reads fresh `loadData()` inside debounced callback |
| C6 | **SUBS/TOTAL_Q static initialization** | `questionPools.ts:1-17` | `TOTAL_Q` calculated at module load from localStorage (may be stale). Shows 1950 (13×150) until `prefetchCounts()` completes. Causes UI flicker |
| C7 | ✅ **Missing Kazakh translations** | `kk.ts` | Fixed: 855 lines (ru.ts: 877), all UI keys present. `Translations` type exported from ru.ts |
| C8 | **26 components have no tests** | `src/components/` | Core untested: Test, FullENT, Adaptive, SubjectDetail, Home, Duel, Friends, Leaderboard, Progress, Settings |
| C9 | ✅ **Silent localStorage failures** | `questionStore.ts:85` | Fixed: calls `captureError()` for QuotaExceededError (Sentry) |

### LOW

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| C10 | **No Supabase request timeout** | `questionStore.ts:109` | Fetch hangs forever on slow network. Fix: `Promise.race` with 10s AbortController |
| C11 | **Duel.tsx complexity** | `Duel.tsx:37-96` | 895 lines, 15+ state variables, real-time sync. High bug risk during refactoring. Consider `useReducer` |
| C12 | **ESLint suppressions** | `Test.tsx:78-80` | 6× `eslint-disable-line react-hooks/exhaustive-deps` — potential stale state bugs hidden |

---

## 3. UX & Design

### CRITICAL

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| D1 | ✅ **No safe area handling (iOS notch)** | `index.html:5,64` | Fixed: `viewport-fit=cover` + `env(safe-area-inset-*)` CSS padding |
| D2 | ✅ **Touch targets too small** | `Home.tsx:231` | Fixed: close buttons 44×44px, multiple components updated |
| D3 | ⚠️ **White (#fff) hardcoded on accent backgrounds** | `FullENT.tsx`, `Duel.tsx`, `Settings.tsx` | Partially fixed: some `color="#fff"` remain on gradient buttons |

### HIGH

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| D4 | ✅ **Hardcoded Russian in UI components** | `MultipleAnswerCard.tsx:59`, `MatchingCard.tsx:86` | Fixed: uses `t.test.multipleAnswers` / `t.test.matching` via `useT()` |
| D5 | **Inconsistent icon sizes** | Multiple files | Sizes: 10/13/14/15/16/18/20/22/28/32/38/44px — no standard. Fix: create constants (sm=14, md=16, lg=20, xl=24) |
| D6 | **Close buttons lack context** | `Home.tsx:211-243` | `aria-label={t.close}` — screen readers don't know what is being closed. Fix: context-specific labels |

### MEDIUM

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| D7 | ✅ **Onboarding 100vh ignores safe area** | `Onboarding.tsx:34` | Fixed: uses `100dvh` |
| D8 | **Keyboard navigation stuck after answer** | `Test.tsx:98-127` | After selecting answer, can't change via keyboard. Fix: allow re-navigation |
| D9 | **MatchingCard dropdowns not accessible** | `MatchingCard.tsx:36-58` | `<select>` elements missing `aria-label`. Fix: add descriptive labels |
| D10 | **Auth avatar missing alt text** | `Auth.tsx:62` | `<img alt="">` — empty alt. Fix: `alt={user.name}` |
| D11 | **Status bar not theme-aware** | `index.html:6` | `theme-color="#0C0C14"` hardcoded dark. Not updated for light theme |

### LOW

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| D12 | **Inconsistent button padding** | Multiple files | Ad-hoc values: "8px 12px", "15px", "16px 14px". Fix: use SP constants |
| D13 | **Dark mode splash flash** | `index.html:74-90` | Brief dark flash before light theme applies (~100ms) |

---

## 4. App Store Readiness

### BLOCKERS

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| A1 | ✅ **Placeholder App Store ID** | `PaywallModal.tsx:30` | Fixed: real ID `id6760261689` |
| A2 | ✅ **FREE_PREMIUM = true** | `AuthContext.tsx:84` | Fixed: RevenueCat active, premium checks DB + native |
| A3 | **No app icon** | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | Only 1024px provided. Need proper icon or verify Xcode auto-scales |
| A4 | **No screenshots** | App Store Connect | Need 6.7" and 6.5" screenshots (5-6 screens) |

### MAJOR (Rejection Risks)

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| A5 | **WebView-only app risk** | — | Apple may reject as "website wrapper". Mitigations: RevenueCat IAP (native), push notifications, offline support. Need to emphasize native features in review notes |
| A6 | ✅ **Missing viewport-fit=cover** | `index.html:5` | Fixed: `viewport-fit=cover` added |
| A7 | ✅ **RevenueCat not configured** | `purchases.ts` | Fixed: products created, IAP working on TestFlight |
| A8 | **Push notifications setup incomplete** | — | Web Push may not work on iOS native. Need Capacitor Push plugin or verify |

### MODERATE

| # | Issue | File:Line | Details |
|---|-------|-----------|---------|
| A9 | **Splash screen notch support** | `LaunchScreen.storyboard` | No safe area constraints for notch |
| A10 | **App description/keywords** | App Store Connect | Not yet filled in |
| A11 | **Age rating** | App Store Connect | Not yet configured |
| A12 | **Privacy policy** | ✅ Done | `https://entprep.org/privacy` |

---

## 5. Incomplete Integrations

### Integration Status Matrix

| Integration | Code Written | Configured | Working | Blocker |
|-------------|:---:|:---:|:---:|---------|
| **Apple Sign In** | ✅ | ✅ | ✅ | — |
| **Google OAuth** | ✅ | ✅ | ✅ | — |
| **RevenueCat IAP (iOS)** | ✅ | ✅ | ✅ | — |
| **RevenueCat IAP (Android)** | ✅ | ❌ | ❌ | Service account JSON + Play Console setup needed |
| **Push (Web)** | ✅ | ✅ | ✅ | — |
| **Push (Native iOS)** | ❌ | ❌ | ❌ | @capacitor/push-notifications not installed |
| **Push (Native Android)** | ❌ | ❌ | ❌ | google-services.json missing |
| **Sentry** | ✅ | ✅ | ✅ | — |
| **Plausible** | ✅ | ✅ | ✅ | — |
| **Referral System** | ✅ | ✅ | ✅ | — |

### I1. Apple Sign In — Setup Steps

**Code exists:** `Auth.tsx:25-30`, `AuthPrompt.tsx:35-43` — `signInWithOAuth({ provider: 'apple' })`

**What's missing:**
1. **Apple Developer Portal:**
   - Go to Certificates, Identifiers & Profiles → Identifiers → `kz.entprep.app`
   - Enable **Sign In with Apple** capability
   - Create **Services ID** (for web OAuth): identifier `kz.entprep.app.auth`
   - Register domain: add Supabase callback URL as authorized redirect
   - Create **Key** with Sign In with Apple enabled → download .p8 file

2. **Supabase Dashboard:**
   - Auth → Providers → Apple → Enable
   - Enter: Services ID, Team ID, Key ID, .p8 private key contents
   - Authorized redirect: `https://<project>.supabase.co/auth/v1/callback`

3. **Xcode:**
   - Signing & Capabilities → + Capability → **Sign In with Apple** (for native app)

### I2. RevenueCat — Remaining Setup

**Code exists:** `src/config/purchases.ts`, `netlify/functions/revenuecat-webhook.mjs`

**What's missing:**
1. Create products in **App Store Connect** → Subscriptions:
   - `entprep_monthly` (1990₸/мес)
   - `entprep_yearly` (4990₸/год)
2. Create products in **Google Play Console** → Monetize → Subscriptions
3. **RevenueCat Dashboard:**
   - Create project, add iOS + Android apps
   - Add products with same IDs
   - Upload Apple .p8 key
   - Upload Google service account JSON
   - Set webhook URL: `https://entprep.org/.netlify/functions/revenuecat-webhook`
4. **Netlify env vars:**
   - `VITE_RC_API_KEY_APPLE=appl_xxxxx`
   - `VITE_RC_API_KEY_GOOGLE=goog_xxxxx`
   - `REVENUECAT_WEBHOOK_SECRET=<token>`
5. **Supabase:** Run `payments` table migration SQL
6. **AuthContext.tsx:78:** Flip `FREE_PREMIUM = false`

### I3. Native Push Notifications

**Web push works** (push-subscribe.mjs, push-cron.mjs, sw.ts)

**Native not configured:**
- Install: `npm install @capacitor/push-notifications && npx cap sync`
- iOS: Add Push Notifications capability in Xcode + APNs key
- Android: Add `google-services.json` from Firebase Console
- Update `src/utils/pushHelpers.ts` to use Capacitor plugin on native

### I4. Dead Code — Kaspi Payment System

**Files:** `src/config/payment.ts`, `netlify/functions/payment-webhook.mjs`

Kaspi was dropped in favor of RevenueCat. Code lingers but is disabled. Can be removed after RevenueCat is fully working to reduce confusion.

### I5. Missing .env Documentation

**Used but undocumented env vars:**

| Variable | Used In | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | supabase.ts | Yes |
| `VITE_SUPABASE_ANON_KEY` | supabase.ts | Yes |
| `SUPABASE_SERVICE_KEY` | netlify functions | Yes (server) |
| `ANTHROPIC_API_KEY` | ai-*.mjs | Yes (server) |
| `VITE_SENTRY_DSN` | sentry.ts | Optional |
| `VITE_VAPID_PUBLIC_KEY` | pushHelpers.ts | For push |
| `VAPID_PRIVATE_KEY` | push-cron.mjs | For push |
| `ADMIN_EMAILS` | admin-action.mjs | Yes (server) |
| `ALLOWED_ORIGIN` | shared.mjs | Optional (defaults) |
| `VITE_RC_API_KEY_APPLE` | purchases.ts | For IAP |
| `VITE_RC_API_KEY_GOOGLE` | purchases.ts | For IAP |
| `REVENUECAT_WEBHOOK_SECRET` | revenuecat-webhook.mjs | For IAP |

---

## 6. Prioritized Roadmap

> **Realistic timeline: 5-7 дней** при ежедневной работе
> - Claude делает: код, фиксы, сборка, конфиги (~80% работы)
> - Ты делаешь: Apple Developer Portal, App Store Connect, RevenueCat dashboard, скриншоты, иконка (~20%, но блокирующие)

### Phase 1: Critical Code Fixes
> **~1 сессия Claude** | День 1

- [ ] **D1**: Add `viewport-fit=cover` + safe area CSS padding (`index.html`, main layout)
- [ ] **C2**: Fix SubjectDetail showing `sub.cnt` instead of `poolSize` (line 113)
- [ ] **C3**: Add timer cleanup in Test.tsx and FullENT.tsx useEffect returns
- [ ] **S2**: Fix push-subscribe rate limiter — use `user.id` instead of `req`
- [ ] **S10**: Move Android keystore passwords out of build.gradle into env vars
- [ ] **C1**: Fix unsafe type coercion in NavigationContext.tsx
- [ ] **S4**: Sanitize duel question IDs (integer validation)
- [ ] **S5**: Validate fetched duel questions count
- [ ] **S6**: Use `crypto.timingSafeEqual` for webhook secret
- [ ] **S8**: Normalize admin email check to lowercase
- [ ] **S11**: Run `npm audit fix`

### Phase 2: UX & Design Fixes
> **~1 сессия Claude** | День 1-2

- [ ] **D3**: Replace hardcoded `#fff` with theme-aware colors in FullENT, Duel, Settings, Auth
- [ ] **D2**: Increase touch targets to 44px minimum (Home, Friends, BackButton)
- [ ] **D4**: Extract hardcoded Russian labels to i18n (MultipleAnswerCard, MatchingCard)
- [ ] **D5**: Standardize icon sizes (create constants)
- [ ] **D7**: Fix onboarding height (use `100dvh`)
- [ ] **D8**: Fix keyboard navigation in Test after answer selection
- [ ] **D9**: Add aria-labels to MatchingCard dropdowns
- [ ] **D10**: Add alt text to auth avatar
- [ ] **D11**: Make status bar theme-aware
- [ ] **D12**: Standardize button padding with SP constants

### Phase 3: Apple Sign In
> **~1 сессия** | День 2 | ⚠️ Ты + Claude вместе

- [ ] Enable Sign In with Apple on App ID `kz.entprep.app` (Apple Developer Portal — **ты**)
- [ ] Create Services ID for web OAuth `kz.entprep.app.auth` (**ты**)
- [ ] Generate .p8 key with Sign In with Apple enabled (**ты**)
- [ ] Configure Supabase Apple provider — Services ID, Team ID, Key ID, .p8 (**ты**, Claude подскажет)
- [ ] Add Sign In with Apple capability in Xcode (**ты**)
- [ ] Test sign in flow end-to-end

### Phase 4: Payment System (RevenueCat)
> **~1 сессия** | День 3 | ⚠️ Ты + Claude вместе

- [ ] Create subscription products in App Store Connect: `entprep_monthly` (1990₸), `entprep_yearly` (4990₸) (**ты**)
- [ ] Create RevenueCat project, add iOS app (**ты**)
- [ ] Upload .p8 key to RevenueCat (**ты**)
- [ ] Add products in RevenueCat dashboard (**ты**)
- [ ] Set Netlify env vars: `VITE_RC_API_KEY_APPLE`, `REVENUECAT_WEBHOOK_SECRET` (**ты**)
- [ ] Run `payments` table SQL in Supabase (**ты**, Claude даст SQL)
- [ ] Flip `FREE_PREMIUM = false` (Claude)
- [ ] Replace placeholder App Store ID in PaywallModal (Claude)
- [ ] Test purchase flow in sandbox

### Phase 5: App Store Preparation
> **~1 сессия** | День 4 | ⚠️ Смешанная

- [ ] Создать иконку 1024×1024 (**ты** — Canva/Figma/заказать)
- [ ] Сделать 5-6 скриншотов на симуляторе iPhone 16 Pro Max (Claude + ты)
- [ ] Заполнить описание, ключевые слова, возрастной рейтинг (Claude напишет, **ты** вставишь)
- [ ] Update LaunchScreen.storyboard for notch safe areas (Claude)
- [ ] Review notes для Apple: объяснить native features (Claude напишет)

### Phase 6: Security Hardening
> **~1 сессия Claude** | День 4-5

- [ ] **S3**: Validate leaderboard scores server-side
- [ ] **S9**: Add admin audit logging table
- [ ] **C5**: Fix debounce race condition in AppContext
- [ ] **C10**: Add Supabase request timeout (10s AbortController)
- [ ] **C9**: Add user notification on localStorage quota exceeded
- [ ] Remove dead Kaspi payment code (`payment.ts`, `payment-webhook.mjs`)

### 🚀 Phase 7: RELEASE
> **День 5-6** | ⚠️ Ты + Claude вместе

- [ ] Final `npm run build` + `npx cap sync ios`
- [ ] Archive in Xcode → Distribute to App Store Connect
- [ ] Deploy web: `npx vite build && netlify deploy --prod --dir=dist --no-build`
- [ ] Выбрать build в App Store Connect
- [ ] Submit for Review
- [ ] ⏳ Ждать Apple Review (1-3 дня)

### Phase 8: Post-Release (Code Quality)
> **После релиза** | Ongoing

- [ ] **C7**: Complete Kazakh translations (missing UI keys)
- [ ] **C8**: Write tests for core components (Test, FullENT, SubjectDetail, Home)
- [ ] **C6**: Make TOTAL_Q reactive (not frozen at module load)
- [x] Kazakh question translations — **28 593/28 593 (100%) fully translated**
- [ ] Topic/section name localization (80 sections, 284 subtopics)
- [ ] Add more questions per subject (target: 2000+ each)
- [ ] Native push notifications (Capacitor plugin + APNs)

---

## Quick Reference: File Index

| File | Issues |
|------|--------|
| `index.html` | D1, D11, D13 |
| `AuthContext.tsx` | S1, A2 |
| `NavigationContext.tsx` | C1 |
| `AppContext.tsx` | C5 |
| `Home.tsx` | D2, D6 |
| `SubjectDetail.tsx` | C2, C4 |
| `Test.tsx` | C3, D8, C12 |no nnen
| `FullENT.tsx` | C3, D3 |
| `Duel.tsx` | D3, C11 |
| `PaywallModal.tsx` | A1 |
| `Onboarding.tsx` | D7 |
| `MultipleAnswerCard.tsx` | D4 |
| `MatchingCard.tsx` | D4, D9 |
| `Auth.tsx` | D3, D10 |
| `Settings.tsx` | D3 |
| `BackButton.tsx` | D2 |
| `Friends.tsx` | D2 |
| `questionStore.ts` | C9, C10 |
| `questionPools.ts` | C6 |
| `kk.ts` | C7 |
| `netlify/functions/push-subscribe.mjs` | S2 |
| `netlify/functions/leaderboard.mjs` | S3 |
| `netlify/functions/duel.mjs` | S4, S5 |
| `netlify/functions/revenuecat-webhook.mjs` | S6 |
| `netlify/functions/utils/shared.mjs` | S7 |
| `netlify/functions/ai-generate.mjs` | S8 |
| `netlify/functions/admin-action.mjs` | S9 |
| `netlify/functions/payment-webhook.mjs` | I4 (dead code) |
| `purchases.ts` | A7, I2 |
| `android/app/build.gradle` | S10 |
| `config/payment.ts` | I4 (dead code) |

---

## Stats Summary

| Category | Total | ✅ Fixed | ⚠️ Partial | ❌ Open |
|----------|-------|---------|-----------|--------|
| Security | 12 | 8 | 0 | 4 (S7, S9, S11, S12) |
| Code/Logic | 12 | 7 | 0 | 5 (C6, C8, C10, C11, C12) |
| UX/Design | 13 | 4 | 2 | 7 (D5, D6, D8, D9, D10, D12, D13) |
| App Store | 11 | 5 | 2 | 4 (A3, A4, A10, A11) |
| Integrations | 5 | 3 | 0 | 2 (native push iOS/Android) |
| **Total** | **53** | **27** | **4** | **22** |

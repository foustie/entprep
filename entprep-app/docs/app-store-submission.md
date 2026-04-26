# App Store Submission — ENTprep iOS

> **Цель:** ENTprep iOS LIVE к 30 апреля 2026 (до основного ЕНТ-сезона май-июль)
>
> Этот документ — пошаговый план для Diyar по подаче в App Store. Технические правки уже в коммитах `203ffdd` + `6457905` на ветке `design/typography-system`.

---

## ⚡ Готовность билда

| Item | Status | Notes |
|------|--------|-------|
| Bundle ID | ✅ | `kz.entprep.app` |
| Team ID | ✅ | `85MH8SWD4T` |
| App Store ID | ✅ | `6760261689` (запись существует) |
| MARKETING_VERSION | ✅ | `1.1.0` |
| CURRENT_PROJECT_VERSION | ✅ | `5` (bumped from 4) |
| AppIcon 1024×1024 | ✅ | Vector source |
| Splash light + dark | ✅ | 2732×2732 |
| PrivacyInfo.xcprivacy | ✅ | Data types + API reasons |
| ITSAppUsesNonExemptEncryption | ✅ | false |
| Apple Sign-In | ✅ | Native plugin + entitlement |
| Google Sign-In via OAuth | ✅ | Deep link callback |
| Account deletion | ✅ | Settings → Delete Account → `delete-account.mjs` |
| Universal Links | ✅ | `applinks:entprep.org` + AASA file |
| Native IAP via RevenueCat | ✅ | StoreKit, all 5 paywall surfaces bridged |
| Localized legal text (ru + kk) | ✅ | Auto-renewal disclosure |
| Anti-steering audit | ✅ | No web checkout links inside native |
| TypeScript / Build / Sim build | ✅ | All green |

---

## ⚠️ Что ты делаешь сам (~ 2-3 часа суммарно)

### 1. App Store Connect — Metadata (~30 мин)

Открой https://appstoreconnect.apple.com → My Apps → ENTprep (`6760261689`).

**App Information:**
- Subtitle: `AI-репетитор и тесты ЕНТ` (skopируй из `docs/aso-listing.md`)
- Category Primary: **Education**
- Category Secondary: **Productivity**
- Content Rights: проверь "Does your app contain, show, or access third-party content?" → No
- Age Rating: запусти questionnaire, ответь No на все (educational, no violence/UGC/gambling/etc) → результат **4+**

**Pricing & Availability:**
- Free
- Available in: All countries, OR ограничь Kazakhstan + Russia + Kyrgyzstan + Uzbekistan

**App Privacy:**
- Privacy Policy URL: `https://entprep.org/privacy.html`
- Privacy Choices URL: пусто (нет cookies tracking)
- Data Collected: соответствует тому что в `PrivacyInfo.xcprivacy`:
  - **Email** — Linked, App Functionality + Authentication
  - **Name** — Linked, App Functionality
  - **User ID** — Linked, App Functionality + Authentication
  - **Product Interaction** — Linked, App Functionality + Analytics
  - **Crash Data** — Not Linked, App Functionality + Analytics
  - **Performance Data** — Not Linked, Analytics
  - **Purchase History** — Linked, App Functionality
- Tracking: **No** (мы не трекаем cross-app)

**App Information → Localizable Information** (заполни RU + KK):
- Name: `ENTprep — Подготовка к ЕНТ` (RU) / `ENTprep — ҰБТ Дайындық` (KK)
- Subtitle: см. выше
- Description: copy из `docs/aso-listing.md` (3000 chars max)
- Keywords: copy из `docs/aso-listing.md` (100 chars exactly)
- Support URL: `https://entprep.org`
- Marketing URL: `https://entprep.org`
- Promotional Text: `28 000+ вопросов · AI-репетитор · Пробный ЕНТ. Готовься к ЕНТ 2026 уже сегодня.` (170 chars max — обновляется без re-review)

---

### 2. App Store Connect — In-App Purchases (~20 мин)

Open My Apps → ENTprep → **Features → In-App Purchases**.

Создай два **Auto-Renewable Subscription** в группе `entprep_premium`:

**Monthly:**
- Reference Name: `ENTprep PRO Monthly`
- Product ID: `entprep_pro_monthly`
- Price: Tier 5 (~$5.99 / ~2 990 ₸ / ~₽599) — Apple price tier picker
- Subscription Duration: 1 month
- Localizations:
  - Display Name (RU): `Premium · 1 месяц`
  - Description (RU): `Безлимит AI-репетитор и AI-разборы. Пробный ЕНТ без ограничений. Подписка автопродлевается, отменить в Apple ID.`
  - Display Name (KK): `Premium · 1 ай`
  - Description (KK): `Шектеусіз AI-репетитор және AI-түсіндірмелер. Сынақ ҰБТ шектеусіз. Жазылым автоматты ұзартылады, Apple ID-да бас тартыңыз.`
- Review Screenshot: 1242×2208 от paywall (любой test screen)

**Yearly:**
- Reference Name: `ENTprep PRO Yearly`
- Product ID: `entprep_pro_yearly`
- Price: Tier 19 (~$19.99 / ~9 990 ₸)
- Duration: 1 year
- Localizations: тот же стиль, заменить "месяц/ай" → "год/жыл"
- Review Screenshot: тот же

**ВАЖНО:** Product IDs (`entprep_pro_monthly`, `entprep_pro_yearly`) должны 1:1 совпадать с тем что в RevenueCat и в `src/config/payment.ts`. Сейчас в коде используется проверка через `purchases.ts` — она читает offerings из RC, так что главное чтобы RC знал эти IDs.

---

### 3. RevenueCat Dashboard (~15 мин)

Open https://app.revenuecat.com → Project ENTprep.

- **Settings → Apps → iOS:**
  - Bundle ID: `kz.entprep.app`
  - App Store Connect API: connect (если ещё не) — issue API key в ASC → Users and Access → Keys → App Store Connect API → копируй Issuer ID + Key ID + .p8 файл → upload в RC
- **Products:** import обоих (monthly + yearly) из ASC. Verify identifiers.
- **Entitlements:**
  - Create entitlement `premium` (если ещё нет)
  - Attach обои products к этому entitlement
  - В коде проверка: `customerInfo.entitlements.active.premium` ([purchases.ts:69](entprep-app/src/config/purchases.ts:69))
- **Offerings:**
  - Create offering `default`
  - Add Package `monthly` → product `entprep_pro_monthly`
  - Add Package `yearly` → product `entprep_pro_yearly`
  - Set as Current
- **Integrations → Webhooks:**
  - URL: `https://entprep.org/api/revenuecat-webhook`
  - Auth: HMAC SHA256, secret = тот же что в Netlify env `REVENUECAT_WEBHOOK_SECRET`
  - Events: GRANT_ENTITLEMENT, REVOKE_ENTITLEMENT, INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION

**Apple API Key (`appl_hSiijbsNKsMxZEeQDZLYTtjSwmw`):** уже в Netlify env `VITE_RC_API_KEY_APPLE`. Проверь что для `master` deploy он есть. Если нет — добавь в Netlify → Site settings → Environment variables.

---

### 4. Скриншоты (~30-60 мин)

Делай на **реальном iPhone 15/16/17 Pro Max** (6.7"). Симулятор — мутные.

Перед съёмкой:
1. Логинься в свой аккаунт где есть прогресс (серия, история тестов, Mastery progress)
2. Включи Do Not Disturb (без notifications в статус-баре)
3. Заряди до 100% (или добавь mock через Xcode Devices → Simulator → Customize → Status Bar — для симулятора)
4. Время в статус-баре: 9:41 (Apple convention) — для симулятора `xcrun simctl status_bar booted override --time "9:41"`

6 шотов в порядке (per `docs/aso-listing.md`):
1. **Hero/Home** — CoachHome с прогресс-кольцом, серия, CTA «Начать»
2. **AI Tutor чат** — открой какую-то тему, попроси объяснение, дождись ответа, сними диалог
3. **Mastery / weak topics** — Profile или Adaptive с разбивкой по предметам, выделенная слабая тема
4. **Тест** — middle of test, видны вопрос + варианты + таймер + прогресс
5. **Пробный ЕНТ результат** — нужна реальная сессия пробного, или mock state. Финальный экран с баллом + прогноз
6. **Лидерборд** — top-10 with avatars

Опционально — добавить **promotional text overlay** (как делает Notion/Linear на App Store): hero с текстом «AI-репетитор для ЕНТ 2026». Сделай в Figma или Photoshop поверх скриншотов. Это сильно поднимает CTR в search.

Резолюция: **1290×2796** (6.7" Pro Max). Для iPad — отдельные 2048×2732.

---

### 5. Build Upload (~15 мин)

В Xcode (уже открыт):

1. Top bar → выбери `App` scheme + **Any iOS Device (arm64)**
2. Product → Archive (~3-5 мин)
3. Откроется Organizer → выбери архив → **Distribute App** → **App Store Connect** → **Upload**
4. Сертификат подписи: Apple Distribution с твоего Team
5. Upload завершится → archive покажется в ASC через 5-15 мин (processing)

Если ошибка signing — проверь:
- Xcode → Settings → Accounts → твой Apple ID → есть ли certificates
- Project → Signing & Capabilities → Team = Diyar Raimzhanov (`85MH8SWD4T`)
- "Automatically manage signing" включено

---

### 6. TestFlight + Sandbox IAP (~30 мин)

Когда build обработался в ASC:

1. ASC → My Apps → ENTprep → **TestFlight** → Builds → выбери 1.1.0 (5)
2. Заполни Test Information:
   - What to Test: `IAP flow + AI Tutor + Mastery`
   - Email: твой
   - Privacy URL: `https://entprep.org/privacy.html`
3. Internal Testing → Add Tester → ты сам → отправь invitation на свой Apple ID
4. На iPhone — install **TestFlight app** → принять invitation → install ENTprep TestFlight build
5. **Sandbox testing IAP:**
   - iPhone → Settings → App Store → Sandbox Account → sign in test account из ASC → Users → Sandbox Testers (создай если нет)
   - Открой ENTprep TestFlight build
   - Trigger paywall (зайди в AI Tutor, потрать лимит, или в ProfileTab → Premium)
   - Купи monthly → должен показаться StoreKit dialog "ENTprep PRO Monthly $5.99"
   - Confirm → app должен показать success + premium активирован
   - Проверь webhook сработал: ASC → User в Supabase должен иметь `is_premium=true`

Если paywall показывает Lemon Squeezy на TestFlight — bridge не сработал, открой issue, я фикшу.

---

### 7. Submit for Review

ASC → My Apps → ENTprep → версия 1.1.0 → **Build** → выбери 1.1.0 (5).

**App Review Information:**
- First Name: Diyar
- Last Name: Raimzhanov
- Phone: твой
- Email: raimzhan1907@gmail.com
- **Sign-in Information:** добавь test account
  - Username: создай новый аккаунт ENTprep (например `apple-review@entprep.org`)
  - Password: задай в Supabase Auth admin
  - Mark "Sign-in required" YES
- **Notes for Review:** см. `docs/app-review-notes.md`
- **Attachment:** опционально demo video 30 сек (повышает шансы на быстрый review)

**Version Release:**
- Manually release this version (рекомендую — контролируешь момент)

→ **Submit for Review**

Apple review обычно 24-72 часа. Может прийти запрос на дополнительную инфу (запросы по IAP описанию, age rating, account deletion location). Отвечай в Resolution Center в ASC.

---

## 🚫 Common rejections — превентивно

1. **Guideline 5.1.1(v) — Account Deletion not visible**
   - Проверь что в Settings есть кнопка "Удалить аккаунт" с красным цветом, не закопана. Уже реализовано через `delete-account.mjs` + UI.

2. **Guideline 3.1.1 — IAP for digital content**
   - Все 5 paywall surfaces теперь bridged на native (commit `203ffdd`). Если Apple увидит web Lemon Squeezy в native билде — отклонит. Двойной чек на TestFlight.

3. **Guideline 2.1 — App Completeness / Crash on launch**
   - Smoke-tested на симуляторе iPhone 17 Pro 26.3 — рендерится, не падает.

4. **Guideline 4.0 — Design / Auto-renewal disclosure**
   - Локализованная строка `legalRenewalNotice` показывается на native paywall.

5. **Guideline 5.1.1(ii) — Privacy Policy missing/unreachable**
   - Verify `https://entprep.org/privacy.html` живой 200 OK.

6. **Sign In with Apple required** (если есть Google OAuth)
   - У тебя уже есть нативный Apple Sign-In ([AppleSignInPlugin.swift](entprep-app/ios/App/App/AppleSignInPlugin.swift)). ✅

---

## 📅 Timeline

| Когда | Что |
|-------|-----|
| Сейчас (26.04 вечер) | ASC metadata + IAP products + RC config |
| 27.04 утро | Скриншоты на iPhone + Archive в Xcode + Upload |
| 27.04 день | TestFlight + sandbox IAP test |
| 27.04 вечер | Submit for Review |
| 28-30.04 | Apple review (24-72 ч) |
| 30.04 / 01.05 | **LIVE** — за день до основного ЕНТ-сезона |

Если Apple отклонит → fix issue → re-submit (новый review цикл). Закладывай 1-2 итерации.

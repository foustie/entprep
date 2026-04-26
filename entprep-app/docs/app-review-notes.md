# App Review Notes — ENTprep iOS

> Скопируй текст ниже в App Store Connect → My Apps → ENTprep → version 1.1.0 → App Review Information → Notes.
> Это сообщение Apple reviewer'у которое сильно повышает шансы на pass с первого раза.

---

## English (для App Review reviewer)

```
Hello,

ENTprep is an exam prep app for Kazakhstan's Unified National Testing (UNT / ЕНТ — the country's standardized university entrance exam taken by ~225,000 students per year). The app provides 28,000+ practice questions across 13 subjects, an AI tutor that explains mistakes, mastery tracking by topic, full exam simulation, and a leaderboard.

Primary languages: Russian and Kazakh. UI defaults to Russian; user can switch to Kazakh in Settings → Language.

==============================
LOGIN FOR REVIEW
==============================
Email: apple-review@entprep.org
Password: [FILL_IN_BEFORE_SUBMIT]

This account has Premium pre-activated so you can verify all paid features without testing IAP.

==============================
HOW TO TEST KEY FEATURES
==============================

1. AI TUTOR (core paid feature)
   • Bottom tab "Дияр" (or "AI" if EN) — opens the AI tutor chat
   • Or: tap any subject → tap weak topic → "Спросить Дияра" — opens tutor scoped to topic
   • Type any question, AI responds in 3-5 seconds

2. PRACTICE TEST
   • Bottom tab "Главная" → tap any subject (e.g. "Биология")
   • Tap "Начать тест" — practice questions begin
   • Answer 5-10 questions, see results screen with AI explanation option

3. FULL EXAM SIMULATION (Premium)
   • Bottom tab "Главная" → "Полный ЕНТ" card
   • 120 questions, 5 subjects, 4 hours (matches the real exam)
   • Pre-activated test account skips paywall; for free users a paywall appears

4. MASTERY / WEAK TOPICS
   • Bottom tab "Прогресс" or tap profile avatar
   • Shows breakdown of mastery per topic with weak topics highlighted
   • Tapping a weak topic opens AI Tutor pre-loaded with that context

5. ACCOUNT DELETION (Guideline 5.1.1)
   • Bottom tab "Настройки" → scroll to bottom → "Удалить аккаунт" (red button)
   • Confirmation dialog → confirms deletion
   • Backend (delete-account.mjs) removes auth.users, profile, avatars, push subscriptions

6. RESTORE PURCHASES
   • Paywall screen → "Восстановить покупку" button at the bottom
   • Calls Purchases.restorePurchases() — entitlement re-fetched from RevenueCat

==============================
SUBSCRIPTION DETAILS
==============================
- Auto-renewable monthly: entprep_pro_monthly @ $5.99/month
- Auto-renewable yearly: entprep_pro_yearly @ $19.99/year
- Both unlock the same "premium" entitlement
- Auto-renewal disclosure displayed on paywall in user's locale (Russian / Kazakh)
- Privacy policy: https://entprep.org/privacy.html
- Terms of service: https://entprep.org/terms.html

==============================
ARCHITECTURE NOTES
==============================
- Built with Capacitor 8 (WebView wrapper around React PWA)
- Native plugins: Apple Sign-In, RevenueCat StoreKit (in-app purchases), Browser
- All digital subscription purchases inside iOS go through StoreKit via RevenueCat — no web checkout in native context (Guideline 3.1.1 compliant)
- Web version (entprep.org) uses Lemon Squeezy for browser-based payment, but this is gated to non-native platforms via Capacitor.isNativePlatform() check

==============================
CONTACT
==============================
Diyar Raimzhanov (founder)
raimzhan1907@gmail.com

Thanks for the review!
```

---

## Notes for "Notes" field — короткая версия (если нужна краткая)

```
ENTprep is an AI-powered exam prep app for Kazakhstan's Unified National Testing (UNT/ЕНТ). 28,000+ questions across 13 subjects, AI tutor, mastery tracking.

Test account: apple-review@entprep.org / [FILL_PASSWORD] (Premium pre-activated)

To test AI Tutor: bottom tab "Дияр" → ask anything.
To test exam simulation: Главная → "Полный ЕНТ".
To test account deletion: Настройки → "Удалить аккаунт".

All in-app purchases go through StoreKit via RevenueCat. No web checkout inside native iOS.

Privacy: https://entprep.org/privacy.html
Terms: https://entprep.org/terms.html
```

---

## ⚠️ Перед submit:
1. Создать аккаунт `apple-review@entprep.org` в Supabase Auth
2. Установить ему `is_premium = true` через admin
3. Заменить `[FILL_IN_BEFORE_SUBMIT]` / `[FILL_PASSWORD]` реальным паролем (генерируй надёжный — Apple reviewer не делится)
4. Verify аккаунт работает — залогинься через web entprep.org с этими credentials прежде чем отправлять

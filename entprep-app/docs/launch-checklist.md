# Чеклист запуска ENTprep — до 31 марта 2026

## Фаза 1: Публикация (17-19 марта)

- [ ] App Store одобрен (на ревью)
- [x] Google Play: AAB собран (ENTprep-v1.0.aab, 7.2 MB)
- [ ] Google Play: листинг создан (название, описание, скриншоты) — текст в docs/aso-listing.md
- [ ] Google Play: AAB загружен в Google Play Console
- [ ] Google Play: отправлен на ревью
- [x] ASO описание на русском + казахском (docs/aso-listing.md)
- [ ] Скриншоты 6 штук (6.7" + 5.5" iOS, phone Android)
- [x] Privacy Policy доступен (/privacy.html на Netlify)
- [x] OG meta-теги обновлены и проверены на продакшне

## Фаза 2: Критические доработки (17-21 марта)

- [x] Реферальная программа: Supabase миграция выполнена (таблица referrals создана)
- [x] Реферальная программа: Netlify Function (referral.mjs) — задеплоен, CORS 204, auth 401
- [x] Реферальная программа: клиентский код (socialHelpers.ts, App.tsx)
- [x] Реферальная программа: кнопка "Пригласи друга" в Settings
- [x] Реферальная программа: обработка ?ref= параметра с sessionStorage
- [x] Реферальная программа: переводы RU + KK
- [ ] RevenueCat Google API key: получить ключ в RC Dashboard
- [ ] RevenueCat Google API key: добавить VITE_RC_API_KEY_GOOGLE в .env и Netlify
- [x] RevenueCat: код уже поддерживает Android (purchases.ts:24)
- [x] .env: placeholder VITE_RC_API_KEY_GOOGLE добавлен
- [ ] Firebase: создать проект, скачать google-services.json
- [ ] Firebase: настроить FCM для Android push

## Фаза 3: Маркетинг (20-25 марта)

- [x] 5 промо-постов готовы (docs/marketing-posts.md)
- [x] 3 Telegram-поста готовы
- [x] WhatsApp-рассылка готова
- [ ] 10 Telegram-каналов контактированы
- [ ] Instagram/TikTok видео сняты и опубликованы
- [ ] Баджи App Store / Google Play на лендинге

## Фаза 4: Удержание (25-31 марта)

- [x] Streak milestones (weekStreak, monthStreak) — уже реализованы
- [x] 16 бейджей — уже реализованы
- [ ] Push "друг вызвал на дуэль" (nice to have)
- [ ] Push "ты в топ-10 лидерборда" (nice to have)
- [ ] Учительские амбассадоры (бесплатный Premium)

## Верификация

- [x] TypeScript: 0 ошибок (tsc --noEmit)
- [x] npm run build — без ошибок
- [x] npm run test — 346/353 тестов проходят (7 pre-existing failures)
- [x] Web: entprep.org — задеплоен с реферальной системой
- [x] OG preview: og:image 200 OK (41KB PNG), все теги на месте
- [x] Referral API: CORS 204, Unauthorized 401 без токена
- [ ] TestFlight: тест авторизации, покупки, дуэли
- [ ] Android APK: тест на устройстве
- [ ] Реферал: ?ref=nickname → Premium у обоих (нужен ручной тест)
- [ ] Шеринг: ссылка в Telegram → OG preview (нужен ручной тест)
- [ ] Покупка: тестовый аккаунт → Premium статус

## Ручные действия (осталось тебе)

1. **Google Play Console** — загрузить ENTprep-v1.0.aab + описание из docs/aso-listing.md
2. **Скриншоты** — сделать 6 скриншотов для сторов
3. **RevenueCat Dashboard** — добавить Google Play app, получить API key, добавить в Netlify env vars
4. **Firebase Console** — создать проект для FCM (Android push)
5. **Telegram** — написать 10 каналам (шаблон в docs/marketing-posts.md)
6. **Instagram/TikTok** — снять и выложить видео (тексты готовы)
7. **Ручной тест** — открыть ?ref=твой_никнейм, залогиниться, проверить Premium

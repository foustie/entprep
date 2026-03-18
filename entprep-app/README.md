# ENTprep

Бесплатное веб-приложение для подготовки к ЕНТ (Единое национальное тестирование) Казахстана.

**Live:** [entprep.org](https://entprep.org)

## Возможности

- 28 000+ вопросов по 13 предметам (284 подтемы, Supabase + 150/предмет офлайн)
- 3 типа заданий: одиночный выбор, множественный ответ, соответствие
- Полная симуляция ЕНТ (120 заданий, 5 предметов, 4 часа, 140 баллов)
- AI-разбор ошибок, учебные планы, генерация вопросов (Claude Sonnet 4.6)
- Адаптивные рекомендации на основе слабых тем
- Калькулятор грантов (52 вуза по всему Казахстану)
- Лидерборд по предметам (все / друзья)
- Друзья: добавление по никнейму или ссылке, входящие запросы
- Дуэль 1 на 1: real-time через Supabase Realtime, 10 вопросов, race mode
- XP/уровни (6 уровней), 16 достижений, серии, ежедневные цели
- Push-уведомления (серия, ошибки, еженедельный отчёт — KZ time)
- PWA: работает офлайн, устанавливается на телефон
- Облачная синхронизация через Supabase (Google OAuth + Apple Sign In)
- Темная и светлая тема, двуязычный интерфейс (русский + казахский)

## Стек

- **Frontend:** React 18, TypeScript, Vite 6, inline styles + theme system
- **Backend:** Netlify Functions (serverless)
- **AI:** Anthropic Claude Sonnet 4.6 (объяснения, учебный план, генерация вопросов)
- **БД/Auth:** Supabase (PostgreSQL, Google OAuth + Apple Sign In, RLS)
- **Мониторинг:** Sentry
- **Аналитика:** Plausible (privacy-first)
- **Тестирование:** Vitest (345 тестов)
- **Мобильные:** Capacitor (iOS/Android)
- **CI/CD:** GitHub Actions, Netlify

## Запуск локально

```bash
cd entprep-app
npm install
cp .env.example .env  # заполните переменные
npm run dev
```

## Переменные окружения

### Клиентские (VITE_)

| Переменная | Назначение |
|---|---|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase |
| `VITE_ADMIN_EMAILS` | Email администраторов (клиентская часть) |
| `VITE_SENTRY_DSN` | DSN проекта Sentry |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key для push-уведомлений |
| `VITE_RC_API_KEY_APPLE` | RevenueCat API key (iOS) |
| `VITE_RC_API_KEY_GOOGLE` | RevenueCat API key (Android) |

### Серверные (Netlify Functions)

| Переменная | Назначение |
|---|---|
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Ключ Anthropic (ai-explain, ai-generate, ai-plan) |
| `ADMIN_EMAILS` | Email администраторов (через запятую) |
| `ALLOWED_ORIGIN` | Разрешённый origin для CORS |
| `VAPID_PRIVATE_KEY` | VAPID private key для push |
| `VAPID_PUBLIC_KEY` | VAPID public key для push |
| `VAPID_SUBJECT` | VAPID subject (mailto:) |
| `REVENUECAT_WEBHOOK_SECRET` | Секрет вебхука RevenueCat |

## Команды

```bash
npm run dev        # Dev сервер
npm run build      # Production билд
npm run preview    # Предпросмотр билда
npm run lint       # ESLint проверка
npm run lint:fix   # ESLint автофикс
npm run format     # Prettier форматирование
npm run typecheck  # TypeScript проверка типов
npm run test       # Запуск тестов (vitest)
npm run test:watch # Тесты в watch-режиме
```

## Деплой

```bash
npm run build
npx netlify deploy --prod --dir=dist --no-build
```

## Структура проекта

```
src/
  components/     React компоненты (33)
  components/ui/  UI-библиотека (19 примитивов)
  config/         Конфигурация предметов, ЕНТ, Supabase, Sentry, topics
  constants/      Стили, темы, экраны
  contexts/       React контексты (App, Auth, Navigation, Toast)
  data/           Вопросы (офлайн-фолбэк), университеты
  hooks/          Кастомные хуки (useAsyncData, useBreakpoint)
  locales/        i18n (ru.ts, kk.ts, useT хук)
  types/          TypeScript типы и интерфейсы
  utils/          Хелперы (questionStore, storage, sync, adaptive, scoring)
  sw.ts           Service worker
netlify/
  functions/      Serverless API (ai-explain, ai-generate, ai-plan, leaderboard,
                  social, duel, admin-action, push-subscribe, push-cron,
                  revenuecat-webhook)
  functions/utils Общие утилиты (CORS, auth, rate limiting)
scripts/          Скрипты генерации, аудита, тегирования вопросов
```

## Лицензия

Частный проект. Все права защищены.

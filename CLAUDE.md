# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules for Claude

### Keep this file up to date
After ANY structural change to the project (new files, deleted files, new dependencies, new features, architecture changes, question count changes), **update the relevant sections of this CLAUDE.md immediately** in the same session. Never let these files go stale.

### Challenge the user's decisions
The project owner is not a professional developer. When the user proposes something — **always evaluate it critically before executing**. If you see a better approach, a flaw in reasoning, or a risk the user hasn't considered — speak up immediately. Don't just comply. This applies to everything: technical decisions, product ideas, priorities, UX choices, architecture. Push back with a clear explanation and offer a better alternative. Be direct but not condescending. The user explicitly wants to be challenged — silence is not politeness, it's a disservice.

### No wheel inventions
Before writing custom implementations, check if an existing npm package or built-in browser/React API already solves the problem. Prefer well-maintained libraries over custom code. When reviewing the codebase, flag custom implementations that could be replaced by existing solutions.

## Project Overview

ENTprep is a TypeScript + React educational web app for Kazakhstan's Unified National Testing (ЕНТ). Practice tests across 13 subjects with **28 593 questions** in Supabase (284 subtopics, 150/subject static fallback), AI explanations, adaptive learning, full ЕНТ simulation, leaderboard, social features, real-time duels, referral system, and a university grant calculator.

**Live URL:** https://entprep.org

## Project Structure

```
entprep-app/src/
├── App.tsx              # Root (providers, navigation, lazy routes)
├── main.tsx             # Entry point (OAuth deep link handling)
├── types/index.ts       # All shared TypeScript interfaces
├── components/          # 33 components (Home, Test, FullENT, Adaptive, Progress, etc.)
│   └── ui/              # 19 reusable UI primitives
├── contexts/            # AppContext, AuthContext, NavigationContext, ToastContext
├── locales/             # ru.ts (877 lines), kk.ts (855 lines), index.ts (useT hook)
├── hooks/               # useAsyncData, useBreakpoint
├── config/              # 9 files: subjects, ent, questionPools, supabase, sentry, topics, payment, purchases, app
├── constants/           # styles, screens, themes
├── utils/               # 19 files: questionStore, questionHelpers, questionAssembler, storage, cloudSync, analytics, aiLimits, avatarHelpers, pushHelpers, shareCard, shareHelpers, socialHelpers, duelHelpers, scoringEngine, xpHelpers, adaptiveHelpers, competitionHelpers, formatters, srEngine
├── data/questions/      # 13 static fallback files (150q each, .ts)
├── data/universities.ts # 52 universities
└── sw.ts                # Service worker (Workbox + push)

entprep-app/netlify/functions/   # Serverless API
├── ai-explain.mjs, ai-generate.mjs, ai-plan.mjs
├── admin-action.mjs, leaderboard.mjs, social.mjs, duel.mjs
├── revenuecat-webhook.mjs, referral.mjs
├── push-subscribe.mjs, push-cron.mjs
└── utils/shared.mjs, constants.mjs, quality.mjs

entprep-app/docs/                # Documentation
├── launch-checklist.md, aso-listing.md, marketing-posts.md

entprep-app/scripts/             # Build & generation scripts
└── utils/                       # ent-specs.mjs, constants.mjs, quality.mjs, json.mjs
```

### Key Files

| File | Role |
|------|------|
| `utils/questionStore.ts` | Question loading: memory → Supabase → localStorage → static fallback. Language-aware: `getPool(sid, lang?)` resolves `_kk` fields for Kazakh |
| `config/questionPools.ts` | Central hub — builds `TOTAL_Q`, `ALL_PROFILES`, `SUBS` |
| `config/payment.ts` | PLANS (1990₸/9990₸), RC_PRODUCT_IDS |
| `config/purchases.ts` | RevenueCat Capacitor wrapper (lazy-loaded, no-ops on web) |
| `contexts/AppContext.tsx` | Global state — history, profile, settings, cloud sync |
| `contexts/AuthContext.tsx` | Supabase auth, premium status (DB + native RC), user profile |
| `config/ent.ts` | Full ENT exam config: sections, timing, scoring, profile blocks |
| `config/topics.ts` | TOPIC_MAP — 80 sections, 284 subtopics |
| `scripts/utils/ent-specs.mjs` | Official ENT curriculum from testcenter.kz |
| `locales/index.ts` | i18n: `useT()` hook, `getT()` function |

## Key Features
- 13 ENT subjects, 28 593 questions (Supabase) + static fallback
- 3 question types: single choice, multiple answer, matching
- Full ENT simulation (120q, 5 subjects, 4h, 140 pts, profile blocks)
- AI explanations, study plans, question generation (Claude Sonnet 4.6)
- Adaptive learning, daily challenges, error review
- Leaderboard, friends system, real-time 1v1 duels
- Supabase auth (Google OAuth + Apple Sign In), cloud sync
- RevenueCat IAP (monthly 1990₸, yearly 9990₸)
- Referral system (7 days Premium for both users)
- XP/levels, 16 achievements, streaks, daily goals
- Push notifications (streak, errors, weekly — all KZ time)
- Dark/light theme, bilingual (Russian + Kazakh) — UI + question content (q_kk, o_kk, e_kk columns)
- PWA, Sentry, Plausible analytics
- University grant calculator (52 universities)

## Development Commands

```bash
cd entprep-app
npm run dev          # Dev server with hot reload
npm run build        # Production build → dist/
npm run lint         # ESLint check
npm run lint:fix     # ESLint autofix
npm run format       # Prettier format
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode tests

# Deploy (--no-build avoids OOM on Netlify server)
VITE_RC_API_KEY_APPLE=appl_hSiijbsNKsMxZEeQDZLYTtjSwmw npx vite build && netlify deploy --prod --dir=dist --no-build
```

## Technical Stack
- **Language**: TypeScript — **Frontend**: React 18 — **Build**: Vite 6.x
- **Hosting**: Netlify (+ Functions) — **Backend**: Supabase (PostgreSQL)
- **AI**: Claude Sonnet 4.6 — **Errors**: Sentry — **Analytics**: Plausible
- **Styling**: Inline styles + themes — **State**: React Context (4 contexts)
- **Icons**: lucide-react — **Fonts**: Unbounded, JetBrains Mono
- **PWA**: vite-plugin-pwa — **Testing**: Vitest (345 tests, 22 files)
- **Mobile**: Capacitor (android/ios) — **Payments**: RevenueCat

## Important Notes
- UI: Russian (default) + Kazakh — switchable in Settings
- Code comments/variables: English
- Question content: bilingual (Russian + Kazakh via `_kk` Supabase columns)
- Question explanations include math symbols: ², ³, √, π, ×, ÷, ≈, →
- `VITE_RC_API_KEY_APPLE` must be passed at build time (Vite inlines it)

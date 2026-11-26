# ENTprep

> **Project #01 of [Unaided Lab](https://unaided.atla.kz)** ([github.com/foustie/unaided-lab](https://github.com/foustie/unaided-lab))

Free, bilingual (Russian + Kazakh) AI exam-prep platform for Kazakhstan's Unified National Testing (ENT / ҰБТ). Built to break expensive prep-center monopolies and help students train for closed-book national exams without paid barriers.

**Live app:** [entprep.org](https://entprep.org)

## Verified Traction

- **7,630+ students** reached on **$0 paid advertising**
- **Backed by Emergent Ventures** ($10,000 grant, Tyler Cowen / Mercatus Center)
- **30,000+ questions** across 13 subjects and 284 subtopics
- **479 automated tests** (Vitest + TypeScript)

## What Is Inside

- Full 120-question, 4-hour, 140-point ENT simulation (single choice, context, matching, multiple selection)
- Switchable AI tutor and explanation adapter (`entprep-app/netlify/functions/utils/ai.mjs`)
- Adaptive weak-topic drills and personalized study roadmaps
- Grant probability calculator covering 52 universities across Kazakhstan
- Real-time 1v1 duels (Supabase Realtime), leaderboards, and referral loops
- Offline-capable PWA + Capacitor iOS and Android builds

## Quick Start

```bash
cd entprep-app
npm install
cp .env.example .env
npm run dev
```

Run tests and typechecks:

```bash
cd entprep-app
npm run typecheck
npm run test
```

Full architecture and environment variable reference live in [entprep-app/README.md](entprep-app/README.md).

## Contributing

ENTprep is now open-source under **Unaided Lab**. Pull requests are welcome for:
- Fixing typos or improving Kazakh and Russian question translations
- Improving anti-dependency Socratic hints and 48-hour unaided retention tracking
- Updating 2027 ENT specifications and university grant cutoff tables
- Adapting the core exam engine for other national exams

## Credits & License

Started by **Diyar Zhakpelov** ([diyar.atla.kz](https://diyar.atla.kz)) with engineering contributions from **Adlet Seitenov**. Released under the [MIT License](LICENSE).

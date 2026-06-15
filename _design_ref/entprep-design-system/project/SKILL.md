---
name: entprep-design
description: Use this skill to generate well-branded interfaces and assets for ENTprep (the "Vibrant Game" ЕНТ exam-prep app), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view — link `styles.css`
for tokens, and reuse the recipe classes in `tokens/base.css` (`.card`, `.btn`,
`.pill`, `.progress`, `.answer`) or the React components in `components/`.

If working on production code, copy assets and read the rules in `readme.md` to
become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they
want to build or design, ask a few questions, and act as an expert designer who
outputs HTML artifacts _or_ production code, depending on the need.

## The five things that make it look like ENTprep
1. Cream paper (`--bg`), white/`#22222E` cards, **2px ink borders** everywhere.
2. **Hard stamped shadows** (`0 3px/5px/6px 0 0 ink`) — never blur. Press = shadow
   collapses to `0 1px` + sink 4px.
3. **One** streak-orange (`--streak`) CTA per screen; **one** bright yellow
   (`--xp-softer`) splash/hero card per screen.
4. Three fonts only — Unbounded (display), Nunito (body), JetBrains Mono
   (eyebrows + any number, tabular-nums).
5. Voice of a 17-year-old Kazakh student; bilingual ru/kk; emoji sparingly.

## Key files
- `styles.css` — link this for all tokens + fonts.
- `tokens/` — colors, typography, spacing/radii/depth, recipe classes.
- `components/core` + `components/learn` — Button, Card, Pill, Badge, Eyebrow,
  Stat, ProgressBar, IconButton, AnswerOption, SubjectTile.
- `ui_kits/app/index.html` — full interactive app reference.
- `guidelines/` — foundation specimen cards.

# ENTprep Design System — “Vibrant Game”

The design system for **ENTprep** ([entprep.org](https://entprep.org)) — a free
ЕНТ / ҰБТ exam-prep app for Kazakh high-schoolers (16–18). 28 000+ questions
across 13 subjects, adaptive practice, full exam simulation, mistake review and
a grant calculator. Bilingual: Russian (`ru_KZ`) + Kazakh (`kk_KZ`).

The aesthetic is **“Vibrant Game”** — Duolingo-grade energy meets a stamped,
printed-paper look. Cream paper, black 2px borders with hard “stamped” shadows,
exactly **one** orange CTA and **one** bright yellow card per screen. Tone:
confident, alive, the voice of a 17-year-old — never corporate.

> **Style in one line:** Cream paper, ink 2px borders with hard stamped shadows,
> one streak-orange CTA and one bright yellow splash card per screen.

## Sources
- Product site: **https://entprep.org** (SPA; theme color `#0B0B12`, OG image
  `https://entprep.org/og-image.png`). No codebase or Figma was provided — this
  system was authored from the written “Vibrant Game” spec supplied by the team,
  which is the source of truth for tokens, recipes and composition rules.

---

## CONTENT FUNDAMENTALS — how ENTprep writes

- **Voice:** a smart, upbeat 17-year-old Kazakh student. Casual, motivating,
  zero corporate-speak. Say “поехали”, “квест”, “красава”, “почти!”. Never say
  “революционное решение”, “leveraging AI”, “синергия”.
- **Person:** address the student directly as **ты** (informal you). The app is a
  friendly coach, not an institution.
- **Casing:** Sentence case for headings and body. ALL CAPS only on the mono
  **eyebrow** kicker (`• ЕНТ 2026 •`) and tiny stat labels.
- **Numbers:** always tabular mono — streaks, XP, scores, %, days-left. Group
  thousands with a thin space (`1 240 XP`) per ru-RU.
- **Emoji:** used, but sparingly and with intent — one celebratory glyph per
  moment (🔥 streak, 🚀 start, 👋 greeting, ✓ done). Never decorative rows of
  emoji; never as a substitute for a real icon in a control.
- **Bilingual:** every visible string ships through `useT()` keys defined in
  `ru.ts` + `kk.ts`. No hardcoded strings in components. (Demo screens here use
  inline RU for readability.)
- **Examples:**
  - CTA: “Продолжить квест”, “Поехали”, “Проверить”, “Разобрать ошибки”.
  - Praise: “Верно! +10 XP”, “Красава! 🔥”, “Почти! Разбор:”.
  - Nudge: “Ещё 2 урока — и серия в безопасности”.

---

## VISUAL FOUNDATIONS

- **Backgrounds:** flat color only. Light theme = warm cream paper
  (`--bg #FBF6EC`); dark theme = ink-black (`--bg #0B0B12`). **No** gradients,
  **no** glass/blur, **no** photographic hero washes. The “texture” is the
  stamped border + hard shadow, not an image.
- **Color:** strictly tokenized. `--ink` is theme-invariant (borders, hard
  shadows, dark text on bright cards). `--streak #FF5A36` is the **only** action
  color — if something is streak-colored, it’s clickable. `--xp` yellow family is
  reward (stars, XP, the one hero card). `--win` green is success only. `--red`
  is error only. `--premium` purple is premium only. Raw hex lives **only** in
  the token CSS; everywhere else use `var(--…)`.
- **Type:** three families. **Unbounded** (display/headings/hero numbers, tight
  negative tracking −0.02…−0.045em), **Nunito** (all body, 1.65 line-height),
  **JetBrains Mono** (eyebrows, stat labels, any changing number, tabular-nums).
  Fixed size scale — never invent 13.5/15.5. One h1 (26/800) per screen.
- **Spacing:** strict 4px grid — `4 / 8 / 12 / 16 / 20 / 24 / 32`. No 18/22/28.
- **Radii:** `8 / 12 (button) / 16 (card) / 18 (hero) / 24 / pill (chip)`. No 6/10.
- **Depth = hard stamped shadows, never blur.** Rest `0 3px 0 0 ink`; hero
  `0 5px`; main CTA `0 6px`. **Press:** shadow collapses to `0 1px` and the
  element sinks ~4px translateY over ~90ms — every interactive element
  physically “presses in”. Flat = dead.
- **Borders:** 2px solid ink on essentially every surface and control. This is
  the signature. In dark theme the border goes to pure `#000`.
- **Cards:** cream/white (or solid `#22222E` in dark — never rgba), 2px ink
  border, hard shadow, radius 16 (hero 18, compact 12). Text on a tinted splash
  card is always ink-dark.
- **Hover/press:** there is no soft hover wash — interaction is the press
  animation. Disabled = 45% opacity + collapsed shadow.
- **Animation:** snappy and physical. `cubic-bezier(.2,.8,.2,1)`, ~90ms press,
  ~240ms progress-fill. No infinite decorative loops; respects
  `prefers-reduced-motion`.
- **Focus:** `:focus-visible` is a 3px streak-orange ring, offset 2px.
- **Layout:** mobile-first. Content max 480px / pad 20 (mobile), 720 / 32
  (tablet), 1080 / 40 (desktop). Touch targets ≥ 44px.
- **Imagery vibe:** the brand barely uses photography; identity is the
  type + stamped geometry + the warm-cream / electric-orange / school-yellow
  palette. Any imagery should stay warm and high-contrast, never cool/grey.

---

## ICONOGRAPHY

- **System:** [Lucide](https://lucide.dev) loaded from CDN
  (`unpkg.com/lucide`). Clean **2px–2.4px stroke**, rounded joints — it sits
  naturally next to the bold stamped borders. Used line-style (stroke), not
  filled, except inside a solid accent chip where the icon is ink/white.
  > ⚠️ **Substitution flag:** no first-party icon set was provided, so Lucide is
  > the stand-in. If ENTprep has its own icon library, drop the SVGs into
  > `assets/icons/` and swap the `Icon` helper’s source.
- **Usage:** icons live in accent chips (subject tiles, headers), in pills
  (streak flame, XP star) and inside buttons (leading/trailing). Always pair an
  icon-only control with an `aria-label` (see `IconButton`).
- **Emoji** complement icons for celebration moments only (🔥 🚀 👋 ✓ 🏆), never
  inside a functional control.
- **Logo:** rendered as a stamped wordmark “**E**” chip + “ENTprep” in Unbounded
  (see `ui_kits/app/kit.jsx` → `AppHeader`).
  > ⚠️ **Asset flag:** no logo source files were provided. Please attach the real
  > ENTprep logo (SVG/PNG) and OG/brand imagery so we can replace the type-built
  > placeholder mark.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (consumers link this one file).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `base.css` (reset + recipe classes: `.card`, `.btn`, `.pill`, `.progress`,
  `.answer`).
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skill manifest for using this system in Claude Code.

**Components** (`window.ENTprepDesignSystem_78ebb6`)
- `components/core/` — `Button`, `IconButton`, `Card`, `Pill`, `Badge`,
  `Eyebrow`, `Stat`, `ProgressBar`.
- `components/learn/` — `AnswerOption`, `SubjectTile`.

**UI kits**
- `ui_kits/app/` — the mobile app: Home → Quiz → Results, plus Subjects &
  Profile, in an interactive phone frame (`index.html`).

**Foundations** (Design System tab cards)
- `guidelines/` — Colors (ink/action, xp, semantic, surfaces), Type (display,
  body, mono), Spacing (scale, radii, depth).

---

## Iron rules before you commit UI
1. No raw hex outside the token CSS. Only `var(--…)`.
2. No inline `font-family` — only the `--ff-*` families / `TYPE` tokens.
3. Sizes from the FS scale, spacing from SP, radii from R.
4. **One** streak CTA and **one** bright splash card per screen.
5. Shadows are hard; presses “stamp in”.
6. Check both themes (light/dark) and 390px + 1440px.
7. All strings through locales (ru + kk).

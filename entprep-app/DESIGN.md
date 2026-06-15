---
version: alpha
name: ENTprep v2 — Vibrant Game
description: Streak-orange ink-stamp design system for a Kazakhstan ENT exam-prep app. Duolingo-adjacent gamification, anti-AI-slop, mobile-first.
colors:
  # ── Brand primary (alias of streak — required by linter) ──────────
  primary: "#FF5A36"

  # ── Surface & content ──────────────────────────────────────────────
  surface: "#FBF7EE"                  # warm cream page background (LIGHT default)
  surface-dim: "#F2ECDE"
  surface-bright: "#FFFFFF"
  surface-card: "#FFFFFF"             # primary card body
  surface-elevated: "#FAFAF8"
  on-surface: "#1A1A2E"               # primary readable text
  on-surface-variant: "#334155"
  on-surface-muted: "#5C6A7A"
  on-surface-dim: "#7A8694"

  # ── Ink (the v2 signature stroke) ──────────────────────────────────
  ink: "#0F0F10"                      # 2px borders, 3-6px hard shadows, dark text on bright splash
  # NOTE: ink at 70% alpha = `rgba(15,15,16,0.7)` — used inline in CSS for muted ink text.
  # Not a token here because spec restricts colors to solid hex.

  # ── Streak (primary CTA, brand) ────────────────────────────────────
  streak: "#FF5A36"                   # ALL primary actions, focus rings, "ты" highlights
  streak-hover: "#FF6A47"
  streak-deep: "#E84D2C"              # 4px bottom-border depth on streak buttons
  streak-soft: "#FFC4AC"              # streak hero splash bg + warning chips
  # NOTE: streak-tint = streak @ 12% (`rgba(255,90,54,0.12)`) and streak-glow = @ 35%
  # used inline as `${COLORS.streak}1F` / `${COLORS.streak}59` — CSS handles alpha.

  # ── XP (reward, hero score) ────────────────────────────────────────
  xp: "#FFC233"                       # XP badges, level pills, accent highlights
  xp-soft: "#FFDF5E"                  # main hero splash fill (yellow card on Home)
  xp-softer: "#FFF1B8"                # subtle yellow rail/sub-fills

  # ── Win (success, correct answer) ──────────────────────────────────
  win: "#1EB854"                      # progress fills, correct option, trend up
  win-soft: "#B8ECC8"                 # celebration banner bg
  win-bright: "#58CC02"               # active progress bar (Duolingo green)

  # ── Semantic states ────────────────────────────────────────────────
  red: "#EF4444"                      # error / wrong only
  blue: "#38BDF8"                     # informational chips (rare)
  purple: "#8B5CF6"                   # paywall feat icon, premium accents
  yellow: "#FFC233"                   # legacy alias of xp

  # ── Dark mode (eye-strain restore Apr 22) ──────────────────────────
  surface-dark: "#0B0B12"
  surface-dark-card: "#22222E"        # 40% lighter than page bg → ink borders read via contrast
  on-surface-dark: "#F5F2EA"
  on-surface-dark-variant: "#E2E0D6"

typography:
  # Display family resolves via CSS var --ff-display: RU = Unbounded, KK = Rubik.
  # Unbounded has NO Kazakh glyphs (ә ғ қ ң ө ұ ү һ) — html:lang(kk) swaps to Rubik.
  # Never hardcode 'Unbounded' inline — use FF.display / TYPE.* so the KK switch applies.
  # ── Display (hero numbers / countdowns) ───────────────────────────
  display-xl:
    fontFamily: Unbounded
    fontSize: 128px
    fontWeight: "800"
    lineHeight: 0.9
    letterSpacing: -0.045em
    fontFeature: tnum
  display-lg:
    fontFamily: Unbounded
    fontSize: 80px
    fontWeight: "800"
    lineHeight: 0.9
    letterSpacing: -0.04em
    fontFeature: tnum
  display-md:
    fontFamily: Unbounded
    fontSize: 56px
    fontWeight: "800"
    lineHeight: 0.9
    letterSpacing: -0.035em
    fontFeature: tnum

  # ── Headlines ─────────────────────────────────────────────────────
  h1:
    fontFamily: Unbounded
    fontSize: 26px
    fontWeight: "800"
    lineHeight: 1.2
    letterSpacing: -0.035em
  h2:
    fontFamily: Unbounded
    fontSize: 18px
    fontWeight: "700"
    lineHeight: 1.25
    letterSpacing: -0.025em
  h3:
    fontFamily: Unbounded
    fontSize: 14px
    fontWeight: "700"
    lineHeight: 1.3

  # ── Body (Nunito — rounded, friendly) ─────────────────────────────
  body-lg:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 1.4
  body-md:
    fontFamily: Nunito
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.65
  body-sm:
    fontFamily: Nunito
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.5
  caption:
    fontFamily: Nunito
    fontSize: 11px
    fontWeight: "400"
    lineHeight: 1.4

  # ── Stat (mono, tabular numbers) ──────────────────────────────────
  stat-lg:
    fontFamily: JetBrains Mono
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 1
    fontFeature: tnum
  stat-md:
    fontFamily: JetBrains Mono
    fontSize: 22px
    fontWeight: "700"
    lineHeight: 1
    fontFeature: tnum

  # ── Eyebrow & labels (mono, uppercase, tracked) ───────────────────
  eyebrow:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: "800"
    lineHeight: 1.3
    letterSpacing: 0.16em
  stat-label:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: "600"
    lineHeight: 1.3
    letterSpacing: 0.12em

rounded:
  sm: 8px                             # small chips, dropdowns
  md: 12px                            # standard cards, buttons
  DEFAULT: 14px
  lg: 16px                            # mid-size cards, sections
  xl: 18px                            # paywall, hero cards
  xxl: 22px                           # rare — large modals only
  pill: 100px                         # pills, progress bars, chips

spacing:
  unit: 4px                           # base grid
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px                            # default content padding
  xxl: 24px                           # section gaps
  xxxl: 32px
  xxxxl: 48px
  content-padding: 20px
  nav-height: 70px

components:
  # ── Cards (the "ink stamp" language) ──────────────────────────────
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 18px
  card-compact:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 14px
  card-hero:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: 24px

  # ── Splash hero cards (ONE per screen — "hero splash rule") ───────
  splash-xp:
    backgroundColor: "{colors.xp-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  splash-streak:
    backgroundColor: "{colors.streak-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  splash-win:
    backgroundColor: "{colors.win-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px

  # ── Buttons ───────────────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.streak}"
    textColor: "#FFFFFF"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 14px
  button-primary-pressed:
    backgroundColor: "{colors.streak-deep}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 14px
  button-ink-cta:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 14px

  # ── Pills, chips, eyebrows ────────────────────────────────────────
  chip-streak:
    backgroundColor: "{colors.streak-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: 6px
  chip-ink:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: 6px

  # ── Test screen — answer states ───────────────────────────────────
  answer-base:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 14px
  answer-correct:
    backgroundColor: "rgba(184,236,200,0.5)"
    textColor: "#2B7A1A"
    rounded: "{rounded.md}"
  answer-wrong:
    backgroundColor: "rgba(239,68,68,0.08)"
    textColor: "{colors.red}"
    rounded: "{rounded.md}"
---

## Overview

ENTprep v2 — **"Vibrant Game"** — is a streak-orange ink-stamp aesthetic for a Kazakhstan ENT exam-prep app. The visual language sits between Duolingo's gamification energy and a hand-stamped print broadside. Every primary action wears one color (streak `#FF5A36`); every card wears one stroke (ink `#0F0F10` 2px border + 3-6px hard shadow). The mobile-first layout caps content width at 480px; pills and 3D press buttons reward touch.

**Anti-patterns banned:** purple gradients, Inter, Roboto, three-card grids, "Build the future" headlines, soft blurry shadows, glass morphism, generic AI-slop accents. **Required:** distinctive display fonts (Unbounded), extreme weight contrasts (Nunito 400 vs Unbounded 800), tabular monospace numbers (JetBrains Mono), custom easing for press-depth interactions.

The system was approved Apr 20, 2026 after four iterations (editorial → playful stickers → quiet craft → vibrant game). Cascade-shipped Apr 21-22 across 25+ components. Dark theme restored Apr 22 (eye-strain user request) — see Layout & Spacing section for the contrast strategy.

## Colors

### Brand triad (the only colors that carry meaning)

- **Streak (`#FF5A36`)** — every primary CTA, focus ring, fire icon, "ты" highlight. Never decoration. If you reach for streak, the user must be able to act on the element.
- **XP (`#FFC233`, soft `#FFDF5E`)** — reward, achievement, hero score splash. The yellow `xp-soft` card is the **single brightest surface per screen** ("hero splash rule" — see Do's/Don'ts).
- **Win (`#1EB854`, soft `#B8ECC8`)** — semantic success: progress bar fill, correct answer feedback, trend-up arrow. Never use as decoration.

### Ink — the stroke language

- **Ink (`#0F0F10`)** is the v2 signature. It appears as:
  - **2px solid border** on every card, button, pill, chip
  - **3px / 5px / 6px hard bottom shadow** for press-depth (`box-shadow: 0 5px 0 0 ink`)
  - **Dark text on bright splash cards** (xp-soft / streak-soft / win-soft)
- Ink is **always `#0F0F10`** — even in dark theme. On dark surface, ink borders read via luminance contrast against the lighter `surface-dark-card` (`#22222E`). Switching ink to cream in dark theme would make text on yellow splash invisible.

### Surface neutrals

- **Light:** warm cream `#FBF7EE → #F2ECDE` page; pure white `#FFFFFF` cards. Never grey 50 or off-white — the cream warmth distinguishes us from corporate SaaS.
- **Dark:** `#0B0B12` page; **solid lighter `#22222E` cards** (40% brighter than page bg, so dark ink borders/shadows remain visible). Avoid `rgba` cards in dark theme — they pick up page bg and kill contrast.

### Token references — never use raw hex

If you see a hex literal `#0F0F10` or `#FF5A36` in a TSX file, it's a bug. Replace with `var(--ink)` / `COLORS.streak`.

## Typography

Three-family stack — **Unbounded** for display/headlines, **Nunito** for body, **JetBrains Mono** for numbers and labels. The contrast between Unbounded's geometric extra-bold and Nunito's rounded body is intentional — it carries the "human ENT student stamp" voice without resorting to handwritten fonts.

### Hierarchy in practice

- **Hero numbers** (`display-md`, `display-lg`, `display-xl`) — only for ENT score, countdowns, big stats. Always `font-feature-settings: 'tnum'` so digits don't jump on update.
- **Headlines** (`h1`, `h2`, `h3`) — Unbounded, weights 700-800, tight letter-spacing (-0.025 to -0.045em). H1 is screen-level only (one per screen).
- **Body** (`body-md`, `body-lg`) — Nunito 400/600. Default body is 14px / 1.65 line height — tuned for Cyrillic + Latin mixed runs.
- **Eyebrow** (`eyebrow`) — JetBrains Mono 10px 800, `letter-spacing: 0.16em`, uppercase, prefixed with `•`. Used as section labels and as "kicker" text above headlines. Color: streak (active) or text-muted (inactive). Examples: `• 5 СЕКУНД •`, `• ЕНТ 2026 • БЕСПЛАТНО •`.

### Numerical content

Always JetBrains Mono with `tnum` feature when the number changes (score, countdown, streak count). Plain Unbounded for static large numbers.

## Layout

- **Mobile content:** `max-width: 480px`, padding `var(--content-padding)` = 20px.
- **Tablet (≥768px):** max-width 720px, padding 32px.
- **Desktop (≥1024px):** max-width 960px, padding 40px, sidebar 220px (Главная / Профиль only).
- **Bottom nav:** 70px height, two tabs only — no three-tab grid.
- **Spacing:** strict 4px grid (`xs 4 / sm 8 / md 12 / lg 16 / xl 20 / xxl 24 / xxxl 32`). Never arbitrary 18 or 22 gaps.

### Dark theme contrast strategy

In dark theme, the page is `#0B0B12` and cards are **solid `#22222E`** (deliberately not `rgba` — see Colors). This gives a 40% luminance lift card-vs-page. Combined with the (always-dark) `#0F0F10` 2px ink border, cards read as crisp clipped paper rectangles. Hard ink shadows fade into the background but the border alone carries the v2 "stamped" identity.

## Elevation & Depth

ENTprep uses **hard shadows only** — no blur. Three depth tiers:

- **Resting (`box-shadow: 0 3px 0 0 ink`)** — every standard card and button.
- **Hero (`box-shadow: 0 5px 0 0 ink`)** — auth prompt main card, paywall main card, hero splash cards.
- **Primary CTA (`box-shadow: 0 6px 0 0 ink, 0 0 40px streak-glow`)** — streak gradient buttons add a 40px streak-colored halo for "actionable glow."

When pressed: shadow collapses to `0 1px 0 0 ink` and content shifts `translateY(5px)` — the press-depth feels physical. Transition: `90ms cubic-bezier(0.4,0,0.2,1)`.

Blur shadows (`0 4px 20px rgba(...)`) are forbidden in v2. They live in `GLOW.*` tokens for legacy compatibility only — do not introduce new uses.

## Shapes

Rounding scale is conservative: 8/12/14/16/18/22/100. Never use 6 or 10. Default `rounded.md` (12px) for buttons; `rounded.lg` (16px) for cards; `rounded.xl` (18px) for hero cards and modals; `rounded.pill` for chips and progress bars.

Square corners (`rounded: 0`) are reserved for inline code blocks and table cells — never for interactive surfaces.

## Components

### Cards

Three sizes — `card`, `card-compact`, `card-hero` — all share the v2 ink language:

```ts
{
  background: 'var(--bg-card)',
  border: '2px solid var(--ink)',
  borderRadius: 12 | 14 | 18,
  boxShadow: '0 3px 0 0 var(--ink)',  // or 5/6 for hero/CTA
  padding: 14 | 18 | 24,
}
```

### Splash cards (the "hero splash rule")

Each screen gets **one** bright colored hero card on a neutral page. The splash always uses `splash-xp` (yellow), `splash-streak` (peach), or `splash-win` (green) — never two splashes on the same screen. The text inside a splash uses `colors.ink` (always dark) regardless of theme — the splash bg is theme-invariant.

Examples:
- **CoachHome** — `splash-xp` yellow with prognosis score (`display-md`).
- **AuthPrompt** — `card-hero` with `splash-streak` for "5 секунд" eyebrow chip.
- **FullENT intro** — `splash-xp` yellow with spec chips (120/5/4ч/140).
- **Test result win ≥70%** — `splash-win` green celebration banner.

### Buttons

- **`button-primary`** — streak gradient `linear-gradient(180deg, #FF6A47 0%, #FF5A36 100%)`, 2px ink border, 6px ink hard shadow + 40px streak glow. Press: shadow → 1px, translateY 5px. Used for the single most important action per screen.
- **`button-ink-cta`** — black `var(--ink)` background, white text, 3px streak hard shadow. Used for Apple Sign In and dark secondary CTAs that should not steal attention from streak primary.
- **`button-secondary`** — white card-bg, ink border, 3px ink shadow. Same shape as primary but neutral.

### Chips & pills

Pills use `rounded.pill` (100px). Three states:
- **Active** — ink bg + white text + streak shadow (chip-ink in components).
- **Streak-active** — streak-tint bg + streak text (chip-streak).
- **Inactive** — card bg + ink border + muted text.

### Test answer states

Single/multiple choice cards use the Duolingo border-bottom-trick (3-4px bottom border that collapses on press). Correct = win-bright `#58CC02` border + light winSoft tint; wrong = red `#EF4444` border + light red tint. Selected (pre-reveal) = streak border.

## Do's and Don'ts

### Do

- ✅ One streak primary CTA per screen ("the action").
- ✅ One bright splash card per screen (xp/streak/win-soft).
- ✅ Eyebrow above headline (`• ЕНТ 2026 •`), never decorative dots without context.
- ✅ Tabular monospace for any number that changes (scores, countdowns, streaks).
- ✅ Press-depth on every interactive surface — flat = lifeless.
- ✅ `var(--ink)` for borders/shadows/text — never raw `#0F0F10`.
- ✅ Solid `surface-dark-card` in dark theme — never rgba cards.

### Don't

- ❌ No `linear-gradient` CTAs except the single streak gradient on `button-primary`. Apr 22 cascade killed 30+ legacy gradients — don't reintroduce.
- ❌ No `Inter` or `Roboto` — only Unbounded / Nunito / JetBrains Mono. Inline `'Unbounded',sans-serif` is forbidden — always `FF.display`.
- ❌ No `Segoe UI` fallback — strip when seen.
- ❌ No three-card grids on Home (the v1 social grid was killed Apr 10).
- ❌ No purple gradient accents (banned global).
- ❌ No blur shadows (`0 4px 20px rgba`). Hard shadows only.
- ❌ No teal/brown ink (`#1A9A8C`, `#C4643C`) — Apr 21 cascade remapped these to streak. New code must not reintroduce.
- ❌ No splash card with cream/light text — splash text is always `var(--ink)` dark.
- ❌ Don't switch `--ink` to cream in dark theme — text on yellow splash will disappear.
- ❌ No mascot ("Andy" was killed Apr 20). The "Д" avatar circle is the single character device.
- ❌ No "build the future" / "leveraging AI" / "revolutionize" copy. Tone of voice: 17yo Kazakh student. "тупишь", "квест", "поехали".

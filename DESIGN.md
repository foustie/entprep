# ENTprep Design System — "Vibrant Game"

Source: Claude Design handoff bundle (`_design_ref/entprep-design-system/`), authored from the team's written "Vibrant Game" spec. This file documents the design and exactly how it maps into the app's existing token system.

## The aesthetic (one line)
Cream paper, ink 2px borders with **hard stamped shadows** (never blur), **one** streak-orange CTA and **one** bright-yellow splash card per screen. Duolingo-grade energy, printed-paper look, voice of a confident 17-year-old.

## Tokens

### Color
| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#0F0F10` | `#0F0F10` (borders → `#000`) | borders, hard shadows, dark text on bright cards (theme-invariant) |
| `--streak` | `#FF5A36` | `#FF6B49` | **the only** action color — if it's streak-colored, it's clickable |
| `--streak-deep` | `#E84320` | `#FF5A36` | pressed/hover |
| `--xp` / `--xp-soft` / `--xp-softer` | `#FFC233` / `#FFDF5E` / `#FFF1B8` | same | reward (stars, XP, the one yellow hero card) |
| `--win` / `--win-soft` | `#1EB854` / `#B8ECC8` | same | success only |
| `--red` / `--red-soft` | `#EF4444` / `#FBD5D5` | same | error only |
| `--premium` / `--premium-soft` | `#8B5CF6` / `#E5DBFB` | same | premium/upsell only |
| `--bg` | `#FBF6EC` (flat cream) | `#0B0B12` | page surface — **no gradients** |
| `--surface-card` | `#FFFFFF` | `#22222E` (solid, never rgba) | cards |
| `--surface-sunken` | `#F3ECDD` | `#16161F` | progress tracks, inset wells |
| text primary/muted/faint | `#0F0F10` / `#6B675E` / `#A39E92` | `#F5F2EA` / `#ABA8B6` / `#6E6B7A` | |

### Type — three families, fixed scale
- **Unbounded** — display/h1/h2/h3, hero numbers. Tight tracking (−0.02…−0.045em). One h1 (26/800) per screen.
- **Nunito** — all body copy, line-height 1.65.
- **JetBrains Mono** — eyebrows, stat labels, any changing number (tabular-nums).
- Scale: stat 32 / display 30 / h1 26 / h2 18 / h3 14 / body 14 / small 12 / caption 11 / eyebrow 10.

### Spacing / radii / depth
- Spacing: strict 4px grid — `4 / 8 / 12 / 16 / 20 / 24 / 32`.
- Radii: `8 / 12 (button) / 16 (card) / 18 (hero) / 24 / pill`.
- Depth = **hard stamped shadows**: rest `0 3px 0 0 ink`, hero `0 5px`, CTA `0 6px`. Press collapses to `0 1px` + `translateY(~4px)` over ~90ms (`cubic-bezier(.2,.8,.2,1)`). Flat = dead.
- Borders: 2px solid ink on essentially every surface/control (the signature). Dark theme → `#000`.
- Focus: 3px streak ring, offset 2px.

### Iron rules
1. No raw hex outside token CSS — only `var(--…)`. 2. No inline font-family — only `--ff-*`. 3. Sizes/spacing/radii from the scales. 4. **One** streak CTA + **one** yellow splash card per screen. 5. Hard shadows; presses stamp in. 6. Check light/dark + 390px/1440px. 7. All strings through `ru.ts`/`kk.ts`.

## Implementation in this codebase

The app is already token-driven (`constants/themes.ts` → CSS vars, `constants/styles.ts` → `COLORS`/`CARD`/`TYPE`/`GLOBAL_STYLES`). Vibrant Game is applied by **retargeting those central tokens** — no component rewrites, no structural/file changes.

| App token | Retargeted to |
|---|---|
| `themes.ts` `LIGHT.bg` | flat `#FBF6EC` (was cream gradient) |
| `themes.ts` `DARK.bg` | flat `#0B0B12` (was radial gradient) |
| `bg-card` | solid `#FFFFFF` / `#22222E` (was rgba) |
| `bg-hero` | `#FFF1B8` (the one yellow hero card) |
| all `border*` vars | `--ink` `#0F0F10` (light) / `#000` (dark) — 2px stamped |
| `shadow-sm/md/glow` | hard stamped `0 3px/5px/6px 0 0 ink` (was soft blur) |
| `COLORS.accent` | `#FF5A36` streak (was `#FF6B35`) |
| `COLORS.green/yellow/purple` | `#1EB854` win / `#FFC233` xp / `#8B5CF6` premium |
| `CARD` / `CARD_COMPACT` / `CARD_HERO` | 2px ink border + hard shadow + radii 16/12/18 |
| `TYPE.body` | Nunito; headings stay Unbounded; mono stays JetBrains |
| `GLOBAL_STYLES` | body font Nunito; focus ring streak; button press = `translateY` stamp |
| `index.html` | + Nunito webfont; theme-color `#0B0B12`; splash + pre-theme light CSS resynced |

## Status
- **Done (central foundation):** palette, surfaces, borders, hard shadows, fonts, focus ring, press animation, card/button recipes — the whole app adopts the Vibrant Game language.
- **Remaining (per-component pixel-match, follow-up):** exact recreation of the mockup screens (Home/Quiz/Results/Subjects/Profile), the `AnswerOption`/`SubjectTile`/`Pill`/`Stat` learn recipes, hero-card text-contrast in dark theme, and removing leftover teal accents. Reference: `_design_ref/entprep-design-system/project/ui_kits/app/` and `components/`.

> Localhost-only review build. Not deployed to production.

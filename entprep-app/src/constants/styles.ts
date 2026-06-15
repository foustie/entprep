import React, { type CSSProperties } from 'react';
import type { Breakpoint } from '../hooks/useBreakpoint';

export const COLORS = {
  bg: "var(--bg)",
  card: "var(--bg-card)",
  cardBorder: "var(--border)",
  // Legacy aliases — remapped to v2 streak palette (no more teal/brown)
  accent: "#FF5A36",
  accentHover: "#FF6A47",
  accentDark: "#E84D2C",
  teal: "#FF5A36",
  tealDark: "#E84D2C",
  tealLight: "#FF6A47",
  green: "#1EB854",
  yellow: "#FFC233",
  amber: "#FFC233",
  red: "#EF4444",
  cyan: "#FF6A47",
  blue: "#38bdf8",
  purple: "#8b5cf6",
  text: "var(--text)",
  textBody: "var(--text-body)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-dim)",
  // A11Y-2: legible colored text on tints/cards — theme-aware (bright on dark, darkened on light).
  // Use these (not the saturated green/red/amber/streak below) wherever a color is applied to TEXT.
  greenText: "var(--text-green)",
  redText: "var(--text-red)",
  amberText: "var(--text-amber)",
  streakText: "var(--text-streak)",

  // v2 Vibrant Game palette (Apr 20, 2026 redesign) — used in new screens
  streak: "#FF5A36",      // primary action CTA, streak fire, "ты" highlight
  streakSoft: "#FFC4AC",  // streak context bg
  xp: "#FFC233",          // reward / XP / highlight
  xpSoft: "#FFDF5E",      // hero splash fill
  xpSofter: "#FFF1B8",    // subtle yellow rail
  win: "#1EB854",         // progress bar / correct (semantic only)
  winSoft: "#B8ECC8",     // progress fill light
} as const;

/** Subtle tinted backgrounds & borders for colored cards/badges */
export const TINT = {
  teal:   { bg: 'rgba(255,90,54,0.12)',    bgLight: 'rgba(255,90,54,0.06)',  border: 'rgba(255,90,54,0.3)',   borderLight: 'rgba(255,90,54,0.2)' },
  accent: { bg: 'rgba(255,90,54,0.12)',    bgLight: 'rgba(255,90,54,0.06)',  border: 'rgba(255,90,54,0.3)',   borderLight: 'rgba(255,90,54,0.2)' },
  green:  { bg: 'rgba(34,197,94,0.12)',    bgLight: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.2)',   borderLight: 'rgba(34,197,94,0.15)' },
  red:    { bg: 'rgba(239,68,68,0.12)',    bgLight: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)',   borderLight: 'rgba(239,68,68,0.15)' },
  amber:  { bg: 'rgba(245,158,11,0.12)',   bgLight: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', borderLight: 'rgba(245,158,11,0.15)' },
  blue:   { bg: 'rgba(56,189,248,0.12)',   bgLight: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.2)', borderLight: 'rgba(56,189,248,0.15)' },
  purple: { bg: 'rgba(139,92,246,0.12)',   bgLight: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)', borderLight: 'rgba(139,92,246,0.15)' },
  // v2 Vibrant Game
  streak: { bg: 'rgba(255,90,54,0.12)',    bgLight: 'rgba(255,90,54,0.06)',  border: 'rgba(255,90,54,0.3)',  borderLight: 'rgba(255,90,54,0.2)' },
  xp:     { bg: 'rgba(255,194,51,0.14)',   bgLight: 'rgba(255,194,51,0.07)', border: 'rgba(255,194,51,0.35)', borderLight: 'rgba(255,194,51,0.25)' },
  win:    { bg: 'rgba(30,184,84,0.12)',    bgLight: 'rgba(30,184,84,0.06)',  border: 'rgba(30,184,84,0.3)',  borderLight: 'rgba(30,184,84,0.2)' },
} as const;

/** Score-based color: green >= 70, yellow >= 50, red < 50 */
export function scoreColor(pct: number): string {
  if (pct >= 70) return COLORS.green;
  if (pct >= 50) return COLORS.yellow;
  return COLORS.red;
}

/** Spacing scale (4px grid) */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48, huge: 64 } as const;

/** Icon size scale */
export const ICON = { sm: 14, md: 16, lg: 20, xl: 24 } as const;

/** Border radius scale */
export const R = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100 } as const;

/** Font size scale */
export const FS = { xxs: 9, xs: 10, sm: 11, base: 12, md: 13, lg: 14, xl: 15, xxl: 18, h1: 26, display: 44, display1: 56, display2: 80, display3: 128 } as const;

/** Font weight scale */
export const FW = { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const;

/** Font family stacks — always use these, never inline "'Unbounded',sans-serif" */
export const FF = {
  // Display font is language-switched via the --ff-display CSS var (see GLOBAL_STYLES):
  // RU keeps 'Unbounded'; KK uses 'Rubik' because Unbounded has no Kazakh glyphs (ә ғ қ ң ө ұ ү һ).
  display: "var(--ff-display, 'Unbounded', 'Nunito', system-ui, sans-serif)",
  // Fixed brand font for the Diyar mascot "Д" glyph — it's a logo, not translatable text,
  // so it must stay Unbounded in BOTH languages (Unbounded covers Cyrillic Д). Never switch to RubikKZ.
  brand: "'Unbounded', sans-serif",
  body: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Transition presets */
export const TR = {
  fast: `0.15s cubic-bezier(0.4,0,0.2,1)`,
  normal: `0.25s cubic-bezier(0.4,0,0.2,1)`,
  slow: `0.4s cubic-bezier(0.16,1,0.3,1)`,
} as const;

/** Colored shadow/glow presets */
export const GLOW = {
  accent: '0 4px 20px rgba(255,90,54,0.25)',
  teal: '0 4px 20px rgba(255,90,54,0.25)',
  success: '0 4px 16px rgba(30,184,84,0.15)',
  error: '0 4px 16px rgba(255,90,54,0.15)',
} as const;

// ─ v2 ink-bordered card presets ──────────────────────────────────────────
export const CARD: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 16,
  border: "2px solid var(--ink)",
  boxShadow: "0 3px 0 0 var(--ink)",
  padding: "18px 16px",
};

export const CARD_COMPACT: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 12,
  border: "2px solid var(--ink)",
  boxShadow: "0 2px 0 0 var(--ink)",
  padding: "14px 14px",
};

export const CARD_HERO: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 18,
  border: "2px solid var(--ink)",
  boxShadow: "0 5px 0 0 var(--ink)",
  padding: "24px 18px",
  position: "relative",
  overflow: "hidden",
};

// ─ "Alive" Duolingo-style presets ────────────────────────────────────────

/** 3D card — raised above surface with bottom border trick */
export const CARD_3D: CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 16,
  border: '2px solid var(--border-light)',
  borderBottom: '4px solid var(--border-md)',
  padding: '16px',
};

/** 3D card large — hero/feature cards */
export const CARD_3D_LG: CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 20,
  border: '2px solid var(--border-light)',
  borderBottom: '4px solid var(--border-md)',
  padding: '24px',
};

/** Answer card states — for test screen */
export const ANSWER = {
  base: {
    background: 'var(--bg-card)',
    borderRadius: 12,
    border: '2px solid var(--border-md)',
    borderBottom: '4px solid var(--border-strong)',
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'all 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as CSSProperties,
  selected: {
    borderColor: '#1CB0F6',
    background: 'rgba(28,176,246,0.08)',
    borderBottomColor: '#09A1D7',
  } as CSSProperties,
  correct: {
    borderColor: '#58CC02',
    background: 'rgba(88,204,2,0.08)',
    borderBottomColor: '#46A302',
  } as CSSProperties,
  wrong: {
    borderColor: '#FF4B4B',
    background: 'rgba(255,75,75,0.06)',
    borderBottomColor: '#E91B1B',
  } as CSSProperties,
};

/** Feedback footer — slides up after answer */
export const FEEDBACK_FOOTER = {
  correct: {
    background: '#58CC02',
    color: '#fff',
    padding: '20px 24px',
    borderRadius: '20px 20px 0 0',
    fontFamily: "'Nunito', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 16,
  } as CSSProperties,
  wrong: {
    background: '#FF4B4B',
    color: '#fff',
    padding: '20px 24px',
    borderRadius: '20px 20px 0 0',
    fontFamily: "'Nunito', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 16,
  } as CSSProperties,
};

/** Horizontal scroll pill chip — for quick actions */
export const PILL: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 18px',
  borderRadius: 100,
  border: '2px solid var(--border-md)',
  borderBottom: '3px solid var(--border-strong)',
  background: 'var(--bg-card)',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "'Nunito', system-ui, sans-serif",
  color: 'var(--text)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'transform 80ms, border-bottom 80ms',
};

/** Pill-shaped progress bar container */
export const PROGRESS_BAR: CSSProperties = {
  height: 14,
  borderRadius: 100,
  background: 'var(--bg-subtle-2)',
  overflow: 'hidden',
};

/** Progress bar fill */
export const PROGRESS_FILL: CSSProperties = {
  height: '100%',
  borderRadius: 100,
  background: '#58CC02',
  transition: 'width 500ms cubic-bezier(0.65, 0, 0.35, 1)',
};

/** Bouncy spring easing — use for positive feedback moments */
export const EASE_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Andy mascot glow — adds signature color to transparent PNGs */
export const ANDY_GLOW = {
  default: 'drop-shadow(0 2px 12px rgba(255,90,54,0.25))',
  excited: 'drop-shadow(0 2px 12px rgba(255,90,54,0.3))',
  streak: 'drop-shadow(0 2px 12px rgba(255,150,0,0.3))',
  calm: 'drop-shadow(0 2px 12px rgba(139,92,246,0.2))',
} as const;

export const TYPE = {
  // ─ Display (hero numbers) ──────────────────────────────────────────
  // Only for huge numerical stats or hero headlines. NEVER for body text.
  display: { fontSize: 80, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, fontFamily: "var(--ff-display, 'Unbounded', -apple-system, system-ui, sans-serif)", fontVariantNumeric: 'tabular-nums', color: 'var(--text)', margin: 0 } as CSSProperties,
  displayLg: { fontSize: 128, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.9, fontFamily: "var(--ff-display, 'Unbounded', -apple-system, system-ui, sans-serif)", fontVariantNumeric: 'tabular-nums', color: 'var(--text)', margin: 0 } as CSSProperties,

  // ─ Headlines ───────────────────────────────────────────────────────
  h1: { fontSize: 26, fontWeight: 800, color: "var(--text)", fontFamily: "var(--ff-display, 'Unbounded', -apple-system, system-ui, sans-serif)", margin: 0, lineHeight: 1.2 } as CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, color: "var(--text)", fontFamily: "var(--ff-display, 'Unbounded', -apple-system, system-ui, sans-serif)", margin: 0 } as CSSProperties,
  h3: { fontSize: 14, fontWeight: 700, color: "var(--text)", fontFamily: "var(--ff-display, 'Unbounded', -apple-system, system-ui, sans-serif)", margin: 0 } as CSSProperties,

  // ─ Subtitle (under hero number) ────────────────────────────────────
  subtitle: { fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-secondary)', fontFamily: "'Nunito', system-ui, sans-serif", margin: 0, textWrap: 'balance' } as CSSProperties,
  subtitleLg: { fontSize: 17, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-secondary)', fontFamily: "'Nunito', system-ui, sans-serif", margin: 0, textWrap: 'balance' } as CSSProperties,

  // ─ Body (Nunito — rounded, friendly) ───────────────────────────────
  body: { fontSize: 14, color: "var(--text-body)", lineHeight: 1.65, fontFamily: "'Nunito', system-ui, sans-serif" } as CSSProperties,
  bodySmall: { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "'Nunito', system-ui, sans-serif" } as CSSProperties,
  caption: { fontSize: 11, color: "var(--text-muted)", fontFamily: "'Nunito', system-ui, sans-serif" } as CSSProperties,

  // ─ Stats (mini numbers) ────────────────────────────────────────────
  stat: { fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'var(--text)' } as CSSProperties,
  statSmall: { fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'var(--text)' } as CSSProperties,

  // ─ Eyebrow (uppercase tracked label above heading) ─────────────────
  eyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", lineHeight: 1.3 } as CSSProperties,

  // ─ Stat label (under mini stat numbers) ────────────────────────────
  statLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", lineHeight: 1.3, marginTop: 4 } as CSSProperties,

  // ─ Deprecated, kept for backward compat — use statLabel or eyebrow ─
  mono: { fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" } as CSSProperties,
  label: { fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" } as CSSProperties,
};

/** Duolingo-style 3D button presets — border-bottom trick for "alive" feel */
export const BUTTON = {
  primary: {
    padding: '12px 24px',
    borderRadius: 12,
    background: '#FF5A36',
    border: '2px solid transparent',
    borderBottom: '4px solid #E84D2C',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Nunito', system-ui, sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 80ms, border-bottom 80ms',
  } as CSSProperties,
  primaryActive: {
    borderBottom: '1px solid #E84D2C',
    transform: 'translateY(3px)',
  } as CSSProperties,
  secondary: {
    padding: '12px 24px',
    borderRadius: 12,
    background: 'var(--bg-card)',
    border: '2px solid var(--border-md)',
    borderBottom: '4px solid var(--border-strong)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Nunito', system-ui, sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 80ms, border-bottom 80ms',
  } as CSSProperties,
  teal: {
    padding: '12px 24px',
    borderRadius: 12,
    background: '#FF5A36',
    border: '2px solid transparent',
    borderBottom: '4px solid #E84D2C',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Nunito', system-ui, sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 80ms, border-bottom 80ms',
  } as CSSProperties,
};

/** Reusable section label style (uppercase muted heading) */
export const SECTION_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  marginBottom: 10,
};

/** Hover glow handlers for interactive cards */
export function hoverGlow(color: string) {
  return {
    onMouseEnter: (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}18`;
    },
    onMouseLeave: (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    },
  };
}


const RESPONSIVE_VARS = `:root{--content-max-width:480px;--content-padding:20px;--nav-height:70px;--sidebar-width:0px}@media(min-width:768px){:root{--content-max-width:720px;--content-padding:32px}}@media(min-width:1024px){:root{--content-max-width:960px;--content-padding:40px;--sidebar-width:220px}}`;

export const GLOBAL_STYLES = `${RESPONSIVE_VARS}:root{--ff-display:'Unbounded','Nunito',system-ui,sans-serif}html:lang(kk){--ff-display:'RubikKZ','Nunito',system-ui,sans-serif}*{box-sizing:border-box;margin:0;padding:0;color-scheme:var(--color-scheme)}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#FF5A36;cursor:pointer;border:3px solid var(--text);box-shadow:0 0 8px rgba(255,90,54,0.4)}input[type="range"]::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:#FF5A36;cursor:pointer;border:3px solid var(--text)}button{font-family:inherit;transition:transform 90ms cubic-bezier(.2,.8,.2,1),box-shadow 90ms cubic-bezier(.2,.8,.2,1)}button:active{transform:translateY(2px)!important}button:disabled{opacity:0.45;cursor:not-allowed}::selection{background:#FFDF5E;color:#0F0F10}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.03)}100%{transform:scale(1)}}@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-100%)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes screenIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes overlayIn{from{opacity:0}to{opacity:1}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes sheetUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}@keyframes confetti{0%{transform:scale(0) rotate(0deg);opacity:0}50%{transform:scale(1.3) rotate(180deg);opacity:1}100%{transform:scale(1) rotate(360deg);opacity:1}}@keyframes firePulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,0.3)}50%{box-shadow:0 0 12px 4px rgba(245,158,11,0.15)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}@keyframes streakPulse{0%{opacity:1}50%{opacity:0.7}100%{opacity:1}}@keyframes toastIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes andyBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes heroEnter{0%{opacity:0;transform:translateY(14px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes shineSweep{0%{transform:translateX(-120%) skewX(-18deg)}100%{transform:translateX(220%) skewX(-18deg)}}:focus{outline:none}:focus-visible{outline:3px solid #FF5A36;outline-offset:2px;border-radius:8px}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:2px}`;

export const LAYOUT = {
  maxWidth: "var(--content-max-width)",
  padding: "var(--content-padding)",
  navHeight: "var(--nav-height)",
  sidebarWidth: "var(--sidebar-width)",
} as const;

export function responsive<T extends CSSProperties>(
  bp: Breakpoint,
  mobile: T,
  tablet?: Partial<T>,
  desktop?: Partial<T>,
): T {
  if (bp === 'desktop' && desktop) return { ...mobile, ...tablet, ...desktop } as T;
  if (bp !== 'mobile' && tablet) return { ...mobile, ...tablet } as T;
  return mobile;
}

/* @ds-bundle: {"format":3,"namespace":"ENTprepDesignSystem_78ebb6","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"Stat","sourcePath":"components/core/Stat.jsx"},{"name":"AnswerOption","sourcePath":"components/learn/AnswerOption.jsx"},{"name":"SubjectTile","sourcePath":"components/learn/SubjectTile.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"132aae813a26","components/core/Button.jsx":"323c8a987ecc","components/core/Card.jsx":"dedea3cd744a","components/core/Eyebrow.jsx":"b3272dfc4705","components/core/IconButton.jsx":"4792f0146e65","components/core/Pill.jsx":"8d9f4367af0b","components/core/ProgressBar.jsx":"2139ab274b01","components/core/Stat.jsx":"ffccb877d19a","components/learn/AnswerOption.jsx":"e089b34b839f","components/learn/SubjectTile.jsx":"241c969d8c53","ui_kits/app/HomeScreen.jsx":"182f8ebd4088","ui_kits/app/ProfileScreen.jsx":"58c6a4707825","ui_kits/app/QuizScreen.jsx":"9eafc5d9972b","ui_kits/app/ResultsScreen.jsx":"f2f7d6a8b180","ui_kits/app/SubjectsScreen.jsx":"42ff08d5c60a","ui_kits/app/data.js":"3cbab99d593b","ui_kits/app/kit.jsx":"0a020a4987be"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ENTprepDesignSystem_78ebb6 = window.ENTprepDesignSystem_78ebb6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Badge — a tiny stamped status/count marker. Smaller than a
 * Pill; for notification counts, "NEW", correct/wrong ticks, etc.
 */
function Badge({
  tone = 'streak',
  children,
  style = {},
  ...rest
}) {
  const tones = {
    streak: {
      bg: 'var(--streak)',
      fg: '#FFFFFF'
    },
    xp: {
      bg: 'var(--xp)',
      fg: 'var(--ink)'
    },
    win: {
      bg: 'var(--win)',
      fg: '#FFFFFF'
    },
    red: {
      bg: 'var(--red)',
      fg: '#FFFFFF'
    },
    premium: {
      bg: 'var(--premium)',
      fg: '#FFFFFF'
    },
    ink: {
      bg: 'var(--ink)',
      fg: '#FFFFFF'
    }
  }[tone] || {};
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 22,
      height: 22,
      padding: '0 7px',
      fontFamily: 'var(--ff-mono)',
      fontWeight: 800,
      fontSize: 'var(--fs-eyebrow)',
      letterSpacing: '0.04em',
      fontVariantNumeric: 'tabular-nums',
      background: tones.bg,
      color: tones.fg,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-pill)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Button — the stamped, pressable action button.
 * Three variants: primary (streak orange — the ONE CTA per screen),
 * secondary (white w/ ink border), ink (solid black).
 * On press the hard shadow collapses and the button sinks ~4px.
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  leadingIcon = null,
  trailingIcon = null,
  children,
  style = {},
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const palette = {
    primary: {
      bg: 'var(--streak)',
      fg: '#FFFFFF',
      rest: 'var(--shadow-cta)'
    },
    secondary: {
      bg: 'var(--surface-card)',
      fg: 'var(--text-primary)',
      rest: 'var(--shadow-rest)'
    },
    ink: {
      bg: 'var(--ink)',
      fg: '#FFFFFF',
      rest: 'var(--shadow-rest)'
    }
  }[variant] || {};
  const sizing = {
    sm: {
      pad: '8px 14px',
      minH: 40,
      fs: 'var(--fs-body-small)'
    },
    md: {
      pad: '12px 20px',
      minH: 48,
      fs: 'var(--fs-h3)'
    },
    lg: {
      pad: '16px 24px',
      minH: 56,
      fs: 'var(--fs-h2)'
    }
  }[size];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onPointerDown: () => !disabled && setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      letterSpacing: '-0.01em',
      fontSize: sizing.fs,
      background: palette.bg,
      color: palette.fg,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-12)',
      padding: sizing.pad,
      minHeight: sizing.minH,
      width: fullWidth ? '100%' : 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--sp-8)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      boxShadow: pressed || disabled ? 'var(--shadow-press)' : palette.rest,
      transform: pressed && !disabled ? 'translateY(4px)' : 'translateY(0)',
      transition: 'transform 90ms cubic-bezier(.2,.8,.2,1), box-shadow 90ms cubic-bezier(.2,.8,.2,1)',
      userSelect: 'none',
      ...style
    }
  }, rest), leadingIcon, children, trailingIcon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Card — cream-paper surface with a 2px ink border and a hard
 * stamped shadow. `hero` is the one bright (yellow) splash card per
 * screen; pass a `tone` to tint a splash card (xp / streak / win).
 */
function Card({
  variant = 'base',
  tone = null,
  as = 'div',
  children,
  style = {},
  ...rest
}) {
  const Tag = as;
  const toneBg = {
    xp: 'var(--xp-softer)',
    streak: 'var(--streak-soft)',
    win: 'var(--win-soft)',
    premium: 'var(--premium-soft)'
  }[tone];
  const base = {
    background: toneBg || 'var(--surface-card)',
    border: '2px solid var(--border-strong)',
    borderRadius: 'var(--r-16)',
    boxShadow: 'var(--shadow-rest)',
    padding: 'var(--sp-20)',
    // text on a tinted splash card is always ink-dark
    color: tone ? 'var(--ink)' : 'var(--text-primary)'
  };
  const variants = {
    base: {},
    compact: {
      padding: 'var(--sp-12)',
      borderRadius: 'var(--r-12)'
    },
    hero: {
      borderRadius: 'var(--r-18)',
      boxShadow: 'var(--shadow-hero)',
      padding: 'var(--sp-24)',
      background: toneBg || 'var(--xp-softer)',
      color: 'var(--ink)'
    }
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Eyebrow — a mono, uppercase, wide-tracked label that sits
 * above a section heading (e.g. "• ЕНТ 2026 •"). Use instead of
 * decorative dots or kicker graphics.
 */
function Eyebrow({
  children,
  color = 'var(--text-muted)',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 800,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      lineHeight: 1,
      color,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep IconButton — a square, stamped, pressable button for a single
 * icon. Always pass an `ariaLabel`. Use `variant="primary"` only when it
 * is THE action on screen.
 */
function IconButton({
  variant = 'secondary',
  ariaLabel,
  children,
  style = {},
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const palette = {
    primary: {
      bg: 'var(--streak)',
      fg: '#FFFFFF',
      rest: 'var(--shadow-cta)'
    },
    secondary: {
      bg: 'var(--surface-card)',
      fg: 'var(--text-primary)',
      rest: 'var(--shadow-rest)'
    },
    ink: {
      bg: 'var(--ink)',
      fg: '#FFFFFF',
      rest: 'var(--shadow-rest)'
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      width: 48,
      height: 48,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: palette.bg,
      color: palette.fg,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-12)',
      cursor: 'pointer',
      boxShadow: pressed ? 'var(--shadow-press)' : palette.rest,
      transform: pressed ? 'translateY(4px)' : 'translateY(0)',
      transition: 'transform 90ms cubic-bezier(.2,.8,.2,1), box-shadow 90ms cubic-bezier(.2,.8,.2,1)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Pill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Pill — a stamped chip for tags, filters, counters and the
 * streak counter. Mono label, ink border, pill radius. Tint via `tone`.
 */
function Pill({
  tone = 'neutral',
  icon = null,
  children,
  style = {},
  ...rest
}) {
  const tones = {
    neutral: {
      bg: 'var(--surface-card)',
      fg: 'var(--text-primary)'
    },
    xp: {
      bg: 'var(--xp-soft)',
      fg: 'var(--ink)'
    },
    streak: {
      bg: 'var(--streak)',
      fg: '#FFFFFF'
    },
    win: {
      bg: 'var(--win-soft)',
      fg: 'var(--ink)'
    },
    premium: {
      bg: 'var(--premium-soft)',
      fg: 'var(--ink)'
    }
  }[tone] || {};
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--ff-mono)',
      fontWeight: 700,
      fontSize: 'var(--fs-caption)',
      letterSpacing: '0.04em',
      fontVariantNumeric: 'tabular-nums',
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-pill)',
      padding: '5px 12px',
      background: tones.bg,
      color: tones.fg,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pill.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep ProgressBar — ink-bordered pill track with a colored fill.
 * Default fill is win-green (progress = success). Use `tone` to switch.
 */
function ProgressBar({
  value = 0,
  tone = 'win',
  showLabel = false,
  style = {},
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    win: 'var(--win)',
    xp: 'var(--xp)',
    streak: 'var(--streak)'
  }[tone] || 'var(--win)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-12)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": pct,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    style: {
      flex: 1,
      height: 14,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-pill)',
      background: 'var(--surface-sunken)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      background: fill,
      borderRadius: 'var(--r-pill)',
      transition: 'width 240ms cubic-bezier(.2,.8,.2,1)'
    }
  })), showLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontWeight: 700,
      fontSize: 'var(--fs-body-small)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-muted)',
      minWidth: 38,
      textAlign: 'right'
    }
  }, pct, "%"));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep Stat — a big mono, tabular-nums number with a small mono
 * label beneath. For streaks, XP, scores, days-left counters.
 */
function Stat({
  value,
  label,
  color = 'var(--text-primary)',
  align = 'left',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      alignItems: align === 'center' ? 'center' : 'flex-start',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 'var(--fs-stat)',
      fontWeight: 800,
      lineHeight: 1.05,
      fontVariantNumeric: 'tabular-nums',
      color
    }
  }, value), label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Stat.jsx", error: String((e && e.message) || e) }); }

// components/learn/AnswerOption.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep AnswerOption — a full-width quiz answer row with a leading
 * letter marker (А/Б/В/Г). States: base, selected, correct, wrong.
 * When overriding colors we always set the FULL border shorthand
 * (border: '2px solid X') to avoid React's borderColor merge conflict.
 */
function AnswerOption({
  marker,
  state = 'base',
  disabled = false,
  children,
  style = {},
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const states = {
    base: {
      border: '2px solid var(--ink)',
      bg: 'var(--surface-card)',
      mk: 'var(--ink)',
      mkFg: '#FFFFFF',
      mkBg: 'transparent'
    },
    selected: {
      border: '2px solid var(--streak)',
      bg: 'var(--surface-card)',
      mk: 'var(--streak)',
      mkFg: '#FFFFFF',
      mkBg: 'var(--streak)'
    },
    correct: {
      border: '2px solid var(--win)',
      bg: 'var(--win-soft)',
      mk: 'var(--win)',
      mkFg: '#FFFFFF',
      mkBg: 'var(--win)'
    },
    wrong: {
      border: '2px solid var(--red)',
      bg: 'var(--red-soft)',
      mk: 'var(--red)',
      mkFg: '#FFFFFF',
      mkBg: 'var(--red)'
    }
  }[state];
  const isResult = state === 'correct' || state === 'wrong';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled || isResult,
    "aria-pressed": state === 'selected',
    onPointerDown: () => !disabled && !isResult && setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-12)',
      width: '100%',
      textAlign: 'left',
      background: states.bg,
      border: states.border,
      borderRadius: 'var(--r-12)',
      boxShadow: pressed ? 'var(--shadow-press)' : 'var(--shadow-rest)',
      transform: pressed ? 'translateY(2px)' : 'translateY(0)',
      padding: '14px var(--sp-16)',
      fontFamily: 'var(--ff-body)',
      fontWeight: 700,
      fontSize: 'var(--fs-body)',
      color: 'var(--ink)',
      cursor: disabled || isResult ? 'default' : 'pointer',
      transition: 'transform 90ms cubic-bezier(.2,.8,.2,1), box-shadow 90ms cubic-bezier(.2,.8,.2,1)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: '0 0 auto',
      width: 28,
      height: 28,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--ff-mono)',
      fontWeight: 800,
      fontSize: 'var(--fs-body-small)',
      border: '2px solid ' + states.mk,
      background: states.mkBg,
      color: states.mkBg === 'transparent' ? states.mk : states.mkFg,
      borderRadius: 'var(--r-8)'
    }
  }, marker), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, children));
}
Object.assign(__ds_scope, { AnswerOption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/learn/AnswerOption.jsx", error: String((e && e.message) || e) }); }

// components/learn/SubjectTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ENTprep SubjectTile — a stamped, pressable tile for a subject in the
 * lesson path: icon chip, title, subtitle and an optional progress bar.
 */
function SubjectTile({
  icon = null,
  title,
  subtitle,
  progress = null,
  accent = 'var(--xp-soft)',
  locked = false,
  style = {},
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: locked,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-16)',
      width: '100%',
      textAlign: 'left',
      background: 'var(--surface-card)',
      border: '2px solid var(--border-strong)',
      borderRadius: 'var(--r-16)',
      boxShadow: pressed ? 'var(--shadow-press)' : 'var(--shadow-rest)',
      transform: pressed ? 'translateY(2px)' : 'translateY(0)',
      padding: 'var(--sp-16)',
      cursor: locked ? 'not-allowed' : 'pointer',
      opacity: locked ? 0.55 : 1,
      transition: 'transform 90ms cubic-bezier(.2,.8,.2,1), box-shadow 90ms cubic-bezier(.2,.8,.2,1)',
      ...style
    },
    onPointerDown: () => !locked && setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false)
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: '0 0 auto',
      width: 48,
      height: 48,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: accent,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-12)',
      color: 'var(--ink)'
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--ff-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-h3)',
      letterSpacing: '-0.02em',
      color: 'var(--text-primary)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--ff-mono)',
      fontSize: 'var(--fs-caption)',
      fontWeight: 600,
      color: 'var(--text-muted)',
      marginTop: 2,
      fontVariantNumeric: 'tabular-nums'
    }
  }, subtitle), progress != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 8,
      height: 10,
      border: '2px solid var(--ink)',
      borderRadius: 'var(--r-pill)',
      background: 'var(--surface-sunken)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: Math.max(0, Math.min(100, progress)) + '%',
      height: '100%',
      background: 'var(--win)'
    }
  }))));
}
Object.assign(__ds_scope, { SubjectTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/learn/SubjectTile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HomeScreen.jsx
try { (() => {
// Home / dashboard screen.
const {
  Card,
  Button,
  Eyebrow,
  ProgressBar,
  SubjectTile,
  Stat
} = window.ENTprepDesignSystem_78ebb6;
function HomeScreen({
  data,
  onStartQuiz,
  onOpenSubjects
}) {
  const {
    user,
    goal,
    subjects
  } = data;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 \u0414\u043D\u0435\u0432\u043D\u0430\u044F \u0446\u0435\u043B\u044C \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: '-0.035em',
      color: 'var(--ink)',
      marginTop: 8
    }
  }, "\u041F\u0440\u0438\u0432\u0435\u0442, ", user.name, " \uD83D\uDC4B"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-body)',
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--ink)',
      marginTop: 2
    }
  }, "\u0415\u0449\u0451 ", goal.total - goal.done, " \u0443\u0440\u043E\u043A\u0430 \u2014 \u0438 \u0441\u0435\u0440\u0438\u044F \u0432 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438")), /*#__PURE__*/React.createElement(Stat, {
    value: `${goal.done}/${goal.total}`,
    label: "\u0443\u0440\u043E\u043A\u043E\u0432",
    color: "var(--ink)",
    align: "center"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: goal.done / goal.total * 100
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    leadingIcon: /*#__PURE__*/React.createElement(Icon, {
      name: "Play",
      size: 18,
      stroke: "#fff"
    }),
    onClick: onStartQuiz
  }, "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043A\u0432\u0435\u0441\u0442"))), /*#__PURE__*/React.createElement(Card, {
    variant: "compact"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      border: '2px solid var(--ink)',
      background: 'var(--streak-soft)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Flame",
    size: 22,
    stroke: "var(--streak)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '-0.02em'
    }
  }, "\u0421\u0435\u0440\u0438\u044F ", user.streak, " \u0434\u043D\u0435\u0439"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-muted)'
    }
  }, user.league))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, [1, 1, 1, 1, 1, 0, 0].map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 16,
      height: 16,
      borderRadius: 6,
      border: '2px solid var(--ink)',
      background: d ? 'var(--win)' : 'var(--surface-sunken)'
    }
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 \u0422\u0432\u043E\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: '-0.025em',
      marginTop: 4
    }
  }, "\u041A\u0443\u0434\u0430 \u0434\u0430\u043B\u044C\u0448\u0435?")), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenSubjects,
    style: {
      background: 'none',
      border: 0,
      cursor: 'pointer',
      fontFamily: 'var(--ff-mono)',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--streak)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, "\u0412\u0441\u0435 \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, subjects.slice(0, 3).map(s => /*#__PURE__*/React.createElement(SubjectTile, {
    key: s.id,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: s.icon,
      size: 22,
      stroke: "var(--ink)"
    }),
    title: s.title,
    subtitle: `${s.count} вопросов`,
    progress: s.progress,
    accent: s.accent,
    onClick: onStartQuiz
  })))));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProfileScreen.jsx
try { (() => {
// Profile screen — stats, league, theme toggle.
const {
  Card,
  Eyebrow,
  Stat,
  Button,
  ProgressBar,
  Pill
} = window.ENTprepDesignSystem_78ebb6;
function ProfileScreen({
  data,
  theme,
  onToggleTheme
}) {
  const {
    user
  } = data;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 18,
      border: '2px solid var(--ink)',
      background: 'var(--streak)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'var(--shadow-rest)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 900,
      fontSize: 26,
      color: '#fff',
      letterSpacing: '-0.04em'
    }
  }, user.name[0])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-0.03em'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: "xp",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "Crown",
      size: 13,
      stroke: "var(--ink)"
    })
  }, user.league)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: user.streak,
    label: "\u0434\u043D\u0435\u0439 \u043F\u043E\u0434\u0440\u044F\u0434",
    color: "var(--streak)",
    align: "center"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: user.xp.toLocaleString('ru-RU'),
    label: "\u0432\u0441\u0435\u0433\u043E XP",
    color: "var(--xp)",
    align: "center"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: "87%",
    label: "\u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C",
    color: "var(--win)",
    align: "center"
  }))), /*#__PURE__*/React.createElement(Card, {
    variant: "hero"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 \u0414\u043E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      margin: '8px 0 12px'
    }
  }, "\u0423\u0440\u043E\u0432\u0435\u043D\u044C 7 \u2192 8"), /*#__PURE__*/React.createElement(ProgressBar, {
    value: 62,
    tone: "xp",
    showLabel: true
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true,
    leadingIcon: /*#__PURE__*/React.createElement(Icon, {
      name: theme === 'dark' ? 'Sun' : 'Moon',
      size: 18,
      stroke: "var(--ink)"
    }),
    onClick: onToggleTheme
  }, theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'));
}
Object.assign(window, {
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/QuizScreen.jsx
try { (() => {
// Quiz screen — interactive: select an answer, check, see result + explanation.
const {
  Card,
  Button,
  Eyebrow,
  AnswerOption,
  IconButton,
  ProgressBar
} = window.ENTprepDesignSystem_78ebb6;
function QuizScreen({
  data,
  onBack,
  onFinish
}) {
  const q = data.quiz;
  const [selected, setSelected] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const correctIdx = q.options.findIndex(o => o.correct);
  const isRight = selected === correctIdx;
  function answerState(i) {
    if (!checked) return selected === i ? 'selected' : 'base';
    if (i === correctIdx) return 'correct';
    if (i === selected) return 'wrong';
    return 'base';
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 20px 6px'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    ariaLabel: "\u0412\u044B\u0439\u0442\u0438",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "X",
    size: 20,
    stroke: "var(--ink)"
  })), /*#__PURE__*/React.createElement(ProgressBar, {
    value: q.index / q.total * 100,
    tone: "streak"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontWeight: 700,
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-muted)',
      minWidth: 40,
      textAlign: 'right'
    }
  }, q.index, "/", q.total)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '12px 20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 ", q.subject, " \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 24,
      letterSpacing: '-0.035em',
      lineHeight: 1.15,
      marginTop: 10,
      color: 'var(--text-primary)'
    }
  }, q.question)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, q.options.map((o, i) => /*#__PURE__*/React.createElement(AnswerOption, {
    key: i,
    marker: o.marker,
    state: answerState(i),
    onClick: () => !checked && setSelected(i)
  }, o.text))), checked && /*#__PURE__*/React.createElement(Card, {
    tone: isRight ? 'win' : 'streak',
    variant: "compact"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isRight ? 'CircleCheck' : 'Lightbulb',
    size: 18,
    stroke: "var(--ink)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 14,
      letterSpacing: '-0.02em',
      color: 'var(--ink)'
    }
  }, isRight ? 'Верно! +10 XP' : 'Почти! Разбор:')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-body)',
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.55,
      color: 'var(--ink)'
    }
  }, q.explain))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px',
      borderTop: '2px solid var(--ink)',
      background: 'var(--surface-card)'
    }
  }, !checked ? /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    disabled: selected === null,
    onClick: () => setChecked(true)
  }, "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C") : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    trailingIcon: /*#__PURE__*/React.createElement(Icon, {
      name: "ArrowRight",
      size: 18,
      stroke: "#fff"
    }),
    onClick: onFinish
  }, "\u0414\u0430\u043B\u044C\u0448\u0435")));
}
Object.assign(window, {
  QuizScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/QuizScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ResultsScreen.jsx
try { (() => {
// Results screen — shown after a quest. One yellow hero card, one CTA.
const {
  Card,
  Button,
  Eyebrow,
  Stat,
  Pill
} = window.ENTprepDesignSystem_78ebb6;
function ResultsScreen({
  data,
  onReview,
  onHome
}) {
  const r = data.results;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 76,
      height: 76,
      margin: '0 auto 14px',
      borderRadius: 20,
      border: '2px solid var(--ink)',
      background: 'var(--xp)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'var(--shadow-hero)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Trophy",
    size: 38,
    stroke: "var(--ink)"
  })), /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 \u041A\u0432\u0435\u0441\u0442 \u043F\u0440\u043E\u0439\u0434\u0435\u043D \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 900,
      fontSize: 26,
      letterSpacing: '-0.04em',
      marginTop: 8
    }
  }, "\u041A\u0440\u0430\u0441\u0430\u0432\u0430! \uD83D\uDD25"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-body)',
      fontWeight: 700,
      fontSize: 14,
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "\u0421\u0435\u0440\u0438\u044F ", data.user.streak, " \u0434\u043D\u0435\u0439 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430")), /*#__PURE__*/React.createElement(Card, {
    variant: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-around',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: `${r.score}/${r.total}`,
    label: "\u043E\u0442\u0432\u0435\u0442\u043E\u0432",
    color: "var(--ink)",
    align: "center"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      background: 'var(--ink)',
      opacity: 0.25
    }
  }), /*#__PURE__*/React.createElement(Stat, {
    value: `+${r.xp}`,
    label: "XP",
    color: "var(--ink)",
    align: "center"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      background: 'var(--ink)',
      opacity: 0.25
    }
  }), /*#__PURE__*/React.createElement(Stat, {
    value: `${r.accuracy}%`,
    label: "\u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C",
    color: "var(--ink)",
    align: "center"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: "win",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "TrendingUp",
      size: 13,
      stroke: "var(--ink)"
    })
  }, "+1 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0441\u043A\u043E\u0440\u043E"), /*#__PURE__*/React.createElement(Pill, {
    tone: "streak",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "Flame",
      size: 13,
      stroke: "#fff"
    })
  }, "\u0441\u0435\u0440\u0438\u044F x", data.user.streak)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    size: "lg",
    leadingIcon: /*#__PURE__*/React.createElement(Icon, {
      name: "Search",
      size: 18,
      stroke: "#fff"
    }),
    onClick: onReview
  }, "\u0420\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C \u043E\u0448\u0438\u0431\u043A\u0438"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true,
    onClick: onHome
  }, "\u041D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E")));
}
Object.assign(window, {
  ResultsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ResultsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SubjectsScreen.jsx
try { (() => {
// Subjects screen — full lesson path list.
const {
  Eyebrow,
  SubjectTile,
  Pill
} = window.ENTprepDesignSystem_78ebb6;
function SubjectsScreen({
  data,
  onStartQuiz
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "\u2022 13 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0415\u041D\u0422 \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: '-0.035em',
      marginTop: 6
    }
  }, "\u0412\u044B\u0431\u0435\u0440\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: "streak"
  }, "\u0412\u0441\u0435"), /*#__PURE__*/React.createElement(Pill, null, "\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435"), /*#__PURE__*/React.createElement(Pill, null, "\u041F\u0440\u043E\u0444\u0438\u043B\u044C\u043D\u044B\u0435"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, data.subjects.map(s => /*#__PURE__*/React.createElement(SubjectTile, {
    key: s.id,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: s.icon,
      size: 22,
      stroke: "var(--ink)"
    }),
    title: s.title,
    subtitle: s.locked ? 'скоро' : `${s.count} вопросов · ${s.progress}%`,
    progress: s.locked ? null : s.progress,
    accent: s.accent,
    locked: s.locked,
    onClick: onStartQuiz
  }))));
}
Object.assign(window, {
  SubjectsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SubjectsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
// Fake content for the ENTprep app UI kit. Bilingual-ready strings kept
// inline (RU) for the demo; production uses useT() keys in ru.ts + kk.ts.
window.ENTPREP_DATA = {
  user: {
    name: 'Алихан',
    streak: 12,
    xp: 1240,
    league: 'Золотая лига'
  },
  goal: {
    done: 3,
    total: 5
  },
  subjects: [{
    id: 'math',
    icon: 'Calculator',
    title: 'Математика',
    count: 320,
    progress: 68,
    accent: 'var(--xp-soft)'
  }, {
    id: 'physics',
    icon: 'Atom',
    title: 'Физика',
    count: 240,
    progress: 41,
    accent: 'var(--win-soft)'
  }, {
    id: 'history',
    icon: 'Landmark',
    title: 'История Казахстана',
    count: 280,
    progress: 22,
    accent: 'var(--streak-soft)'
  }, {
    id: 'geo',
    icon: 'Globe2',
    title: 'География',
    count: 190,
    progress: 12,
    accent: 'var(--premium-soft)'
  }, {
    id: 'bio',
    icon: 'Leaf',
    title: 'Биология',
    count: 210,
    progress: 0,
    accent: 'var(--win-soft)',
    locked: true
  }],
  quiz: {
    subject: 'Математика · Алгебра',
    index: 4,
    total: 12,
    question: 'Чему равен log₂ 8 ?',
    options: [{
      marker: 'А',
      text: '2'
    }, {
      marker: 'Б',
      text: '3',
      correct: true
    }, {
      marker: 'В',
      text: '4'
    }, {
      marker: 'Г',
      text: '8'
    }],
    explain: 'log₂ 8 — это степень, в которую возводим 2, чтобы получить 8. 2³ = 8, значит ответ 3.'
  },
  results: {
    score: 9,
    total: 12,
    xp: 90,
    accuracy: 75,
    streakKept: true
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/app/kit.jsx
try { (() => {
// Shared UI-kit chrome: Lucide icon helper, top bar, bottom nav.
const {
  Pill,
  Stat,
  IconButton
} = window.ENTprepDesignSystem_78ebb6;
function Icon({
  name,
  size = 22,
  stroke = 'currentColor',
  width = 2.4
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && window.lucide && window.lucide.icons[name]) {
      ref.current.innerHTML = '';
      const el = window.lucide.createElement(window.lucide.icons[name]);
      el.setAttribute('width', size);
      el.setAttribute('height', size);
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', width);
      ref.current.appendChild(el);
    }
  }, [name, size, stroke, width]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: 'inline-flex',
      lineHeight: 0
    }
  });
}
function AppHeader({
  user,
  onProfile
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      border: '2px solid var(--ink)',
      background: 'var(--streak)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'var(--shadow-rest)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 900,
      color: '#fff',
      fontSize: 16,
      letterSpacing: '-0.04em'
    }
  }, "E")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-mono)',
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "\u2022 \u0415\u041D\u0422 2026 \u2022"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--ff-display)',
      fontWeight: 800,
      fontSize: 15,
      letterSpacing: '-0.03em',
      color: 'var(--text-primary)'
    }
  }, "ENTprep"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: "streak",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "Flame",
      size: 13,
      stroke: "#fff"
    })
  }, user.streak), /*#__PURE__*/React.createElement(Pill, {
    tone: "xp",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "Star",
      size: 13,
      stroke: "var(--ink)"
    })
  }, user.xp.toLocaleString('ru-RU'))));
}
function BottomNav({
  active,
  onNav
}) {
  const items = [{
    id: 'home',
    icon: 'House',
    label: 'Дом'
  }, {
    id: 'subjects',
    icon: 'LayoutGrid',
    label: 'Предметы'
  }, {
    id: 'quiz',
    icon: 'Swords',
    label: 'Квест'
  }, {
    id: 'profile',
    icon: 'User',
    label: 'Профиль'
  }];
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 12px 14px',
      borderTop: '2px solid var(--ink)',
      background: 'var(--surface-card)'
    }
  }, items.map(it => {
    const on = active === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onNav(it.id),
      "aria-label": it.label,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 0,
        cursor: 'pointer',
        padding: '4px 10px',
        minWidth: 56
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 44,
        height: 32,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: on ? 'var(--streak)' : 'transparent',
        border: on ? '2px solid var(--ink)' : '2px solid transparent',
        color: on ? '#fff' : 'var(--text-muted)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: it.icon,
      size: 20,
      width: 2.4
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--ff-mono)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: on ? 'var(--text-primary)' : 'var(--text-faint)'
      }
    }, it.label));
  }));
}
Object.assign(window, {
  Icon,
  AppHeader,
  BottomNav
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/kit.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.AnswerOption = __ds_scope.AnswerOption;

__ds_ns.SubjectTile = __ds_scope.SubjectTile;

})();

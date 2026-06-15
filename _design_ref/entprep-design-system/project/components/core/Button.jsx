import React from 'react';

/**
 * ENTprep Button — the stamped, pressable action button.
 * Three variants: primary (streak orange — the ONE CTA per screen),
 * secondary (white w/ ink border), ink (solid black).
 * On press the hard shadow collapses and the button sinks ~4px.
 */
export function Button({
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
    primary: { bg: 'var(--streak)', fg: '#FFFFFF', rest: 'var(--shadow-cta)' },
    secondary: { bg: 'var(--surface-card)', fg: 'var(--text-primary)', rest: 'var(--shadow-rest)' },
    ink: { bg: 'var(--ink)', fg: '#FFFFFF', rest: 'var(--shadow-rest)' },
  }[variant] || {};

  const sizing = {
    sm: { pad: '8px 14px', minH: 40, fs: 'var(--fs-body-small)' },
    md: { pad: '12px 20px', minH: 48, fs: 'var(--fs-h3)' },
    lg: { pad: '16px 24px', minH: 56, fs: 'var(--fs-h2)' },
  }[size];

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
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
        ...style,
      }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

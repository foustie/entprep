import React from 'react';

/**
 * ENTprep IconButton — a square, stamped, pressable button for a single
 * icon. Always pass an `ariaLabel`. Use `variant="primary"` only when it
 * is THE action on screen.
 */
export function IconButton({ variant = 'secondary', ariaLabel, children, style = {}, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const palette = {
    primary: { bg: 'var(--streak)', fg: '#FFFFFF', rest: 'var(--shadow-cta)' },
    secondary: { bg: 'var(--surface-card)', fg: 'var(--text-primary)', rest: 'var(--shadow-rest)' },
    ink: { bg: 'var(--ink)', fg: '#FFFFFF', rest: 'var(--shadow-rest)' },
  }[variant] || {};

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
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
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

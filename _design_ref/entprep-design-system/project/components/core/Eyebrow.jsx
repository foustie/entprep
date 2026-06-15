import React from 'react';

/**
 * ENTprep Eyebrow — a mono, uppercase, wide-tracked label that sits
 * above a section heading (e.g. "• ЕНТ 2026 •"). Use instead of
 * decorative dots or kicker graphics.
 */
export function Eyebrow({ children, color = 'var(--text-muted)', style = {}, ...rest }) {
  return (
    <div
      style={{
        fontFamily: 'var(--ff-mono)',
        fontSize: 'var(--fs-eyebrow)',
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        lineHeight: 1,
        color,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

import React from 'react';

/**
 * ENTprep Badge — a tiny stamped status/count marker. Smaller than a
 * Pill; for notification counts, "NEW", correct/wrong ticks, etc.
 */
export function Badge({ tone = 'streak', children, style = {}, ...rest }) {
  const tones = {
    streak: { bg: 'var(--streak)', fg: '#FFFFFF' },
    xp: { bg: 'var(--xp)', fg: 'var(--ink)' },
    win: { bg: 'var(--win)', fg: '#FFFFFF' },
    red: { bg: 'var(--red)', fg: '#FFFFFF' },
    premium: { bg: 'var(--premium)', fg: '#FFFFFF' },
    ink: { bg: 'var(--ink)', fg: '#FFFFFF' },
  }[tone] || {};

  return (
    <span
      style={{
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
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

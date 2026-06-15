import React from 'react';

/**
 * ENTprep Pill — a stamped chip for tags, filters, counters and the
 * streak counter. Mono label, ink border, pill radius. Tint via `tone`.
 */
export function Pill({ tone = 'neutral', icon = null, children, style = {}, ...rest }) {
  const tones = {
    neutral: { bg: 'var(--surface-card)', fg: 'var(--text-primary)' },
    xp: { bg: 'var(--xp-soft)', fg: 'var(--ink)' },
    streak: { bg: 'var(--streak)', fg: '#FFFFFF' },
    win: { bg: 'var(--win-soft)', fg: 'var(--ink)' },
    premium: { bg: 'var(--premium-soft)', fg: 'var(--ink)' },
  }[tone] || {};

  return (
    <span
      style={{
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
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

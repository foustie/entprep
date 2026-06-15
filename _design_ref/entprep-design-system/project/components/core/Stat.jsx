import React from 'react';

/**
 * ENTprep Stat — a big mono, tabular-nums number with a small mono
 * label beneath. For streaks, XP, scores, days-left counters.
 */
export function Stat({ value, label, color = 'var(--text-primary)', align = 'left', style = {}, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: align === 'center' ? 'center' : 'flex-start', ...style }} {...rest}>
      <div
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 'var(--fs-stat)',
          fontWeight: 800,
          lineHeight: 1.05,
          fontVariantNumeric: 'tabular-nums',
          color,
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            fontFamily: 'var(--ff-mono)',
            fontSize: 'var(--fs-eyebrow)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

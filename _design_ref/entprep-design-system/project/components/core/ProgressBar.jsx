import React from 'react';

/**
 * ENTprep ProgressBar — ink-bordered pill track with a colored fill.
 * Default fill is win-green (progress = success). Use `tone` to switch.
 */
export function ProgressBar({ value = 0, tone = 'win', showLabel = false, style = {}, ...rest }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    win: 'var(--win)',
    xp: 'var(--xp)',
    streak: 'var(--streak)',
  }[tone] || 'var(--win)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-12)', ...style }} {...rest}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: 1,
          height: 14,
          border: '2px solid var(--ink)',
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: pct + '%',
            height: '100%',
            background: fill,
            borderRadius: 'var(--r-pill)',
            transition: 'width 240ms cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </div>
      {showLabel && (
        <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700, fontSize: 'var(--fs-body-small)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>
          {pct}%
        </span>
      )}
    </div>
  );
}

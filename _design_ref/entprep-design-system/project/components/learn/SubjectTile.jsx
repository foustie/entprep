import React from 'react';

/**
 * ENTprep SubjectTile — a stamped, pressable tile for a subject in the
 * lesson path: icon chip, title, subtitle and an optional progress bar.
 */
export function SubjectTile({
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

  return (
    <button
      type="button"
      disabled={locked}
      style={{
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
        ...style,
      }}
      onPointerDown={() => !locked && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: 48,
          height: 48,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: accent,
          border: '2px solid var(--ink)',
          borderRadius: 'var(--r-12)',
          color: 'var(--ink)',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 'var(--fs-h3)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ display: 'block', fontFamily: 'var(--ff-mono)', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {subtitle}
          </span>
        )}
        {progress != null && (
          <span style={{ display: 'block', marginTop: 8, height: 10, border: '2px solid var(--ink)', borderRadius: 'var(--r-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: Math.max(0, Math.min(100, progress)) + '%', height: '100%', background: 'var(--win)' }} />
          </span>
        )}
      </span>
    </button>
  );
}

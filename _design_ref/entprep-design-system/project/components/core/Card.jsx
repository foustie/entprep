import React from 'react';

/**
 * ENTprep Card — cream-paper surface with a 2px ink border and a hard
 * stamped shadow. `hero` is the one bright (yellow) splash card per
 * screen; pass a `tone` to tint a splash card (xp / streak / win).
 */
export function Card({
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
    premium: 'var(--premium-soft)',
  }[tone];

  const base = {
    background: toneBg || 'var(--surface-card)',
    border: '2px solid var(--border-strong)',
    borderRadius: 'var(--r-16)',
    boxShadow: 'var(--shadow-rest)',
    padding: 'var(--sp-20)',
    // text on a tinted splash card is always ink-dark
    color: tone ? 'var(--ink)' : 'var(--text-primary)',
  };

  const variants = {
    base: {},
    compact: { padding: 'var(--sp-12)', borderRadius: 'var(--r-12)' },
    hero: {
      borderRadius: 'var(--r-18)',
      boxShadow: 'var(--shadow-hero)',
      padding: 'var(--sp-24)',
      background: toneBg || 'var(--xp-softer)',
      color: 'var(--ink)',
    },
  };

  return (
    <Tag style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </Tag>
  );
}

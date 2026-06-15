import React from 'react';

/**
 * Big mono tabular-nums number with a mono label — streaks, XP, scores.
 */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The number (or short string) to feature. */
  value: React.ReactNode;
  /** Small uppercase label below the value. */
  label?: React.ReactNode;
  /** Color of the number. Use var(--streak) for streaks, var(--win) for scores. */
  color?: string;
  align?: 'left' | 'center';
}

export function Stat(props: StatProps): JSX.Element;

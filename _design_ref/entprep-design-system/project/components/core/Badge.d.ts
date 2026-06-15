import React from 'react';

export type BadgeTone = 'streak' | 'xp' | 'win' | 'red' | 'premium' | 'ink';

/**
 * Tiny stamped count/status marker (smaller than a Pill).
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;

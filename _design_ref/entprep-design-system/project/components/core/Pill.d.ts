import React from 'react';

export type PillTone = 'neutral' | 'xp' | 'streak' | 'win' | 'premium';

/**
 * Stamped chip for tags, filters and counters (incl. the streak counter).
 *
 * @startingPoint section="Core" subtitle="Stamped mono chip — neutral / xp / streak / win" viewport="700x120"
 */
export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** Small icon node placed before the label. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Pill(props: PillProps): JSX.Element;

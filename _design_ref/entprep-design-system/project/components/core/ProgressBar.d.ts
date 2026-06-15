import React from 'react';

export type ProgressTone = 'win' | 'xp' | 'streak';

/**
 * Ink-bordered pill progress track. Default fill is win-green.
 *
 * @startingPoint section="Core" subtitle="Stamped progress track — win / xp / streak fill" viewport="700x90"
 */
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number;
  /** Fill color. `win` (default) for progress, `xp` for reward, `streak` for goal. */
  tone?: ProgressTone;
  /** Show a trailing % label (mono, tabular). */
  showLabel?: boolean;
}

export function ProgressBar(props: ProgressBarProps): JSX.Element;

import React from 'react';

/**
 * Mono uppercase label that sits above a section heading. Replaces
 * decorative dots/kickers.
 */
export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Override color (default muted). Use var(--streak) sparingly for emphasis. */
  color?: string;
  children?: React.ReactNode;
}

export function Eyebrow(props: EyebrowProps): JSX.Element;

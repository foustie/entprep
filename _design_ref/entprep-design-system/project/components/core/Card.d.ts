import React from 'react';

export type CardVariant = 'base' | 'compact' | 'hero';
export type CardTone = 'xp' | 'streak' | 'win' | 'premium' | null;

/**
 * Cream-paper surface with ink border + hard stamped shadow.
 *
 * @startingPoint section="Core" subtitle="Stamped card — base / compact / hero / tinted splash" viewport="700x240"
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** `base` (default), `compact` (tighter pad), `hero` (bright splash, 0 5px shadow). */
  variant?: CardVariant;
  /** Tint for a splash card. Text on a tinted card is always ink-dark. One splash per screen. */
  tone?: CardTone;
  /** Element tag to render. Default `div`. */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export function Card(props: CardProps): JSX.Element;

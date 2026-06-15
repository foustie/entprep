import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ink';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * The stamped, pressable ENTprep action button. Use `primary` (streak
 * orange) for the single CTA on a screen; `secondary` or `ink` for the
 * next-most-important action.
 *
 * @startingPoint section="Core" subtitle="Stamped pressable button — streak / secondary / ink" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Only one `primary` per screen. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Icon node placed before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon node placed after the label. */
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;

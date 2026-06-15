import React from 'react';

export type IconButtonVariant = 'primary' | 'secondary' | 'ink';

/**
 * Square 48px stamped icon button. Always provide `ariaLabel`.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  /** Required accessible label (icon-only control). */
  ariaLabel: string;
  /** The icon node. */
  children?: React.ReactNode;
}

export function IconButton(props: IconButtonProps): JSX.Element;

import React from 'react';

export type AnswerState = 'base' | 'selected' | 'correct' | 'wrong';

/**
 * Full-width quiz answer row with a letter marker.
 *
 * @startingPoint section="Learn" subtitle="Quiz answer row — base / selected / correct / wrong" viewport="700x260"
 */
export interface AnswerOptionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading marker, e.g. "А" / "Б" / "В" / "Г". */
  marker?: React.ReactNode;
  /** Visual state. `correct`/`wrong` lock the control. */
  state?: AnswerState;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function AnswerOption(props: AnswerOptionProps): JSX.Element;

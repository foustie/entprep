import React from 'react';

/**
 * Stamped pressable tile for a subject in the lesson path.
 *
 * @startingPoint section="Learn" subtitle="Subject row — icon, title, progress" viewport="700x200"
 */
export interface SubjectTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon node shown in the accent chip. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Secondary mono line (e.g. "320 вопросов"). */
  subtitle?: React.ReactNode;
  /** 0–100 progress; omit to hide the bar. */
  progress?: number | null;
  /** Icon chip background tint. */
  accent?: string;
  locked?: boolean;
}

export function SubjectTile(props: SubjectTileProps): JSX.Element;

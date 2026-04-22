import React from 'react';
import { COLORS } from '../../constants/styles';

type ChipColor = 'teal' | 'accent';

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Legacy prop — both modes now render as v2 ink-bordered pill. */
  mode?: 'gradient' | 'subtle';
  /** Kept for backward compat — now ignored, always streak accent. */
  activeColor?: ChipColor;
  style?: React.CSSProperties;
}

export default function Chip({
  active,
  onClick,
  children,
  style,
}: ChipProps) {
  const base: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: 999,
    fontFamily: "'Nunito',sans-serif",
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'transform 80ms, box-shadow 80ms',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    border: '1.5px solid var(--ink)',
    background: active ? 'var(--ink)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text)',
    boxShadow: active ? `0 2px 0 0 ${COLORS.streak}` : '0 2px 0 0 rgba(15,15,16,0.18)',
  };

  return (
    <button onClick={onClick} style={{ ...base, ...style }}>
      {children}
    </button>
  );
}

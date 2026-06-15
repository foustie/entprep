import React from 'react';
import { CARD_COMPACT, FF } from '../../constants/styles';

interface StatBadgeProps {
  value: React.ReactNode;
  label: string;
  color: string;
  Icon?: React.ComponentType<{ size: number; color: string }>;
  style?: React.CSSProperties;
}

export default function StatBadge({ value, label, color, Icon, style }: StatBadgeProps) {
  return (
    <div style={{ ...CARD_COMPACT, padding: '12px 8px', textAlign: 'center', ...style }}>
      <div
        style={{
          fontFamily: FF.display,
          fontSize: 20, fontWeight: 900,
          color,
          letterSpacing: '-0.03em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
        }}
      >
        {Icon && <Icon size={17} color={color} />}
        {value}
      </div>
      <div style={{
        fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginTop: 5,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</div>
    </div>
  );
}

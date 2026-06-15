import React from 'react';
import { CARD_COMPACT } from '../../constants/styles';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size: number; color: string; style?: React.CSSProperties; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function EmptyState({ icon: Icon, title, description, action, style }: EmptyStateProps) {
  return (
    <div style={{ ...CARD_COMPACT, padding: '32px 20px', textAlign: 'center', ...style }}>
      {Icon && <Icon size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} aria-hidden="true" />}
      {title && <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{title}</h3>}
      {description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{description}</div>}
      {action}
    </div>
  );
}

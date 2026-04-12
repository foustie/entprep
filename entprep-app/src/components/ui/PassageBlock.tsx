import React from 'react';
import { CARD_COMPACT, COLORS } from '../../constants/styles';

interface Props {
  title?: string;
  text?: string;
}

/** Renders passage/context text above a question. Use for any question with pt/px fields. */
export default function PassageBlock({ title, text }: Props) {
  if (!text) return null;
  return (
    <div style={{
      ...CARD_COMPACT,
      background: 'rgba(26,154,140,0.06)',
      border: '1px solid rgba(26,154,140,0.18)',
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.teal, marginBottom: 4 }}>
          📖 {title}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.75 }}>
        {text}
      </div>
    </div>
  );
}

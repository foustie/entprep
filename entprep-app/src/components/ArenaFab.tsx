import React, { useState, useRef, useEffect } from 'react';
import { Swords, X, Users, Zap } from 'lucide-react';
import { COLORS } from '../constants/styles';
import { useNav } from '../contexts/NavigationContext';

interface Props {
  bottom: number;
}

export default function ArenaFab({ bottom }: Props) {
  const [open, setOpen] = useState(false);
  const { nav } = useNav();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { id: 'arena', label: 'Создать арену', icon: <Users size={16} color="#fff" />, color: COLORS.accent, target: 'arena' as const },
    { id: 'duel', label: 'Вызвать на дуэль', icon: <Zap size={16} color="#fff" />, color: COLORS.teal, target: 'duel' as const },
  ];

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: bottom + 8, right: 16, zIndex: 95 }}>
      {/* Menu items */}
      {items.map((item, i) => (
        <button
          key={item.id}
          aria-label={item.label}
          onClick={() => { setOpen(false); nav(item.target); }}
          style={{
            position: 'absolute',
            bottom: open ? (i + 1) * 56 : 0,
            right: 0,
            height: 42,
            borderRadius: 12,
            background: item.color,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 14px',
            boxShadow: `0 3px 12px ${item.color}44`,
            cursor: 'pointer',
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.5)',
            transition: `all 0.25s cubic-bezier(0.34,1.56,0.64,1) ${open ? i * 0.05 : 0}s`,
            pointerEvents: open ? 'auto' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {item.icon}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.label}</span>
        </button>
      ))}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close' : 'Arena & Duel'}
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: open ? 'var(--bg-card)' : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`,
          border: open ? '1px solid var(--border-light)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: open ? 'var(--shadow-md)' : '0 4px 20px rgba(255,107,53,0.35)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          position: 'relative',
        }}
      >
        {open
          ? <X size={20} color="var(--text-muted)" />
          : <Swords size={22} color="#fff" />
        }
      </button>
    </div>
  );
}

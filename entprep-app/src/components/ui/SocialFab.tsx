import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Heart } from 'lucide-react';

interface SocialItem {
  id: string;
  label: string;
  href?: string;
  action?: 'donate';
  color: string;
  shadow: string;
  icon: React.ReactNode;
}

const SOCIALS: SocialItem[] = [
  {
    id: 'donate',
    label: 'Поддержать',
    action: 'donate',
    color: '#F59E0B',
    shadow: 'rgba(245,158,11,0.3)',
    icon: <Heart size={18} color="#fff" fill="#fff" />,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://wa.me/77473564629?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82!%20%D0%A5%D0%BE%D1%87%D1%83%20%D1%83%D0%B7%D0%BD%D0%B0%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%20ENTprep',
    color: '#25D366',
    shadow: 'rgba(37,211,102,0.3)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@diyarbuilds',
    color: '#010101',
    shadow: 'rgba(0,0,0,0.2)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.81V6.69h3.77z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/diyarbuilds',
    color: '#E1306C',
    shadow: 'rgba(225,48,108,0.3)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="#fff" stroke="none" />
      </svg>
    ),
  },
];

interface Props {
  bottom: number;
}

export default function SocialFab({ bottom }: Props) {
  const [open, setOpen] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open && !showDonate) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowDonate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, showDonate]);

  const handleCopy = () => {
    navigator.clipboard.writeText('87473564629').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div ref={ref} style={{ position: 'fixed', bottom, right: 16, zIndex: 90 }}>
      {/* Donate popup */}
      {showDonate && (
        <div style={{
          position: 'absolute', bottom: 60, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 16, padding: '16px 18px', width: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Поддержи ENTprep
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Приложение бесплатное навсегда. Но если хочешь помочь:
          </div>
          <button
            onClick={handleCopy}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              background: copied ? 'rgba(37,211,102,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${copied ? 'rgba(37,211,102,0.25)' : 'rgba(245,158,11,0.25)'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: copied ? '#25D366' : '#F59E0B' }}>
              {copied ? 'Скопировано!' : 'Kaspi: 8 747 356 4629'}
            </span>
          </button>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Нажми чтобы скопировать номер
          </div>
        </div>
      )}

      {/* Expanded social links */}
      {SOCIALS.map((s, i) => (
        s.action === 'donate' ? (
          <button
            key={s.id}
            aria-label={s.label}
            onClick={() => { setOpen(false); setShowDonate(d => !d); }}
            style={{
              position: 'absolute',
              bottom: open ? (i + 1) * 56 : 0,
              right: 0,
              width: 42, height: 42, borderRadius: 12,
              background: s.color, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 3px 12px ${s.shadow}`,
              cursor: 'pointer',
              opacity: open ? 1 : 0,
              transform: open ? 'scale(1)' : 'scale(0.5)',
              transition: `all 0.25s cubic-bezier(0.34,1.56,0.64,1) ${open ? i * 0.05 : 0}s`,
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {s.icon}
          </button>
        ) : (
          <a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener"
            aria-label={s.label}
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              bottom: open ? (i + 1) * 56 : 0,
              right: 0,
              width: 42, height: 42, borderRadius: 12,
              background: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 3px 12px ${s.shadow}`,
              textDecoration: 'none',
              opacity: open ? 1 : 0,
              transform: open ? 'scale(1)' : 'scale(0.5)',
              transition: `all 0.25s cubic-bezier(0.34,1.56,0.64,1) ${open ? i * 0.05 : 0}s`,
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {s.icon}
          </a>
        )
      ))}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close' : 'Social links'}
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: open ? 'var(--bg-card)' : '#25D366',
          border: open ? '1px solid var(--border-light)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? 'var(--shadow-md)' : '0 4px 16px rgba(37,211,102,0.3)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          position: 'relative',
        }}
      >
        {open
          ? <X size={20} color="var(--text-muted)" />
          : <MessageCircle size={22} color="#fff" fill="#fff" />
        }
      </button>
    </div>
  );
}

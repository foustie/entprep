import { COLORS, FF, FS, FW, SP } from '../constants/styles';
import { shareToWhatsApp, copyText } from '../utils/shareHelpers';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';

/**
 * Bottom-sheet modal prompting the student to share prognosis with a parent via WhatsApp.
 * Shows a preview card (prognosis + "мам, PRO 1 990 vs репетитор 30 000").
 */
export default function SendToMomSheet({
  prognosis,
  maxScore,
  grantTarget,
  onClose,
}: {
  prognosis: number;
  maxScore: number;
  grantTarget: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const shareText =
    `Мам, посмотри мой прогноз на ЕНТ: ${prognosis}/${maxScore}.\n` +
    `Моя цель — ${grantTarget}.\n\n` +
    `Я учусь в entprep — AI-репетитор за 1 990₸/мес (живой репетитор стоит 30 000₸).\n` +
    `https://entprep.org`;

  function shareWhatsApp() {
    shareToWhatsApp(shareText);
    onClose();
  }

  async function copyLink() {
    const ok = await copyText('https://entprep.org');
    if (ok) onClose();
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={handle} />

        <div style={headerRow}>
          <h3 style={title}>Отправь маме</h3>
          <button onClick={onClose} style={closeBtn} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <p style={subtitle}>
          Пусть увидит твой прогресс. И решит сама — PRO или репетитор за&nbsp;30К.
        </p>

        {/* Preview card */}
        <div style={previewCard}>
          <div style={previewBrand}>
            entprep<span style={{ color: COLORS.streak }}>.</span>
          </div>
          <div style={previewHeader}>
            <span style={previewAvatar}>Д</span>
            <div style={{ lineHeight: 1.2 }}>
              <div style={previewName}>Твой прогноз</div>
              <div style={previewSub}>ЕНТ 2026</div>
            </div>
          </div>
          <div style={previewScoreRow}>
            <span style={previewScoreBig}>{prognosis}</span>
            <span style={previewScoreMax}>/ {maxScore}</span>
            <span style={previewTrend}>прогноз ↑</span>
          </div>
          <div style={previewProgressTrack}>
            <div style={{ ...previewProgressFill, width: `${Math.min(100, (prognosis / maxScore) * 100)}%` }} />
          </div>
          <div style={previewNote}>
            Мам, AI-репетитор <b>1 990₸/мес</b>{' '}
            <span style={{ textDecoration: 'line-through', color: COLORS.textMuted }}>
              vs 30 000₸
            </span>. В 15 раз дешевле, всегда на связи.
          </div>
        </div>

        {/* CTAs */}
        <button onClick={shareWhatsApp} style={wappBtn}>
          <span>WhatsApp</span>
          <span style={{ fontSize: 18 }}>→</span>
        </button>
        <button onClick={copyLink} style={copyBtn}>
          скопировать ссылку
        </button>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  animation: 'fadeIn 0.2s ease',
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--bg)',
  borderTop: `2px solid ${COLORS.text}`,
  borderLeft: `2px solid ${COLORS.text}`,
  borderRight: `2px solid ${COLORS.text}`,
  borderRadius: '24px 24px 0 0',
  padding: `${SP.md}px ${SP.xl}px ${SP.xxl}px`,
  animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  maxHeight: '92vh',
  overflowY: 'auto',
};

const handle: CSSProperties = {
  width: 48,
  height: 4,
  margin: '0 auto 12px',
  background: COLORS.cardBorder,
  borderRadius: 999,
};

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: SP.sm,
};

const title: CSSProperties = {
  margin: 0,
  fontFamily: FF.display,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '-0.025em',
  color: COLORS.text,
};

const closeBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: 'var(--bg-card)',
  border: `1px solid ${COLORS.cardBorder}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: COLORS.textMuted,
};

const subtitle: CSSProperties = {
  margin: `0 0 ${SP.lg}px`,
  fontFamily: FF.body,
  fontSize: 13.5,
  fontWeight: FW.semibold,
  lineHeight: 1.5,
  color: COLORS.textSecondary,
};

const previewCard: CSSProperties = {
  background: 'var(--bg-card)',
  border: `2px solid ${COLORS.text}`,
  borderRadius: 18,
  padding: SP.lg,
  boxShadow: `0 4px 0 0 ${COLORS.text}`,
  marginBottom: SP.lg,
  position: 'relative',
};

const previewBrand: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 14,
  fontFamily: FF.display,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  color: COLORS.textMuted,
  textTransform: 'uppercase',
};

const previewHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: SP.md,
};

const previewAvatar: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: COLORS.text,
  color: COLORS.xp,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FF.display,
  fontWeight: 900,
  fontSize: 17,
  border: `3px solid ${COLORS.xp}`,
};

const previewName: CSSProperties = {
  fontFamily: FF.body,
  fontSize: 13,
  fontWeight: 800,
  color: COLORS.text,
};

const previewSub: CSSProperties = {
  fontFamily: FF.mono,
  fontSize: 11,
  fontWeight: 600,
  color: COLORS.textMuted,
  marginTop: 2,
};

const previewScoreRow: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  marginBottom: 6,
};

const previewScoreBig: CSSProperties = {
  fontFamily: FF.display,
  fontSize: 40,
  fontWeight: 900,
  lineHeight: 1,
  color: COLORS.text,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.035em',
};

const previewScoreMax: CSSProperties = {
  fontFamily: FF.body,
  fontSize: 13,
  fontWeight: 700,
  color: COLORS.textMuted,
};

const previewTrend: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: FF.body,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: COLORS.win,
  textTransform: 'uppercase',
};

const previewProgressTrack: CSSProperties = {
  height: 6,
  background: 'rgba(0,0,0,0.06)',
  borderRadius: 999,
  overflow: 'hidden',
  marginBottom: SP.md,
};

const previewProgressFill: CSSProperties = {
  height: '100%',
  background: COLORS.win,
  borderRadius: 999,
};

const previewNote: CSSProperties = {
  background: COLORS.streakSoft,
  border: `1px solid rgba(255,90,54,0.3)`,
  borderRadius: 12,
  padding: '10px 12px',
  fontFamily: FF.body,
  fontSize: 12,
  fontWeight: FW.semibold,
  lineHeight: 1.45,
  color: COLORS.text,
};

const wappBtn: CSSProperties = {
  width: '100%',
  height: 52,
  background: '#25D366',
  color: '#fff',
  border: `2px solid ${COLORS.text}`,
  borderRadius: 12,
  boxShadow: `0 4px 0 0 ${COLORS.text}`,
  fontFamily: FF.display,
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginBottom: SP.sm,
};

const copyBtn: CSSProperties = {
  width: '100%',
  height: 44,
  background: 'var(--bg-card)',
  color: COLORS.text,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 12,
  fontFamily: FF.body,
  fontSize: FS.md,
  fontWeight: FW.bold,
  cursor: 'pointer',
};

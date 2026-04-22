import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Zap, ArrowRight, Lock, MessageCircle, Bot, TrendingUp, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useT } from '../../locales/index';
import { COLORS, FF, FW, SP, TINT } from '../../constants/styles';
import { getEntCountdown } from '../../config/ent';
import { trackEvent } from '../../utils/analytics';
import SendToMomSheet from '../SendToMomSheet';

interface PaywallScreenProps {
  trigger: 'explain_limit' | 'tutor_limit' | 'fullent_result';
  score?: number;
  onClose: () => void;
}

const SEASON_URL = 'https://entprep.lemonsqueezy.com/checkout/buy/f2bd4267-eddc-4ba3-9e88-b43eee15dc9a';
const MONTHLY_URL = 'https://entprep.lemonsqueezy.com/checkout/buy/6dac2860-6f5a-4643-8eee-1981e3441d08';

const INK = 'var(--ink)';
const DEFAULT_GRANT = 122;
const MAX_SCORE = 140;

function PrimaryCTA({ href, label, sub, onClose, onTrackClick }: { href: string; label: string; sub?: string; onClose: () => void; onTrackClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const base: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    width: '100%',
    padding: '15px 20px',
    background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
    color: '#fff',
    border: `2px solid ${INK}`,
    borderRadius: 14,
    textDecoration: 'none',
    fontFamily: FF.display,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'transform 90ms cubic-bezier(0.4,0,0.2,1), box-shadow 90ms',
    boxShadow: pressed
      ? `0 1px 0 0 ${INK}, 0 0 20px rgba(255,90,54,0.25)`
      : `0 6px 0 0 ${INK}, 0 0 40px rgba(255,90,54,0.35)`,
    transform: pressed ? 'translateY(5px)' : 'none',
    gap: 3,
    overflow: 'hidden',
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { onTrackClick(); onClose(); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={base}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900 }}>
        {label}
        <ArrowRight size={16} strokeWidth={3} />
      </span>
      {sub && (
        <span style={{
          fontFamily: FF.mono, fontSize: 10, fontWeight: 700, opacity: 0.85,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {sub}
        </span>
      )}
    </a>
  );
}

function useCountUp(target: number, durationMs = 700): number {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, durationMs]);
  return n;
}

export default function PaywallScreen({ trigger, score, onClose }: PaywallScreenProps) {
  const { user } = useAuth();
  const { st } = useApp();
  const t = useT();
  const pw = t.paywall;
  const [showMom, setShowMom] = useState(false);
  const animatedScore = useCountUp(typeof score === 'number' ? score : 0);
  const grantTarget = st.goal?.target ?? DEFAULT_GRANT;
  const countdown = useMemo(() => getEntCountdown(), []);

  useEffect(() => {
    (document.activeElement as HTMLElement)?.blur?.();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Track paywall view exactly once per mount — funnel anchor for sales drought analysis
  const viewTrackedRef = useRef(false);
  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    trackEvent('Paywall View', { trigger, hasScore: typeof score === 'number' });
  }, [trigger, score]);

  const email = user?.email ?? '';
  const qs = email ? `?checkout[email]=${encodeURIComponent(email)}` : '';
  const seasonLink = SEASON_URL + qs;
  const monthlyLink = MONTHLY_URL + qs;

  const features = useMemo((): { label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }>; color: string; bg: string }[] => {
    const base = [
      { label: pw.feat1, Icon: Sparkles, color: COLORS.streak, bg: TINT.streak.bg },
      { label: pw.feat2, Icon: Bot, color: '#7A5AF8', bg: 'rgba(122,90,248,0.14)' },
      { label: pw.feat3, Icon: TrendingUp, color: COLORS.win, bg: TINT.win.bg },
    ];
    if (trigger === 'fullent_result') {
      base.push({ label: pw.feat4, Icon: BookOpen, color: '#0B80B7', bg: 'rgba(11,128,183,0.12)' });
    }
    return base;
  }, [trigger, pw]);

  const freeExit = trigger === 'explain_limit' ? pw.freeExitExplain
    : trigger === 'tutor_limit' ? pw.freeExitTutor : null;

  // Countdown badge only makes sense during the pre-exam wait window.
  // Other phases (reg_open/exam_now/before_reg) would make "До ЕНТ X дней" misleading.
  const showCountdown = countdown?.phase === 'before_exam';
  const days = countdown?.daysLeft ?? 0;
  const canShareToMom = trigger === 'fullent_result' && typeof score === 'number';
  const reachedGrant = trigger === 'fullent_result' && typeof score === 'number' && score >= grantTarget;
  const delta = trigger === 'fullent_result' && typeof score === 'number' ? score - grantTarget : 0;
  const progressPct = trigger === 'fullent_result' && typeof score === 'number'
    ? Math.min(100, Math.round((score / grantTarget) * 100))
    : 0;

  return createPortal(
    <>
      <div
        onClick={() => { trackEvent('Paywall Dismissed', { trigger, via: 'overlay' }); onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(15,15,16,0.72)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 12,
          animation: 'overlayIn 0.2s ease',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 22,
            border: `2px solid ${INK}`,
            boxShadow: `0 8px 0 0 ${INK}`,
            width: '100%', maxWidth: 420, maxHeight: '92vh',
            overflowY: 'auto',
            padding: `${SP.xl}px ${SP.xl}px ${SP.xl}px`,
            position: 'relative',
            animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Close */}
          <button
            onClick={() => { trackEvent('Paywall Dismissed', { trigger, via: 'close_btn' }); onClose(); }}
            aria-label={t.close}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'var(--bg-subtle)',
              border: `1.5px solid ${COLORS.cardBorder}`,
              borderRadius: 10,
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: COLORS.textMuted,
              zIndex: 2,
            }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>

          {/* Countdown eyebrow — only during pre-exam wait */}
          {showCountdown && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: TINT.streak.bg,
              border: `1.5px solid ${TINT.streak.border}`,
              color: COLORS.streak,
              padding: '5px 11px', borderRadius: 999,
              fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: SP.md,
            }}>
              <Zap size={12} strokeWidth={2.8} />
              <span>{pw.countdown.replace('{days}', String(days))}</span>
            </div>
          )}

          {/* HERO — branches by trigger */}
          {trigger === 'fullent_result' ? (
            <div style={{
              position: 'relative',
              background: COLORS.xpSoft,
              border: `2px solid ${INK}`,
              borderRadius: 18,
              boxShadow: `0 4px 0 0 ${INK}`,
              padding: '16px 16px 18px',
              marginBottom: SP.lg,
            }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 9.5, fontWeight: 800,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: INK, opacity: 0.7, marginBottom: 4,
              }}>
                {pw.resultTitle}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontFamily: FF.display,
                  fontSize: 76, fontWeight: 900,
                  letterSpacing: '-0.045em', lineHeight: 0.9,
                  fontVariantNumeric: 'tabular-nums',
                  color: INK,
                }}>
                  {animatedScore}
                </span>
                <span style={{
                  fontFamily: FF.display,
                  fontSize: 22, fontWeight: 800,
                  color: INK, opacity: 0.45,
                  letterSpacing: '-0.02em',
                }}>
                  / {MAX_SCORE}
                </span>
              </div>

              {/* Progress to grant */}
              <div style={{
                position: 'relative', height: 8,
                background: 'rgba(15,15,16,0.08)',
                borderRadius: 999,
                border: `1.5px solid ${INK}`,
                overflow: 'hidden',
                marginBottom: 10,
              }}>
                <div style={{
                  width: `${progressPct}%`, height: '100%',
                  background: reachedGrant ? COLORS.win : COLORS.streak,
                  borderRight: progressPct < 100 ? `1.5px solid ${INK}` : 'none',
                }} />
              </div>

              {/* Delta chip */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: reachedGrant ? COLORS.win : INK,
                color: '#fff',
                padding: '5px 11px', borderRadius: 999,
                fontFamily: FF.display,
                fontSize: 11, fontWeight: 900,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {reachedGrant ? (
                  <>🎯 цель твоя · +{delta}</>
                ) : (
                  <>до цели {grantTarget} · +{Math.abs(delta)}</>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              marginBottom: SP.lg,
              paddingRight: 40,
            }}>
              <div style={{
                flexShrink: 0,
                width: 48, height: 48, borderRadius: 14,
                background: INK,
                color: COLORS.xp,
                border: `2px solid ${INK}`,
                boxShadow: `0 3px 0 0 ${COLORS.streak}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={24} strokeWidth={2.3} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{
                  margin: 0, marginBottom: 4,
                  fontFamily: FF.display,
                  fontSize: 19, fontWeight: 900,
                  letterSpacing: '-0.025em', lineHeight: 1.15,
                  color: COLORS.text,
                }}>
                  {trigger === 'tutor_limit' ? pw.tutorTitle : pw.explainTitle}
                </h2>
                <p style={{
                  margin: 0,
                  fontFamily: FF.body,
                  fontSize: 13, fontWeight: FW.semibold,
                  lineHeight: 1.4, color: COLORS.textSecondary,
                }}>
                  {trigger === 'tutor_limit' ? pw.tutorSubtitle : pw.explainSubtitle}
                </p>
              </div>
            </div>
          )}

          {/* Emotional hook for fullent — dynamic based on score vs grant */}
          {trigger === 'fullent_result' && (
            <p style={{
              margin: 0, marginBottom: SP.lg,
              fontFamily: FF.body,
              fontSize: 13.5, fontWeight: 700,
              lineHeight: 1.45, color: COLORS.text,
            }}>
              {reachedGrant
                ? <>Грант у тебя в кармане. <span style={{ color: COLORS.textSecondary, fontWeight: FW.semibold }}>Держи темп до ЕНТ — AI закроет слабые места.</span></>
                : <>PRO покажет <span style={{ color: COLORS.streak }}>где теряешь баллы</span> и поможет забрать недостающие {Math.abs(delta)}.</>}
            </p>
          )}

          {/* Features — contextual icons per benefit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: SP.lg }}>
            {features.map(({ label, Icon, color, bg }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '8px 10px',
                background: bg,
                border: `1.5px solid ${color}`,
                borderRadius: 12,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: color, color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  border: `1.5px solid ${INK}`,
                }}>
                  <Icon size={14} strokeWidth={2.5} />
                </span>
                <span style={{
                  fontFamily: FF.body,
                  fontSize: 13.5, fontWeight: 800,
                  lineHeight: 1.3,
                  color: COLORS.text,
                }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Price comparison table */}
          <div style={{
            border: `2px solid ${INK}`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: SP.lg,
            boxShadow: `0 3px 0 0 ${INK}`,
          }}>
            <div style={priceRow('var(--bg-subtle)', true)}>
              <span style={priceLabel}>Репетитор</span>
              <span style={priceValStrike}>15 000 ₸<span style={priceUnit}>/мес</span></span>
            </div>
            <div style={priceRow('var(--bg-subtle)', true)}>
              <span style={priceLabel}>iTest</span>
              <span style={priceValStrike}>4 490 ₸<span style={priceUnit}>/3 мес</span></span>
            </div>
            <div style={{ ...priceRow(TINT.streak.bgLight, false), borderTop: `2px solid ${INK}` }}>
              <span style={{ ...priceLabel, color: COLORS.streak, fontWeight: 900 }}>
                <span style={{ display: 'inline-block', transform: 'translateY(-1px)', marginRight: 4 }}>★</span>
                ENTprep PRO
              </span>
              <span style={{
                fontFamily: FF.display,
                fontSize: 15, fontWeight: 900,
                color: COLORS.streak,
                letterSpacing: '-0.015em',
              }}>
                1 990 ₸<span style={{ ...priceUnit, color: COLORS.streak, opacity: 0.8 }}>/мес</span>
              </span>
            </div>
          </div>

          {/* Primary CTA with press depth */}
          <div style={{ marginBottom: SP.sm }}>
            <PrimaryCTA
              href={seasonLink}
              label={pw.ctaSeason.replace(/\d.*/, '').trim() || 'Забрать PRO'}
              sub={pw.ctaSeason.match(/\d.+/)?.[0]}
              onClose={onClose}
              onTrackClick={() => trackEvent('Paywall Checkout Click', { trigger, plan: 'season' })}
            />
          </div>

          {/* Secondary — monthly */}
          <div style={{ textAlign: 'center', marginBottom: SP.md }}>
            <a
              href={monthlyLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { trackEvent('Paywall Checkout Click', { trigger, plan: 'monthly' }); onClose(); }}
              style={{
                fontFamily: FF.body,
                fontSize: 12.5, fontWeight: FW.bold,
                color: COLORS.textSecondary,
                textDecoration: 'underline',
                textDecorationColor: COLORS.cardBorder,
                textUnderlineOffset: 3,
              }}
            >
              или {pw.ctaMonthly}
            </a>
          </div>

          {/* Trust line */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: FF.body,
            fontSize: 11, fontWeight: FW.semibold,
            color: COLORS.textMuted,
            marginBottom: canShareToMom || freeExit ? SP.md : 0,
          }}>
            <Lock size={11} strokeWidth={2.3} />
            <span>Безопасная оплата · Lemon Squeezy</span>
          </div>

          {/* Отправь маме — only for fullent_result */}
          {canShareToMom && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                margin: `${SP.md}px 0`,
              }}>
                <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
                <span style={{
                  fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: COLORS.textMuted,
                }}>
                  или
                </span>
                <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
              </div>

              <button
                onClick={() => { trackEvent('Paywall Send To Mom', { trigger, score: score ?? 0 }); setShowMom(true); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 46,
                  background: 'var(--bg-card)',
                  color: COLORS.text,
                  border: `2px solid ${INK}`,
                  borderRadius: 12,
                  boxShadow: `0 3px 0 0 ${INK}`,
                  fontFamily: FF.display,
                  fontSize: 12.5, fontWeight: 800,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <MessageCircle size={15} strokeWidth={2.3} />
                отправь маме
              </button>
            </>
          )}

          {/* Free exit */}
          {freeExit && (
            <div style={{
              textAlign: 'center',
              marginTop: SP.md,
              fontFamily: FF.body,
              fontSize: 11.5, fontWeight: FW.semibold,
              lineHeight: 1.4,
              color: COLORS.textMuted,
            }}>
              {freeExit}
            </div>
          )}
        </div>
      </div>

      {showMom && canShareToMom && (
        <SendToMomSheet
          prognosis={score!}
          maxScore={MAX_SCORE}
          grantTarget={grantTarget}
          onClose={() => setShowMom(false)}
        />
      )}
    </>,
    document.body,
  );
}

// ── price row helpers ──────────────────────────────────────────────────
function priceRow(bg: string, muted: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 14px',
    background: bg,
    fontFamily: FF.body,
    fontSize: 13, fontWeight: 700,
    color: muted ? COLORS.textMuted : COLORS.text,
  };
}

const priceLabel: CSSProperties = {
  fontFamily: FF.body,
  fontSize: 13, fontWeight: 700,
};

const priceValStrike: CSSProperties = {
  fontFamily: FF.display,
  fontSize: 13, fontWeight: 800,
  textDecoration: 'line-through',
  opacity: 0.7,
  letterSpacing: '-0.01em',
};

const priceUnit: CSSProperties = {
  fontFamily: FF.body,
  fontSize: 10, fontWeight: 700,
  marginLeft: 2,
  opacity: 0.7,
};

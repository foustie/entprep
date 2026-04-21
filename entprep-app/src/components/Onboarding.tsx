import { useState } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import { Sparkles, Bot, Trophy, ArrowRight, ArrowLeft } from 'lucide-react';
import { COLORS, FF, FW, SP } from '../constants/styles';
import { useT } from '../locales';
import { TOTAL_Q } from '../config/questionPools';

const INK = '#0F0F10';

interface SlideSpec {
  Icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  // hero accent: drives splash bg + icon chip color
  tone: 'xp' | 'streak' | 'win';
  // eyebrow label (mono caps)
  eyebrow: string;
}

const SLIDES: SlideSpec[] = [
  { Icon: Sparkles, tone: 'xp',     eyebrow: 'банк вопросов' },
  { Icon: Bot,      tone: 'streak', eyebrow: 'ии-репетитор' },
  { Icon: Trophy,   tone: 'win',    eyebrow: 'симулятор ент' },
];

const TONE: Record<SlideSpec['tone'], { splash: string; chip: string; textOnSplash: string }> = {
  xp:     { splash: COLORS.xpSoft,    chip: COLORS.xp,     textOnSplash: INK },
  streak: { splash: COLORS.streakSoft, chip: COLORS.streak, textOnSplash: INK },
  win:    { splash: COLORS.winSoft,    chip: COLORS.win,    textOnSplash: INK },
};

interface OnboardingProps {
  onFinish: () => void;
}

export default function Onboarding({ onFinish }: OnboardingProps) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const cfg = SLIDES[idx];
  const tone = TONE[cfg.tone];
  const isLast = idx === SLIDES.length - 1;

  const qCount = `${Math.floor(TOTAL_Q / 1000)} 000+`;
  const titles = [
    t.onboarding.slide1Title.replace(/[\d\s]+000\+/, qCount),
    t.onboarding.slide2Title,
    t.onboarding.slide3Title,
  ];
  const descs = [
    t.onboarding.slide1Desc,
    t.onboarding.slide2Desc,
    t.onboarding.slide3Desc,
  ];

  return (
    <div style={{
      padding: '32px 20px 24px',
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      {/* Top: brand + skip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28,
      }}>
        <div style={{
          fontFamily: FF.display,
          fontSize: 16, fontWeight: 900,
          letterSpacing: '-0.03em',
        }}>
          <span style={{ color: COLORS.text }}>ENT</span>
          <span style={{ color: COLORS.streak }}>prep.</span>
        </div>
        <button
          onClick={onFinish}
          style={{
            background: 'none', border: 'none',
            fontFamily: FF.body, fontSize: 13, fontWeight: FW.bold,
            color: COLORS.textMuted, cursor: 'pointer',
            padding: 4,
          }}
        >
          {t.skip} →
        </button>
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 24,
      }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            flex: i === idx ? 3 : 1,
            height: 6,
            background: i === idx ? COLORS.text : COLORS.cardBorder,
            borderRadius: 3,
            transition: 'flex 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        ))}
      </div>

      {/* Hero slide — splash card */}
      <div
        key={idx}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: tone.splash,
          border: `2px solid ${INK}`,
          borderRadius: 24,
          boxShadow: `0 6px 0 0 ${INK}`,
          padding: '32px 24px',
          marginBottom: 24,
          animation: 'slideHero 0.42s cubic-bezier(0.16,1,0.3,1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative dotted grid — subtle */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(${INK} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          opacity: 0.05,
          pointerEvents: 'none',
        }} />

        {/* Eyebrow */}
        <div style={{
          fontFamily: FF.mono,
          fontSize: 10, fontWeight: 800,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: tone.textOnSplash, opacity: 0.6,
          marginBottom: 20,
          position: 'relative',
        }}>
          {cfg.eyebrow} · {idx + 1}/{SLIDES.length}
        </div>

        {/* Icon chip */}
        <div style={{
          width: 68, height: 68, borderRadius: 18,
          background: tone.chip,
          border: `2.5px solid ${INK}`,
          boxShadow: `0 4px 0 0 ${INK}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 28,
          color: '#fff',
          position: 'relative',
        }}>
          <cfg.Icon size={34} strokeWidth={2.2} />
        </div>

        {/* Title */}
        <h1 style={{
          margin: 0, marginBottom: 12,
          fontFamily: FF.display,
          fontSize: idx === 0 ? 40 : 30,
          fontWeight: 900,
          letterSpacing: '-0.035em', lineHeight: 1.05,
          color: tone.textOnSplash,
          position: 'relative',
          textWrap: 'balance' as 'balance',
        }}>
          {titles[idx]}
        </h1>

        {/* Description */}
        <p style={{
          margin: 0,
          fontFamily: FF.body,
          fontSize: 14.5, fontWeight: FW.semibold,
          lineHeight: 1.5,
          color: tone.textOnSplash, opacity: 0.75,
          position: 'relative',
          textWrap: 'balance' as 'balance',
        }}>
          {descs[idx]}
        </p>
      </div>

      {/* Bottom nav row */}
      <div style={{ display: 'flex', gap: 10 }}>
        {idx > 0 && (
          <BackBtn onClick={() => setIdx(idx - 1)} label={t.back} />
        )}
        <NextBtn
          label={isLast ? t.onboarding.start : t.next}
          onClick={() => isLast ? onFinish() : setIdx(idx + 1)}
        />
      </div>

      <style>{`
        @keyframes slideHero {
          0% { opacity: 0; transform: translateY(12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function NextBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const style: CSSProperties = {
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '16px 24px',
    background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
    color: '#fff',
    border: `2px solid ${INK}`,
    borderRadius: 14,
    fontFamily: FF.display,
    fontSize: 14, fontWeight: 900,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'transform 90ms cubic-bezier(0.4,0,0.2,1), box-shadow 90ms',
    boxShadow: pressed
      ? `0 1px 0 0 ${INK}, 0 0 16px rgba(255,90,54,0.2)`
      : `0 6px 0 0 ${INK}, 0 0 32px rgba(255,90,54,0.3)`,
    transform: pressed ? 'translateY(5px)' : 'none',
  };
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      {label}
      <ArrowRight size={18} strokeWidth={3} />
    </button>
  );
}

function BackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 56, height: 56,
    background: 'var(--bg-card)',
    color: COLORS.text,
    border: `2px solid ${INK}`,
    borderRadius: 14,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 90ms, box-shadow 90ms',
    boxShadow: pressed ? `0 1px 0 0 ${INK}` : `0 6px 0 0 ${INK}`,
    transform: pressed ? 'translateY(5px)' : 'none',
  };
  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      <ArrowLeft size={20} strokeWidth={2.5} />
    </button>
  );
}

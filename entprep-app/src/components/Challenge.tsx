import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { SUBJECT_META } from '../config/subjects';
import { COLORS, FF, R } from '../constants/styles';
import { useNav } from '../contexts/NavigationContext';
import BackButton from './ui/BackButton';
import { Swords, Play } from 'lucide-react';
import SubjectIcon from './ui/SubjectIcon';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useT } from '../locales';

interface ChallengeProps {
  data: {
    subjectId: string;
    score: number;
    topicId?: string | null;
  } | null;
}

export default function Challenge({ data }: ChallengeProps) {
  const bp = useBreakpoint(); const isDesktop = bp === 'desktop';
  const { nav } = useNav();
  const t = useT();
  if (!data) return null;

  const { subjectId, score, topicId } = data;
  const sub = SUBS[subjectId] || ALL_PROFILES.find(p => p.id === subjectId);
  const subName = (t.subjects as Record<string, string>)[subjectId] || sub?.name || subjectId;
  const subColor = SUBJECT_META[subjectId]?.color || sub?.color || COLORS.streak;

  const accept = () => {
    sessionStorage.setItem('entprep_challenge', JSON.stringify({ subjectId, score, topicId }));
    window.history.replaceState({}, '', window.location.pathname);
    nav('test', subjectId, topicId);
  };

  const decline = () => {
    window.history.replaceState({}, '', window.location.pathname);
    nav('home');
  };

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <BackButton onClick={decline} label={t.challenge.goHome} style={{ marginBottom: 14 }} />
      <div style={{
        position: 'relative',
        background: COLORS.streakSoft,
        border: '2px solid var(--ink)',
        borderRadius: 20,
        padding: '32px 22px 24px',
        boxShadow: '0 6px 0 0 var(--ink)',
        textAlign: 'center',
        overflow: 'hidden',
        animation: 'heroEnter 0.55s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)',
          backgroundSize: '22px 22px', opacity: 0.05, pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--ink)', border: '2px solid var(--ink)',
            boxShadow: '0 4px 0 0 ' + COLORS.streak,
            color: '#fff', marginBottom: 16,
          }}>
            <Swords size={32} strokeWidth={2.4} />
          </div>
          <div style={{
            fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: COLORS.streak, marginBottom: 6,
          }}>{t.challenge.duelEyebrow}</div>
          <h2 style={{
            fontFamily: FF.display, fontSize: 24, fontWeight: 900,
            color: 'var(--ink)', letterSpacing: '-0.035em', margin: '0 0 8px', lineHeight: 1.05,
          }}>{t.challenge.challenged}</h2>
          <div style={{
            fontFamily: FF.body, fontSize: 13, fontWeight: 700,
            color: 'var(--ink)', opacity: 0.7, lineHeight: 1.5, marginBottom: 22,
          }}>
            {t.challenge.friendScored}{' '}
            <span style={{
              fontFamily: FF.display, fontWeight: 900,
              color: COLORS.streak, fontSize: 18, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}>{score}%</span>{' '}{t.challenge.inSubject}
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', marginBottom: 22,
            background: 'var(--bg-card)',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            boxShadow: '0 2px 0 0 var(--ink)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: R.sm,
              background: `${subColor}18`, border: `1.5px solid ${subColor}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <SubjectIcon sid={subjectId} size={16} color={subColor} strokeWidth={2.2} />
            </div>
            <span style={{
              fontFamily: FF.body, fontSize: 14, fontWeight: 800,
              color: 'var(--text)',
            }}>{subName}</span>
          </div>

          <div style={{
            fontFamily: FF.display, fontSize: 16, fontWeight: 900,
            color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 18,
          }}>{t.challenge.canYouBeat}</div>

          <button onClick={accept} style={{
            width: '100%', padding: '14px',
            background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
            color: '#fff',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            boxShadow: '0 4px 0 0 var(--ink)',
            fontFamily: FF.display, fontSize: 14, fontWeight: 900,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 10,
          }}>
            <Play size={16} strokeWidth={3} fill="#fff" />{t.challenge.accept}
          </button>
          <button onClick={decline} style={{
            width: '100%', padding: '11px',
            background: 'transparent',
            color: 'var(--ink)', opacity: 0.65,
            border: 'none',
            fontFamily: FF.body, fontSize: 12, fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}>
            {t.challenge.notNow}
          </button>
        </div>
      </div>
    </div>
  );
}

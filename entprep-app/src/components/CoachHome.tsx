import React, { useState, useEffect, useRef } from "react";
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { calcStreak } from '../utils/adaptiveHelpers';
import { getEntCountdown } from '../config/ent';
import { PILL, PROGRESS_BAR, PROGRESS_FILL, COLORS, SP, FF, FS, R } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../locales';
import { getRecommendation, getAndySpeech } from '../utils/recommendationEngine';
import { SUBJECT_META } from '../config/subjects';
import { getPersonalBests, getGoalProgress } from '../utils/competitionHelpers';
import { prefetchCounts, getPoolSize } from '../utils/questionStore';
import { pluralizeForms } from '../utils/formatters';
import HomeSubjectGrid from './HomeSubjectGrid';
import SendToMomSheet from './SendToMomSheet';
import SubjectIcon from './ui/SubjectIcon';
import { ArrowRight, GraduationCap, Trophy, ChevronDown, ChevronUp, X, KeyRound, Target, Flame, Zap, MessageSquare, BookOpen, Sparkles } from 'lucide-react';
import type { SubjectConfig } from '../types';
import type { EntCountdown } from '../config/ent';

// ── Animation (plays once per session) ──────────────────────────────────
let hasAnimatedThisSession = false;
const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Stagger({ index, children }: { index: number; children: React.ReactNode }) {
  if (hasAnimatedThisSession || reducedMotion) return <>{children}</>;
  return (
    <div style={{
      opacity: 0,
      animation: `fadeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${index * 80}ms forwards`,
    }}>
      {children}
    </div>
  );
}

// ── 3D button press handler ─────────────────────────────────────────────
function press3D(darkColor: string) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderBottomWidth = '1px';
      el.style.transform = 'translateY(3px)';
    },
    onPointerUp: (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderBottomWidth = '4px';
      el.style.transform = 'translateY(0)';
    },
    onPointerLeave: (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderBottomWidth = '4px';
      el.style.transform = 'translateY(0)';
    },
  };
}

export default function CoachHome() {
  const { nav } = useNav();
  const { hist, prof, st } = useApp();
  const { user, isPremium } = useAuth();
  const bp = useBreakpoint();
  const t = useT();
  const today = React.useMemo(() => new Date().toLocaleDateString('ru-RU'), []);
  const todayTestCount = React.useMemo(() => hist.filter(h => h.dt === today && h.type !== 'fullent').length, [hist, today]);

  const [countdown, setCountdown] = useState<EntCountdown | null>(getEntCountdown);
  useEffect(() => {
    const tick = () => setCountdown(getEntCountdown());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const streak = React.useMemo(() => calcStreak(hist, isPremium, st.streakFreezeUsedAt), [hist, isPremium, st.streakFreezeUsedAt]);
  const profileSubjects = React.useMemo(() => [...['math', 'reading', 'history'], ...prof], [prof]);
  const rec = React.useMemo(() => getRecommendation(hist, profileSubjects), [hist, profileSubjects]);
  const countdownDays = countdown?.daysLeft;
  const subjectMeta = rec.subject ? SUBJECT_META[rec.subject] : null;
  const dailyGoal = st.dailyGoal || 3;
  const goalComplete = todayTestCount >= dailyGoal;

  // Prognosis tracker — always-visible score projection for ЕНТ
  const goalProg = React.useMemo(() => getGoalProgress(hist, st.goal), [hist, st.goal]);
  const prognosis = goalProg ? Math.round(goalProg.approxScore) : null;
  const grantTarget = st.goal?.target ?? 122;
  const [showMomSheet, setShowMomSheet] = useState(false);

  // Subjects expand (power users)
  const [showSubjects, setShowSubjects] = useState(false);
  const [poolSizes, setPoolSizes] = useState<Record<string, number>>({});
  useEffect(() => {
    prefetchCounts().then((updated) => {
      if (updated) {
        const allSids = [...Object.keys(SUBS), ...ALL_PROFILES.map(p => p.id)];
        const sizes: Record<string, number> = {};
        for (const sid of [...new Set(allSids)]) sizes[sid] = getPoolSize(sid);
        setPoolSizes(sizes);
      }
    });
  }, []);
  const profSubs = prof.map(id => ALL_PROFILES.find(p => p.id === id)).filter(Boolean) as SubjectConfig[];
  const mandatorySubs = Object.values(SUBS);
  const bests = getPersonalBests(hist);

  const hour = new Date().getHours();
  const [authNudgeDismissed, setAuthNudgeDismissed] = useState(
    () => !!localStorage.getItem('entprep_auth_nudge_dismissed'),
  );
  const showAuthNudge = !user && !authNudgeDismissed;
  const [diyarPromoDismissed, setDiyarPromoDismissed] = useState(
    () => !!localStorage.getItem('entprep_diyar_promo_dismissed'),
  );

  // Mark animation played
  const didMarkRef = useRef(false);
  useEffect(() => {
    if (!didMarkRef.current) { didMarkRef.current = true; hasAnimatedThisSession = true; }
  }, []);

  // Handle recommendation action
  const handleRecAction = () => {
    switch (rec.type) {
      case 'weak_subject':
      case 'weak_topic':
      case 'not_practiced':
      case 'not_practiced_new':
        nav('test', rec.subject || profileSubjects[0], rec.topic);
        break;
      case 'error_review': nav('errors'); break;
      case 'full_ent': nav('fullent'); break;
      default: nav('test', profileSubjects[0] || 'math');
    }
  };

  // Quick action pills — core only (AI moved to focal card, Calc moved to Profile tab per kill-list)
  const pills = [
    { label: t.home.fullEnt, icon: GraduationCap, color: COLORS.win, screen: 'fullent' },
    { label: t.home.leaderboard, icon: Trophy, color: COLORS.xp, screen: 'leaderboard' },
    { label: t.rush.title, icon: Zap, color: COLORS.streak, screen: 'rush' },
  ];

  // AI Tutor message — dynamic based on weakest area
  const aiSubjectName = rec.subject
    ? (t.subjects as Record<string, string>)[rec.subject] || rec.subject
    : t.home.entShort;
  const aiMessage = rec.type === 'weak_subject' || rec.type === 'weak_topic'
    ? t.home.aiTutorWeak.replace('{subject}', aiSubjectName)
    : rec.type === 'error_review'
    ? t.home.aiTutorErrors
    : t.home.aiTutorDefault;

  return (
    <div style={{ padding: `0 var(--content-padding) ${bp === 'desktop' ? 40 : 80}px`, overscrollBehavior: 'none' }}>

      {/* ═══ Дияр cross-promo (Aluna referral) ═══ */}
      {!diyarPromoDismissed && (
        <div style={{
          position: 'relative', width: '100%',
          marginTop: 6, marginBottom: 14,
          padding: '14px 16px',
          background: 'var(--bg-card)',
          border: '2px solid var(--ink)',
          borderRadius: 16,
          boxShadow: '0 4px 0 0 var(--ink)',
        }}>
          <button
            onClick={() => { localStorage.setItem('entprep_diyar_promo_dismissed', '1'); setDiyarPromoDismissed(true); }}
            aria-label={t.close}
            style={{
              position: 'absolute', top: 4, right: 4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, padding: 11,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-subtle)',
            }}>
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
          <div style={{ display: 'flex', gap: 10, paddingRight: 22 }}>
            <Sparkles size={18} color={COLORS.streak} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FF.body, fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: 'var(--text-body)' }}>
                {t.home.diyarPromoText}
              </div>
              <a
                href="https://aluna.beauty/?ref=entprep"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: 10, padding: '8px 18px',
                  background: 'var(--ink)', color: '#fff', borderRadius: R.md,
                  textDecoration: 'none', fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
                }}
              >
                {t.home.diyarPromoCta}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Auth nudge — v2 ink chip ═══ */}
      {showAuthNudge && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 10px 8px 12px',
          marginTop: 6, marginBottom: 14,
          background: 'var(--bg-card)',
          border: `1.5px solid ${COLORS.text}`,
          borderRadius: R.pill,
        }}>
          <KeyRound size={13} color={COLORS.text} strokeWidth={2.5} />
          <button
            onClick={() => nav('settings')}
            style={{
              flex: 1, textAlign: 'left',
              background: 'none', border: 'none',
              fontFamily: FF.body, fontSize: FS.base, fontWeight: 800,
              color: COLORS.text, cursor: 'pointer', padding: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {t.home.loginToSave}
          </button>
          <button
            onClick={() => {
              localStorage.setItem('entprep_auth_nudge_dismissed', '1');
              setAuthNudgeDismissed(true);
            }}
            aria-label={t.close}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              // ~44px hit area without enlarging the visible 22px chip: pad + negative margin
              width: 44, height: 44, padding: 11, margin: -11,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: COLORS.textMuted,
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--bg-subtle)',
            }}>
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}

      {/* ═══ UNIFIED HERO — prognosis + mission (one focal) ═══ */}
      <Stagger index={1}>
        <HomeHero
          t={t}
          prognosis={prognosis}
          grantTarget={grantTarget}
          rec={rec}
          streak={streak.current}
          todayTestCount={todayTestCount}
          dailyGoal={dailyGoal}
          countdownDays={countdownDays}
          onStart={handleRecAction}
          subName={(id: string) => (t.subjects as Record<string, string>)[id] || id}
        />
      </Stagger>

      {/* ═══ SECONDARY: share with mom — outside hero, subtle ═══ */}
      {prognosis != null && prognosis > 0 && (
        <Stagger index={2}>
          <button
            onClick={() => setShowMomSheet(true)}
            style={{
              width: '100%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 14px',
              marginBottom: 18,
              background: 'transparent',
              border: `1.5px dashed ${COLORS.cardBorder}`,
              borderRadius: 12,
              color: COLORS.textSecondary,
              fontFamily: FF.body,
              fontSize: FS.base, fontWeight: 800,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.streak; e.currentTarget.style.color = COLORS.streak; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.color = COLORS.textSecondary; }}
          >
            <MessageSquare size={13} strokeWidth={2.3} />
            <span>{t.home.sendPrognosisToMom}</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </Stagger>
      )}

      {showMomSheet && prognosis != null && (
        <SendToMomSheet
          prognosis={prognosis}
          maxScore={140}
          grantTarget={grantTarget}
          onClose={() => setShowMomSheet(false)}
        />
      )}

      {/* ═══ AI TUTOR FOCAL CARD — primary entry to pivot product (v2) ═══ */}
      <Stagger index={3}>
        <button
          onClick={() => nav('tutor')}
          {...press3D(COLORS.text)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 12,
            // Theme-invariant ink banner: bg is var(--ink), NEVER COLORS.text
            // (in dark theme text is cream → white copy on it disappears)
            background: 'var(--ink)',
            color: '#fff',
            border: '2px solid var(--border-strong)',
            borderRadius: 16,
            padding: '14px 14px',
            marginBottom: SP.lg,
            boxShadow: '0 4px 0 0 var(--ink)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'transform 80ms ease, box-shadow 80ms ease',
          }}
        >
          {/* Avatar chip */}
          <div style={{
            flexShrink: 0,
            position: 'relative',
            width: 44, height: 44, borderRadius: 12,
            background: COLORS.streak,
            border: `2px solid ${COLORS.xp}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FF.brand,
            fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em',
            color: '#fff',
          }}>
            Д
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: COLORS.win,
              border: '2px solid var(--ink)',
            }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FF.mono,
              fontSize: FS.xs, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: COLORS.xp, marginBottom: 2,
            }}>
              {t.home.aiTutorEyebrow}
            </div>
            <div style={{
              fontFamily: FF.body,
              fontSize: FS.lg, fontWeight: 700,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.88)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {aiMessage}
            </div>
          </div>

          {/* CTA arrow — subtle, avatar already anchors the card */}
          <span style={{
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            color: 'rgba(255,255,255,0.6)',
          }}>
            <ArrowRight size={20} strokeWidth={2.4} />
          </span>
        </button>
      </Stagger>

      {/* ═══ Quick Action Pills — 2-col tile grid ═══ */}
      <Stagger index={4}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          marginBottom: SP.lg,
        }}>
          {pills.map(({ label, icon: Icon, color, screen }, i) => (
            <button
              key={screen}
              onClick={() => nav(screen)}
              {...press3D(INK)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                // odd count → last tile spans the full row
                ...(pills.length % 2 === 1 && i === pills.length - 1 ? { gridColumn: '1 / -1' } : {}),
                padding: '11px 12px',
                background: 'var(--bg-card)',
                border: `2px solid ${INK}`,
                borderBottom: `4px solid ${INK}`,
                borderRadius: R.lg,
                fontFamily: FF.display,
                fontSize: 12, fontWeight: 900,
                letterSpacing: '-0.015em',
                color: COLORS.text,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'transform 80ms, border-bottom 80ms',
              }}
            >
              <span style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: R.md,
                background: `${color}1F`,
                border: `1.5px solid ${color}`,
                color,
              }}>
                <Icon size={16} strokeWidth={2.5} />
              </span>
              <span style={{ flex: 1, lineHeight: 1.15 }}>{label}</span>
            </button>
          ))}
        </div>
      </Stagger>

      {/* ═══ "Все предметы" section — v2 header + expand body ═══ */}
      <Stagger index={5}>
        <button
          onClick={() => setShowSubjects(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            width: '100%', padding: '10px 14px',
            background: showSubjects ? 'var(--bg-card)' : 'var(--bg-subtle)',
            border: `1.5px solid ${showSubjects ? INK : COLORS.cardBorder}`,
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'all 0.18s',
            marginBottom: showSubjects ? SP.md : 0,
          }}
        >
          <span style={{
            fontFamily: FF.mono, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: showSubjects ? COLORS.text : COLORS.textSecondary,
          }}>
            {t.home.allSubjects}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 8,
            background: showSubjects ? COLORS.streak : 'var(--bg-card)',
            color: showSubjects ? '#fff' : COLORS.textSecondary,
            border: `1.5px solid ${showSubjects ? INK : COLORS.cardBorder}`,
            transition: 'all 0.18s',
          }}>
            {showSubjects ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
          </span>
        </button>

        {showSubjects && (
          <div style={{ animation: 'fadeIn 0.25s ease', marginTop: SP.sm }}>
            <HomeSubjectGrid
              mandatory={mandatorySubs}
              profile={profSubs}
              hist={hist}
              poolSizes={poolSizes}
              bests={bests}
            />
          </div>
        )}
      </Stagger>
    </div>
  );
}

// ── Unified Home Hero ────────────────────────────────────────────────────
type RecType = ReturnType<typeof getRecommendation>;

const INK = 'var(--ink)';

function useCountUp(target: number, durationMs = 850): number {
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

function HomeHero({
  t, prognosis, grantTarget, rec, streak, todayTestCount, dailyGoal, countdownDays,
  onStart, subName,
}: {
  t: ReturnType<typeof useT>;
  prognosis: number | null;
  grantTarget: number;
  rec: RecType;
  streak: number;
  todayTestCount: number;
  dailyGoal: number;
  countdownDays?: number;
  onStart: () => void;
  subName: (id: string) => string;
}) {
  const [actPressed, setActPressed] = useState(false);
  const animScore = useCountUp(prognosis ?? 0);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setBarWidth(prognosis != null ? Math.min(100, (prognosis / 140) * 100) : 0);
    });
    return () => cancelAnimationFrame(id);
  }, [prognosis]);
  const hasPrognosis = prognosis != null && prognosis > 0;
  const reached = hasPrognosis && prognosis >= grantTarget;
  const delta = hasPrognosis ? prognosis - grantTarget : 0;

  const subjectId = rec.subject || 'math';
  const subjectColor = SUBJECT_META[subjectId]?.color || COLORS.streak;
  const subjectName = subName(subjectId);

  const missionTitle =
    rec.type === 'full_ent' ? t.home.missionTrialEnt
    : rec.type === 'error_review' ? t.home.missionErrorReview
    : subjectName;
  const missionReason =
    rec.type === 'weak_subject' ? t.home.reasonWeakSpot
    : rec.type === 'weak_topic' ? (rec.topic ? t.home.reasonTopic.replace('{topic}', rec.topic) : t.home.reasonPullTopic)
    : rec.type === 'error_review' ? t.home.reasonNewErrors
    : rec.type === 'not_practiced' ? t.home.reasonLongAway
    : rec.type === 'full_ent' ? t.home.reasonFullEnt
    : t.home.reasonTimeToStart;

  return (
    <div style={{
      position: 'relative',
      background: COLORS.xpSoft,
      border: `2px solid ${INK}`,
      borderRadius: 22,
      padding: hasPrognosis ? '16px 16px 14px' : '20px 16px 18px',
      marginBottom: 18,
      minHeight: hasPrognosis ? undefined : 280,
      display: 'flex', flexDirection: 'column',
      boxShadow: `0 6px 0 0 ${INK}`,
      overflow: 'hidden',
      animation: hasAnimatedThisSession ? undefined : 'heroEnter 0.55s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {/* Decorative dotted grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(${INK} 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
        opacity: 0.045,
        pointerEvents: 'none',
      }} />

      {/* Top strip: stat chips with unit labels */}
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 14,
      }}>
        <StatChip icon={Flame} value={streak} unit={pluralizeForms(streak, t.home.dayForms)} color={COLORS.streak} highlight={streak > 0} />
        <StatChip icon={Target} value={`${todayTestCount}/${dailyGoal}`} unit={t.home.goalLabel} color={INK} highlight={todayTestCount >= dailyGoal && dailyGoal > 0} highlightColor={COLORS.win} />
        {countdownDays != null && countdownDays > 0 && (
          <StatChip icon={Zap} value={countdownDays} unit={t.home.beforeEntLabel} color={INK} />
        )}
      </div>

      {/* Headline when no prognosis — fills hero height */}
      {!hasPrognosis && (
        <div style={{ position: 'relative', flex: 1, marginBottom: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontFamily: FF.mono, fontSize: FS.xs, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: INK, opacity: 0.55, marginBottom: 8,
          }}>
            {t.home.heroEyebrowStart}
          </div>
          <div style={{
            fontFamily: FF.display,
            fontSize: 32, fontWeight: 900,
            letterSpacing: '-0.035em', lineHeight: 1.02,
            color: INK,
          }}>
            {t.home.heroHeadlineLine1}<br />{t.home.heroHeadlineLine2}
          </div>
        </div>
      )}

      {/* Score block */}
      {hasPrognosis && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            fontFamily: FF.mono, fontSize: FS.xs, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: INK, opacity: 0.55, marginBottom: 2,
          }}>
            {t.home.prognosisEyebrow}
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{
              fontFamily: FF.display,
              fontSize: 72, fontWeight: 900,
              letterSpacing: '-0.045em', lineHeight: 0.9,
              fontVariantNumeric: 'tabular-nums',
              color: INK,
            }}>
              {animScore}
              <span style={{
                fontFamily: FF.display,
                fontSize: 22, fontWeight: 700,
                color: INK, opacity: 0.5, letterSpacing: '-0.02em',
                marginLeft: 2,
              }}>
                /140
              </span>
            </span>
          </div>

          {/* Progress bar + delta chip beside */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 10,
          }}>
            <div style={{
              flex: 1, minWidth: 0,
              height: 10, borderRadius: R.pill,
              background: 'rgba(15,15,16,0.28)',
              border: `1.5px solid ${INK}`,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${barWidth}%`,
                background: reached ? COLORS.win : COLORS.streak,
                borderRight: barWidth < 100 ? `1.5px solid ${INK}` : 'none',
                transition: 'width 1.2s cubic-bezier(0.25,1,0.3,1)',
              }} />
            </div>
            <div style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: R.pill,
              background: reached ? COLORS.win : INK,
              color: '#fff',
              fontFamily: FF.display, fontSize: 10, fontWeight: 900,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {reached ? (
                <><span style={{ fontVariantNumeric: 'tabular-nums' }}>+{delta}</span><span>✓</span></>
              ) : (
                <><span>{t.home.deltaMore}</span><span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{Math.abs(delta)}</span></>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Mission action — inverse-styled card inside yellow splash */}
      <button
        onClick={onStart}
        onMouseDown={() => setActPressed(true)}
        onMouseUp={() => setActPressed(false)}
        onMouseLeave={() => setActPressed(false)}
        onTouchStart={() => setActPressed(true)}
        onTouchEnd={() => setActPressed(false)}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          background: '#FFFDF5',
          border: `2px solid ${INK}`,
          borderRadius: R.lg,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'transform 80ms, box-shadow 80ms',
          boxShadow: actPressed ? `0 1px 0 0 ${INK}` : `0 4px 0 0 ${INK}`,
          transform: actPressed ? 'translateY(3px)' : 'none',
          marginBottom: 0,
        }}
      >
        <div style={{
          flexShrink: 0,
          width: 44, height: 44, borderRadius: 12,
          background: `${subjectColor}18`,
          border: `1.5px solid ${subjectColor}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: subjectColor,
        }}>
          {rec.type === 'full_ent'
            ? <GraduationCap size={22} strokeWidth={2.3} />
            : rec.type === 'error_review'
              ? <BookOpen size={22} strokeWidth={2.3} />
              : <SubjectIcon sid={subjectId} size={24} color={subjectColor} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Fixed light surface (#FFFDF5) → text must be theme-invariant ink, not var(--text*) */}
          <div style={{
            fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--ink-soft)', marginBottom: 1,
          }}>
            {t.home.nextStep}
          </div>
          <div style={{
            fontFamily: FF.display, fontSize: FS.xl, fontWeight: 900,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {missionTitle}
          </div>
          <div style={{
            fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
            color: 'var(--ink-soft)', marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {missionReason}
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          background: COLORS.streak, color: '#fff',
          border: `2px solid ${INK}`,
        }}>
          <ArrowRight size={18} strokeWidth={3} />
        </span>
      </button>

    </div>
  );
}

// ── Small stat chip used in hero top strip ─────────────────────────────
function StatChip({
  icon: Icon, value, unit, color, highlight, highlightColor,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string; fill?: string }>;
  value: number | string;
  unit: string;
  color: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  const tint = highlight ? (highlightColor || color) : INK;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 10px 5px 9px', borderRadius: R.pill,
      background: highlight ? '#fff' : 'rgba(255,255,255,0.6)',
      border: `1.5px solid ${INK}`,
    }}>
      <Icon size={13} strokeWidth={2.8} color={tint} fill={highlight && color === COLORS.streak ? color : undefined} />
      <span style={{
        fontFamily: FF.display, fontSize: 13, fontWeight: 900,
        letterSpacing: '-0.02em',
        color: INK, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: FF.mono, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: INK, opacity: 0.5,
      }}>
        {unit}
      </span>
    </div>
  );
}


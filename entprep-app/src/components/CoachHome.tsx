import React, { useState, useEffect, useRef } from "react";
import { ALL_PROFILES, SUBS } from '../config/questionPools';
import { calcStreak } from '../utils/adaptiveHelpers';
import { getEntCountdown } from '../config/ent';
import { CARD_3D_LG, PILL, PROGRESS_BAR, PROGRESS_FILL, COLORS, TINT, SP, FF, BUTTON } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../locales';
import { getRecommendation, getContextualCTA, getAndySpeech } from '../utils/recommendationEngine';
import { SUBJECT_META } from '../config/subjects';
import { getPersonalBests } from '../utils/competitionHelpers';
import { prefetchCounts, getPoolSize } from '../utils/questionStore';
import SubjectIcon from './ui/SubjectIcon';
import Mascot, { getAndyEmotion } from './ui/Mascot';
import HomeSubjectGrid from './HomeSubjectGrid';
import { ArrowRight, GraduationCap, Swords, Users, Calculator, Trophy, ChevronDown, ChevronUp, X, KeyRound } from 'lucide-react';
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
  const today = new Date().toLocaleDateString('ru-RU');
  const todayTestCount = hist.filter(h => h.dt === today && h.type !== 'fullent').length;

  const [countdown, setCountdown] = useState<EntCountdown | null>(getEntCountdown);
  useEffect(() => {
    const tick = () => setCountdown(getEntCountdown());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const streak = calcStreak(hist, isPremium, st.streakFreezeUsedAt);
  const profileSubjects = [...['math', 'reading', 'history'], ...prof];
  const rec = getRecommendation(hist, profileSubjects);
  const countdownDays = countdown?.daysLeft;
  const subjectMeta = rec.subject ? SUBJECT_META[rec.subject] : null;
  const dailyGoal = st.dailyGoal || 3;
  const goalComplete = todayTestCount >= dailyGoal;

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

  // Care banners
  const hour = new Date().getHours();
  // Evening/night banners removed — Andy handles this via getAndySpeech() + emotion changes
  const [authNudgeDismissed, setAuthNudgeDismissed] = useState(
    () => !!localStorage.getItem('entprep_auth_nudge_dismissed'),
  );
  const showAuthNudge = !user && !authNudgeDismissed;

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
        nav('test', rec.subject || profileSubjects[0], rec.topic);
        break;
      case 'error_review': nav('errors'); break;
      case 'full_ent': nav('fullent'); break;
      default: nav('test', profileSubjects[0] || 'math');
    }
  };

  // Quick action pills
  const pills = [
    { label: 'Полный ЕНТ', icon: GraduationCap, color: COLORS.teal, screen: 'fullent' },
    { label: 'Дуэль', icon: Swords, color: COLORS.purple, screen: 'duel' },
    { label: 'Рейтинг', icon: Trophy, color: COLORS.amber, screen: 'leaderboard' },
    { label: 'Друзья', icon: Users, color: COLORS.teal, screen: 'friends' },
    { label: 'Калькулятор', icon: Calculator, color: COLORS.accent, screen: 'calc' },
  ];

  return (
    <div style={{ padding: `0 var(--content-padding) ${bp === 'desktop' ? 40 : 100}px` }}>

      {/* ═══ Auth nudge — minimal thin bar, no card ═══ */}
      {showAuthNudge && (
        <button onClick={() => nav('settings')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '8px 12px', marginTop: 4, marginBottom: 4,
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <KeyRound size={12} color={COLORS.teal} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.teal, fontFamily: FF.body }}>
            Войди чтобы сохранить прогресс
          </span>
          <div onClick={e => {
            e.stopPropagation();
            localStorage.setItem('entprep_auth_nudge_dismissed', '1');
            setAuthNudgeDismissed(true);
          }} role="button" aria-label={t.close} style={{
            marginLeft: 4, padding: 4, cursor: 'pointer',
          }}>
            <X size={10} color="var(--text-muted)" />
          </div>
        </button>
      )}

      {/* ═══ ANDY — character left, speech bubble right, CTA below bubble ═══ */}
      <Stagger index={1}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
          paddingTop: SP.md,
          marginBottom: SP.lg,
        }}>
          {/* Andy — left, BIG */}
          <div style={{ flexShrink: 0, marginRight: -8, zIndex: 1 }}>
            <Mascot
              emotion={getAndyEmotion({ recType: rec.type, score: rec.score, streak: streak.current })}
              size={bp === 'mobile' ? 220 : 260}
              style={{
                display: 'block',
                animation: reducedMotion ? 'none' : 'andyBob 3s ease-in-out infinite',
              }}
            />
          </div>

          {/* Right side: bubble + button stacked */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: SP.lg }}>
            {/* Speech bubble — just text */}
            <div style={{
              position: 'relative',
              background: 'var(--bg-card)',
              borderRadius: '20px 20px 20px 4px',
              border: '2px solid var(--border-md)',
              padding: `${SP.md}px ${SP.lg}px`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              marginBottom: SP.md,
            }}>
              <p style={{
                fontSize: bp === 'mobile' ? 15 : 18,
                fontWeight: 700,
                fontFamily: FF.body,
                color: 'var(--text)',
                lineHeight: 1.4,
                margin: 0,
              }}>
                {getAndySpeech(rec, streak.current, hour)}
              </p>
            </div>

            {/* CTA — compact orange pill */}
            <button
              onClick={handleRecAction}
              {...press3D(COLORS.accentDark)}
              style={{
                background: COLORS.accent,
                border: '2px solid transparent',
                borderBottom: `4px solid ${COLORS.accentDark}`,
                color: '#fff',
                padding: '10px 24px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FF.body,
                borderRadius: 100,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'transform 80ms, border-bottom 80ms',
              }}
            >
              Давай <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </Stagger>

      {/* ═══ STATS — minimal, warm ═══ */}
      <Stagger index={2}>
        {/* Progress bar first — thin, clean */}
        <div style={{ ...PROGRESS_BAR, height: 6, marginBottom: SP.lg }}>
          <div style={{
            ...PROGRESS_FILL, height: '100%',
            background: goalComplete ? '#58CC02' : COLORS.accent,
            width: todayTestCount === 0 ? '2%' : `${Math.min(100, (todayTestCount / dailyGoal) * 100)}%`,
          }} />
        </div>

        {/* Stats — just numbers, quiet */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: SP.xxl,
          marginBottom: SP.xl,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.body, color: streak.current > 0 ? COLORS.amber : 'var(--text-dim)' }}>
              {streak.current}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: FF.body, marginTop: 2 }}>серия</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.body, color: goalComplete ? '#58CC02' : 'var(--text-secondary)' }}>
              {todayTestCount}<span style={{ fontWeight: 500, color: 'var(--text-dim)' }}>/{dailyGoal}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: FF.body, marginTop: 2 }}>цель</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.body, color: countdownDays != null && countdownDays > 0 ? COLORS.accent : 'var(--text-dim)' }}>
              {countdownDays != null && countdownDays > 0 ? countdownDays : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: FF.body, marginTop: 2 }}>до ЕНТ</div>
          </div>
        </div>
      </Stagger>

      {/* ═══ Quick Action Pills ═══ */}
      <Stagger index={4}>
        <div style={{
          display: 'flex', gap: SP.sm,
          overflowX: 'auto', overflowY: 'hidden',
          paddingBottom: SP.sm,
          marginBottom: SP.lg,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {pills.map(({ label, icon: Icon, color, screen }) => (
            <button
              key={screen}
              onClick={() => nav(screen)}
              {...press3D('var(--border-strong)')}
              style={{
                ...PILL,
                color,
                background: `${color}10`,
                borderColor: `${color}25`,
                borderBottomColor: `${color}35`,
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </Stagger>

      {/* ═══ "Все предметы" expandable (power users) ═══ */}
      <Stagger index={5}>
        <button
          onClick={() => setShowSubjects(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '12px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: FF.body,
            color: 'var(--text-muted)',
            marginBottom: showSubjects ? SP.md : 0,
          }}
        >
          Все предметы
          {showSubjects ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSubjects && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
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

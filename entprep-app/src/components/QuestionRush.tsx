import { useState, useEffect, useRef, useCallback } from 'react';
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { TOPIC_MAP, getTopicQuestions } from '../config/topics';
import { getPool } from '../utils/questionStore';
import { shuffleArray, shuffleOptions } from '../utils/questionHelpers';
import { getQType, getSingleCorrect } from '../types';
import type { Question, TestResult, QuestionDetail } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../locales';
import { CARD, CARD_COMPACT, COLORS, TYPE, FF, BUTTON, ANSWER, PROGRESS_BAR } from '../constants/styles';
import { pluralizeForms } from '../utils/formatters';
import BackButton from './ui/BackButton';
import SubjectIcon from './ui/SubjectIcon';
import { Zap, Star, Check, X, ChevronDown, ChevronRight, Crown, Clock } from 'lucide-react';

interface RushProps {
  /** Persists a finished run to history/leaderboard WITHOUT navigating away */
  save: (result: TestResult) => void;
}

type Phase = 'subject' | 'loading' | 'wizard' | 'playing' | 'result';
type Difficulty = 'easy' | 'medium' | 'hard';
type DiffKey = Difficulty | 'challenge';
type Pace = 'relaxed' | 'steady' | 'standard' | 'blitz';

// Subjects available for Rush (reading is passage-based — excluded from speed mode)
const RUSH_SUBJECTS = [SUBS.math, SUBS.history, ...ALL_PROFILES];

const BASE_SEC = 25; // baseline seconds per question
const PACE_MULT: Record<Pace, number> = { relaxed: 1.5, steady: 1.25, standard: 1, blitz: 0.8 };
const COUNT_OPTS = [10, 20, 30] as const;

const INK = 'var(--ink)';

function press3D(darkColor: string) {
  return {
    onMouseDown: (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = 'translateY(2px)';
      el.style.borderBottomWidth = '2px';
      void darkColor;
    },
    onMouseUp: (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = '';
      el.style.borderBottomWidth = '';
    },
    onMouseLeave: (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = '';
      el.style.borderBottomWidth = '';
    },
  };
}

export default function QuestionRush({ save }: RushProps) {
  const { st, hist } = useApp();
  const { isPremium } = useAuth();
  const { goHome, openPaywall } = useNav();
  const toast = useToast();
  const t = useT();
  const lang = st.lang || 'ru';

  const [phase, setPhase] = useState<Phase>('subject');
  const [subject, setSubject] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // pool + derived topic counts
  const poolRef = useRef<Question[]>([]);
  const [topicCounts, setTopicCounts] = useState<{ id: string; name: string; icon?: string; skills: number; q: number; subs: string[] }[]>([]);

  // wizard config
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Set<DiffKey>>(new Set<DiffKey>(['easy', 'medium', 'hard']));
  const [count, setCount] = useState<number>(20);
  const [skipDone, setSkipDone] = useState(true);
  const [pace, setPace] = useState<Pace>('standard');
  const [showPro, setShowPro] = useState(false);

  // game state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BASE_SEC);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastStars, setLastStars] = useState(0);
  const [stars, setStars] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const qdRef = useRef<QuestionDetail[]>([]);
  const startTimeRef = useRef(0);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  const savedRef = useRef(false);
  const hasDbTopicsRef = useRef(false); // true when pool questions carry _topic (Supabase); else fall back to TOPIC_MAP ranges

  const timePerQ = Math.round(BASE_SEC * PACE_MULT[pace]);
  const subName = (sid: string) => (t.subjects as Record<string, string>)[sid] || RUSH_SUBJECTS.find(s => s.id === sid)?.name || sid;

  // ── Subject selection → load pool, compute topic counts ──────────────────
  const selectSubject = async (sid: string) => {
    setSubject(sid);
    setPhase('loading');
    try {
      const pool = await getPool(sid, lang);
      poolRef.current = pool;
      const singles = pool.filter(q => getQType(q) === 'single');
      const sections = TOPIC_MAP[sid];
      // Supabase questions carry _topic; static-fallback questions don't — then use TOPIC_MAP ranges
      const hasDbTopics = singles.some(q => q._topic);
      hasDbTopicsRef.current = hasDbTopics;
      let counts: typeof topicCounts;
      if (sections && sections.length > 0) {
        counts = sections.map(sec => ({
          id: sec.id,
          name: lang === 'kk' ? (sec.name_kk || sec.name) : sec.name,
          icon: sec.icon,
          skills: sec.subtopics?.length || 0,
          q: hasDbTopics
            ? singles.filter(q => q._topic === sec.id).length
            : getTopicQuestions(pool, sec.ranges).filter(q => getQType(q) === 'single').length,
          subs: (sec.subtopics || []).map(s => (lang === 'kk' ? (s.name_kk || s.name) : s.name)),
        })).filter(c => c.q > 0);
      } else {
        counts = [];
      }
      if (counts.length === 0) {
        // No topic metadata — single synthetic "all" bucket
        counts = [{ id: '__all__', name: t.rush.allQuestions, skills: 0, q: singles.length, subs: [] }];
      }
      setTopicCounts(counts);
      setTopics(new Set(counts.map(c => c.id)));
      setStep(1);
      setPhase('wizard');
    } catch {
      toast.error(t.errors.rushMessage);
      setPhase('subject');
    }
  };

  // ── Build the question set and start ─────────────────────────────────────
  const startGame = () => {
    const answered = new Set<number>();
    if (skipDone) {
      hist.filter(r => r.su === subject).forEach(r => r.qd?.forEach(d => answered.add(d.oi)));
    }
    const allTopics = topics.has('__all__');
    let src: Question[];
    if (allTopics) {
      src = poolRef.current.filter(q => getQType(q) === 'single');
    } else if (hasDbTopicsRef.current) {
      src = poolRef.current.filter(q => getQType(q) === 'single' && q._topic && topics.has(q._topic));
    } else {
      // Static fallback: collect selected sections via TOPIC_MAP ranges (deduped)
      const sections = TOPIC_MAP[subject!] || [];
      const seen = new Set<number>();
      src = [];
      for (const sec of sections) {
        if (!topics.has(sec.id)) continue;
        for (const q of getTopicQuestions(poolRef.current, sec.ranges)) {
          if (getQType(q) === 'single' && q._oi != null && !seen.has(q._oi)) { seen.add(q._oi); src.push(q); }
        }
      }
    }
    src = src.filter(q => {
      const d = (q.difficulty || 'medium') as Difficulty;
      if (diffs.has(d)) return true;
      if (diffs.has('challenge') && d === 'hard') return true;
      return false;
    });
    if (skipDone) src = src.filter(q => q._oi == null || !answered.has(q._oi));

    const picked = shuffleArray(src).slice(0, count).map(shuffleOptions);
    if (picked.length === 0) {
      toast.warning(t.rush.noQuestions);
      return;
    }

    qdRef.current = [];
    savedRef.current = false;
    startTimeRef.current = Date.now();
    setQuestions(picked);
    setIndex(0);
    setStars(0);
    setCorrect(0);
    setSelected(null);
    setRevealed(false);
    setLastStars(0);
    setPhase('playing');
  };

  // ── Answer handling (kept in a ref so the timer can call the latest) ──────
  const handleAnswer = useCallback((idx: number | null) => {
    if (lockedRef.current) return;
    const q = questions[index];
    if (!q) return;
    lockedRef.current = true;
    const ok = idx !== null && getSingleCorrect(q) === idx;
    let s = 0;
    if (ok) {
      const frac = timeLeft / timePerQ;
      s = frac >= 0.66 ? 3 : frac >= 0.33 ? 2 : 1;
    }
    qdRef.current.push({ oi: q._oi!, ok, tp: q._topic, stp: q._subtopic });
    setLastStars(s);
    setStars(v => v + s);
    if (ok) setCorrect(v => v + 1);
    setSelected(idx);
    setRevealed(true);

    const isLast = index >= questions.length - 1;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => {
      if (isLast) setPhase('result');
      else setIndex(i => i + 1);
    }, 850);
  }, [questions, index, timeLeft, timePerQ]);

  const answerRef = useRef(handleAnswer);
  answerRef.current = handleAnswer;

  // Per-question countdown (pauses while the answer is revealed)
  useEffect(() => {
    if (phase !== 'playing') return;
    lockedRef.current = false;
    setSelected(null);
    setRevealed(false);
    setTimeLeft(timePerQ);
    const iv = setInterval(() => { if (!lockedRef.current) setTimeLeft(t => Math.max(0, t - 1)); }, 1000);
    return () => clearInterval(iv);
  }, [index, phase, timePerQ]);

  // Timeout → auto-submit blank
  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0 && !lockedRef.current) answerRef.current(null);
  }, [timeLeft, phase]);

  // Cleanup pending advance on unmount
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  // Persist the run once when results show: cumulative stars + history/leaderboard.
  // Saving here (not on the "Done" button) means "New round" can't lose a finished run.
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const el = Math.round((Date.now() - startTimeRef.current) / 1000);
    setElapsed(el);
    try {
      const prev = parseInt(localStorage.getItem('entprep_rush_stars') || '0', 10) || 0;
      const next = prev + stars;
      localStorage.setItem('entprep_rush_stars', String(next));
      setTotalStars(next);
    } catch { setTotalStars(stars); }
    const total = questions.length;
    save({
      su: subject!, co: correct, to: total,
      sc: total ? Math.round((correct / total) * 100) : 0,
      dt: new Date().toLocaleDateString('ru-RU'), tm: el,
      qd: qdRef.current, type: 'rush',
    });
  }, [phase, stars, correct, questions.length, subject, save]);

  const toggleDiff = (d: DiffKey) => {
    if (d === 'challenge' && !isPremium && !diffs.has('challenge')) { setShowPro(true); return; }
    setDiffs(prev => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  };

  const toggleTopic = (id: string) => {
    setTopics(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // ════════════════════════════ RENDER ════════════════════════════════════

  const header = (label: string, onBack: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 16px' }}>
      <BackButton onClick={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 800, fontFamily: FF.display, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        <Zap size={18} color={COLORS.streak} fill={COLORS.streak} /> {label}
      </div>
    </div>
  );

  const checkbox = (on: boolean) => (
    <span style={{
      width: 24, height: 24, borderRadius: 7, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? COLORS.streak : 'transparent',
      border: on ? `2px solid ${INK}` : `2px solid var(--border-strong)`,
    }}>
      {on && <Check size={15} color="#fff" strokeWidth={3} />}
    </span>
  );

  // ── Subject picker ───────────────────────────────────────────────────────
  if (phase === 'subject') {
    return (
      <div style={{ padding: '0 var(--content-padding) 100px' }}>
        {header(t.rush.title, goHome)}
        <div style={{ ...TYPE.bodySmall, marginBottom: 16 }}>{t.rush.pickSubjectDesc}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {RUSH_SUBJECTS.map(s => (
            <button key={s.id} onClick={() => selectSubject(s.id)} {...press3D(INK)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px',
              background: 'var(--bg-card)',
              border: `2px solid ${INK}`, borderBottom: `4px solid ${INK}`, borderRadius: 14,
              cursor: 'pointer', textAlign: 'left',
              transition: 'transform 80ms, border-bottom 80ms',
            }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${s.color}1F`, border: `1.5px solid ${s.color}` }}>
                <SubjectIcon sid={s.id} size={17} color={s.color} strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, fontFamily: FF.body, color: 'var(--text)', lineHeight: 1.2 }}>{subName(s.id)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <Zap size={36} color={COLORS.streak} style={{ animation: 'pulse 1.2s infinite' }} />
        <div style={{ ...TYPE.bodySmall, fontSize: 14, marginTop: 14 }}>{t.rush.preparing}</div>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  if (phase === 'wizard') {
    const back = () => { if (step > 1) setStep(step - 1); else setPhase('subject'); };
    const next = () => { if (step < 4) setStep(step + 1); else startGame(); };
    const nextDisabled = (step === 1 && topics.size === 0) || (step === 2 && diffs.size === 0);

    return (
      <div style={{ padding: '0 var(--content-padding) 120px' }}>
        {header(t.rush.title, goHome)}
        <div style={{ ...TYPE.eyebrow, marginBottom: 6 }}>{t.rush.step} {step} {t.rush.of} 4 · {subName(subject!)}</div>

        {/* progress segments */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, border: `1.5px solid ${INK}`, background: i <= step ? COLORS.streak : 'var(--bg-subtle-2)' }} />
          ))}
        </div>

        {step === 1 && (<>
          <h2 style={{ ...TYPE.h2, fontSize: 22, margin: '0 0 8px' }}>{t.rush.stepTopics}</h2>
          <p style={{ ...TYPE.bodySmall, fontSize: 13, marginBottom: 16 }}>{t.rush.topicsDesc}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: FF.body, color: 'var(--text)' }}>{t.rush.allTopics}</span>
            <button onClick={() => setTopics(topics.size === topicCounts.length ? new Set() : new Set(topicCounts.map(c => c.id)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: FF.body, color: COLORS.streak }}>
              {topics.size === topicCounts.length ? t.rush.deselectAll : t.rush.selectAll}
            </button>
          </div>
          {topicCounts.map(c => {
            const on = topics.has(c.id);
            return (
              <div key={c.id} style={{ ...CARD_COMPACT, padding: 0, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px' }}>
                  <button onClick={() => toggleTopic(c.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0 }}>
                    {checkbox(on)}
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, fontFamily: FF.body, color: 'var(--text)' }}>{c.name}</span>
                      <span style={{ fontSize: 11, fontFamily: FF.body, color: 'var(--text-muted)' }}>{c.skills > 0 ? `${c.skills} ${pluralizeForms(c.skills, t.rush.skills)} · ` : ''}{c.q} {pluralizeForms(c.q, t.rush.questionsWord)}</span>
                    </span>
                  </button>
                  {c.subs.length > 0 && (
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} aria-label="expand" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <ChevronDown size={18} color="var(--text-muted)" style={{ transform: expanded === c.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  )}
                </div>
                {expanded === c.id && c.subs.length > 0 && (
                  <div style={{ padding: '0 14px 12px 50px' }}>
                    {c.subs.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: FF.body, color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--text-muted)' }} />{s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {step === 2 && (<>
          <h2 style={{ ...TYPE.h2, fontSize: 22, margin: '0 0 8px' }}>{t.rush.stepDifficulty}</h2>
          <p style={{ ...TYPE.bodySmall, fontSize: 13, marginBottom: 16 }}>{t.rush.difficultyDesc}</p>
          {([
            { k: 'easy' as DiffKey, label: t.rush.easy, desc: t.rush.easyDesc, pro: false },
            { k: 'medium' as DiffKey, label: t.rush.medium, desc: t.rush.mediumDesc, pro: false },
            { k: 'hard' as DiffKey, label: t.rush.hard, desc: t.rush.hardDesc, pro: false },
            { k: 'challenge' as DiffKey, label: t.rush.challenge, desc: t.rush.challengeDesc, pro: true },
          ]).map(d => {
            const on = diffs.has(d.k);
            return (
              <button key={d.k} onClick={() => toggleDiff(d.k)} style={{
                ...CARD_COMPACT, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '15px 14px', marginBottom: 10,
                cursor: 'pointer', textAlign: 'left',
                background: on ? 'var(--bg-card)' : 'var(--bg-card-dim)',
                opacity: on ? 1 : 0.75,
              }}>
                {checkbox(on)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FF.body, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {d.label}
                    {d.pro && <span style={{ fontSize: 9, fontWeight: 800, fontFamily: FF.mono, color: INK, background: COLORS.xp, border: `1.5px solid ${INK}`, padding: '2px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: '0.06em' }}><Crown size={10} />{t.rush.pro}</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: FF.body, color: 'var(--text-secondary)' }}>{d.desc}</div>
                </div>
              </button>
            );
          })}
        </>)}

        {step === 3 && (<>
          <h2 style={{ ...TYPE.h2, fontSize: 22, margin: '0 0 8px' }}>{t.rush.stepCount}</h2>
          <p style={{ ...TYPE.bodySmall, fontSize: 13, marginBottom: 16 }}>{t.rush.countDesc}</p>
          {COUNT_OPTS.map(n => {
            const on = count === n;
            const sub = n === 10 ? t.rush.quickSession : n === 20 ? t.rush.balanced : t.rush.focusedSprint;
            return (
              <button key={n} onClick={() => setCount(n)} style={{
                ...CARD_COMPACT, display: 'block', width: '100%', padding: '15px 16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left',
                background: on ? 'rgba(255,90,54,0.1)' : 'var(--bg-card)',
                boxShadow: on ? `0 2px 0 0 ${COLORS.streak}` : (CARD_COMPACT.boxShadow as string),
                border: on ? `2px solid ${COLORS.streak}` : (CARD_COMPACT.border as string),
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FF.display, letterSpacing: '-0.02em', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {n} {pluralizeForms(n, t.rush.questionsWord)}
                  {n === 20 && <span style={{ fontSize: 9, fontWeight: 800, fontFamily: FF.mono, color: INK, background: COLORS.winSoft, border: `1.5px solid ${INK}`, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.rush.recommended}</span>}
                </div>
                <div style={{ fontSize: 12, fontFamily: FF.body, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
              </button>
            );
          })}
          <button onClick={() => setSkipDone(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 2px', marginTop: 4 }}>
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, fontFamily: FF.body, color: 'var(--text)' }}>{t.rush.skipCompleted}</span>
              <span style={{ fontSize: 11, fontFamily: FF.body, color: 'var(--text-muted)' }}>{t.rush.skipCompletedDesc}</span>
            </span>
            <span style={{ width: 44, height: 26, borderRadius: 13, border: `2px solid ${INK}`, background: skipDone ? COLORS.win : 'var(--toggle-off)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: skipDone ? 19 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', border: `1.5px solid ${INK}`, transition: 'left 0.2s' }} />
            </span>
          </button>
        </>)}

        {step === 4 && (<>
          <h2 style={{ ...TYPE.h2, fontSize: 22, margin: '0 0 8px' }}>{t.rush.stepPace}</h2>
          <p style={{ ...TYPE.bodySmall, fontSize: 13, marginBottom: 16 }}>{t.rush.paceDesc}</p>
          {([
            { k: 'relaxed' as Pace, label: t.rush.relaxed, mult: '1.5×' },
            { k: 'steady' as Pace, label: t.rush.steady, mult: '1.25×' },
            { k: 'standard' as Pace, label: t.rush.standard, mult: t.rush.baselineTimes },
            { k: 'blitz' as Pace, label: t.rush.blitz, mult: '0.8×' },
          ]).map(p => {
            const on = pace === p.k;
            return (
              <button key={p.k} onClick={() => setPace(p.k)} style={{
                ...CARD_COMPACT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '15px 16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left',
                background: on ? 'rgba(255,90,54,0.1)' : 'var(--bg-card)',
                boxShadow: on ? `0 2px 0 0 ${COLORS.streak}` : (CARD_COMPACT.boxShadow as string),
                border: on ? `2px solid ${COLORS.streak}` : (CARD_COMPACT.border as string),
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FF.display, letterSpacing: '-0.02em', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.label}
                    {p.k === 'standard' && <span style={{ fontSize: 9, fontWeight: 800, fontFamily: FF.mono, color: INK, background: COLORS.winSoft, border: `1.5px solid ${INK}`, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.rush.recommended}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: FF.body, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {p.k === 'standard' ? t.rush.baselineTimes : `${p.mult} ${t.rush.timePerQ}`}
                  </div>
                </div>
                <Clock size={20} color={on ? COLORS.streak : 'var(--text-muted)'} />
              </button>
            );
          })}
        </>)}

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={back} {...press3D(INK)} style={{ ...BUTTON.secondary, flex: '0 0 auto' }}>{t.back}</button>
          <button onClick={next} disabled={nextDisabled} {...press3D(INK)}
            style={{ ...BUTTON.primary, flex: 1, justifyContent: 'center', opacity: nextDisabled ? 0.5 : 1 }}>
            {step < 4 ? t.rush.continue : t.rush.startRush} <ChevronRight size={18} />
          </button>
        </div>

        {showPro && (
          <div onClick={() => setShowPro(false)} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...CARD, background: 'var(--bg-modal)', borderRadius: 18, boxShadow: `0 5px 0 0 ${INK}`, padding: '28px 22px', maxWidth: 320, textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setShowPro(false)} aria-label={t.close} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, border: `2px solid ${INK}`, background: 'var(--bg-subtle)', cursor: 'pointer', color: 'var(--text)' }}><X size={16} /></button>
              <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: COLORS.xpSoft, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Crown size={28} color={INK} /></div>
              <h3 style={{ ...TYPE.h3, fontSize: 18, margin: '0 0 8px' }}>{t.rush.proTitle}</h3>
              <p style={{ ...TYPE.bodySmall, fontSize: 13, marginBottom: 18 }}>{t.rush.proDesc}</p>
              <button onClick={() => { setShowPro(false); openPaywall('upgrade'); }} {...press3D(INK)} style={{ ...BUTTON.primary, width: '100%', justifyContent: 'center' }}>{t.rush.upgrade}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const q = questions[index];
    if (!q) return null;
    const correctIdx = getSingleCorrect(q);
    const timeFrac = timeLeft / timePerQ;
    return (
      <div style={{ padding: '0 var(--content-padding) 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 12px' }}>
          <button onClick={goHome} aria-label={t.close} style={{ width: 34, height: 34, borderRadius: 17, border: `2px solid ${INK}`, background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
          <span style={{ ...TYPE.eyebrow, fontSize: 12 }}>{index + 1} / {questions.length}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800, fontFamily: FF.display, color: 'var(--text)' }}>
            <Star size={16} fill={COLORS.xp} color={INK} strokeWidth={1.5} /> {stars}
          </span>
        </div>
        {/* time bar */}
        <div style={{ ...PROGRESS_BAR, height: 12, border: `2px solid ${INK}`, marginBottom: 16 }}>
          <div style={{ height: '100%', borderRadius: 100, width: `${timeFrac * 100}%`, background: timeFrac > 0.33 ? COLORS.win : COLORS.red, transition: 'width 1s linear, background 0.3s' }} />
        </div>

        <div style={{ ...CARD, padding: '22px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FF.body, color: 'var(--text)', lineHeight: 1.55 }}>{q.q}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {q.o.map((opt, idx) => {
            const isCorrect = revealed && idx === correctIdx;
            const isWrong = revealed && idx === selected && idx !== correctIdx;
            // Explicit border shorthands — mixing ANSWER.correct's borderColor over
            // ANSWER.base's border shorthand triggers React style-conflict warnings
            const border = isCorrect ? '2px solid #58CC02' : isWrong ? '2px solid #FF4B4B' : (ANSWER.base.border as string);
            const borderBottom = isCorrect ? '4px solid #46A302' : isWrong ? '4px solid #E91B1B' : (ANSWER.base.borderBottom as string);
            const background = isCorrect ? 'rgba(88,204,2,0.08)' : isWrong ? 'rgba(255,75,75,0.06)' : (ANSWER.base.background as string);
            const tc = isCorrect ? COLORS.win : isWrong ? COLORS.red : 'var(--text)';
            return (
              <button key={idx} onClick={() => handleAnswer(idx)} disabled={revealed} style={{
                ...ANSWER.base, border, borderBottom, background,
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                cursor: revealed ? 'default' : 'pointer',
              }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, border: `2px solid ${tc === 'var(--text)' ? 'var(--border-strong)' : tc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: FF.mono, color: tc, flexShrink: 0 }}>
                  {revealed && idx === correctIdx ? <Check size={14} /> : revealed && idx === selected ? <X size={14} /> : String.fromCharCode(65 + idx)}
                </span>
                <span style={{ fontSize: 14, fontFamily: FF.body, color: tc, fontWeight: 600 }}>{opt}</span>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 15, fontWeight: 800, fontFamily: FF.body, color: lastStars > 0 ? COLORS.win : COLORS.red, animation: 'slideUp 0.3s ease' }}>
            {lastStars > 0
              ? <>{t.rush.correctWord} <span style={{ color: COLORS.xp, textShadow: `0 1px 0 ${INK}` }}>{'★'.repeat(lastStars)}</span></>
              : (selected === null ? t.rush.timeUp : t.rush.wrongWord)}
          </div>
        )}
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  const total = questions.length;
  const acc = total ? Math.round((correct / total) * 100) : 0;
  const maxStars = total * 3;
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;

  return (
    <div style={{ padding: '0 var(--content-padding) 100px' }}>
      {header(t.rush.title, goHome)}
      <div style={{ ...CARD, borderRadius: 18, boxShadow: `0 5px 0 0 ${INK}`, background: COLORS.xpSoft, padding: '32px 20px', textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ ...TYPE.h2, fontSize: 22, color: INK, margin: '0 0 18px' }}>{t.rush.resultTitle}</h2>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 44, fontWeight: 800, color: INK, fontFamily: FF.display, letterSpacing: '-0.03em' }}>
          <Star size={38} fill="#fff" color={INK} strokeWidth={1.5} /> {stars}
        </div>
        <div style={{ fontSize: 12, fontFamily: FF.mono, fontWeight: 700, color: 'rgba(15,15,16,0.6)', marginTop: 4 }}>/ {maxStars} {pluralizeForms(maxStars, t.rush.starsWord)}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 22 }}>
          <div style={{ background: '#fff', border: `2px solid ${INK}`, borderRadius: 12, padding: '12px 8px' }}>
            <div style={{ ...TYPE.statLabel, marginTop: 0, color: 'rgba(15,15,16,0.55)' }}>{t.rush.accuracy}</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.display, color: INK, marginTop: 4 }}>{acc}%</div>
            <div style={{ fontSize: 10, fontFamily: FF.mono, color: 'rgba(15,15,16,0.5)' }}>{correct}/{total}</div>
          </div>
          <div style={{ background: '#fff', border: `2px solid ${INK}`, borderRadius: 12, padding: '12px 8px' }}>
            <div style={{ ...TYPE.statLabel, marginTop: 0, color: 'rgba(15,15,16,0.55)' }}>{t.rush.timeLabel}</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FF.mono, color: INK, marginTop: 4 }}>{mm}:{String(ss).padStart(2, '0')}</div>
          </div>
        </div>
        {totalStars > 0 && <div style={{ fontSize: 12, fontFamily: FF.body, fontWeight: 700, color: 'rgba(15,15,16,0.7)', marginTop: 14 }}>{t.rush.totalStars}: <b style={{ color: INK }}>{totalStars}</b></div>}
      </div>

      <button onClick={() => { setStep(1); setPhase('wizard'); }} {...press3D(INK)} style={{ ...BUTTON.primary, width: '100%', justifyContent: 'center', marginBottom: 8 }}>
        <Zap size={18} /> {t.rush.newRound}
      </button>
      <button onClick={goHome} {...press3D(INK)} style={{ ...BUTTON.secondary, width: '100%', justifyContent: 'center' }}>{t.rush.finishBtn}</button>
    </div>
  );
}

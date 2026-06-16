import { useState, useEffect, useRef } from "react";
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { getQs } from '../utils/questionHelpers';
import { supabase } from '../config/supabase';
import { CARD, CARD_COMPACT, TYPE, COLORS, scoreColor, FF, FS, R } from '../constants/styles';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { formatTime } from '../utils/formatters';
import { API_BASE } from '../config/app';
import { isNewRecord, completeDailyChallenge, loadDaily } from '../utils/competitionHelpers';
import TestSkeleton from './ui/TestSkeleton';
import BackButton from './ui/BackButton';
import ProgressBar from './ui/ProgressBar';
import { Lightbulb, Bot, Share2, Check, X, ChevronDown, ChevronUp, ChevronRight, Swords, Trophy, Flag, WifiOff, RotateCcw, ArrowRight, Sparkles, Flame } from 'lucide-react';
import { getRecommendation } from '../utils/recommendationEngine';
import { trackEvent } from '../utils/analytics';
import ReportSheet from './ui/ReportSheet';
import { captureError } from '../config/sentry';
import type { Question, TestResult, AnswerValue } from '../types';
import { getSingleCorrect, getQType } from '../types';
import { scoreQuestion } from '../utils/scoringEngine';
import { buildQd, clampQdTime } from '../utils/qdHelpers';
import { consumeExplain, getExplainRemaining } from '../utils/aiLimits';
import MultipleAnswerCard from './ui/MultipleAnswerCard';
import MatchingCard from './ui/MatchingCard';
import { calcTestXP } from '../utils/xpHelpers';
import ScoreRing from './ui/ScoreRing';
import PaywallScreen from './ui/PaywallScreen';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useT } from '../locales';

interface TestProps {
  sid: string;
  tid?: string | null;
  customQs?: Question[] | null;
  finish: (result: TestResult) => void;
}

interface AIText {
  short: string;
  detailed: string;
}

interface ChallengeSession {
  subjectId: string;
  score: number;
}

export default function Test({ sid, tid, customQs = null, finish }: TestProps) {
  const { st, hist, prof } = useApp();
  const { user, isPremium } = useAuth();
  const { goHome, nav: navFn, navToErrorTest, setCustomQs: setNavCustomQs, setScreen, openPaywall } = useNav();
  const toast = useToast();
  const t = useT();
  const { exp: showExp = true, tmr: useTmr = true, shf: useShuffle = true } = st;
  const sub = SUBS[sid] || ALL_PROFILES.find(p => p.id === sid);

  const [qs, setQs] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const baseTime = sid === "history" ? 30 * 60 : 20 * 60;
  const [cur, setCur] = useState(0); const [ans, setAns] = useState<Record<number, AnswerValue>>({}); const [show, setShow] = useState(false);
  const [tl, setTl] = useState(baseTime); const [fin, setFin] = useState(false); const tr = useRef<ReturnType<typeof setInterval> | null>(null); const autoFinished = useRef(false);
  const [aiText, setAiText] = useState<Record<number, AIText>>({});
  const [aiLoad, setAiLoad] = useState<Record<number, boolean>>({});
  const [aiExpanded, setAiExpanded] = useState<Record<number, boolean>>({});
  const [showShare, setShowShare] = useState(false);
  const [challenge] = useState<ChallengeSession | null>(() => { try { const c = sessionStorage.getItem("entprep_challenge"); return c ? JSON.parse(c) : null; } catch { return null; } });
  const dailyMarkedRef = useRef(false);
  const [reportIdx, setReportIdx] = useState<number | null>(null);
  const [reportSent, setReportSent] = useState<Record<number, boolean>>({});
  const [reportLoading, setReportLoading] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [focused, setFocused] = useState(-1);
  const [offline, setOffline] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isFirstAiExposure, setIsFirstAiExposure] = useState(() => !localStorage.getItem('entprep_ai_btn_seen'));
  // Per-question answer time tracking (refs, no extra re-renders):
  // qShownAtRef resets when the current question changes; qTimesRef stores seconds spent per index.
  const qShownAtRef = useRef(Date.now());
  const qTimesRef = useRef<Record<number, number>>({});
  const leaveDlgRef = useRef<HTMLDivElement>(null);

  // BUG-2: one history entry per test. The timer auto-finish and each results-screen
  // button (retry / next / home) all call finish(); without this guard a timed-out
  // test that is then dismissed via a button records the result twice.
  const recordedRef = useRef(false);
  const recordResult = (result: TestResult) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    finish(result);
  };

  const doLeave = () => {
    setShowLeaveConfirm(false);
    if (customQs) { setNavCustomQs(null); setScreen('errors'); }
    else if (sid === "reading") { goHome(); }
    else { setScreen('topics'); }
  };

  const handleBack = () => {
    if (!fin && Object.keys(ans).length > 0) {
      setShowLeaveConfirm(true);
      return;
    }
    doLeave();
  };

  // Focus management for the leave-confirm dialog (initial focus, Tab trap, Escape, restore).
  useFocusTrap(leaveDlgRef, showLeaveConfirm, () => setShowLeaveConfirm(false));

  useEffect(() => { let cancelled = false; (async () => { const questions = customQs ? customQs.map(q => ({ ...q, o: [...q.o] })) : await getQs(sid, sub.cnt, useShuffle, tid, st.lang); if (cancelled) return; if (questions.length === 0) { toast.error(t.test.noQuestionsForTopic); doLeave(); return; } const tot = questions.length; const timerSec = tid ? Math.max(5 * 60, Math.round(baseTime * (tot / sub.cnt))) : baseTime; setQs(questions); setTl(timerSec); setLoading(false); })(); return () => { cancelled = true } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loading || !useTmr || offline) { if (tr.current) { clearInterval(tr.current); tr.current = null; } return; } tr.current = setInterval(() => setTl(p => { if (p <= 1) { clearInterval(tr.current!); autoFinished.current = true; setFin(true); return 0; } return p - 1; }), 1000); return () => { if (tr.current) clearInterval(tr.current); }; }, [loading, offline]);
  useEffect(() => { if (!fin || !autoFinished.current || !qs) return; autoFinished.current = false; const tot = qs.length; const timerSec = tid ? Math.max(5 * 60, Math.round(baseTime * (tot / sub.cnt))) : baseTime; const cc = qs.filter((q, i) => ans[i] !== undefined && scoreQuestion(q, ans[i]).correct).length; const qd = buildQd(qs, ans, qTimesRef.current); recordResult({ su: sid, tp: tid || undefined, co: cc, to: tot, sc: tot ? Math.round(cc / tot * 100) : 0, dt: new Date().toLocaleDateString("ru-RU"), tm: timerSec, qd, _leaderboard: buildLeaderboardData() }); }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fin || dailyMarkedRef.current || customQs || !qs) return;
    const tot = qs.length;
    const cc = qs.filter((q, i) => ans[i] !== undefined && scoreQuestion(q, ans[i]).correct).length;
    const pctVal = tot ? Math.round(cc / tot * 100) : 0;
    const daily = loadDaily();
    if (daily && daily.subjectId === sid && !daily.completed) {
      completeDailyChallenge(pctVal);
      dailyMarkedRef.current = true;
    }
  }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fin && qs) { const cnt = qs.length; const c = qs.filter((q, i) => ans[i] !== undefined && scoreQuestion(q, ans[i]).correct).length; trackEvent('Test Completed', { subject: sid, score: cnt ? Math.round(c / cnt * 100) : 0, questionCount: cnt }); } }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setFocused(-1); }, [cur]);
  // Restart the per-question stopwatch whenever a new question is shown (or questions finish loading)
  useEffect(() => { qShownAtRef.current = Date.now(); }, [cur, loading]);

  useEffect(() => {
    if (loading || !qs || fin) return;
    const handler = (e: KeyboardEvent) => {
      const optCount = qs[cur]?.o?.length || 4;
      if (!show) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setFocused(f => f < optCount - 1 ? f + 1 : 0);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocused(f => f > 0 ? f - 1 : optCount - 1);
        }
        else if ((e.key === 'Enter' || e.key === ' ') && focused >= 0) {
          e.preventDefault();
          sel(focused);
        }
        else if (e.key >= '1' && e.key <= String(optCount)) {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          setFocused(idx);
          sel(idx);
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          nxt();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, qs, fin, cur, show, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause timer when offline
  useEffect(() => {
    if (loading || fin) return;
    const goOffline = () => { setOffline(true); toast.warning((t.test as unknown as Record<string, string>).connectionLost); };
    const goOnline = () => { setOffline(false); toast.success((t.test as unknown as Record<string, string>).connectionRestored); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, [loading, fin, toast, t.test]);

  if (loading || !qs) return <TestSkeleton color={sub?.color} />;

  /* Leave confirm overlay — replaces window.confirm (broken in iOS PWA) */
  if (showLeaveConfirm) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div ref={leaveDlgRef} role="dialog" aria-modal="true" aria-label={t.test.leaveTestConfirm} tabIndex={-1} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '24px 20px', maxWidth: 320, width: '100%', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: FS.xl, fontWeight: 700, color: 'var(--text)' }}>{t.test.leaveTestConfirm}</h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{Object.keys(ans).length}/{qs.length}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1, padding: '12px 0', borderRadius: R.md, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {t.test.continue}
          </button>
          <button onClick={doLeave} style={{ flex: 1, padding: '12px 0', borderRadius: R.md, border: 'none', background: COLORS.red, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {t.test.exit}
          </button>
        </div>
      </div>
    </div>
  );

  const tot = qs.length; const timerSec = tid ? Math.max(5 * 60, Math.round(baseTime * (tot / sub.cnt))) : baseTime;
  const q = qs[cur]; const qType = getQType(q); const cc = qs.filter((qq, i) => ans[i] !== undefined && scoreQuestion(qq, ans[i]).correct).length;
  // Consecutive-correct streak run ending at current (or last answered) question
  const streakRun = (() => {
    let run = 0;
    const upto = show ? cur : cur - 1;
    for (let i = upto; i >= 0; i--) {
      const a = ans[i];
      if (a !== undefined && scoreQuestion(qs[i], a).correct) run++;
      else break;
    }
    return run;
  })();
  const trackFirstAnswer = () => {
    // Fires once per user (localStorage flag) on their very first answered question across the app.
    const key = 'entprep_first_q_answered';
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    trackEvent('first_question_answered', { subject: sid });
  };
  const markAnswerTime = () => { qTimesRef.current[cur] = clampQdTime((Date.now() - qShownAtRef.current) / 1000); };
  const sel = (idx: number) => { if (show || ans[cur] !== undefined || qType !== 'single') return; trackFirstAnswer(); markAnswerTime(); setAns(p => ({ ...p, [cur]: idx })); if (showExp) { setShow(true); } else { setTimeout(() => { if (cur < tot - 1) { setCur(c => c + 1); } else { if (tr.current) clearInterval(tr.current); setFin(true); } }, 300); } };
  const confirmMulti = (selected: number[]) => { if (ans[cur] !== undefined) return; trackFirstAnswer(); markAnswerTime(); setAns(p => ({ ...p, [cur]: selected })); if (showExp) { setShow(true); } else { setTimeout(() => { if (cur < tot - 1) { setCur(c => c + 1); } else { if (tr.current) clearInterval(tr.current); setFin(true); } }, 300); } };
  const confirmMatch = (mapping: Record<number, number>) => { if (ans[cur] !== undefined) return; trackFirstAnswer(); markAnswerTime(); setAns(p => ({ ...p, [cur]: mapping })); if (showExp) { setShow(true); } else { setTimeout(() => { if (cur < tot - 1) { setCur(c => c + 1); } else { if (tr.current) clearInterval(tr.current); setFin(true); } }, 300); } };
  const nxt = () => { setShow(false); if (cur < tot - 1) { setCur(cur + 1); } else { if (tr.current) clearInterval(tr.current); setFin(true); } };
  const fm = formatTime;
  const askAI = async (index: number) => {
    if (aiText[index] || aiLoad[index]) return;
    if (!user) { toast.warning(t.test.loginRequired || 'Войдите в аккаунт'); return; }
    if (!isPremium && !consumeExplain()) { trackEvent('AI Explain Limit Hit', { subject: sid }); setShowPaywall(true); return; }
    trackEvent('AI Explain Used', { subject: sid });
    setAiLoad(p => ({ ...p, [index]: true }));
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      const token = session?.access_token;
      if (!token) { setAiLoad(p => ({ ...p, [index]: false })); toast.error(t.test.sessionExpired); return; }
      const qItem = qs[index];
      const res = await fetch(`${API_BASE}/api/ai-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ question: qItem.q, options: qItem.o, userAnswer: ans[index], correctAnswer: qItem.c, explanation: qItem.e, questionType: getQType(qItem), pairs: qItem.pairs, lang: st.lang, subject: sid })
      });
      if (res.status === 403) { setAiText(p => ({ ...p, [index]: { short: t.test.aiDailyLimit, detailed: t.test.aiDailyLimit } })); setAiLoad(p => ({ ...p, [index]: false })); return; }
      const data = await res.json();
      if (data.short) setAiText(p => ({ ...p, [index]: { short: data.short, detailed: data.detailed || data.short } }));
      else if (data.explanation) setAiText(p => ({ ...p, [index]: { short: data.explanation, detailed: data.explanation } }));
      else setAiText(p => ({ ...p, [index]: { short: t.test.aiError, detailed: t.test.aiError } }));
    } catch { setAiText(p => ({ ...p, [index]: { short: t.test.aiConnectionError, detailed: t.test.aiConnectionErrorFull } })); }
    setAiLoad(p => ({ ...p, [index]: false }));
  };
  const reportQuestion = async (index: number, reason: string) => {
    if (!user || reportLoading) return;
    setReportLoading(true);
    try {
      const qItem = qs[index];
      const oi = qItem._oi != null ? qItem._oi : index;
      const { data: found } = await supabase!.from('questions').select('id').eq('subject', sid).eq('idx', oi).limit(1).single();
      if (!found) { setReportLoading(false); toast.warning(t.test.questionNotFound); return; }
      const row: Record<string, unknown> = { question_id: found.id, subject: sid, idx: oi, reason, user_id: user.id };
      if (reportComment.trim()) row.comment = reportComment.trim();
      const { error } = await supabase!.from('question_reports').insert(row);
      if (error && error.code === '23505') {
        // Already reported
      } else if (error) {
        captureError(error, { context: 'Test.report', sid });
        toast.error(t.test.reportFailed);
        setReportLoading(false);
        return;
      }
      setReportSent(p => ({ ...p, [index]: true }));
      toast.success(t.test.reportSent);
    } catch (err) {
      captureError(err, { context: 'Test.report', sid });
      toast.error(t.test.reportNetError);
    }
    setReportLoading(false);
    setReportIdx(null);
    setReportComment('');
  };

  const openReport = (idx: number) => {
    if (!user) { toast.info(t.test.loginToReport); return; }
    setReportComment(''); setReportIdx(idx);
  };

  /** Build leaderboard verification payload: question indices + answers mapped to original (pre-shuffle) space */
  const buildLeaderboardData = () => {
    if (!qs) return undefined;
    const question_indices = qs.map(q => q._oi!);
    const answers: (number | number[] | Record<number, number> | null)[] = qs.map((q, i) => {
      const a = ans[i];
      if (a === undefined) return null;
      const qt = getQType(q);
      if (qt === 'single' && typeof a === 'number') {
        // Map shuffled answer index back to original option index
        return q._shuffleMap ? q._shuffleMap[a] : a;
      }
      if (qt === 'multiple' && Array.isArray(a)) {
        return q._shuffleMap ? (a as number[]).map(idx => q._shuffleMap![idx]) : a;
      }
      // matching: no option shuffle, pass through
      return a;
    });
    return { question_indices, answers };
  };

  const pct = tot ? Math.round(cc / tot * 100) : 0;
  const record = fin && !customQs ? isNewRecord(hist, { su: sid, sc: pct } as TestResult) : { isRecord: false, prevBest: 0, improvement: 0 };
  const aiBtn = (index: number) => {
    const aiButtonLabel = aiLoad[index] ? t.test.thinking : isPremium
      ? t.test.aiExplainDifferent
      : t.test.aiExplainRemaining.replace('{n}', String(getExplainRemaining()));
    return (
    <div style={{ marginTop: 10 }}>
      {user ? <>
        {!aiText[index] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => { if (isFirstAiExposure) { localStorage.setItem('entprep_ai_btn_seen', '1'); setIsFirstAiExposure(false); } askAI(index); }} disabled={aiLoad[index]} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', width: '100%',
              background: 'var(--bg-card)',
              border: '2px solid var(--ink)',
              borderRadius: 12,
              boxShadow: '0 3px 0 0 var(--ink)',
              cursor: aiLoad[index] ? 'wait' : 'pointer',
              color: 'var(--text)',
              fontFamily: FF.body,
              fontSize: FS.md, fontWeight: 700,
              textAlign: 'left',
              ...(isFirstAiExposure && !aiLoad[index] ? { animation: 'pulse 2s ease-in-out 3' } : {}),
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: COLORS.streak, border: '1.5px solid var(--ink)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: FF.brand,
                fontWeight: 900, fontSize: 12, letterSpacing: '-0.04em', flexShrink: 0,
              }}>Д</span>
              <span style={{ flex: 1 }}>{aiButtonLabel}</span>
              <ChevronRight size={14} color="var(--text-muted)" strokeWidth={2.4} />
            </button>
            <button onClick={() => {
              const q = qs[index];
              const msg = `${t.test.aiTutorNudgeMsg || 'Объясни мне этот вопрос'}:\n\n"${q.q}"\n\n${t.test.aiTutorNudgeWrong || 'Я ответил неправильно. Помоги разобраться.'}`;
              try { sessionStorage.setItem('entprep_tutor_init', JSON.stringify({ subject: sid, message: msg })); } catch {}
              navFn('tutor');
            }} style={{
              background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
              color: COLORS.streak,
              fontFamily: FF.body, fontSize: FS.base, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            }}>
              <Sparkles size={12} strokeWidth={2.4} />{t.test.aiTutorNudge || 'Разобрать с AI Tutor'}
              <ChevronRight size={12} strokeWidth={2.4} />
            </button>
          </div>
        )}
        {aiText[index] && (
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
            marginTop: 4,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: R.sm,
              background: COLORS.streak, border: '1.5px solid var(--ink)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: FF.brand,
              fontWeight: 900, fontSize: 14, letterSpacing: '-0.04em',
              flexShrink: 0, marginBottom: 2,
            }}>Д</div>
            <div style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '2px solid var(--ink)',
              borderRadius: R.lg,
              borderBottomLeftRadius: R.sm,
              boxShadow: '0 3px 0 0 var(--ink)',
              padding: '12px 14px',
            }}>
              <div style={{
                fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: COLORS.streak, marginBottom: 6,
              }}>{t.test.diyarSays}</div>
              <div style={{
                fontFamily: FF.body, fontSize: 13, fontWeight: 600,
                color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap',
              }}>
                {aiExpanded[index] ? aiText[index].detailed : aiText[index].short}
              </div>
              {aiText[index].short !== aiText[index].detailed && (
                <button onClick={() => setAiExpanded(p => ({ ...p, [index]: !p[index] }))} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: COLORS.streak,
                  fontFamily: FF.body, fontSize: 11, fontWeight: 700,
                }}>
                  {aiExpanded[index] ? <><ChevronUp size={12} strokeWidth={2.4} />{t.test.brief}</> : <><ChevronDown size={12} strokeWidth={2.4} />{t.test.detailed}</>}
                </button>
              )}
            </div>
          </div>
        )}
      </> : (
        <button onClick={() => { trackEvent('ai_auth_nudge_clicked', { subject: sid }); toast.warning(t.test.loginRequired || 'Войдите в аккаунт'); }} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', width: '100%',
          background: 'var(--bg-subtle)',
          border: '1.5px dashed rgba(15,15,16,0.25)',
          borderRadius: 12,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontFamily: FF.body, fontSize: 12, fontWeight: 700,
          textAlign: 'left',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: R.sm,
            background: 'var(--bg-card)', border: '1.5px solid rgba(15,15,16,0.2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontFamily: FF.brand,
            fontWeight: 900, fontSize: 11, letterSpacing: '-0.04em', flexShrink: 0,
          }}>Д</span>
          <span style={{ flex: 1 }}>{t.test.aiLoginHint}</span>
        </button>
      )}
    </div>
  );
  };

  if (fin) return (<div style={{ padding: "0 20px 100px" }}>
    {/* v2 Result hero — xp splash, ink shadow, celebratory */}
    <div style={{
      position: 'relative',
      background: pct >= 70 ? '#B8ECC8' : pct >= 50 ? COLORS.xpSoft : 'rgba(255,90,54,0.16)',
      border: `2px solid var(--ink)`,
      borderRadius: 22,
      padding: "28px 20px 22px",
      textAlign: "center",
      marginBottom: 18,
      boxShadow: `0 6px 0 0 var(--ink)`,
      overflow: 'hidden',
      animation: "heroEnter 0.55s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      {/* dotted grid decoration */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(var(--ink) 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
        opacity: 0.045,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
        {(() => {
          const tierPhrase = pct === 100 ? t.test.resultTierPerfect
            : pct >= 80 ? t.test.resultTierGreat
            : pct >= 60 ? t.test.resultTierGood
            : pct >= 40 ? t.test.resultTierOk
            : t.test.resultTierLow;
          return (
            <h1 style={{
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 14,
              fontFamily: FF.display,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: 'var(--ink)',
              lineHeight: 1,
              animation: 'heroEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s both',
            }}>
              {pct >= 80 && <Sparkles size={22} color={COLORS.xp} fill={COLORS.xp} strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 3px rgba(255,194,51,0.6))' }} />}
              {tierPhrase}
              {pct >= 80 && <Sparkles size={22} color={COLORS.xp} fill={COLORS.xp} strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 3px rgba(255,194,51,0.6))' }} />}
            </h1>
          );
        })()}
        <ScoreRing value={pct} label={`${pct}%`} sublabel={`${cc}/${tot} ${t.correct}`} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.6)', border: '1.5px solid var(--ink)', borderRadius: 12, padding: "10px 8px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FF.mono, color: 'var(--ink)', opacity: 0.8, marginBottom: 3 }}>{t.test.timeLabel}</div>
            <div style={{ fontSize: FS.xl, fontWeight: 900, fontFamily: FF.display, letterSpacing: '-0.025em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fm(timerSec - tl)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.6)', border: '1.5px solid var(--ink)', borderRadius: 12, padding: "10px 8px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FF.mono, color: 'var(--ink)', opacity: 0.8, marginBottom: 3 }}>XP</div>
            <div style={{ fontSize: FS.xl, fontWeight: 900, fontFamily: FF.display, letterSpacing: '-0.025em', color: '#C77D00', fontVariantNumeric: 'tabular-nums' }}>+{calcTestXP({ su: sid, sc: pct, dt: '', co: cc, to: tot })}</div>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          marginTop: 14,
          padding: '6px 12px', borderRadius: R.pill,
          background: 'var(--ink)', color: '#fff',
          fontFamily: FF.display, fontSize: FS.sm, fontWeight: 900,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {pct >= 70 ? <><Check size={13} strokeWidth={3} />{t.test.aboveThreshold}</> : pct >= 50 ? t.test.needReview : t.test.needMorePrep}
        </div>
        {record.isRecord && <div style={{
          marginTop: 14, padding: "10px 14px",
          background: COLORS.xp, color: 'var(--ink)',
          border: '2px solid var(--ink)', borderRadius: 12,
          boxShadow: '0 3px 0 0 var(--ink)',
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Trophy size={16} strokeWidth={2.5} />
            <span style={{ fontFamily: FF.display, fontSize: 12, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t.test.newRecord}</span>
          </div>
          {record.prevBest > 0 && <div style={{ fontSize: FS.sm, fontWeight: 700, fontFamily: FF.body, marginTop: 4, opacity: 0.8 }}>
            {t.test.was} {record.prevBest}{t.test.became} {pct}% (+{record.improvement}%)
          </div>}
        </div>}
      </div>
    </div>
    <h3 style={{ ...TYPE.h3, margin: "0 0 10px" }}>{t.test.reviewAnswers}</h3>
    {qs.map((q, i) => { const ua = ans[i]; const qt = getQType(q); const sr = ua !== undefined ? scoreQuestion(q, ua) : null; const ok = sr?.correct ?? false; const borderColor = ok ? COLORS.green : sr?.partial ? COLORS.yellow : ua !== undefined ? COLORS.red : "var(--text-muted)"; return (
      <div key={i} style={{ ...CARD_COMPACT, padding: "12px 13px", marginBottom: 6, borderLeft: `3px solid ${borderColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 12, color: "var(--text-body)", marginBottom: 3, fontWeight: 500, flex: 1 }}>{i + 1}. {q.q}</div>
          {sr && qt !== 'single' && <span style={{ fontSize: 10, fontWeight: 700, color: borderColor, flexShrink: 0, marginLeft: 8 }}>{sr.pts}/{sr.maxPts} {t.test.pointsShort}</span>}
        </div>
        {qt === 'single' && (ua !== undefined ? (<div style={{ fontSize: 11, color: ok ? COLORS.green : COLORS.red, display: "flex", alignItems: "center", gap: 4 }}>
          {ok ? <Check size={13} /> : <X size={13} />} {q.o[ua as number]}{!ok && <span style={{ color: COLORS.green }}> → {q.o[getSingleCorrect(q)]}</span>}
        </div>) : (<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.test.skipped} → {q.o[getSingleCorrect(q)]}</div>))}
        {qt === 'multiple' && (() => { const correctArr = Array.isArray(q.c) ? q.c : [q.c]; const userArr = Array.isArray(ua) ? ua : []; return (<div style={{ fontSize: 11, marginTop: 2 }}>
          {ua !== undefined ? (<><div style={{ color: borderColor, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {ok ? <Check size={13} /> : sr?.partial ? <span style={{ color: COLORS.yellow }}>~</span> : <X size={13} />}
            {t.test.yourAnswer} {userArr.map(idx => q.o[idx]).join(', ')}
          </div>{!ok && <div style={{ color: COLORS.green, marginTop: 2 }}>{t.test.correctAnswer} {correctArr.map(idx => q.o[idx]).join(', ')}</div>}</>) : <div style={{ color: "var(--text-muted)" }}>{t.test.skipped} → {correctArr.map(idx => q.o[idx]).join(', ')}</div>}
        </div>); })()}
        {qt === 'matching' && q.pairs && (<div style={{ fontSize: 11, marginTop: 2 }}>
          {ua !== undefined ? q.pairs.map((pair, pi) => {
            const userMapping = ua as Record<number, number>;
            const pairOk = userMapping[pi] === pi;
            return <div key={pi} style={{ color: pairOk ? COLORS.green : COLORS.red, display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
              {pairOk ? <Check size={11} /> : <X size={11} />} {pair[0]} → {pairOk ? pair[1] : <><s>{q.pairs![userMapping[pi]]?.[1] ?? '?'}</s> <span style={{ color: COLORS.green }}>{pair[1]}</span></>}
            </div>;
          }) : <div style={{ color: "var(--text-muted)" }}>{t.test.skipped}</div>}
        </div>)}
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.7, background: "rgba(255,90,54,0.04)", padding: "6px 8px", borderRadius: 8 }}>
          <span style={{ color: COLORS.teal, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}><Lightbulb size={12} /></span> {q.e}
        </div>
        {!ok && aiBtn(i)}
        {user && <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          {reportSent[i]
            ? <span style={{ fontSize: 10, color: COLORS.green, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} />{t.test.sent}</span>
            : <button onClick={() => setReportIdx(i)} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.7 }}><Flag size={11} />{t.test.report}</button>
          }
        </div>}
      </div>
    ); })}
    {challenge && challenge.subjectId === sid && (<div style={{ ...CARD_COMPACT, background: "linear-gradient(135deg,rgba(255,107,53,0.06),rgba(255,90,54,0.06))", border: "1px solid rgba(255,107,53,0.2)", padding: "16px", marginTop: 14, textAlign: "center", animation: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}><Swords size={18} color={COLORS.accent} /><span style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>{t.test.challengeResult}</span></div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 6 }}>
        <div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.test.friend}</div><div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-muted)" }}>{challenge.score}%</div></div>
        <div style={{ fontSize: 20, color: "var(--text-muted)", alignSelf: "center" }}>vs</div>
        <div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.you}</div><div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(pct > challenge.score ? 70 : pct === challenge.score ? 50 : 0) }}>{pct}%</div></div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: scoreColor(pct > challenge.score ? 70 : pct === challenge.score ? 50 : 0) }}>{pct > challenge.score ? t.test.youWon : pct === challenge.score ? t.test.tie : t.test.friendWon}</div>
    </div>)}
    {/* After-test flow: error retry → next test → share → home */}
    {tot - cc > 0 && (
      <button
        onClick={() => {
          const errorQs = qs.filter((_, i) => ans[i] !== undefined && !scoreQuestion(qs[i], ans[i]).correct);
          if (errorQs.length > 0) {
            const qd = buildQd(qs, ans, qTimesRef.current);
            recordResult({ su: sid, tp: tid || undefined, co: cc, to: tot, sc: pct, dt: new Date().toLocaleDateString("ru-RU"), tm: timerSec - tl, qd, _leaderboard: buildLeaderboardData() });
            setTimeout(() => navToErrorTest(errorQs), 50);
          }
        }}
        style={{
          width: "100%", padding: "15px", marginTop: 14,
          background: COLORS.red, color: "#fff", border: "none", borderRadius: R.lg,
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(239,68,68,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <RotateCcw size={16} />{t.home.retryErrors} ({tot - cc})
      </button>
    )}
    <button
      onClick={() => {
        const qd = buildQd(qs, ans, qTimesRef.current);
        const result = { su: sid, tp: tid || undefined, co: cc, to: tot, sc: pct, dt: new Date().toLocaleDateString("ru-RU"), tm: timerSec - tl, qd, _leaderboard: buildLeaderboardData() };
        recordResult(result);
        const profileSubjects = [...['math', 'reading', 'history'], ...prof];
        const rec = getRecommendation([...hist, result], profileSubjects);
        setTimeout(() => {
          if (rec.type === 'error_review') navFn('errors');
          else if (rec.type === 'full_ent') navFn('fullent');
          else navFn('test', rec.subject || profileSubjects[0], rec.topic);
        }, 50);
      }}
      style={{
        width: "100%", padding: "15px", marginTop: 8,
        background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`,
        color: "#fff",
        border: "2px solid var(--ink)",
        borderRadius: R.lg,
        fontFamily: FF.display,
        fontSize: 13, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase',
        cursor: "pointer",
        boxShadow: "0 5px 0 0 var(--ink), 0 0 28px rgba(255,90,54,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      {t.home.nextTest} <ArrowRight size={16} strokeWidth={3} />
    </button>
    <button
      onClick={() => {
        if (challenge) sessionStorage.removeItem("entprep_challenge");
        const qd = buildQd(qs, ans, qTimesRef.current);
        recordResult({ su: sid, tp: tid || undefined, co: cc, to: tot, sc: pct, dt: new Date().toLocaleDateString("ru-RU"), tm: timerSec - tl, qd, _leaderboard: buildLeaderboardData() });
        goHome();
      }}
      style={{
        width: "100%", padding: "15px", marginTop: 8,
        background: "none", color: "var(--text-secondary)",
        border: "1px solid var(--border-light)", borderRadius: R.lg,
        fontSize: 14, fontWeight: 600, cursor: "pointer",
      }}
    >{t.test.goHome}</button>
    <ReportSheet visible={reportIdx !== null} questionText={reportIdx !== null ? qs[reportIdx]?.q : undefined} options={reportIdx !== null ? qs[reportIdx]?.o : undefined} comment={reportComment} loading={reportLoading} onClose={() => { setReportIdx(null); setReportComment(''); }} onCommentChange={setReportComment} onReport={reason => reportQuestion(reportIdx!, reason)} />
  </div>);

  const isR = !!q.px;
  return (<div style={{ padding: "0 20px 100px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <BackButton onClick={handleBack} label={t.test.exit} />
      {useTmr && <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: "7px 12px",
        background: tl < 120 ? "rgba(239,68,68,0.12)" : "var(--bg-card)",
        border: `2px solid ${tl < 120 ? COLORS.red : 'var(--ink)'}`,
        borderRadius: R.pill,
        boxShadow: tl < 120 ? 'none' : '0 2px 0 0 var(--ink)',
        fontFamily: FF.display, fontSize: 13, fontWeight: 900,
        letterSpacing: '-0.025em',
        color: tl < 120 ? COLORS.red : "var(--text)",
        fontVariantNumeric: 'tabular-nums',
      }}>{fm(tl)}</div>}
    </div>
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: "var(--text-muted)",
        }}>{t.test.questionN} {cur + 1} {t.test.of} {tot}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streakRun >= 3 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: R.pill,
              background: COLORS.streak, color: '#fff',
              border: '2px solid var(--ink)',
              fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.04em',
              animation: 'firePulse 1.6s ease-in-out infinite',
            }}>
              <Flame size={11} strokeWidth={2.5} fill="#fff" />{streakRun}
            </span>
          )}
          <span style={{
            fontFamily: FF.display, fontSize: 12, fontWeight: 900,
            letterSpacing: '-0.02em',
            color: COLORS.win, fontVariantNumeric: 'tabular-nums',
          }}>{cc} {t.correct}</span>
        </div>
      </div>
      <div style={{
        height: 8, borderRadius: R.pill,
        background: 'rgba(15,15,16,0.1)',
        border: '1.5px solid var(--ink)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, ((cur + 1) / tot) * 100)}%`,
          background: COLORS.streak,
          borderRight: cur + 1 < tot ? '1.5px solid var(--ink)' : 'none',
          transition: 'width 0.45s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
    {offline && <div style={{ ...CARD, background: "linear-gradient(135deg,rgba(26,26,50,0.95),rgba(22,33,62,0.95))", borderRadius: 18, padding: "32px 20px", textAlign: "center", marginBottom: 16, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <WifiOff size={32} color={COLORS.red} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: FS.xl, fontWeight: 700, color: COLORS.red, marginBottom: 6 }}>{(t.test as unknown as Record<string, string>).connectionLost}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{(t.test as unknown as Record<string, string>).timerPaused}</div>
    </div>}
    {!offline && <div key={`qblock-${cur}`}>
    {isR && <div style={{ ...CARD_COMPACT, background: "rgba(255,90,54,0.06)", border: "1px solid rgba(255,90,54,0.18)", padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.teal, marginBottom: 4 }}>{"\uD83D\uDCD6"} {q.pt}</div>
      <div style={{ fontSize: 12, color: "var(--text-light)", lineHeight: 1.75 }}>{q.px}</div>
    </div>}
    <div style={{ ...CARD, padding: "20px 16px", marginBottom: 12, animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: FS.xl, fontWeight: 600, color: "var(--text)", lineHeight: 1.65 }}>{q.q}</div>
        {!reportSent[cur] && <button onClick={() => openReport(cur)} aria-label={t.test.report} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', flexShrink: 0, opacity: 0.5 }}><Flag size={16} color="var(--text-secondary)" /></button>}
        {reportSent[cur] && <Check size={16} color={COLORS.win} style={{ flexShrink: 0, marginTop: 4 }} />}
      </div>
    </div>
    {qType === 'multiple' ? (
      <MultipleAnswerCard
        key={cur}
        question={q}
        onConfirm={confirmMulti}
        showResult={show}
        userAnswer={ans[cur] as number[] | undefined}
      />
    ) : qType === 'matching' ? (
      <MatchingCard
        key={cur}
        question={q}
        onConfirm={confirmMatch}
        showResult={show}
        userAnswer={ans[cur] as Record<number, number> | undefined}
      />
    ) : (
    <div role="radiogroup" aria-label={t.test.answerOptions} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {q.o.map((opt, idx) => {
        const picked = ans[cur] === idx; const correct = getSingleCorrect(q) === idx;
        let bg = "var(--bg-card)", bd = "1px solid var(--border)", tc = "var(--text-body)";
        if (show && correct) { bg = "rgba(184,236,200,0.5)"; bd = "2px solid #58CC02"; tc = "#2B7A1A"; }
        else if (show && picked && !correct) { bg = "rgba(239,68,68,0.08)"; bd = "2px solid #EF4444"; tc = COLORS.red; }
        else if (picked) { bg = "rgba(255,90,54,0.1)"; bd = "1.5px solid rgba(255,90,54,0.55)"; tc = COLORS.streak; }
        const isFocused = !show && focused === idx;
        if (isFocused && !picked) { bd = "1px solid rgba(255,90,54,0.5)"; bg = "rgba(255,90,54,0.08)"; }
        return (<button key={`${cur}-${idx}`} onClick={() => sel(idx)} role="radio" aria-checked={picked} aria-label={`${t.test.option} ${String.fromCharCode(65 + idx)}: ${opt}`} style={{ display: "flex", alignItems: "center", background: bg, border: bd, borderRadius: R.md, padding: "13px 14px", cursor: show ? "default" : "pointer", textAlign: "left", transition: "all 0.2s", position: "relative", overflow: "hidden", outline: isFocused ? "2px solid rgba(255,90,54,0.4)" : undefined, outlineOffset: 1 }}>
          <div style={{ width: 26, height: 26, borderRadius: R.md, border: `2px solid ${tc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: tc, flexShrink: 0, marginRight: 11 }}>
            {show && correct ? <Check size={14} /> : show && picked && !correct ? <X size={14} /> : String.fromCharCode(65 + idx)}
          </div>
          <span style={{ fontSize: 14, color: tc, fontWeight: picked ? 600 : 400 }}>{opt}</span>
        </button>);
      })}
    </div>
    )}
    {show && ans[cur] !== undefined && (() => {
      const sr = scoreQuestion(q, ans[cur]);
      const isCorrect = sr.correct;
      let wrongLabel = '';
      if (!isCorrect) {
        if (qType === 'single') {
          const correctIdx = getSingleCorrect(q);
          wrongLabel = `${String.fromCharCode(65 + correctIdx)} — ${q.o[correctIdx]}`;
        } else if (qType === 'multiple') {
          const correctArr = Array.isArray(q.c) ? q.c : [q.c];
          wrongLabel = correctArr.map(i => String.fromCharCode(65 + i)).join(', ');
        } else {
          wrongLabel = t.test.seeExplanation || 'Смотри разбор ниже';
        }
      }
      const phrases = t.test.correctPhrases || [t.test.correctBanner];
      const phrase = phrases[cur % phrases.length];
      return (
        <div role="status" aria-live="polite" aria-atomic="true" style={{
          marginTop: 12,
          padding: '11px 14px',
          borderRadius: R.lg,
          background: isCorrect ? '#B8ECC8' : '#FFE8DE',
          border: '2px solid var(--ink)',
          borderBottom: '4px solid var(--ink)',
          animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {isCorrect ? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: R.lg, background: '#58CC02', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={14} color="#fff" strokeWidth={3.2} />
              </div>
              <div style={{
                flex: 1,
                fontFamily: FF.display, fontSize: FS.xl, fontWeight: 800,
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>
                {phrase}
              </div>
              <div style={{
                padding: '3px 10px',
                borderRadius: 100,
                background: 'var(--ink)',
                color: COLORS.xp,
                fontFamily: FF.mono,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Sparkles size={11} color={COLORS.xp} fill={COLORS.xp} strokeWidth={2.5} />+1 XP
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 28, height: 28, borderRadius: R.lg, background: COLORS.streak, border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} color="#fff" strokeWidth={3} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FF.mono, fontSize: 10, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
                  {t.test.wrongBanner}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {wrongLabel}
                </div>
              </div>
            </>
          )}
        </div>
      );
    })()}
    {show && <div style={{ ...CARD_COMPACT, background: "rgba(255,90,54,0.05)", border: "1px solid rgba(255,90,54,0.12)", padding: "12px 14px", marginTop: 10, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, display: "flex", gap: 6 }}>
        <Lightbulb size={15} color={COLORS.teal} style={{ flexShrink: 0, marginTop: 2 }} /><span>{q.e}</span>
      </div>
      {aiBtn(cur)}
    </div>}
    {show && <button onClick={nxt} style={{ width: "100%", padding: "15px", marginTop: 12, background: `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`, color: "#fff", border: "2px solid var(--ink)", borderRadius: R.lg, fontFamily: FF.display, fontSize: 13, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: "pointer", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 5px 0 0 var(--ink), 0 0 24px rgba(255,90,54,0.25)" }}>{cur < tot - 1 ? t.test.nextQuestion : t.test.finishTest}</button>}
    </div>}
    <ReportSheet visible={reportIdx !== null} questionText={reportIdx !== null ? qs[reportIdx]?.q : undefined} options={reportIdx !== null ? qs[reportIdx]?.o : undefined} comment={reportComment} loading={reportLoading} onClose={() => { setReportIdx(null); setReportComment(''); }} onCommentChange={setReportComment} onReport={reason => reportQuestion(reportIdx!, reason)} />
    {showPaywall && <PaywallScreen trigger="explain_limit" onClose={() => setShowPaywall(false)} />}
  </div>);
}

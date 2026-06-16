import React, { useState, useEffect, useRef } from "react";
import { ALL_PROFILES } from '../config/questionPools';
import { ENT_CONFIG, PROFILE_BLOCKS } from '../config/ent';
import { getQs } from '../utils/questionHelpers';
import { assembleProfileSection } from '../utils/questionAssembler';
import { scoreQuestion } from '../utils/scoringEngine';
import { getBlockForIndex } from '../utils/questionAssembler';
import MultipleAnswerCard from './ui/MultipleAnswerCard';
import MatchingCard from './ui/MatchingCard';
import BlockIndicator from './ui/BlockIndicator';
import PointsBadge from './ui/PointsBadge';
import { CARD, CARD_COMPACT, TYPE, COLORS, FF, R, FS } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useApp } from '../contexts/AppContext';
import { useNav } from '../contexts/NavigationContext';
import { formatTimeHMS } from '../utils/formatters';
import BackButton from './ui/BackButton';
import ProgressBar from './ui/ProgressBar';
import { GraduationCap, AlertTriangle, Share2, Check, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Lightbulb, Grid3X3, Play, Flag, Pause, BookOpen, WifiOff } from 'lucide-react';
import SubjectIcon, { SubjectChip } from './ui/SubjectIcon';
import { SUBJECT_META } from '../config/subjects';
import ReportSheet from './ui/ReportSheet';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { trackEvent } from '../utils/analytics';
import type { Question, TestResult, ENTSection, AnswerValue, QuestionDetail } from '../types';
import { clampQdTime, qdDifficulty } from '../utils/qdHelpers';
import { getSingleCorrect, getQType } from '../types';
import { calcTestXP } from '../utils/xpHelpers';
import ScoreRing from './ui/ScoreRing';
import { useT } from '../locales';
// FullENT is free unlimited — no AI limits needed

interface FullENTProps {
  finish: (result: TestResult) => void;
}

interface Section extends ENTSection {
  qs: Question[];
}

interface SectionResult extends Section {
  correct: number;
  pts: number;
  passed: boolean;
  total: number;
}

export default function FullENT({ finish }: FullENTProps) {
  const { prof, st } = useApp();
  const { goHome, openPaywall } = useNav();
  const { user, isPremium } = useAuth();
  const toast = useToast();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const fm = formatTimeHMS;
  const t = useT();
  const subName = (id: string) => (t.subjects as Record<string, string>)[id] || id;

  const [phase, setPhase] = useState<"intro" | "test" | "results">("intro");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  useEffect(() => { let cancelled = false; (async () => {
    try {
    const p1 = ALL_PROFILES.find(p => p.id === prof[0]);
    const p2 = ALL_PROFILES.find(p => p.id === prof[1]);
    const lang = st.lang;
    const [mandatoryQs, prof0Qs, prof1Qs] = await Promise.all([
      Promise.all(ENT_CONFIG.sections.map(s => getQs(s.sid, s.cnt, true, null, lang))),
      assembleProfileSection(prof[0], PROFILE_BLOCKS, true, lang),
      assembleProfileSection(prof[1], PROFILE_BLOCKS, true, lang),
    ]);
    if (cancelled) return;
    // Compute real maxPts based on actual question types in the section
    const calcMaxPts = (qs: Question[]) => qs.reduce((sum, qq) => {
      const qt = getQType(qq);
      return sum + (qt === 'multiple' || qt === 'matching' ? 2 : 1);
    }, 0);
    const secs: Section[] = [
      ...ENT_CONFIG.sections.map((s, i) => ({ ...s, label: (t.subjects as Record<string, string>)[s.sid] || s.label, qs: mandatoryQs[i] })),
      { sid: prof[0], label: (t.subjects as Record<string, string>)[prof[0]] || p1?.name || prof[0], icon: p1?.icon || "\uD83D\uDD2C", cnt: ENT_CONFIG.profileCnt, maxPts: calcMaxPts(prof0Qs), threshold: ENT_CONFIG.profileThreshold, ptsPerQ: ENT_CONFIG.profilePtsPerQ, qs: prof0Qs },
      { sid: prof[1], label: (t.subjects as Record<string, string>)[prof[1]] || p2?.name || prof[1], icon: p2?.icon || "\uD83D\uDCBB", cnt: ENT_CONFIG.profileCnt, maxPts: calcMaxPts(prof1Qs), threshold: ENT_CONFIG.profileThreshold, ptsPerQ: ENT_CONFIG.profilePtsPerQ, qs: prof1Qs },
    ];
    if (secs.some(s => s.qs.length === 0)) { toast.error(t.fullent.notEnoughQuestions); goHome(); return; }
    setSections(secs);
    } catch (err) { console.error('FullENT load error:', err); toast.error(t.fullent.loadFailed); goHome(); }
    finally { setSectionsLoading(false); }
  })(); return () => { cancelled = true; if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [curSec, setCurSec] = useState(0);
  const [curQ, setCurQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Record<number, AnswerValue>>>({});
  const [timeLeft, setTimeLeft] = useState(ENT_CONFIG.totalTime);
  const [showGrid, setShowGrid] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [reportIdx, setReportIdx] = useState<string | null>(null); // "sec-qi" key
  const [reportSent, setReportSent] = useState<Record<string, boolean>>({});
  const [reportLoading, setReportLoading] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [passageOpen, setPassageOpen] = useState(true);
  const [focused, setFocused] = useState(-1);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const finishConfirmRef = useRef<HTMLDivElement>(null);
  useFocusTrap(finishConfirmRef, showFinishConfirm, () => setShowFinishConfirm(false));
  // Reset passage to open when navigating to a new question
  useEffect(() => { setPassageOpen(true); }, [curSec, curQ]);
  // Reset focus when question changes
  useEffect(() => { setFocused(-1); }, [curSec, curQ]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The timer interval is NOT re-created when `answers` changes (its effect deps are
  // [phase, paused, offline]), so it would otherwise call a finishENT closure captured
  // at test start with empty answers. This ref always points at the latest finishENT.
  const finishRef = useRef<() => void>(() => {});

  // ── Per-question answer-time tracking ──────────────────────────────────────
  // Questions can be revisited, so we accumulate CUMULATIVE facing time per
  // question (keyed "sec:qi") in a ref. Time is flushed whenever the active
  // question changes or the exam is paused/offline, so timer-stopped periods
  // are not counted.
  const qTimesRef = useRef<Record<string, number>>({});
  const qViewRef = useRef<{ key: string; at: number } | null>(null);
  const flushQTime = () => {
    const v = qViewRef.current;
    if (v) {
      qTimesRef.current[v.key] = (qTimesRef.current[v.key] || 0) + (Date.now() - v.at) / 1000;
      qViewRef.current = null;
    }
  };
  useEffect(() => {
    flushQTime();
    if (phase === 'test' && !paused && !offline) qViewRef.current = { key: `${curSec}:${curQ}`, at: Date.now() };
  }, [phase, paused, offline, curSec, curQ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Always clear previous interval first to prevent double-tick
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (phase !== "test" || paused || offline) return;
    timerRef.current = setInterval(() => setTimeLeft(p => { if (p <= 1) { clearInterval(timerRef.current!); timerRef.current = null; finishRef.current(); return 0; } return p - 1; }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, paused, offline]);

  // Pause timer when offline
  useEffect(() => {
    if (phase !== "test") return;
    const goOffline = () => { setOffline(true); toast.warning((t.test as unknown as Record<string, string>).connectionLost); };
    const goOnline = () => { setOffline(false); toast.success((t.test as unknown as Record<string, string>).connectionRestored); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, [phase, toast, t.test]);

  // Keyboard navigation for answer options
  useEffect(() => {
    if (phase !== 'test' || paused || offline || !sections) return;
    const currentSec = sections[curSec];
    const currentQ = currentSec?.qs[curQ];
    if (!currentQ || getQType(currentQ) !== 'single') return;
    const optCount = currentQ.o?.length || 4;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocused(f => f < optCount - 1 ? f + 1 : 0);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocused(f => f > 0 ? f - 1 : optCount - 1);
      } else if ((e.key === 'Enter' || e.key === ' ') && focused >= 0) {
        e.preventDefault();
        sel(focused);
      } else if (e.key >= '1' && e.key <= String(optCount)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        setFocused(idx);
        sel(idx);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, paused, offline, sections, curSec, curQ, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const sec = sections?.[curSec];
  const q = sec?.qs[curQ];
  const secAnswers = answers[curSec] || {};

  const sel = (idx: number) => { if (getQType(q!) !== 'single') return; setAnswers(p => ({ ...p, [curSec]: { ...(p[curSec] || {}), [curQ]: idx } })); };
  const confirmMulti = (selected: number[]) => { setAnswers(p => ({ ...p, [curSec]: { ...(p[curSec] || {}), [curQ]: selected } })); };
  const confirmMatch = (mapping: Record<number, number>) => { setAnswers(p => ({ ...p, [curSec]: { ...(p[curSec] || {}), [curQ]: mapping } })); };
  const [secPos, setSecPos] = useState<Record<number, number>>({}); // remember last question per section
  const navigateTo = (s: number, qi: number) => { setSecPos(p => ({ ...p, [curSec]: curQ })); setCurSec(s); setCurQ(qi); setShowGrid(false); };
  const nxt = () => { if (curQ < sec!.qs.length - 1) navigateTo(curSec, curQ + 1); else if (curSec < sections!.length - 1) navigateTo(curSec + 1, secPos[curSec + 1] || 0); else finishENT(); };
  const prev = () => { if (curQ > 0) navigateTo(curSec, curQ - 1); };
  const goSec = (i: number) => { navigateTo(i, secPos[i] || 0); };
  const goQ = (i: number) => { navigateTo(curSec, i); };

  const finishENT = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    flushQTime(); // capture time spent on the question visible at finish
    setPhase("results");
    const r = calcResults();
    const totalPtsVal = Math.round(r.reduce((s, x) => s + x.pts, 0) * 10) / 10;
    trackEvent('FullENT Completed', { totalScore: totalPtsVal });
    // Build per-question details for analytics. oi is per-subject, so each entry
    // carries its own su. tms is the cumulative facing time across revisits.
    const qd: QuestionDetail[] = sections!.flatMap((s, si) => s.qs.map((qq, qi): QuestionDetail => {
      const a = (answers[si] || {})[qi];
      const tSec = qTimesRef.current[`${si}:${qi}`];
      return {
        oi: qq._oi!,
        ok: a !== undefined && scoreQuestion(qq, a).correct,
        su: s.sid,
        tp: qq._topic,
        stp: qq._subtopic,
        picked: a ?? null,
        tms: tSec !== undefined ? clampQdTime(tSec) : undefined,
        df: qdDifficulty(qq),
      };
    }));
    // Save results to history immediately (don't wait for "Go Home" click)
    finish({ type: "fullent", su: "fullent", sc: 0, co: r.reduce((s, x) => s + x.correct, 0), to: r.reduce((s, x) => s + x.total, 0), dt: new Date().toLocaleDateString("ru-RU"), tm: ENT_CONFIG.totalTime - timeLeft, qd, sections: r.map(sr => ({ sid: sr.sid, label: sr.label, icon: sr.icon, pts: sr.pts, maxPts: sr.maxPts, passed: sr.passed, correct: sr.correct, total: sr.total })) });
    // Show paywall after 3s delay for free users (let them see their score first)
    if (!isPremium) paywallTimerRef.current = setTimeout(() => openPaywall('fullent'), 3000);
  };

  // Point the timer's finish-ref at the freshest closure on every render.
  finishRef.current = finishENT;

  const calcResults = (): SectionResult[] => {
    return sections!.map((s, si) => {
      const sa = answers[si] || {};
      const isProfile = s.cnt === ENT_CONFIG.profileCnt;
      let totalPts = 0;
      let correct = 0;
      s.qs.forEach((qq, qi) => {
        const userAns = sa[qi];
        if (userAns === undefined) return;
        if (isProfile) {
          // Use actual question type to determine points, not just block position
          // This prevents single fillers from getting 2pts in multiple/matching blocks
          const qType = getQType(qq);
          const pts = qType === 'multiple' || qType === 'matching' ? 2 : 1;
          const result = scoreQuestion(qq, userAns, pts);
          totalPts += result.pts;
          if (result.correct) correct++;
        } else {
          const result = scoreQuestion(qq, userAns, s.ptsPerQ);
          totalPts += result.pts;
          if (result.correct) correct++;
        }
      });
      const pts = Math.round(totalPts * 10) / 10;
      return { ...s, correct, pts, passed: pts >= s.threshold, total: s.qs.length };
    });
  };

  const totalAnswered = Object.values(answers).reduce((s, a) => s + Object.keys(a).length, 0);
  const reportKey = `${curSec}-${curQ}`;

  const reportQuestion = async (key: string, reason: string) => {
    if (!user || !supabase || reportLoading) return;
    setReportLoading(true);
    try {
      const [si, qi] = key.split('-').map(Number);
      const s = sections![si];
      const qItem = s.qs[qi];
      const oi = qItem._oi != null ? qItem._oi : qi;
      const { data: found } = await supabase.from('questions').select('id').eq('subject', s.sid).eq('idx', oi).limit(1).single();
      if (!found) { setReportLoading(false); toast.warning(t.test.questionNotFound); return; }
      const row: Record<string, unknown> = { question_id: found.id, subject: s.sid, idx: oi, reason, user_id: user.id };
      if (reportComment.trim()) row.comment = reportComment.trim();
      const { error } = await supabase.from('question_reports').insert(row);
      if (error && error.code === '23505') { /* Already reported */ }
      else if (error) { toast.error(t.test.reportFailed); setReportLoading(false); return; }
      setReportSent(p => ({ ...p, [key]: true }));
      toast.success(t.test.reportSent);
    } catch { toast.error(t.test.reportNetError); }
    setReportLoading(false);
    setReportIdx(null);
    setReportComment('');
  };

  const openReport = (key: string) => { setReportComment(''); setReportIdx(key); };

  if (sectionsLoading || !sections) {
    const shimmerStyle: React.CSSProperties = {
      background: 'linear-gradient(90deg, var(--skeleton-bg) 25%, var(--border-light) 50%, var(--skeleton-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
    };
    return (
      <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
        {/* Loading message */}
        <h1 style={{ textAlign: 'center', padding: '24px 0 16px', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>
          {t.fullent.loadingQuestions}
        </h1>
        {/* Hero skeleton */}
        <div style={{ ...shimmerStyle, borderRadius: 22, height: 140, marginBottom: 20 }} />
        {/* Section card skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 6, marginBottom: 18 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...CARD_COMPACT, padding: '14px', display: 'flex', alignItems: 'center' }}>
              <div style={{ ...shimmerStyle, width: 40, height: 40, borderRadius: R.md, flexShrink: 0, animationDelay: `${i * 0.08}s` }} />
              <div style={{ marginLeft: 11, flex: 1 }}>
                <div style={{ ...shimmerStyle, height: 13, width: '70%', borderRadius: R.sm, marginBottom: 6, animationDelay: `${0.05 + i * 0.08}s` }} />
                <div style={{ ...shimmerStyle, height: 10, width: '50%', borderRadius: 5, animationDelay: `${0.1 + i * 0.08}s` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Start button skeleton */}
        <div style={{ ...shimmerStyle, height: 50, borderRadius: R.lg }} />
      </div>
    );
  }

  // ===== INTRO =====
  if (phase === "intro") return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <BackButton onClick={goHome} style={{ marginBottom: 14 }} />

      {/* v2 hero — xp splash with decorative dots */}
      <div style={{
        position: 'relative',
        background: COLORS.xpSoft,
        border: '2px solid var(--ink)',
        borderRadius: 22,
        padding: "28px 20px 22px",
        textAlign: "center",
        marginBottom: 18,
        boxShadow: '0 6px 0 0 var(--ink)',
        overflow: 'hidden',
        animation: 'heroEnter 0.55s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.045,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--ink)', color: COLORS.xp,
            border: '2px solid var(--ink)',
            boxShadow: '0 4px 0 0 #FF5A36',
            marginBottom: 14,
          }}>
            <GraduationCap size={28} strokeWidth={2.2} />
          </div>
          <h1 style={{
            ...TYPE.h1, fontSize: 26, marginBottom: 6, color: 'var(--ink)',
            fontFamily: FF.display, fontWeight: 900,
            letterSpacing: '-0.035em',
          }}>{t.fullent.title}</h1>
          <p style={{
            fontFamily: FF.body, fontSize: FS.lg, fontWeight: 700,
            color: 'var(--ink)', opacity: 0.65, margin: 0, lineHeight: 1.45,
          }}>{t.fullent.subtitle}</p>

          {/* Spec chips row */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6,
            flexWrap: 'wrap', marginTop: 16,
          }}>
            {[
              { n: '120', l: t.fullent.specQuestions },
              { n: '5', l: t.fullent.specSubjects },
              { n: t.fullent.specTimeValue, l: t.fullent.specTimeLimit },
              { n: '140', l: t.fullent.specMax },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 4,
                padding: '5px 10px', borderRadius: R.pill,
                background: 'rgba(255,255,255,0.7)',
                border: '1.5px solid var(--ink)',
                fontFamily: FF.display,
              }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{s.n}</span>
                <span style={{
                  fontFamily: FF.mono, fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--ink)', opacity: 0.55,
                }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sections grid */}
      <div style={{
        fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px',
      }}>{t.fullent.sectionsHeader}</div>
      <div style={{ display: "grid", gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 8, marginBottom: 18 }}>
        {sections.map((s, i) => {
          const isProfile = s.cnt === ENT_CONFIG.profileCnt;
          const subColor = SUBJECT_META[s.sid]?.color || 'var(--ink)';
          return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: 'var(--bg-card)',
            border: '2px solid var(--ink)',
            borderRadius: R.lg,
            boxShadow: '0 3px 0 0 var(--ink)',
          }}>
            <SubjectChip sid={s.sid} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FF.body, fontSize: 14, fontWeight: 800,
                color: "var(--text)",
              }}>{subName(s.sid)}</div>
              <div style={{
                fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.04em',
                color: "var(--text-muted)", marginTop: 2,
              }}>{s.cnt} {t.fullent.sectionInfo} {s.maxPts} {t.fullent.sectionInfoSuffix} {s.threshold} {t.home.pointsShort}</div>
              {isProfile && <div style={{
                fontFamily: FF.body, fontSize: 10, fontWeight: 700,
                color: COLORS.streak, marginTop: 3,
              }}>{t.fullent.profileBlocksDesc}</div>}
            </div>
          </div>
        ); })}
      </div>

      {/* Warning card */}
      <div style={{
        background: COLORS.streakSoft,
        border: '2px solid var(--ink)',
        borderRadius: R.lg,
        padding: "12px 14px",
        marginBottom: 18,
        boxShadow: '0 3px 0 0 var(--ink)',
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: FF.display, fontSize: 11, fontWeight: 900,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: COLORS.streak, marginBottom: 4,
        }}>
          <AlertTriangle size={14} strokeWidth={2.5} />{t.fullent.important}
        </div>
        <div style={{
          fontFamily: FF.body, fontSize: 12, fontWeight: 600,
          color: "var(--ink)", lineHeight: 1.55,
        }}>{t.fullent.importantDesc}</div>
      </div>

      {/* Start CTA */}
      <button onClick={() => {
        if (!isPremium) {
          const lastFull = localStorage.getItem('entprep_last_fullent');
          const today = new Date().toDateString();
          if (lastFull === today) { openPaywall('fullent'); return; }
          localStorage.setItem('entprep_last_fullent', today);
        }
        setPhase("test");
      }} style={{
        width: "100%", padding: "16px",
        background: COLORS.streak,
        color: "#fff",
        border: "2px solid var(--ink)",
        borderBottom: "5px solid var(--ink)",
        borderRadius: R.lg,
        fontFamily: FF.display,
        fontSize: 14, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase',
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <Play size={18} strokeWidth={3} fill="#fff" />{t.fullent.startEnt}
      </button>
    </div>
  );

  // ===== RESULTS =====
  if (phase === "results") {
    const res = calcResults();
    const totalPts = Math.round(res.reduce((s, r) => s + r.pts, 0) * 10) / 10;
    const allPassed = res.every(r => r.passed);
    const totalCorrect = res.reduce((s, r) => s + r.correct, 0);
    const elapsed = ENT_CONFIG.totalTime - timeLeft;
    return (
      <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
        <div style={{
          position: 'relative',
          background: totalPts >= 122 ? '#B8ECC8' : totalPts >= 85 ? COLORS.xpSoft : COLORS.streakSoft,
          border: '2px solid var(--ink)',
          borderRadius: 22,
          padding: "28px 20px 22px",
          textAlign: "center",
          marginBottom: 18,
          boxShadow: '0 6px 0 0 var(--ink)',
          overflow: 'hidden',
          animation: 'heroEnter 0.55s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            opacity: 0.045,
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <ScoreRing value={totalPts} max={140} label={`${totalPts}`} sublabel={`${t.test.resultOf} 140 ${t.score}`} size={150} color={allPassed ? COLORS.win : COLORS.streak} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1.5px solid var(--ink)',
                borderRadius: 12, padding: "10px 8px",
              }}>
                <div style={{ fontFamily: FF.mono, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.55, marginBottom: 3 }}>{t.correct}</div>
                <div style={{ fontFamily: FF.display, fontSize: 14, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>{totalCorrect}/120</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1.5px solid var(--ink)',
                borderRadius: 12, padding: "10px 8px",
              }}>
                <div style={{ fontFamily: FF.mono, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.55, marginBottom: 3 }}>{t.test.timeLabel}</div>
                <div style={{ fontFamily: FF.display, fontSize: 14, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>{fm(elapsed)}</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1.5px solid var(--ink)',
                borderRadius: 12, padding: "10px 8px",
              }}>
                <div style={{ fontFamily: FF.mono, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.55, marginBottom: 3 }}>XP</div>
                <div style={{ fontFamily: FF.display, fontSize: 14, fontWeight: 900, color: '#C77D00', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>+{calcTestXP({ type: 'fullent', su: 'fullent', sc: 0, dt: '', sections: res.map(r => ({ pts: r.pts })) })}</div>
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
              {allPassed ? <><Check size={13} strokeWidth={3} />{t.fullent.allThresholdsPassed}</> : <><X size={13} strokeWidth={3} />{t.fullent.someThresholdsFailed}</>}
            </div>
          </div>
        </div>
        <h3 style={{ ...TYPE.h3, margin: "0 0 12px" }}>{t.fullent.subjectResults}</h3>
        <div style={{ display: "grid", gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 7 }}>
        {res.map((r, i) => (
          <div key={i} style={{ ...CARD_COMPACT, padding: "14px", border: `1px solid ${r.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`, borderLeft: `3px solid ${r.passed ? COLORS.green : COLORS.red}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: R.sm,
                  background: `${SUBJECT_META[r.sid]?.color || 'var(--ink)'}14`,
                  border: `1.5px solid ${SUBJECT_META[r.sid]?.color || 'var(--ink)'}4D`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <SubjectIcon sid={r.sid} size={17} color={SUBJECT_META[r.sid]?.color} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{subName(r.sid)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.correct}/{r.total} {t.fullent.correctOf}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: FS.xxl, fontWeight: 800, fontFamily: FF.mono, color: r.passed ? COLORS.green : COLORS.red }}>{r.pts}/{r.maxPts}</div>
                <div style={{ fontSize: 10, color: r.passed ? COLORS.green : COLORS.red, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                  {r.passed ? <><Check size={11} />{t.fullent.threshold}</> : `${t.fullent.thresholdFailed} ${r.threshold})`}
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 13, fontWeight: 600, color: COLORS.teal, cursor: "pointer", marginBottom: 10 }}>{t.fullent.reviewAll}</summary>
          {sections.map((s, si) => (
            <div key={si} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <SubjectIcon sid={s.sid} size={14} color={SUBJECT_META[s.sid]?.color} strokeWidth={2.2} /> {subName(s.sid)}
              </div>
              {s.qs.map((qq, qi) => { const ua = (answers[si] || {})[qi]; const qt = getQType(qq); const sr = ua !== undefined ? scoreQuestion(qq, ua) : null; const ok = sr?.correct ?? false; const borderColor = ok ? COLORS.green : sr?.partial ? COLORS.yellow : ua !== undefined ? COLORS.red : "var(--text-muted)"; return (
                <div key={qi} style={{ ...CARD_COMPACT, padding: "10px 12px", marginBottom: 4, borderLeft: `3px solid ${borderColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 11, color: "var(--text-body)", marginBottom: 3, fontWeight: 500, flex: 1 }}>{qi + 1}. {qq.q}</div>
                    {sr && qt !== 'single' && <span style={{ fontSize: 9, fontWeight: 700, color: borderColor, flexShrink: 0, marginLeft: 6 }}>{sr.pts}/{sr.maxPts} {t.test.pointsShort}</span>}
                  </div>
                  {qt === 'single' && (ua !== undefined ? (<div style={{ fontSize: 10, color: ok ? COLORS.green : COLORS.red, display: "flex", alignItems: "center", gap: 3 }}>
                    {ok ? <Check size={11} /> : <X size={11} />} {qq.o[ua as number]}{!ok && <span style={{ color: COLORS.green }}> → {qq.o[getSingleCorrect(qq)]}</span>}
                  </div>) : (<div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.test.skipped} → {qq.o[getSingleCorrect(qq)]}</div>))}
                  {qt === 'multiple' && (() => { const correctArr = Array.isArray(qq.c) ? qq.c : [qq.c]; const userArr = Array.isArray(ua) ? ua : []; return (
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                      {ua !== undefined ? (<><div style={{ color: borderColor, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
                        {ok ? <Check size={11} /> : sr?.partial ? <span style={{ color: COLORS.yellow }}>~</span> : <X size={11} />}
                        {t.test.yourAnswer} {userArr.map(idx => qq.o[idx]).join(', ')}
                      </div>{!ok && <div style={{ color: COLORS.green, marginTop: 1 }}>{t.test.correctAnswer} {correctArr.map(idx => qq.o[idx]).join(', ')}</div>}</>) : <div style={{ color: "var(--text-muted)" }}>{t.test.skipped} → {correctArr.map(idx => qq.o[idx]).join(', ')}</div>}
                    </div>); })()}
                  {qt === 'matching' && qq.pairs && (<div style={{ fontSize: 10, marginTop: 2 }}>
                    {ua !== undefined ? qq.pairs.map((pair, pi) => {
                      const userMapping = ua as Record<number, number>;
                      const pairOk = userMapping[pi] === pi;
                      return <div key={pi} style={{ color: pairOk ? COLORS.green : COLORS.red, display: "flex", alignItems: "center", gap: 3, marginBottom: 1 }}>
                        {pairOk ? <Check size={10} /> : <X size={10} />} {pair[0]} → {pairOk ? pair[1] : <><s>{qq.pairs![userMapping[pi]]?.[1] ?? '?'}</s> <span style={{ color: COLORS.green }}>{pair[1]}</span></>}
                      </div>;
                    }) : <div style={{ color: "var(--text-muted)" }}>{t.test.skipped}</div>}
                  </div>)}
                  <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.6, background: "rgba(255,90,54,0.04)", padding: "5px 7px", borderRadius: R.sm, display: "flex", gap: 4 }}>
                    <Lightbulb size={11} color={COLORS.teal} style={{ flexShrink: 0, marginTop: 1 }} /><span>{qq.e}</span>
                  </div>
                  {user && (reportSent[`${si}-${qi}`]
                    ? <div style={{ fontSize: 9, color: COLORS.green, marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={10} />{t.test.sent}</div>
                    : <button onClick={() => openReport(`${si}-${qi}`)} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', fontSize: 9, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.7, marginTop: 3 }}><Flag size={10} />{t.test.report}</button>
                  )}
                </div>
              ); })}
            </div>
          ))}
        </details>
        <button onClick={goHome} style={{ width: "100%", padding: "15px", marginTop: 8, background: COLORS.teal, color: "#fff", border: "none", borderRadius: R.lg, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{t.test.goHome}</button>
        <ReportSheet visible={reportIdx !== null} questionText={reportIdx !== null && sections ? (() => { const [si, qi] = reportIdx.split('-').map(Number); return sections[si]?.qs[qi]?.q; })() : undefined} options={reportIdx !== null && sections ? (() => { const [si, qi] = reportIdx.split('-').map(Number); return sections[si]?.qs[qi]?.o; })() : undefined} comment={reportComment} loading={reportLoading} onClose={() => { setReportIdx(null); setReportComment(''); }} onCommentChange={setReportComment} onReport={reason => reportQuestion(reportIdx!, reason)} />
      </div>
    );
  }

  // ===== TEST =====
  const isR = !!q?.px;
  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <BackButton onClick={goHome} label={t.test.exit} style={{ padding: "7px 11px" }} />
        <div aria-label={`${t.fullent.answeredCount}: ${totalAnswered}/120`} style={{ fontSize: 11, color: "var(--text-secondary)" }}>{totalAnswered}/120</div>
        <button onClick={() => setPaused(p => !p)} style={{ ...CARD_COMPACT, background: paused ? "rgba(234,179,8,0.12)" : "var(--bg-card)", border: `1px solid ${paused ? "rgba(234,179,8,0.3)" : "var(--border)"}`, padding: "7px 9px", cursor: "pointer", color: paused ? COLORS.yellow : "var(--text-muted)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
          {paused ? <><Play size={12} />{t.fullent.resume}</> : <><Pause size={12} />{t.fullent.pause}</>}
        </button>
        <div role="timer" aria-live="off" aria-label={`${t.fullent.timeRemaining}: ${fm(timeLeft)}`} style={{ ...CARD_COMPACT, background: timeLeft < 600 ? "rgba(239,68,68,0.12)" : "var(--bg-card)", border: `1px solid ${timeLeft < 600 ? "rgba(239,68,68,0.25)" : "var(--border)"}`, padding: "7px 11px", fontFamily: FF.mono, fontSize: 13, fontWeight: 700, color: timeLeft < 600 ? COLORS.red : "var(--text)" }}>{fm(timeLeft)}</div>
      </div>
      {paused && !offline && <div style={{ ...CARD, background: COLORS.xpSofter, padding: "48px 20px", textAlign: "center", marginBottom: 16, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
        <Pause size={40} color='var(--ink)' style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{t.fullent.paused}</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16 }}>{t.fullent.pauseDesc}</div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 20 }}>{t.fullent.pauseStats} {totalAnswered}/120 {t.fullent.pauseRemaining} {fm(timeLeft)}</div>
        <button onClick={() => setPaused(false)} style={{ padding: "14px 32px", background: COLORS.streak, color: "#fff", border: "2px solid var(--ink)", borderBottom: "4px solid var(--ink)", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Play size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{t.fullent.resume}
        </button>
      </div>}
      {offline && <div style={{ ...CARD, background: COLORS.streakSoft, padding: "48px 20px", textAlign: "center", marginBottom: 16, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
        <WifiOff size={40} color={COLORS.red} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.red, marginBottom: 8 }}>{(t.test as unknown as Record<string, string>).connectionLost}</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16 }}>{(t.test as unknown as Record<string, string>).timerPaused}</div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{t.fullent.pauseStats} {totalAnswered}/120 {t.fullent.pauseRemaining} {fm(timeLeft)}</div>
      </div>}
      {!paused && !offline && <><div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto" }}>
        {sections.map((s, i) => { const sa = answers[i] || {}; const cnt = Object.keys(sa).length; const active = i === curSec; return (
          <button key={i} onClick={() => goSec(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: active ? "rgba(255,90,54,0.12)" : "var(--bg-card)", border: active ? "1px solid rgba(255,90,54,0.3)" : "1px solid var(--border)", borderRadius: R.md, padding: "7px 9px", cursor: "pointer", minWidth: 56, flexShrink: 0 }}>
            <SubjectIcon sid={s.sid} size={16} color={active ? COLORS.teal : (SUBJECT_META[s.sid]?.color || 'var(--text-muted)')} strokeWidth={2.2} />
            <span style={{ fontSize: 9, color: active ? COLORS.teal : "var(--text-muted)", fontWeight: 600, marginTop: 3 }}>{cnt}/{s.cnt}</span>
          </button>
        ); })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SubjectIcon sid={sec!.sid} size={14} color={SUBJECT_META[sec!.sid]?.color} strokeWidth={2.2} /> {subName(sec!.sid)}
        </span>
        <button onClick={() => setShowGrid(!showGrid)} style={{ ...CARD_COMPACT, background: "var(--bg-card)", padding: "5px 10px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Grid3X3 size={13} />#{curQ + 1}/{sec!.cnt}
        </button>
      </div>
      {showGrid && <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4, marginBottom: 12 }}>
        {sec!.qs.map((_qq, i) => { const a = (answers[curSec] || {})[i]; const hasAnswer = a !== undefined; return (
          <button key={i} onClick={() => goQ(i)} aria-current={i === curQ ? 'true' : undefined} aria-label={`${t.fullent.questionNumber} ${i + 1}${hasAnswer ? `, ${t.fullent.answeredWord}` : ''}`} style={{ background: i === curQ ? "rgba(255,90,54,0.15)" : hasAnswer ? "rgba(255,90,54,0.08)" : "var(--bg-card)", border: `1px solid ${i === curQ ? "rgba(255,90,54,0.35)" : "var(--border-light)"}`, borderRadius: R.sm, padding: "5px 0", cursor: "pointer", fontSize: 10, color: i === curQ ? COLORS.teal : hasAnswer ? COLORS.teal : "var(--text-muted)", fontWeight: 600 }}>{i + 1}</button>
        ); })}
      </div>}
      <ProgressBar value={curQ + 1} max={sec!.qs.length} gradient={`linear-gradient(90deg,${COLORS.accent},${COLORS.amber})`} style={{ marginBottom: 12 }} />
      <div key={`qblock-${curSec}-${curQ}`}>
      {isR && <div style={{ ...CARD_COMPACT, background: "rgba(255,90,54,0.06)", border: "1px solid rgba(255,90,54,0.18)", padding: passageOpen ? "12px 14px" : "8px 14px", marginBottom: 12, position: "sticky", top: 0, zIndex: 10, maxHeight: passageOpen ? "40vh" : "auto", overflowY: passageOpen ? "auto" : "hidden", transition: "all 0.2s" }}>
        <button onClick={() => setPassageOpen(p => !p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.teal, display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={12} />{q!.pt}</div>
          {passageOpen ? <ChevronUp size={14} color={COLORS.teal} /> : <ChevronDown size={14} color={COLORS.teal} />}
        </button>
        {passageOpen && <div style={{ fontSize: 11, color: "var(--text-light)", lineHeight: 1.7, marginTop: 4 }}>{q!.px}</div>}
      </div>}
      {(() => { const isProfile = sec!.cnt === ENT_CONFIG.profileCnt; const block = isProfile ? getBlockForIndex(curQ, PROFILE_BLOCKS) : null; return block ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <BlockIndicator currentIndex={curQ} blocks={PROFILE_BLOCKS} />
          <PointsBadge pts={block.ptsPerQ} />
        </div>
      ) : null; })()}
      <div style={{ ...CARD, padding: "18px 14px", marginBottom: 12, animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.6 }}>{q?.q}</div>
          {user && !reportSent[reportKey] && <button onClick={() => openReport(reportKey)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', flexShrink: 0, opacity: 0.4 }}><Flag size={14} color="var(--text-secondary)" /></button>}
          {user && reportSent[reportKey] && <Check size={14} color={COLORS.green} style={{ flexShrink: 0, marginTop: 4 }} />}
        </div>
      </div>
      {getQType(q!) === 'multiple' ? (
        <MultipleAnswerCard question={q!} onConfirm={confirmMulti} showResult={false} userAnswer={secAnswers[curQ] as number[] | undefined} />
      ) : getQType(q!) === 'matching' ? (
        <MatchingCard key={`m-${curSec}-${curQ}`} question={q!} onConfirm={confirmMatch} showResult={false} userAnswer={secAnswers[curQ] as Record<number, number> | undefined} />
      ) : (
      <div role="radiogroup" aria-label={t.test.answerOptions} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q?.o.map((opt, idx) => {
          const picked = secAnswers[curQ] === idx;
          const locked = secAnswers[curQ] !== undefined;
          let bg = "var(--bg-card)", bd = "1px solid var(--border)", tc = "var(--text-body)";
          if (picked) { bg = "rgba(255,90,54,0.1)"; bd = "1px solid rgba(255,90,54,0.35)"; tc = COLORS.teal; }
          const isFocused = focused === idx && !locked;
          if (isFocused && !picked) { bd = "1px solid rgba(255,90,54,0.5)"; bg = "rgba(255,90,54,0.08)"; }
          return (<button key={idx} onClick={() => sel(idx)} role="radio" aria-checked={picked} aria-label={`${t.test.option} ${String.fromCharCode(65 + idx)}: ${opt}`} style={{ display: "flex", alignItems: "center", background: bg, border: bd, borderRadius: 12, padding: "12px 13px", cursor: locked ? "default" : "pointer", textAlign: "left", transition: "all 0.2s", outline: isFocused ? "2px solid rgba(255,90,54,0.4)" : undefined, outlineOffset: 1 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${tc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: tc, flexShrink: 0, marginRight: 10 }}>
              {picked ? <Check size={12} /> : String.fromCharCode(65 + idx)}
            </div>
            <span style={{ fontSize: 13, color: tc, fontWeight: picked ? 600 : 400 }}>{opt}</span>
          </button>);
        })}
      </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {curQ > 0 && <button onClick={prev} style={{ flex: 1, padding: "13px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <ChevronLeft size={16} />{t.fullent.prev}
        </button>}
        {secAnswers[curQ] !== undefined ? <button onClick={nxt} style={{ flex: 2, padding: "13px", background: COLORS.streak, color: "#fff", border: "2px solid var(--ink)", borderBottom: "4px solid var(--ink)", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {curQ < sec!.qs.length - 1 ? t.fullent.nextQ : curSec < sections.length - 1 ? t.fullent.nextSubject : t.fullent.finish}<ChevronRight size={16} />
        </button> : <button onClick={() => { if (curQ < sec!.qs.length - 1) navigateTo(curSec, curQ + 1); else if (curSec < sections.length - 1) navigateTo(curSec + 1, secPos[curSec + 1] || 0); }} style={{ flex: 2, padding: "13px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {t.fullent.skipQuestion}<ChevronRight size={16} />
        </button>}
      </div>
      <button onClick={() => setShowFinishConfirm(true)} style={{ width: "100%", padding: "13px", marginTop: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.fullent.finishEarly}</button>
      {showFinishConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowFinishConfirm(false)}>
        <div ref={finishConfirmRef} role="dialog" aria-modal="true" aria-label={t.fullent.finishEarlyConfirm} tabIndex={-1} style={{ background: "var(--bg-card)", borderRadius: 18, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <Flag size={28} color={COLORS.red} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{t.fullent.finishEarlyConfirm}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 18 }}>{totalAnswered}/120 {t.fullent.answeredWord}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowFinishConfirm(false)} style={{ flex: 1, padding: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text)" }}>{t.fullent.resume}</button>
            <button onClick={() => { setShowFinishConfirm(false); finishENT(); }} style={{ flex: 1, padding: 12, background: COLORS.red, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" }}>{t.fullent.finishEarly}</button>
          </div>
        </div>
      </div>}
      </div>
      </>}
      <ReportSheet visible={reportIdx !== null} questionText={reportIdx !== null && sections ? (() => { const [si, qi] = reportIdx.split('-').map(Number); return sections[si]?.qs[qi]?.q; })() : undefined} comment={reportComment} loading={reportLoading} onClose={() => { setReportIdx(null); setReportComment(''); }} onCommentChange={setReportComment} onReport={reason => reportQuestion(reportIdx!, reason)} />
    </div>
  );
}

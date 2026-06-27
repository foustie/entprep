import React, { useState, useRef } from "react";
import { getRecommendations, calcTopicStats, calcSubtopicStats, getWrongQuestions } from '../utils/adaptiveHelpers';
import { generateStudyPlan } from '../utils/studyPlanGenerator';
import { toggleTaskDone } from '../utils/studyPlanStore';
import { trackEvent } from '../utils/analytics';
import { getUpcomingPeriods } from '../config/ent';
import { TOPIC_MAP } from '../config/topics';
import { CARD_COMPACT, CARD_HERO, TYPE, COLORS, scoreColor, FF, FS, SP, R, ICON } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import SubjectIcon from './ui/SubjectIcon';
import { useT } from '../locales';
import { supabase } from '../config/supabase';
import { API_BASE } from '../config/app';
import EmptyState from './ui/EmptyState';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, FileText, XCircle, Sparkles, RefreshCw, Lock, Check, Play, Lightbulb } from 'lucide-react';
import type { TopicStats, StudyPlan, StudyTask, StudyWeek, StudyPlanTopicRef, StudyWorkload } from '../types';

// Shape returned by the additive /api/study-plan-focus endpoint (graceful: may be []).
interface FocusWeek { weekNum: number; focus?: string; tips?: { text: string }[] }

interface SubjectAnalysis {
  id: string;
  name: string;
  icon: string;
  color: string;
  avg: number;
  score: number;
  trend: string;
  count: number;
  message: string;
}

// ── Plan date helpers ─────────────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO date `n` whole months from today (used by the duration quick-pick chips). */
function isoAddMonths(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Quick-pick durations (months until ЕНТ) offered in the survey. */
const MONTH_OPTIONS = [1, 3, 6, 9] as const;

/** Index of the week containing `today` (clamped to [0, last]). */
function defaultWeekIndex(weeks: StudyWeek[], today: string): number {
  for (let i = 0; i < weeks.length; i++) {
    if (today >= weeks[i].startDate && today <= weeks[i].endDate) return i;
  }
  if (weeks.length && today < weeks[0].startDate) return 0;
  return Math.max(0, weeks.length - 1);
}

export default function Adaptive() {
  const { nav, openPaywall } = useNav();
  const { hist, prof, st, plan: planSnap, setPlanSnapshot, updSt } = useApp();
  const { user, isPremium } = useAuth();
  const toast = useToast();
  const bp = useBreakpoint();
  const t = useT();
  const isKk = st.lang === 'kk';
  const isDesktop = bp === 'desktop';
  const { weak, strong, overall, totalTests } = getRecommendations(hist, prof);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [topicCache, setTopicCache] = useState<Record<string, TopicStats[]>>({});
  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({});
  const [subtopicCache, setSubtopicCache] = useState<Record<string, TopicStats[]>>({});
  const wrongCount = getWrongQuestions(hist, 1).length;
  const hasQd = hist.some(t => t.qd);

  // currentWeek is 0-based; null = follow the by-date default (today's week).
  const [weekIdx, setWeekIdx] = useState<number | null>(null);

  // Plan-setup survey: pick exam date (duration) + task density before (re)generating.
  // 'create' = fresh plan, 'regen' = replace existing (shows the "progress wiped" warning).
  const [workloadOpen, setWorkloadOpen] = useState<false | 'create' | 'regen'>(false);
  const [workloadSel, setWorkloadSel] = useState<StudyWorkload>('medium');
  const [dateSel, setDateSel] = useState<string>('');       // chosen exam date (ISO)
  const [monthsSel, setMonthsSel] = useState<number | null>(null); // active month chip (highlight)
  const pickerDlgRef = useRef<HTMLDivElement>(null);
  useFocusTrap(pickerDlgRef, !!workloadOpen, () => setWorkloadOpen(false));

  // Open the survey, seeding the inputs from the existing plan/goal. Create requires login.
  const openSurvey = (mode: 'create' | 'regen') => {
    if (!user) { toast.warning(t.test.loginRequired); return; }
    const today = todayISO();
    // Never seed a stale (past) date — many users carry a goal.date for an ENT period
    // that has already started; fall back to the next upcoming period instead.
    const futureOrNext = (d?: string) => (d && d >= today ? d : getUpcomingPeriods()[0]?.examStart || '');
    if (mode === 'regen') {
      setWorkloadSel(planSnap?.plan.workload ?? 'medium');
      setDateSel(futureOrNext(planSnap?.plan.examDate || st.goal?.date));
    } else {
      setWorkloadSel('medium');
      setDateSel(futureOrNext(st.goal?.date));
    }
    setMonthsSel(null); // the seed is an actual date, not a month-count — no chip highlighted
    setWorkloadOpen(mode);
  };

  const pickMonths = (n: number) => { setMonthsSel(n); setDateSel(isoAddMonths(n)); };

  // Commit the survey: generate FIRST, and only on success persist the exam date to the
  // global goal + close the modal — so a failed/past-date generate never corrupts goal state.
  const submitSurvey = () => {
    const examDate = dateSel || getUpcomingPeriods()[0]?.examStart || '';
    if (!examDate || examDate < todayISO()) { toast.warning(t.study_plan.noGoal); return; }
    const next = handleGenerate(workloadSel, examDate);
    if (!next) return; // generation failed (toast already shown) — keep the survey open to fix
    updSt({ ...st, goal: { target: st.goal?.target || 122, date: examDate } });
    setWorkloadOpen(false);
  };

  // ── Plan generation ──────────────────────────────────────────────────────
  const buildWeakTopics = (): StudyPlanTopicRef[] =>
    weak.map(s => {
      const ts = calcTopicStats(s.id, hist);
      const weakest = ts ? ts.filter(x => x.pct >= 0).sort((a, b) => a.pct - b.pct)[0] : undefined;
      return { id: s.id, topic: weakest?.id, name: s.name, score: s.score };
    });

  const buildStrongTopics = (): StudyPlanTopicRef[] =>
    strong.map(s => ({ id: s.id, name: s.name, score: s.score }));

  const handleGenerate = (workload: StudyWorkload, examDate: string): StudyPlan | null => {
    // Plan is VISIBLE to everyone, but creating one requires an account.
    if (!user) { toast.warning(t.test.loginRequired); return null; }
    if (!examDate) { toast.warning(t.study_plan.noGoal); return null; }
    const seed = new Date().toISOString();
    const next = generateStudyPlan({
      examDate,
      target: st.goal?.target || 122,
      profileSubjects: prof,
      weakTopics: buildWeakTopics(),
      strongTopics: buildStrongTopics(),
      today: todayISO(),
      seed,
      workload,
    });
    if (!next) { toast.error(t.study_plan.planError); return null; }
    // Render the deterministic plan immediately…
    setPlanSnapshot({ plan: next, completion: {}, updatedAt: seed });
    setWeekIdx(defaultWeekIndex(next.weeks, todayISO()));
    trackEvent('Study Plan Created', { weeks: next.weeksCount, target: next.target });
    // …then enrich with AI weekly focus/tips in the background (graceful: silent on failure).
    void fetchAndMergeFocus(next, seed);
    return next;
  };

  /**
   * Phase-4 enrichment: ask /api/study-plan-focus for a weekly focus line + a few
   * task-title tips, then merge into the snapshot (focus → Week.focus; one display-only
   * `tip` StudyTask per tip, prepended to the week). Purely additive and graceful —
   * the plan already rendered, so any failure (no auth, AI down, bad JSON) is silent.
   */
  const fetchAndMergeFocus = async (next: StudyPlan, seed: string): Promise<void> => {
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const input = {
        lang: isKk ? 'kk' : 'ru',
        target: next.target,
        examDate: next.examDate,
        weeks: next.weeks.map(w => ({
          weekNum: w.weekNum,
          phase: w.phase,
          subjects: Array.from(new Set(w.tasks.map(tk => tk.subject).filter((s): s is string => !!s))),
          topics: Array.from(new Set(w.tasks.map(tk => tk.topic).filter((tp): tp is string => !!tp))),
        })),
        weak: weak.map(s => ({ name: s.name, avg: s.avg, pct: Math.round(s.score), trend: s.trend })),
        strong: strong.map(s => ({ name: s.name, avg: s.avg })),
      };

      const res = await fetch(`${API_BASE}/api/study-plan-focus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
      if (!res.ok) return;
      const data = await res.json();
      const focusWeeks: FocusWeek[] = Array.isArray(data?.weeks) ? data.weeks : [];
      if (!focusWeeks.length) return;

      const byNum = new Map(focusWeeks.map(w => [w.weekNum, w]));
      const mergedWeeks: StudyWeek[] = next.weeks.map(week => {
        const f = byNum.get(week.weekNum);
        if (!f) return week;
        const tipTasks: StudyTask[] = (f.tips || []).map((tip, m) => ({
          id: `week_${week.weekNum}_tip_${m}`,
          date: week.startDate,
          type: 'tip' as const,
          subject: undefined,
          topic: undefined,
          title: tip.text,
          durationMin: 3,
          premium: false,
        }));
        return { ...week, focus: f.focus || week.focus, tasks: [...tipTasks, ...week.tasks] };
      });

      // Identity-guarded functional merge: only patch the snapshot this focus
      // request was seeded from, and preserve live `completion`/`updatedAt`. This
      // avoids two races in the multi-second AI window — (A) a task toggled mid-fetch
      // having its completion wiped back to {}, and (B) a newer regenerate's plan
      // being clobbered by an older in-flight focus response.
      setPlanSnapshot(prev =>
        prev && prev.updatedAt === seed ? { ...prev, plan: { ...next, weeks: mergedWeeks } } : prev,
      );
    } catch {
      /* graceful: focus is optional polish — never block or surface an error */
    }
  };

  const handleToggle = (taskId: string) => {
    if (!planSnap) return;
    const now = new Date().toISOString();
    setPlanSnapshot({ ...planSnap, completion: toggleTaskDone(planSnap.completion, taskId, now), updatedAt: now });
  };

  const handleStart = (task: StudyTask) => {
    if (task.type === 'practice' || task.type === 'review') {
      if (task.subject) nav('test', task.subject, task.topic || null);
    } else if (task.type === 'fullent') {
      nav('fullent');
    } else if (task.type === 'lesson') {
      nav('tutor', task.subject || null, task.topic || null);
    }
    // challenge: deferred to phase 4 (locked / placeholder); tip: display-only
  };

  const hasStart = (task: StudyTask) =>
    task.type === 'practice' || task.type === 'review' || task.type === 'fullent' || task.type === 'lesson';

  const openLock = (reason: 'week3Plus' | 'challenge') => {
    trackEvent('Study Plan Paywall Click', { reason });
    openPaywall('study_plan_locked');
  };

  // ── Title / meta localization ────────────────────────────────────────────
  const subjectName = (id?: string) => (id ? (t.subjects as Record<string, string>)[id] || id : '');
  const taskTypeLabel = (type: StudyTask['type']) =>
    (t.study_plan.taskTypes as Record<string, string>)[type] || type;

  const topicName = (subject?: string, topic?: string): string => {
    if (!subject || !topic) return '';
    const loc = (t.topics as Record<string, string>)[`${subject}_${topic}`];
    if (loc) return loc;
    const sec = TOPIC_MAP[subject]?.find(s => s.id === topic);
    if (sec) return isKk && sec.name_kk ? sec.name_kk : sec.name;
    return '';
  };

  const taskTitle = (task: StudyTask): string => {
    const sp = t.study_plan as unknown as Record<string, string>;
    if (task.subject) {
      if (task.topic) {
        const k = `task_${task.type}_${task.subject}_${task.topic}`;
        if (sp[k]) return sp[k];
      }
      const k2 = `task_${task.type}_${task.subject}`;
      if (sp[k2]) return sp[k2];
    }
    const tl = taskTypeLabel(task.type);
    if (!task.subject) return tl;
    const sn = subjectName(task.subject);
    const tn = topicName(task.subject, task.topic);
    return tn ? `${tl}: ${sn} — ${tn}` : `${tl}: ${sn}`;
  };

  const taskMeta = (task: StudyTask): string => {
    const parts: string[] = [];
    if (task.subject) parts.push(subjectName(task.subject));
    parts.push(taskTypeLabel(task.type));
    parts.push(`~${task.durationMin} ${t.study_plan.meta.duration}`);
    return parts.join(' / ');
  };

  const locale = isKk ? 'kk-KZ' : 'ru-RU';
  const fmtDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtRange = (start: string, end: string) => {
    const a = new Date(start + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const b = new Date(end + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${a} – ${b}`;
  };

  // Subject color lookup (from recommendation meta).
  const subjColorMap: Record<string, string> = {};
  [...weak, ...strong].forEach(s => { subjColorMap[s.id] = s.color; });
  const subjColor = (id?: string) => (id && subjColorMap[id]) || COLORS.streak;
  // Per-task left-border accent: subject colour, else a type colour (keeps subject
  // identity on the card so the Start button can stay quiet — one bright splash rule).
  const rowAccent = (task: StudyTask): string =>
    task.subject ? subjColor(task.subject) : task.type === 'fullent' ? COLORS.accent : COLORS.streak;

  const toggle = (id: string) => {
    if (!expanded[id] && !topicCache[id]) {
      const stats = calcTopicStats(id, hist);
      if (stats) setTopicCache(p => ({ ...p, [id]: stats }));
    }
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "improving") return <TrendingUp size={13} color={COLORS.green} />;
    if (trend === "declining") return <TrendingDown size={13} color={COLORS.red} />;
    return <Minus size={13} color="var(--text-secondary)" />;
  };
  const trendLabel = (trend: string) => trend === "improving" ? t.adaptive.improving : trend === "declining" ? t.adaptive.declining : trend === "none" ? "" : t.adaptive.stable;
  const stripColor = (score: number) => score > 60 ? COLORS.red : score > 40 ? COLORS.yellow : COLORS.green;

  const toggleSection = (subjectId: string, sectionId: string) => {
    const key = `${subjectId}:${sectionId}`;
    if (!expandedSection[key] && !subtopicCache[key]) {
      const stats = calcSubtopicStats(subjectId, sectionId, hist);
      if (stats) setSubtopicCache(p => ({ ...p, [key]: stats }));
      else return; // no subtopics to show
    }
    setExpandedSection(p => ({ ...p, [key]: !p[key] }));
  };

  const renderTopics = (subjectId: string) => {
    const stats = topicCache[subjectId];
    if (!stats) return null;
    return (
      <div style={{ paddingLeft: 50, paddingTop: 6, paddingBottom: 6 }}>
        {stats.map(ts => {
          const key = `${subjectId}:${ts.id}`;
          const hasSubtopics = calcSubtopicStats(subjectId, ts.id, hist) !== null;
          const isSectionOpen = expandedSection[key];
          const stStats = subtopicCache[key];
          return (
            <div key={ts.id}>
              <div
                role={hasSubtopics ? "button" : undefined}
                tabIndex={hasSubtopics ? 0 : undefined}
                aria-expanded={hasSubtopics ? !!isSectionOpen : undefined}
                onKeyDown={hasSubtopics ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(subjectId, ts.id); } }) : undefined}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, cursor: hasSubtopics ? "pointer" : "default" }}
                onClick={() => hasSubtopics && toggleSection(subjectId, ts.id)}
              >

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: "var(--text-body)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isKk && ts.name_kk ? ts.name_kk : ts.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FF.mono, color: ts.pct < 0 ? "var(--text-muted)" : scoreColor(ts.pct), flexShrink: 0, marginLeft: 6 }}>
                      {ts.pct < 0 ? "—" : ts.pct + "%"}
                    </span>
                  </div>
                  <div style={{ height: 3, background: "var(--bg-subtle-2)", borderRadius: 2 }}>
                    {ts.pct >= 0 && <div style={{ height: "100%", width: ts.pct + "%", background: scoreColor(ts.pct), borderRadius: 2, transition: "width 0.3s" }} />}
                  </div>
                </div>
                {ts.weak && <AlertTriangle size={12} color={COLORS.red} style={{ flexShrink: 0 }} />}
                {hasSubtopics && (
                  <ChevronDown size={12} color="var(--text-muted)" style={{ flexShrink: 0, transition: "transform 0.2s", transform: isSectionOpen ? "rotate(180deg)" : "rotate(0)" }} />
                )}
              </div>
              {isSectionOpen && stStats && (
                <div style={{ paddingLeft: 30, paddingBottom: 4 }}>
                  {stStats.map(st => (
                    <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 4, height: 4, borderRadius: 2, background: "var(--text-muted)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isKk && st.name_kk ? st.name_kk : st.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FF.mono, color: st.pct < 0 ? "var(--text-muted)" : scoreColor(st.pct), flexShrink: 0, marginLeft: 4 }}>
                            {st.pct < 0 ? "—" : st.pct + "%"}
                          </span>
                        </div>
                        <div style={{ height: 2, background: "var(--bg-subtle-2)", borderRadius: 1 }}>
                          {st.pct >= 0 && <div style={{ height: "100%", width: st.pct + "%", background: scoreColor(st.pct), borderRadius: 1, transition: "width 0.3s" }} />}
                        </div>
                      </div>
                      {st.weak && <AlertTriangle size={10} color={COLORS.red} style={{ flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const SubjectCard = ({ s, showExpand }: { s: SubjectAnalysis; showExpand: boolean }) => {
    const canExpand = showExpand && s.id !== "reading";
    const isOpen = expanded[s.id];
    const subjectName = (t.subjects as Record<string, string>)[s.id] || s.name;
    return (
      <div key={s.id} style={{ ...CARD_COMPACT, borderLeft: `4px solid ${stripColor(s.score)}`, padding: "16px 14px", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
        <div role={canExpand ? "button" : undefined} tabIndex={canExpand ? 0 : undefined} aria-expanded={canExpand ? isOpen : undefined} onKeyDown={canExpand ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.id); } }) : undefined} style={{ display: "flex", alignItems: "center", marginBottom: 10, cursor: canExpand ? "pointer" : "default" }} onClick={() => canExpand && toggle(s.id)}>
          <div style={{ width: 40, height: 40, borderRadius: R.md, background: s.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SubjectIcon sid={s.id} size={20} color={s.color} strokeWidth={2.2} /></div>
          <div style={{ marginLeft: 11, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{subjectName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              {s.count > 0 ? (
                <>
                  <span style={{ fontWeight: 700, fontFamily: FF.mono, color: scoreColor(s.avg) }}>{s.avg}%</span>
                  <span>{t.adaptive.avg}</span>
                  {s.trend !== "none" && <><TrendIcon trend={s.trend} /><span style={{ color: s.trend === "improving" ? COLORS.green : s.trend === "declining" ? COLORS.red : "var(--text-secondary)" }}>{trendLabel(s.trend)}</span></>}
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>{t.adaptive.noDataShort}</span>
              )}
            </div>
          </div>
          {canExpand && (
            <ChevronDown size={16} color="var(--text-muted)" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)", flexShrink: 0, marginLeft: 6 }} />
          )}
        </div>
        {canExpand && isOpen && renderTopics(s.id)}
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, paddingLeft: 50 }}>{s.message}</div>
        <button
          onClick={() => nav("test", s.id)}
          style={{ marginLeft: 50, background: s.color + "18", border: `1px solid ${s.color}33`, borderRadius: R.md, padding: "9px 18px", color: s.color, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 5 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = s.color + "28"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = s.color + "18"; }}
        >
          {t.adaptive.startTest} <ChevronRight size={14} />
        </button>
      </div>
    );
  };

  // ── Week-view study plan ─────────────────────────────────────────────────
  const ctaStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: SP.sm,
    background: COLORS.streak, color: '#fff',
    border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)',
    borderRadius: R.md, padding: `${SP.md}px ${SP.xl}px`,
    fontSize: FS.md, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer',
  };

  const checkboxStyle = (done: boolean): React.CSSProperties => ({
    width: 24, height: 24, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: R.sm, border: '2px solid var(--ink)',
    background: done ? COLORS.win : 'var(--bg-card)',
    cursor: 'pointer', padding: 0,
  });

  // Quiet, unified Start button (no bright fill) — subject colour lives only in the
  // Play-icon tint + the card's left border, so the screen keeps one bright splash.
  const startBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: SP.xs, flexShrink: 0,
    background: 'var(--bg-card)', color: 'var(--text)',
    border: '2px solid var(--ink)', boxShadow: '0 2px 0 0 var(--ink)',
    borderRadius: R.sm, padding: `${SP.sm}px ${SP.md}px`,
    fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer',
  };

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 40, height: 40, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: R.sm, border: '2px solid var(--ink)', background: 'var(--bg-card)',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer', padding: 0,
  });

  // Normal (unlocked) task card — subject accent on the left border, quiet Start button.
  const renderTaskRow = (task: StudyTask) => {
    const done = !!planSnap?.completion[task.id]?.done;
    const accent = rowAccent(task);
    return (
      <div key={task.id} style={{ ...CARD_COMPACT, marginBottom: SP.sm, borderLeft: `4px solid ${accent}`, display: 'flex', alignItems: 'center', gap: SP.md }}>
        <button onClick={() => handleToggle(task.id)} aria-label={t.study_plan.done} style={checkboxStyle(done)}>
          {done && <Check size={ICON.sm} color="#fff" strokeWidth={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...TYPE.body, fontSize: FS.lg, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.3 }}>{taskTitle(task)}</div>
          <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginTop: 2 }}>{taskMeta(task)}</div>
        </div>
        {hasStart(task) && !done && (
          <button onClick={() => handleStart(task)} style={startBtnStyle}>
            <Play size={ICON.sm} color={accent} fill={accent} /> {t.study_plan.start}
          </button>
        )}
      </div>
    );
  };

  // Locked challenge teaser inside a FREE week (1–2) — clean row, no blur, taps to paywall.
  const renderLockedChallenge = (task: StudyTask) => (
    <div
      key={task.id}
      role="button"
      tabIndex={0}
      onClick={() => openLock('challenge')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLock('challenge'); } }}
      style={{ ...CARD_COMPACT, marginBottom: SP.sm, borderLeft: `4px solid ${COLORS.purple}`, display: 'flex', alignItems: 'center', gap: SP.md, cursor: 'pointer' }}
    >
      <Lock size={ICON.sm} color={COLORS.purple} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...TYPE.body, fontSize: FS.lg, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{taskTitle(task)}</div>
        <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginTop: 2 }}>{t.study_plan.proLock.challenge}</div>
      </div>
      <span style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: 700, fontFamily: FF.mono, color: COLORS.purple, border: `1.5px solid ${COLORS.purple}`, borderRadius: R.sm, padding: '1px 6px' }}>PRO</span>
    </div>
  );

  // Whole locked premium week (week >= 3, free user) — one clean card, not N blurred rows.
  const renderPremiumWeek = (week: StudyWeek) => {
    const count = week.tasks.filter(tk => tk.type !== 'tip').length;
    const subs = Array.from(new Set(week.tasks.map(tk => tk.subject).filter((s): s is string => !!s)))
      .slice(0, 4)
      .map(id => subjectName(id))
      .filter(Boolean)
      .join(', ');
    return (
      <div style={{ ...CARD_COMPACT, borderLeft: `4px solid ${COLORS.purple}`, textAlign: 'center', padding: `${SP.xl}px ${SP.lg}px` }}>
        <Lock size={28} color={COLORS.purple} style={{ marginBottom: SP.sm }} />
        <div style={{ ...TYPE.h3, marginBottom: SP.xs }}>{t.study_plan.proLock.week3Plus}</div>
        <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.lg, lineHeight: 1.45 }}>
          {count} {t.study_plan.tasksGen}{subs ? ` · ${subs}` : ''}
        </div>
        <button onClick={() => openLock('week3Plus')} style={{ display: 'inline-flex', alignItems: 'center', gap: SP.xs, background: COLORS.purple, color: '#fff', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)', borderRadius: R.md, padding: `${SP.md}px ${SP.xl}px`, fontSize: FS.md, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer' }}>
          {t.study_plan.proLock.unlock}
        </button>
      </div>
    );
  };

  // AI tip task (phase 4): display-only — no checkbox, no Start button, muted.
  const renderTipRow = (task: StudyTask) => (
    <div key={task.id} style={{ ...CARD_COMPACT, marginBottom: SP.sm, display: 'flex', alignItems: 'center', gap: SP.md, background: 'var(--bg-subtle)' }}>
      <Lightbulb size={ICON.sm} color={COLORS.streak} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, ...TYPE.body, fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, lineHeight: 1.35 }}>{task.title}</div>
    </div>
  );

  const renderWeekView = () => {
    if (!planSnap) return null;
    const weeks = planSnap.plan.weeks;
    const idx = Math.min(Math.max(weekIdx ?? defaultWeekIndex(weeks, todayISO()), 0), weeks.length - 1);
    const week = weeks[idx];
    const weekTasks = week.tasks;
    // Premium tasks a free user cannot toggle — and display-only `tip` tasks —
    // are excluded from the progress denominator, so weekly progress can still
    // reach 100% (otherwise the always-premium challenge or AI tips would cap it).
    const countableTasks = weekTasks.filter(tk => tk.type !== 'tip' && (isPremium || !tk.premium));
    const doneCount = countableTasks.filter(tk => planSnap.completion[tk.id]?.done).length;
    const pct = countableTasks.length ? Math.round((doneCount / countableTasks.length) * 100) : 0;
    // Whole week behind Premium for a free user → show one clean lock card, not a list.
    const weekLocked = week.premium && !isPremium;

    // Group tasks by day (ISO date), ascending.
    const byDay: { date: string; tasks: StudyTask[] }[] = [];
    for (const tk of weekTasks) {
      let g = byDay.find(x => x.date === tk.date);
      if (!g) { g = { date: tk.date, tasks: [] }; byDay.push(g); }
      g.tasks.push(tk);
    }
    byDay.sort((a, b) => (a.date < b.date ? -1 : 1));

    return (
      <div style={{ marginBottom: SP.xxl }}>
        {/* Header: eyebrow + regenerate */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md }}>
          <div style={TYPE.eyebrow}>{t.study_plan.myPlan}</div>
          <button onClick={() => openSurvey('regen')} style={{ display: 'inline-flex', alignItems: 'center', gap: SP.xs, background: 'none', border: 'none', color: COLORS.streak, fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer', padding: 0 }}>
            <RefreshCw size={ICON.sm} /> {t.study_plan.regeneratePlan}
          </button>
        </div>

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, marginBottom: SP.md }}>
          <button onClick={() => idx > 0 && setWeekIdx(idx - 1)} disabled={idx === 0} aria-label={t.study_plan.weekLabel} style={navBtnStyle(idx === 0)}>
            <ChevronLeft size={ICON.lg} />
          </button>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ ...TYPE.h3, fontSize: FS.xxl }}>{t.study_plan.weekLabel} {week.weekNum} {t.study_plan.weekOf} {weeks.length}</div>
            <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body }}>{fmtRange(week.startDate, week.endDate)}</div>
          </div>
          <button onClick={() => idx < weeks.length - 1 && setWeekIdx(idx + 1)} disabled={idx === weeks.length - 1} aria-label={t.study_plan.weekLabel} style={navBtnStyle(idx === weeks.length - 1)}>
            <ChevronRight size={ICON.lg} />
          </button>
        </div>

        {/* Progress this week — hidden for a fully-locked premium week (nothing to track yet) */}
        {!weekLocked && (
          <div style={{ marginBottom: SP.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.xs }}>
              <span style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body }}>{t.study_plan.progressThisWeek}</span>
              <span style={{ fontSize: FS.base, fontWeight: 700, fontFamily: FF.mono, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: R.pill, background: 'var(--bg-subtle)', border: '1px solid var(--ink)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: COLORS.win, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
          </div>
        )}

        {/* AI weekly focus (phase 4) — readonly callout, fills in when AI returns */}
        {week.focus && (
          <div aria-label={t.study_plan.weekFocus} style={{ display: 'flex', alignItems: 'flex-start', gap: SP.sm, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: R.md, padding: `${SP.md}px ${SP.md}px`, marginBottom: SP.lg }}>
            <Lightbulb size={ICON.sm} color={COLORS.streak} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, lineHeight: 1.45 }}>{week.focus}</div>
          </div>
        )}

        {/* Locked premium week → one clean card; otherwise the day-grouped task list */}
        {weekLocked ? (
          renderPremiumWeek(week)
        ) : (
          byDay.map((g, di) => (
            <div key={g.date}>
              <div style={{ fontSize: FS.base, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: FF.body, textTransform: 'capitalize', margin: `${SP.md}px 0 ${SP.sm}px`, paddingTop: di === 0 ? 0 : SP.sm, borderTop: di === 0 ? 'none' : '1px solid var(--border)' }}>{fmtDay(g.date)}</div>
              {g.tasks.map(task => {
                if (task.type === 'tip') return renderTipRow(task);
                // In a free week (1–2) only the challenge is premium → clean teaser row.
                if (!isPremium && task.premium) return renderLockedChallenge(task);
                return renderTaskRow(task);
              })}
            </div>
          ))
        )}
      </div>
    );
  };

  const renderPlanSection = () => {
    // Visible to everyone (even logged-out / no history) — access is gated at
    // create time (login) and per-week (premium), not by hiding the whole section.
    if (!planSnap) {
      return (
        <div style={{ ...CARD_HERO, marginBottom: SP.xxl, textAlign: 'center' }}>
          <Sparkles size={28} color={COLORS.streak} style={{ marginBottom: SP.sm }} />
          <div style={{ ...TYPE.h3, marginBottom: SP.xs }}>{t.study_plan.empty}</div>
          <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.lg, lineHeight: 1.5 }}>{t.study_plan.createPlanDesc}</div>
          <button onClick={() => openSurvey('create')} style={ctaStyle}>
            <Sparkles size={ICON.sm} /> {t.study_plan.createPlan}
          </button>
        </div>
      );
    }
    return renderWeekView();
  };

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <div style={{ ...CARD_HERO, marginBottom: 28 }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,107,53,0.12)", filter: "blur(25px)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={TYPE.label}>{t.adaptive.title}</div>
          <h1 style={{ ...TYPE.h1, fontSize: 22, margin: "6px 0 10px" }}>{t.adaptive.subtitle}</h1>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: totalTests > 0 ? COLORS.accent : "var(--text-muted)", fontFamily: FF.display }}>{totalTests > 0 ? overall + "%" : "—"}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.adaptive.avgScore}</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.teal, fontFamily: FF.display }}>{totalTests}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.adaptive.testsLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {renderPlanSection()}

      {hasQd && (
        <div role="button" tabIndex={0} onClick={() => nav("errors")} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav("errors"); } }} style={{ ...CARD_COMPACT, border: "1px solid rgba(239,68,68,0.18)", padding: "16px 16px", marginBottom: 28, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.18)"; }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <XCircle size={22} color={COLORS.red} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.adaptive.errorReview}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {wrongCount > 0 ? `${wrongCount} ${wrongCount === 1 ? t.adaptive.error1 : wrongCount < 5 ? t.adaptive.error2 : t.adaptive.error5} ${t.adaptive.errorsForReview}` : t.adaptive.reviewErrors}
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </div>
      )}

      {weak.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: 1.2, margin: "0 0 10px" }}>{t.adaptive.needsAttention}</div>
          <div style={{ display: "grid", gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            {weak.map(s => <SubjectCard key={s.id} s={s} showExpand={hasQd} />)}
          </div>
        </>
      )}

      {strong.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: 1.2, margin: "28px 0 10px" }}>{t.adaptive.strengths}</div>
          <div style={{ display: "grid", gridTemplateColumns: bp === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
          {strong.map(s => (
            <div key={s.id} style={{ ...CARD_COMPACT, display: "flex", alignItems: "center", borderLeft: `4px solid ${COLORS.green}`, padding: "14px 14px", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
              <div style={{ width: 32, height: 32, borderRadius: R.sm, marginRight: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.color + "15" }}><SubjectIcon sid={s.id} size={17} color={s.color} strokeWidth={2.2} /></div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{(t.subjects as Record<string, string>)[s.id] || s.name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FF.mono, color: COLORS.green }}>{s.avg}%</div>
              {s.trend !== "none" && <span style={{ marginLeft: 6 }}><TrendIcon trend={s.trend} /></span>}
            </div>
          ))}
          </div>
        </>
      )}

      {totalTests === 0 && (
        <EmptyState
          icon={FileText}
          title={t.adaptive.noData}
          description={t.adaptive.noDataDesc}
          style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.15)", marginTop: 10 }}
          action={
            <button onClick={() => nav("home")} style={{ marginTop: 16, background: COLORS.accent, border: "none", borderRadius: R.md, padding: "11px 22px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {t.adaptive.toSubjects} <ChevronRight size={14} />
            </button>
          }
        />
      )}

      {/* Plan-setup survey — student picks exam date (duration) + density (also the create/regen gate) */}
      {workloadOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: SP.xl }}>
          <div ref={pickerDlgRef} role="dialog" aria-modal="true" aria-label={t.study_plan.setupTitle} tabIndex={-1} style={{ background: 'var(--bg-card)', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)', borderRadius: R.lg, padding: `${SP.xl}px ${SP.xl}px`, maxWidth: 380, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <h2 style={{ ...TYPE.h3, margin: `0 0 ${SP.xs}px`, textAlign: 'center' }}>{t.study_plan.setupTitle}</h2>
            <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.lg, lineHeight: 1.45, textAlign: 'center' }}>{t.study_plan.setupDesc}</div>
            {workloadOpen === 'regen' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: SP.xs, fontSize: FS.base, color: COLORS.redText, fontFamily: FF.body, marginBottom: SP.md, lineHeight: 1.4 }}>
                <AlertTriangle size={ICON.sm} color={COLORS.red} style={{ flexShrink: 0, marginTop: 1 }} /> {t.study_plan.regenerateConfirmDesc}
              </div>
            )}

            {/* Duration — quick month chips + exact date */}
            <div style={{ ...TYPE.eyebrow, marginBottom: SP.sm }}>{t.study_plan.whenExam}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.md }}>
              {MONTH_OPTIONS.map(n => {
                const active = monthsSel === n;
                return (
                  <button key={n} onClick={() => pickMonths(n)} aria-pressed={active} style={{ flex: '1 1 0', minWidth: 64, padding: `${SP.sm}px ${SP.xs}px`, borderRadius: R.md, border: active ? `2px solid ${COLORS.streak}` : '2px solid var(--ink)', boxShadow: '0 2px 0 0 var(--ink)', background: active ? COLORS.streak + '28' : 'var(--bg-card)', color: 'var(--text)', fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer' }}>
                    {n} {t.study_plan.monthsShort}
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'block', fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.xs }}>{t.study_plan.orExactDate}</label>
            <input
              type="date"
              value={dateSel}
              min={todayISO()}
              onChange={e => { setDateSel(e.target.value); setMonthsSel(null); }}
              aria-label={t.study_plan.orExactDate}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: `${SP.sm}px ${SP.md}px`, marginBottom: SP.lg, background: 'var(--bg-subtle-2)', border: '2px solid var(--ink)', borderRadius: R.md, color: 'var(--text)', fontSize: FS.lg, fontFamily: FF.body, colorScheme: 'var(--color-scheme)', WebkitAppearance: 'none', appearance: 'none' }}
            />

            {/* Workload — density */}
            <div style={{ ...TYPE.eyebrow, marginBottom: SP.sm }}>{t.study_plan.workloadLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, marginBottom: SP.lg }}>
              {(['light', 'medium', 'intense'] as StudyWorkload[]).map(key => {
                const lvl = (t.study_plan.workload as Record<string, { label: string; desc: string }>)[key];
                const active = workloadSel === key;
                return (
                  <button key={key} onClick={() => setWorkloadSel(key)} aria-pressed={active} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, textAlign: 'left', background: active ? COLORS.streak + '28' : 'var(--bg-card)', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)', borderRadius: R.md, padding: `${SP.md}px ${SP.lg}px`, cursor: 'pointer', fontFamily: FF.body }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: FS.lg, fontWeight: 700, color: 'var(--text)' }}>{lvl.label}</span>
                      <span style={{ display: 'block', fontSize: FS.base, color: 'var(--text-secondary)' }}>{lvl.desc}</span>
                    </span>
                    {active && <Check size={ICON.md} color={COLORS.win} strokeWidth={3} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            <button onClick={submitSurvey} style={{ ...ctaStyle, width: '100%', justifyContent: 'center', marginBottom: SP.sm }}>
              <Sparkles size={ICON.sm} /> {t.study_plan.createPlan}
            </button>
            <button onClick={() => setWorkloadOpen(false)} style={{ width: '100%', padding: `${SP.md}px 0`, borderRadius: R.md, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: FS.lg, fontWeight: 600, fontFamily: FF.body, cursor: 'pointer' }}>
              {t.study_plan.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

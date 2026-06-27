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
import EmptyState from './ui/EmptyState';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, FileText, XCircle, Sparkles, RefreshCw, Lock, Check, Play } from 'lucide-react';
import type { TopicStats, StudyTask, StudyWeek, StudyPlanTopicRef } from '../types';

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
  const { hist, prof, st, plan: planSnap, setPlanSnapshot } = useApp();
  const { isPremium } = useAuth();
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

  // Regenerate guard: confirm before wiping completion progress.
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const regenDlgRef = useRef<HTMLDivElement>(null);
  useFocusTrap(regenDlgRef, showRegenConfirm, () => setShowRegenConfirm(false));

  // ── Plan generation ──────────────────────────────────────────────────────
  const buildWeakTopics = (): StudyPlanTopicRef[] =>
    weak.map(s => {
      const ts = calcTopicStats(s.id, hist);
      const weakest = ts ? ts.filter(x => x.pct >= 0).sort((a, b) => a.pct - b.pct)[0] : undefined;
      return { id: s.id, topic: weakest?.id, name: s.name, score: s.score };
    });

  const buildStrongTopics = (): StudyPlanTopicRef[] =>
    strong.map(s => ({ id: s.id, name: s.name, score: s.score }));

  const handleGenerate = () => {
    const examDate = st.goal?.date || getUpcomingPeriods()[0]?.examStart || '';
    if (!examDate) { toast.warning(t.study_plan.noGoal); return; }
    const seed = new Date().toISOString();
    const next = generateStudyPlan({
      examDate,
      target: st.goal?.target || 122,
      profileSubjects: prof,
      weakTopics: buildWeakTopics(),
      strongTopics: buildStrongTopics(),
      today: todayISO(),
      seed,
    });
    if (!next) { toast.error(t.study_plan.planError); return; }
    setPlanSnapshot({ plan: next, completion: {}, updatedAt: seed });
    setWeekIdx(defaultWeekIndex(next.weeks, todayISO()));
    trackEvent('Study Plan Created', { weeks: next.weeksCount, target: next.target });
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

  const startBtnStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: SP.xs, flexShrink: 0,
    background: color, color: '#fff',
    border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)',
    borderRadius: R.sm, padding: `${SP.sm}px ${SP.md}px`,
    fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer',
  });

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 40, height: 40, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: R.sm, border: '2px solid var(--ink)', background: 'var(--bg-card)',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer', padding: 0,
  });

  const renderTaskRow = (task: StudyTask, locked: boolean, showCta: boolean, lockReason: 'week3Plus' | 'challenge') => {
    const done = !!planSnap?.completion[task.id]?.done;
    const color = subjColor(task.subject);
    const inner = (
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, ...(locked ? { filter: 'blur(3px)', opacity: 0.6, pointerEvents: 'none' as const, userSelect: 'none' as const } : {}) }}>
        <button onClick={() => handleToggle(task.id)} disabled={locked} aria-label={t.study_plan.done} style={checkboxStyle(done)}>
          {done && <Check size={ICON.sm} color="#fff" strokeWidth={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...TYPE.body, fontSize: FS.lg, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.3 }}>{taskTitle(task)}</div>
          <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginTop: 2 }}>{taskMeta(task)}</div>
        </div>
        {hasStart(task) && !done && (
          <button onClick={() => handleStart(task)} style={startBtnStyle(color)}>
            <Play size={ICON.sm} fill="#fff" /> {t.study_plan.start}
          </button>
        )}
      </div>
    );
    if (!locked) {
      return <div key={task.id} style={{ ...CARD_COMPACT, marginBottom: SP.sm }}>{inner}</div>;
    }
    return (
      <div key={task.id} style={{ ...CARD_COMPACT, marginBottom: SP.sm, position: 'relative', overflow: 'hidden' }}>
        {inner}
        {showCta ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.sm, padding: SP.md, background: 'var(--bg-card)', borderRadius: R.md }}>
            <Lock size={28} color={COLORS.purple} />
            <div style={{ ...TYPE.body, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{t.study_plan.proLock[lockReason]}</div>
            <button onClick={() => openLock(lockReason)} style={{ display: 'inline-flex', alignItems: 'center', gap: SP.xs, background: COLORS.purple, color: '#fff', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)', borderRadius: R.sm, padding: `${SP.sm}px ${SP.lg}px`, fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer' }}>
              {t.study_plan.proLock.unlock}
            </button>
          </div>
        ) : (
          <div style={{ position: 'absolute', top: SP.sm, right: SP.sm, display: 'inline-flex', alignItems: 'center', gap: 3, color: COLORS.purple }}>
            <Lock size={ICON.sm} />
            <span style={{ fontSize: FS.xs, fontWeight: 700, fontFamily: FF.mono }}>PRO</span>
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    if (!planSnap) return null;
    const weeks = planSnap.plan.weeks;
    const idx = Math.min(Math.max(weekIdx ?? defaultWeekIndex(weeks, todayISO()), 0), weeks.length - 1);
    const week = weeks[idx];
    const weekTasks = week.tasks;
    // Premium tasks a free user cannot toggle are excluded from the progress
    // denominator, so weekly progress can still reach 100% (otherwise the
    // always-premium challenge would cap it at (n-1)/n).
    const countableTasks = weekTasks.filter(tk => isPremium || !tk.premium);
    const doneCount = countableTasks.filter(tk => planSnap.completion[tk.id]?.done).length;
    const pct = countableTasks.length ? Math.round((doneCount / countableTasks.length) * 100) : 0;
    const firstLockId = weekTasks.find(tk => !isPremium && tk.premium)?.id;
    const lockReason: 'week3Plus' | 'challenge' = week.premium ? 'week3Plus' : 'challenge';

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
          <button onClick={() => setShowRegenConfirm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: SP.xs, background: 'none', border: 'none', color: COLORS.streak, fontSize: FS.base, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer', padding: 0 }}>
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

        {/* Progress this week */}
        <div style={{ marginBottom: SP.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.xs }}>
            <span style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body }}>{t.study_plan.progressThisWeek}</span>
            <span style={{ fontSize: FS.base, fontWeight: 700, fontFamily: FF.mono, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: R.pill, background: 'var(--bg-subtle)', border: '1px solid var(--ink)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: COLORS.win, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>

        {/* Day-grouped task list */}
        {byDay.map((g, di) => (
          <div key={g.date}>
            <div style={{ fontSize: FS.base, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: FF.body, textTransform: 'capitalize', margin: `${SP.md}px 0 ${SP.sm}px`, paddingTop: di === 0 ? 0 : SP.sm, borderTop: di === 0 ? 'none' : '1px solid var(--border)' }}>{fmtDay(g.date)}</div>
            {g.tasks.map(task => {
              const locked = !isPremium && task.premium;
              return renderTaskRow(task, locked, locked && task.id === firstLockId, lockReason);
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderPlanSection = () => {
    if (totalTests === 0) return null;
    if (!planSnap) {
      return (
        <div style={{ ...CARD_HERO, marginBottom: SP.xxl, textAlign: 'center' }}>
          <Sparkles size={28} color={COLORS.streak} style={{ marginBottom: SP.sm }} />
          <div style={{ ...TYPE.h3, marginBottom: SP.xs }}>{t.study_plan.empty}</div>
          <div style={{ fontSize: FS.base, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.lg, lineHeight: 1.5 }}>{t.study_plan.createPlanDesc}</div>
          <button onClick={handleGenerate} style={ctaStyle}>
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

      {/* Regenerate confirm — wiping completion progress is destructive */}
      {showRegenConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: SP.xl }}>
          <div ref={regenDlgRef} role="dialog" aria-modal="true" aria-label={t.study_plan.regenerateConfirm} tabIndex={-1} style={{ background: 'var(--bg-card)', border: '2px solid var(--ink)', boxShadow: '0 3px 0 0 var(--ink)', borderRadius: R.lg, padding: `${SP.xxl}px ${SP.xl}px`, maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <h2 style={{ ...TYPE.h3, margin: `0 0 ${SP.xs}px` }}>{t.study_plan.regenerateConfirm}</h2>
            <div style={{ fontSize: FS.md, color: 'var(--text-secondary)', fontFamily: FF.body, marginBottom: SP.xl, lineHeight: 1.5 }}>{t.study_plan.regenerateConfirmDesc}</div>
            <div style={{ display: 'flex', gap: SP.sm }}>
              <button onClick={() => setShowRegenConfirm(false)} style={{ flex: 1, padding: `${SP.md}px 0`, borderRadius: R.md, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: FS.lg, fontWeight: 600, fontFamily: FF.body, cursor: 'pointer' }}>
                {t.study_plan.cancel}
              </button>
              <button onClick={() => { setShowRegenConfirm(false); handleGenerate(); }} style={{ flex: 1, padding: `${SP.md}px 0`, borderRadius: R.md, border: '2px solid var(--ink)', background: COLORS.streak, color: '#fff', fontSize: FS.lg, fontWeight: 700, fontFamily: FF.body, cursor: 'pointer' }}>
                {t.study_plan.regeneratePlan}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

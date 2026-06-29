import { useState, useEffect } from "react";
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { TOPIC_MAP, getTopicCount } from '../config/topics';
import { CARD_COMPACT, TYPE, COLORS, scoreColor, FF, FS, R } from '../constants/styles';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { getPool, getPoolSize } from '../utils/questionStore';
import { assembleProfileSection } from '../utils/questionAssembler';
import { PROFILE_BLOCKS } from '../config/ent';
import { useT } from '../locales';
import BackButton from './ui/BackButton';
import SubjectAnalytics from './SubjectAnalytics';
import SkeletonCard from './ui/SkeletonCard';
import { ChevronRight, ChevronDown, Play, GraduationCap, BookOpen } from 'lucide-react';
import TheorySummary from './TheorySummary';
import SubjectIcon from './ui/SubjectIcon';
import type { ProfileSubject, Question } from '../types';
import { captureError } from '../config/sentry';

interface SubjectDetailProps {
  sid: string;
}

export default function SubjectDetail({ sid }: SubjectDetailProps) {
  const { nav, goHome, setCustomQs, setCurSub, setScreen } = useNav();
  const { hist, st: settings } = useApp();
  const isKk = settings.lang === 'kk';
  const t = useT();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const sub = SUBS[sid] || ALL_PROFILES.find(p => p.id === sid);
  const profileSub = ALL_PROFILES.find(p => p.id === sid) as ProfileSubject | undefined;
  const hasExamMode = !!profileSub?.examCnt;
  const [examLoading, setExamLoading] = useState(false);
  const topics = TOPIC_MAP[sid];

  const [poolSize, setPoolSize] = useState(() => getPoolSize(sid) || sub.pool);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [subtopicCounts, setSubtopicCounts] = useState<Record<string, number>>({});
  const [hasSubtopics, setHasSubtopics] = useState(false);
  // True once counts come from a DB-backed source (meta file or a pool that carries
  // `_topic`). When true, a known section absent from topicCounts genuinely has 0
  // questions and must render 0 — not the static range estimate (getTopicCount).
  const [hasDbCounts, setHasDbCounts] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [showTheory, setShowTheory] = useState(false);

  useEffect(() => {
    if (!topics) return;
    setPoolLoading(true);
    let cancelled = false;

    // Counts derived from the full pool — the previous (pre-meta) behaviour, kept as the
    // fallback when the tiny meta file is unavailable.
    const fromPool = (pool: Question[]) => {
      setPoolSize(pool.length);
      const hasDbTopics = pool.some(q => q._topic);
      setHasDbCounts(hasDbTopics);
      if (hasDbTopics) {
        const counts: Record<string, number> = {};
        for (const tp of topics) {
          counts[tp.id] = pool.filter(q => q._topic === tp.id).length;
        }
        setTopicCounts(counts);
      }
      const hasStp = pool.some(q => q._subtopic);
      setHasSubtopics(hasStp);
      if (hasStp) {
        const stCounts: Record<string, number> = {};
        for (const q of pool) {
          if (q._subtopic) stCounts[q._subtopic] = (stCounts[q._subtopic] || 0) + 1;
        }
        setSubtopicCounts(stCounts);
      }
      setPoolLoading(false);
    };

    // PERF-1: read the tiny <sid>.meta.json (post-quarantine counts) instead of downloading
    // and parsing the entire multi-MB subject pool just to render topic counts + Start. The
    // full pool is fetched lazily only when a test actually starts (getQs / assembleProfileSection).
    const cdnSid = sid === 'literature' ? 'literature_russian' : sid;
    (async () => {
      try {
        const resp = await fetch(`/data/${cdnSid}.meta.json`);
        if (!resp.ok) throw new Error(`meta ${resp.status}`);
        const meta: {
          total: number; hasSubtopics: boolean;
          topicCounts: Record<string, number>; subtopicCounts: Record<string, number>;
        } = await resp.json();
        if (cancelled) return;
        setPoolSize(meta.total);
        setTopicCounts(meta.topicCounts || {});
        setHasDbCounts(true);
        setHasSubtopics(!!meta.hasSubtopics);
        setSubtopicCounts(meta.subtopicCounts || {});
        setPoolLoading(false);
      } catch (err) {
        // Meta missing/unreadable → fall back to deriving counts from the full pool.
        captureError(err, { context: 'SubjectDetail.meta', sid });
        try {
          const pool = await getPool(sid);
          if (cancelled) return;
          fromPool(pool);
        } catch (err2) {
          if (cancelled) return;
          captureError(err2, { context: 'SubjectDetail.getPool', sid });
          setPoolLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [sid, topics]);

  const startExam = async () => {
    if (examLoading) return;
    setExamLoading(true);
    try {
      const qs = await assembleProfileSection(sid, PROFILE_BLOCKS, true, settings.lang);
      if (qs.length > 0) {
        setCustomQs(qs);
        setCurSub(sid);
        setScreen('test');
      }
    } finally {
      setExamLoading(false);
    }
  };

  if (!topics) { nav("test", sid); return null; }

  const subHist = hist.filter(t => t.su === sid);
  const lastFull = subHist.filter(t => !t.tp);
  const lastFullSc = lastFull.length ? lastFull[lastFull.length - 1].sc : null;

  const toggleSection = (tpId: string) => {
    setExpanded(prev => prev === tpId ? null : tpId);
  };

  const totalSubtopics = topics.reduce((sum, tp) => sum + (tp.subtopics?.length || 0), 0);

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <BackButton onClick={goHome} style={{ marginBottom: 14 }} />

      {/* Subject header — neutral ink chip + Unbounded title + mono stats */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20, gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: R.lg,
          background: `${sub.color}2E`,
          border: `2px solid var(--ink)`,
          boxShadow: `0 3px 0 0 var(--ink)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <SubjectIcon sid={sub.id} size={28} color="var(--ink)" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FF.display,
            fontSize: 22, fontWeight: 900,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}>{(t.subjects as Record<string, string>)[sid] || sub.name}</div>
          <div style={{
            fontFamily: FF.mono,
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginTop: 4,
          }}>
            {poolSize} {t.questions} · {topics.length} {t.subjectDetail.sections}
            {hasSubtopics && totalSubtopics > topics.length && ` · ${totalSubtopics} ${t.subjectDetail.topics}`}
          </div>
        </div>
      </div>

      {/* Action cards — unified v2 ink-bordered */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {/* Full test */}
        <ActionRow
          icon={<Play size={18} color="#fff" strokeWidth={2.5} fill="#fff" />}
          iconBg={COLORS.streak}
          title={t.subjectDetail.fullTest}
          desc={`${poolSize} ${t.subjectDetail.randomFromAll}`}
          score={lastFullSc}
          onClick={() => nav("test", sid, null)}
        />

        {/* Exam mode */}
        {hasExamMode && (
          <ActionRow
            icon={<GraduationCap size={18} color="#fff" strokeWidth={2.3} />}
            iconBg={COLORS.win}
            title={t.subjectDetail.examTitle}
            desc={t.subjectDetail.examDesc}
            badgeText="25+5+5+5"
            onClick={startExam}
            disabled={examLoading}
          />
        )}

        {/* Theory toggle */}
        <ActionRow
          icon={<BookOpen size={18} color="#fff" strokeWidth={2.3} />}
          iconBg="#7A5AF8"
          title={isKk ? 'Конспект' : 'Теория'}
          desc={isKk ? 'Қысқаша түсіндірме' : 'Краткие конспекты по темам'}
          chevron={<ChevronDown size={16} color="var(--text-muted)" strokeWidth={2.4} style={{ transition: "transform 0.2s", transform: showTheory ? "rotate(180deg)" : "rotate(0deg)" }} />}
          onClick={() => setShowTheory(s => !s)}
        />
      </div>

      {showTheory && (
        <div style={{ marginBottom: 18, animation: "fadeIn 0.3s ease" }}>
          <TheorySummary sid={sid} topicId="_all" />
        </div>
      )}

      {/* Topics / Sections */}
      <div style={{
        fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px',
      }}>{hasSubtopics ? t.subjectDetail.sectionsTitle : t.subjectDetail.topicsTitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poolLoading ? (
          <>
            {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}
          </>
        ) : topics.map((tp, tpIdx) => {
          // DB-backed subjects: a known section missing from topicCounts means 0 questions.
          // Static-fallback subjects (no DB counts): use the curriculum range estimate.
          const cnt = hasDbCounts ? (topicCounts[tp.id] ?? 0) : getTopicCount(tp.ranges);
          const tpHist = subHist.filter(t => t.tp === tp.id);
          const lastSc = tpHist.length ? tpHist[tpHist.length - 1].sc : null;
          const subs = tp.subtopics || [];
          const isSingleSub = subs.length <= 1;
          const isExpanded = expanded === tp.id;
          const canExpand = hasSubtopics && !isSingleSub;
          const sectionNum = String(tpIdx + 1).padStart(2, '0');

          return (
            <div key={tp.id}>
              {/* Section row — ink-bordered v2 card */}
              <div style={{
                display: "flex", alignItems: "stretch",
                width: "100%",
                background: 'var(--bg-card)',
                border: `2px solid var(--ink)`,
                borderRadius: R.lg,
                boxShadow: '0 3px 0 0 var(--ink)',
                overflow: 'hidden',
              }}>
                {/* Subject-colored side stripe */}
                <div style={{ width: 4, background: sub.color, flexShrink: 0 }} />

                {/* Main clickable area */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={canExpand ? isExpanded : undefined}
                  aria-label={isKk && tp.name_kk ? tp.name_kk : tp.name}
                  onClick={canExpand ? () => toggleSection(tp.id) : () => nav("test", sid, tp.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (canExpand) toggleSection(tp.id); else nav("test", sid, tp.id); } }}
                  style={{ display: "flex", alignItems: "center", flex: 1, cursor: "pointer", gap: 11, padding: '11px 12px', minWidth: 0 }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: R.md,
                    background: 'var(--bg-subtle)',
                    border: '1.5px solid rgba(15,15,16,0.12)',
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: FF.mono,
                    fontSize: 13, fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: sub.color,
                  }}>
                    {sectionNum}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FF.body,
                      fontSize: FS.lg, fontWeight: 800,
                      color: "var(--text)",
                      lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{isKk && tp.name_kk ? tp.name_kk : tp.name}</div>
                    <div style={{
                      fontFamily: FF.mono,
                      fontSize: 10, fontWeight: 700,
                      color: "var(--text-muted)", marginTop: 2,
                      letterSpacing: '0.04em',
                    }}>
                      {cnt} {t.questions}
                      {canExpand && ` · ${subs.length} ${t.subjectDetail.topics}`}
                    </div>
                  </div>
                  {lastSc !== null && (
                    <span style={{
                      flexShrink: 0, marginRight: 4,
                      fontFamily: FF.display,
                      fontSize: 15, fontWeight: 900,
                      letterSpacing: '-0.025em',
                      color: scoreColor(lastSc),
                      fontVariantNumeric: 'tabular-nums',
                    }}>{lastSc}<span style={{ fontSize: 10, opacity: 0.7 }}>%</span></span>
                  )}
                </div>

                {/* Play quick-start (expandable sections only) */}
                {canExpand && (
                  <button
                    onClick={e => { e.stopPropagation(); nav("test", sid, tp.id); }}
                    aria-label={t.subjectDetail.fullTest}
                    style={{
                      width: 44, alignSelf: 'stretch',
                      background: `${sub.color}18`,
                      borderLeft: `1.5px solid rgba(15,15,16,0.1)`,
                      border: 'none',
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", flexShrink: 0,
                      transition: "background 0.15s",
                    }}
                    title={isKk && tp.name_kk ? tp.name_kk : tp.name}
                  >
                    <Play size={14} color={sub.color} strokeWidth={2.5} fill={sub.color} />
                  </button>
                )}

                {/* Expand chevron — redundant control mirroring the main row action;
                    hidden from a11y tree to avoid a duplicate tab stop / announcement */}
                <div
                  aria-hidden="true"
                  onClick={canExpand ? () => toggleSection(tp.id) : () => nav("test", sid, tp.id)}
                  style={{
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: 'center',
                    flexShrink: 0,
                    width: 38, alignSelf: 'stretch',
                    borderLeft: canExpand ? '1.5px solid rgba(15,15,16,0.1)' : 'none',
                  }}
                >
                  {canExpand
                    ? <ChevronDown size={16} color={sub.color} strokeWidth={2.6} style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                    : <ChevronRight size={16} color={sub.color} strokeWidth={2.6} />
                  }
                </div>
              </div>

              {/* Subtopic rows (expanded) */}
              {canExpand && isExpanded && (
                <div style={{ marginLeft: 18, marginTop: 4, marginBottom: 2 }}>
                  {subs.map((st) => {
                    const stCnt = subtopicCounts[st.id] || 0;
                    const stHist = subHist.filter(t => t.tp === st.id);
                    const stLastSc = stHist.length ? stHist[stHist.length - 1].sc : null;
                    return (
                      <button
                        key={st.id}
                        onClick={() => nav("test", sid, st.id)}
                        disabled={stCnt === 0}
                        style={{
                          display: "flex", alignItems: "center", width: "100%",
                          padding: "9px 12px 9px 14px",
                          marginTop: 4,
                          background: 'var(--bg-card)',
                          border: '1.5px solid rgba(15,15,16,0.12)',
                          borderRadius: R.md,
                          cursor: stCnt > 0 ? "pointer" : "default",
                          textAlign: "left",
                          opacity: stCnt > 0 ? 1 : 0.45,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { if (stCnt > 0) (e.currentTarget as HTMLElement).style.borderColor = sub.color; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15,15,16,0.12)'; }}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: 4,
                          background: sub.color,
                          marginRight: 12, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: FF.body,
                            fontSize: FS.md, fontWeight: 700,
                            color: "var(--text)",
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{isKk && st.name_kk ? st.name_kk : st.name}</div>
                          <div style={{
                            fontFamily: FF.mono,
                            fontSize: FS.xs, fontWeight: 700,
                            color: "var(--text-muted)", marginTop: 2,
                            letterSpacing: '0.04em',
                          }}>
                            {stCnt > 0 ? `${stCnt} ${t.questions}` : t.subjectDetail.noQuestions}
                          </div>
                        </div>
                        {stLastSc !== null && (
                          <span style={{
                            flexShrink: 0, marginRight: 6,
                            fontFamily: FF.display,
                            fontSize: 12, fontWeight: 900,
                            color: scoreColor(stLastSc),
                            fontVariantNumeric: 'tabular-nums',
                          }}>{stLastSc}<span style={{ fontSize: 9, opacity: 0.7 }}>%</span></span>
                        )}
                        {stCnt > 0 && <ChevronRight size={13} color="var(--text-muted)" strokeWidth={2.4} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-subject analytics */}
      <SubjectAnalytics sid={sid} />
    </div>
  );
}

// ── ActionRow — unified ink-bordered v2 card with press depth ──────────
function ActionRow({
  icon, iconBg, title, desc, score, badgeText, chevron, onClick, disabled,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  score?: number | null;
  badgeText?: string;
  chevron?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: '2px solid var(--ink)',
        borderRadius: R.lg,
        cursor: disabled ? 'wait' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'transform 80ms, box-shadow 80ms',
        boxShadow: pressed ? '0 1px 0 0 var(--ink)' : '0 4px 0 0 var(--ink)',
        transform: pressed ? 'translateY(3px)' : 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        flexShrink: 0,
        width: 42, height: 42, borderRadius: 12,
        background: iconBg,
        border: `2px solid var(--ink)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FF.body,
          fontSize: 14, fontWeight: 800,
          color: 'var(--text)', lineHeight: 1.2,
        }}>{title}</div>
        <div style={{
          fontFamily: FF.body,
          fontSize: FS.base, fontWeight: 600,
          color: 'var(--text-secondary)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{desc}</div>
      </div>
      {score !== null && score !== undefined && (
        <span style={{
          fontFamily: FF.display,
          fontSize: 15, fontWeight: 900,
          letterSpacing: '-0.025em',
          color: scoreColor(score),
          fontVariantNumeric: 'tabular-nums',
        }}>{score}<span style={{ fontSize: 10, opacity: 0.7 }}>%</span></span>
      )}
      {badgeText && (
        <span style={{
          flexShrink: 0,
          fontFamily: FF.mono,
          fontSize: 9, fontWeight: 800,
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
        }}>{badgeText}</span>
      )}
      {chevron ?? <ChevronRight size={16} color="var(--text-muted)" strokeWidth={2.4} />}
    </button>
  );
}


import { useState, useEffect, useMemo } from "react";
import { SUBS, ALL_PROFILES } from '../config/questionPools';
import { resolveQuestion } from '../utils/questionStore';
import { getWrongQuestions } from '../utils/adaptiveHelpers';
import { shuffleOptions } from '../utils/questionHelpers';
import { CARD_COMPACT, CARD_HERO, TYPE, COLORS, FF, R } from '../constants/styles';
import { useApp } from '../contexts/AppContext';
import { useNav } from '../contexts/NavigationContext';
import SkeletonCard from './ui/SkeletonCard';
import BackButton from './ui/BackButton';
import { ChevronDown, Check, Lightbulb, RotateCcw, ArrowUpDown, AlertTriangle } from 'lucide-react';
import SubjectIcon from './ui/SubjectIcon';
import { SUBJECT_META } from '../config/subjects';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useT } from '../locales';
import Chip from './ui/Chip';
import Button from './ui/Button';
import type { Question, SubjectConfig } from '../types';
import { getSingleCorrect, getQType } from '../types';

function getMeta(sid: string): SubjectConfig {
  const s = SUBS[sid];
  if (s) return s;
  const p = ALL_PROFILES.find(x => x.id === sid);
  return p || { id: sid, name: sid, icon: "\ud83d\udcdd", color: "var(--text-secondary)", cnt: 0 };
}

interface WrongItem {
  su: string;
  oi: number;
}

interface ResolvedWrong extends WrongItem {
  q: Question;
}

interface GroupedSubject {
  su: string;
  meta: SubjectConfig;
  items: ResolvedWrong[];
}


export default function ErrorReview() {
  const bp = useBreakpoint(); const isDesktop = bp === 'desktop';
  const { hist, st } = useApp();
  const { navToErrorTest, setScreen, setTab } = useNav();
  const t = useT();
  const wrongs = useMemo(() => getWrongQuestions(hist), [hist]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [grouped, setGrouped] = useState<GroupedSubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortErrors, setSortErrors] = useState<"count" | "alpha">("count");

  const subjectName = (sid: string) => t.subjects[sid as keyof typeof t.subjects] || getMeta(sid).name;

  const handleBack = () => { setScreen('adaptive'); setTab('adaptive'); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m: Record<string, WrongItem[]> = {};
      for (const w of wrongs) {
        if (!m[w.su]) m[w.su] = [];
        m[w.su].push(w);
      }
      const groups: GroupedSubject[] = [];
      for (const [su, items] of Object.entries(m)) {
        const resolved = await Promise.all(
          items.map(async w => {
            const q = await resolveQuestion(w.su, w.oi, st.lang);
            return { ...w, q };
          })
        );
        const valid = resolved.filter((w): w is ResolvedWrong => w.q != null);
        if (valid.length > 0) {
          groups.push({ su, meta: getMeta(su), items: valid });
        }
      }
      if (!cancelled) { setGrouped(groups); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [wrongs]);

  if (loading) return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <div style={{ height: 18, width: 80, borderRadius: R.sm, background: 'var(--skeleton-bg)', marginBottom: 18 }} />
      {[0, 1, 2, 3].map(i => <SkeletonCard key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}
    </div>
  );

  const totalErrors = grouped!.reduce((s, g) => s + g.items.length, 0);
  const errPlural = (n: number) => n === 1 ? t.errorReview.error1 : n < 5 ? t.errorReview.error2 : t.errorReview.error5;

  const toggle = (su: string) => setExpanded(p => ({ ...p, [su]: !p[su] }));

  const startRetry = () => {
    const questions: Question[] = [];
    for (const g of grouped!) {
      for (const w of g.items) {
        questions.push({ ...w.q, _oi: w.oi });
      }
    }
    const shuffled = questions.map(q => shuffleOptions(q));
    navToErrorTest(shuffled);
  };

  if (totalErrors === 0) {
    return (
      <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <BackButton onClick={handleBack} />
        </div>
        <div style={{ ...CARD_HERO, textAlign: "center", padding: "44px 20px", border: "1px solid rgba(34,197,94,0.18)" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>{"\uD83C\uDF89"}</div>
          <div style={{ ...TYPE.h1, fontSize: 20, color: COLORS.green, marginBottom: 10 }}>{t.errorReview.noErrors}</div>
          <div style={{ ...TYPE.bodySmall }}>{t.errorReview.noErrorsDesc}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: `0 var(--content-padding) ${isDesktop ? 40 : 100}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <BackButton onClick={handleBack} />
        <div style={{
          padding: '5px 10px', borderRadius: R.pill,
          background: COLORS.streakSoft, border: `1.5px solid ${COLORS.streak}`,
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: COLORS.streak, display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <AlertTriangle size={11} strokeWidth={2.6} />{totalErrors} {errPlural(totalErrors)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: R.md,
          background: 'var(--ink)', border: '2px solid var(--ink)',
          boxShadow: '0 3px 0 0 ' + COLORS.streak,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <AlertTriangle size={20} strokeWidth={2.4} />
        </div>
        <h1 style={{
          fontFamily: FF.display, fontSize: 22, fontWeight: 900,
          letterSpacing: '-0.035em', color: 'var(--text)', margin: 0, lineHeight: 1.1,
        }}>{t.errorReview.title}</h1>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <Chip active={sortErrors === "count"} onClick={() => setSortErrors("count")} mode="subtle">
          <ArrowUpDown size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{t.errorReview.byErrors}
        </Chip>
        <Chip active={sortErrors === "alpha"} onClick={() => setSortErrors("alpha")} mode="subtle">
          <ArrowUpDown size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{t.errorReview.byAlphabet}
        </Chip>
      </div>

      {(sortErrors === "count" ? [...grouped!].sort((a, b) => b.items.length - a.items.length) : [...grouped!].sort((a, b) => subjectName(a.su).localeCompare(subjectName(b.su)))).map(g => {
        const isOpen = expanded[g.su];
        return (
          <div key={g.su} style={{ ...CARD_COMPACT, padding: 0, marginBottom: 10, overflow: "hidden" }}>
            <div
              onClick={() => toggle(g.su)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", cursor: "pointer" }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: R.sm,
                background: `${SUBJECT_META[g.su]?.color || 'var(--ink)'}18`,
                border: `1.5px solid ${SUBJECT_META[g.su]?.color || 'var(--ink)'}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <SubjectIcon sid={g.su} size={18} color={SUBJECT_META[g.su]?.color} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: FF.body, fontSize: 14, fontWeight: 800,
                  color: 'var(--text)',
                }}>{subjectName(g.su)}</div>
                <div style={{
                  fontFamily: FF.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.04em', color: COLORS.streak, marginTop: 2,
                }}>{g.items.length} {errPlural(g.items.length)}</div>
              </div>
              <ChevronDown size={16} color="var(--text-muted)" strokeWidth={2.4} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
            </div>
            {isOpen && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map((w, i) => (
                  <div key={i} style={{
                    position: 'relative',
                    padding: '12px 12px 12px 16px',
                    background: 'var(--bg-subtle)',
                    border: `1.5px solid rgba(15,15,16,0.1)`,
                    borderRadius: R.md,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: COLORS.streak,
                    }} />
                    <div style={{
                      fontFamily: FF.body, fontSize: 12.5, fontWeight: 700,
                      color: 'var(--text)', lineHeight: 1.45, marginBottom: 8,
                    }}>{w.q.q}</div>
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '6px 9px', marginBottom: 6,
                      background: COLORS.winSoft,
                      border: `1px solid ${COLORS.win}`,
                      borderRadius: R.sm,
                      fontFamily: FF.body, fontSize: 11, fontWeight: 700,
                      color: COLORS.win, lineHeight: 1.4,
                    }}>
                      <Check size={12} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{getQType(w.q) === 'matching' && w.q.pairs
                        ? w.q.pairs.map(p => `${p[0]} → ${p[1]}`).join('; ')
                        : getQType(w.q) === 'multiple' && Array.isArray(w.q.c)
                          ? (w.q.c as number[]).map(idx => w.q.o[idx]).join(', ')
                          : w.q.o[getSingleCorrect(w.q)]}</span>
                    </div>
                    {w.q.e && (
                      <div style={{
                        display: 'flex', gap: 6,
                        padding: '8px 10px',
                        background: 'var(--bg-card)',
                        border: '1.5px solid rgba(15,15,16,0.12)',
                        borderRadius: 8,
                        fontFamily: FF.body, fontSize: 11, fontWeight: 600,
                        color: 'var(--text-secondary)', lineHeight: 1.55,
                      }}>
                        <Lightbulb size={12} color={COLORS.streak} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{w.q.e}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Button variant="danger" size="lg" fullWidth Icon={RotateCcw} onClick={startRetry} style={{ marginTop: 28 }}>
        {t.errorReview.retryErrors} ({totalErrors})
      </Button>
    </div>
  );
}

import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { ALL_PROFILES } from '../config/questionPools';
import { PROFILE_PARTNERS } from '../config/subjects';
import { COLORS, FF, FW, SP, TINT, R } from '../constants/styles';
import { Target, Check, ArrowRight, Trophy } from 'lucide-react';
import { SubjectChip as SubjectIconChip } from './ui/SubjectIcon';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { trackEvent } from '../utils/analytics';
import { useT } from '../locales';
import { getUpcomingPeriods, type PeriodKey } from '../config/ent';
import type { GoalSettings } from '../types/index';

const INK = 'var(--ink)';

interface ProfileSelectProps {
  onConfirm: (sel: string[], goal?: GoalSettings) => void;
}

export default function ProfileSelect({ onConfirm }: ProfileSelectProps) {
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const [sel, setSel] = useState<string[]>([]);
  const t = useT();
  const subName = (id: string) => (t.subjects as Record<string, string>)[id] || id;

  // Valid pick given the current selection — enforces the official ЕНТ pairs.
  // Before the first pick everything is open; after it, only the first subject's
  // partners stay selectable (the rest dim).
  const pairOpen = (id: string): boolean => {
    if (sel.includes(id)) return true;   // already picked — deselect always allowed
    if (sel.length === 0) return true;   // nothing picked yet — every subject open
    if (sel.length >= 2) return false;   // both slots full
    return (PROFILE_PARTNERS[sel[0]] ?? []).includes(id);  // must pair with the first pick
  };

  const toggle = (id: string) => {
    const sub = ALL_PROFILES.find(p => p.id === id);
    if (!sub?.available) return;         // locked (coming soon)
    if (sel.includes(id)) { setSel(prev => prev.filter(x => x !== id)); return; }
    if (sel.length >= 2 || !pairOpen(id)) return;  // full, or incompatible with first pick
    setSel(prev => [...prev, id]);
  };

  const upcoming = useMemo(() => getUpcomingPeriods(), []);
  const [goalPeriod, setGoalPeriod] = useState<PeriodKey | null>(() => upcoming[0]?.key ?? null);
  const [goalTarget, setGoalTarget] = useState(100);

  const periodName = (key: PeriodKey) => (t.ent as Record<string, string>)[key] || key;
  const ready = sel.length === 2;

  const handleConfirm = () => {
    trackEvent('Profile Selected', { subjects: sel.join(',') });
    const selectedPeriod = upcoming.find(p => p.key === goalPeriod);
    const goal: GoalSettings | undefined = selectedPeriod
      ? { target: goalTarget, date: selectedPeriod.examStart }
      : undefined;
    onConfirm(sel, goal);
  };

  return (
    <div style={{ padding: `20px var(--content-padding) ${isDesktop ? 40 : 120}px` }}>
      {/* Hero header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: TINT.streak.bg,
          border: `1.5px solid ${TINT.streak.border}`,
          color: COLORS.streak,
          padding: '5px 11px', borderRadius: R.pill,
          fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          <Target size={12} strokeWidth={2.8} />
          <span>{t.profileSelect.step1of2}</span>
        </div>
        <h1 style={{
          margin: 0, marginBottom: 8,
          fontFamily: FF.display,
          fontSize: 28, fontWeight: 900,
          letterSpacing: '-0.035em', lineHeight: 1.1,
          color: COLORS.text,
        }}>
          {t.profileSelect.title}
        </h1>
        <p style={{
          margin: 0,
          fontFamily: FF.body,
          fontSize: 14, fontWeight: FW.semibold,
          lineHeight: 1.45, color: COLORS.textSecondary,
        }}>
          {t.profileSelect.subtitle}
        </p>
      </div>

      {/* Selected count chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: R.pill,
          background: ready ? COLORS.win : 'var(--bg-subtle)',
          border: `1.5px solid ${ready ? COLORS.win : COLORS.cardBorder}`,
          color: ready ? '#fff' : COLORS.textSecondary,
          fontFamily: FF.mono, fontSize: 11, fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {ready && <Check size={12} strokeWidth={3} />}
          {t.profileSelect.selectedCount.replace('{n}', String(sel.length))}
        </div>
      </div>

      {/* Subject grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 22,
      }}>
        {ALL_PROFILES.map(p => {
          const active = sel.includes(p.id);
          const blocked = p.available && !active && !pairOpen(p.id);
          return (
            <SubjectChip
              key={p.id}
              id={p.id}
              name={subName(p.id)}
              color={p.color}
              pool={p.pool ?? 0}
              available={p.available}
              active={active}
              blocked={blocked}
              incompatible={blocked && sel.length === 1}
              onToggle={() => toggle(p.id)}
              t={t}
            />
          );
        })}
      </div>

      {/* Goal card — xp splash, only when ready */}
      {ready && upcoming.length > 0 && (
        <div style={{
          background: COLORS.xpSofter,
          border: `2px solid ${INK}`,
          borderRadius: 18,
          boxShadow: `0 4px 0 0 ${INK}`,
          padding: 18,
          marginBottom: 22,
          position: 'relative',
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: INK, color: COLORS.xp,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${INK}`,
            }}>
              <Trophy size={14} strokeWidth={2.5} />
            </div>
            <div style={{
              fontFamily: FF.display,
              fontSize: 15, fontWeight: 800,
              letterSpacing: '-0.02em',
              color: INK,
            }}>
              {t.profileSelect.goalWhen}
            </div>
          </div>

          {/* Period chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {upcoming.map(p => {
              const active = goalPeriod === p.key;
              return (
                <button
                  key={p.key + p.examStart}
                  onClick={() => setGoalPeriod(p.key)}
                  style={{
                    padding: '7px 13px', borderRadius: R.pill,
                    fontFamily: FF.body, fontSize: 12, fontWeight: 800,
                    border: `1.5px solid ${active ? INK : 'rgba(15,15,16,0.2)'}`,
                    background: active ? INK : 'rgba(255,255,255,0.7)',
                    color: active ? COLORS.xp : INK,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {periodName(p.key)}
                </button>
              );
            })}
          </div>

          {/* Target score */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: INK, opacity: 0.65,
            }}>
              {t.profileSelect.goalTarget}
            </span>
            <span style={{
              fontFamily: FF.display, fontSize: 26, fontWeight: 900,
              letterSpacing: '-0.035em', lineHeight: 1,
              color: INK, fontVariantNumeric: 'tabular-nums',
            }}>
              {goalTarget}
              <span style={{ fontSize: 14, opacity: 0.5, fontWeight: 800 }}>/140</span>
            </span>
          </div>

          <input
            type="range"
            min={50}
            max={140}
            value={goalTarget}
            onChange={e => setGoalTarget(+e.target.value)}
            aria-label={t.profileSelect.goalTarget}
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box', height: 6,
              background: 'rgba(15,15,16,0.15)', borderRadius: 3, outline: 'none',
              WebkitAppearance: 'none', appearance: 'none', margin: 0, padding: 0,
              accentColor: COLORS.streak,
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontFamily: FF.mono, fontSize: 9.5, fontWeight: 700,
            color: INK, opacity: 0.55,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <span>~70 {t.profileSelect.goalAvg}</span>
            <span>85+ {t.profileSelect.goalGrant}</span>
            <span>100+ {t.profileSelect.goalTop}</span>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <ConfirmCTA
        ready={ready}
        label={ready ? t.profileSelect.confirmChoice : t.profileSelect.selectTwo}
        onClick={handleConfirm}
      />

      {/* Skip */}
      {!ready && (
        <button
          onClick={() => {
            trackEvent('Profile Skipped');
            onConfirm(['geography', 'english']);
          }}
          style={{
            display: 'block', margin: '12px auto 0',
            background: 'none', border: 'none',
            fontFamily: FF.body, fontSize: 13, fontWeight: FW.bold,
            color: COLORS.textMuted, cursor: 'pointer', padding: 8,
          }}
        >
          {t.profileSelect.skipForNow}
        </button>
      )}

      <style>{`
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Subject chip (Duolingo-ish 3D button) ──────────────────────────────
function SubjectChip({
  id, name, color, pool, available, active, blocked, incompatible, onToggle, t,
}: {
  id: string;
  name: string;
  color: string;
  pool: number;
  available: boolean;
  active: boolean;
  blocked: boolean;
  incompatible: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useT>;
}) {
  const [pressed, setPressed] = useState(false);
  const disabled = !available || blocked;

  const bg = active
    ? TINT.streak.bgLight
    : disabled
      ? 'var(--bg-subtle)'
      : 'var(--bg-card)';

  const borderColor = active ? COLORS.streak : INK;
  const shadowColor = active ? COLORS.streak : INK;
  const shadowDepth = pressed ? 1 : 4;

  const style: CSSProperties = {
    position: 'relative',
    padding: '14px 10px 12px',
    background: bg,
    border: `2px solid ${borderColor}`,
    borderRadius: R.lg,
    boxShadow: disabled ? 'none' : `0 ${shadowDepth}px 0 0 ${shadowColor}`,
    transform: pressed ? 'translateY(3px)' : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'center',
    opacity: disabled ? 0.5 : 1,
    transition: 'transform 80ms cubic-bezier(0.4,0,0.2,1), box-shadow 80ms, background 0.2s',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  };

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      {/* Active check badge */}
      {active && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 22, height: 22, borderRadius: '50%',
          background: COLORS.streak, color: '#fff',
          border: `1.5px solid ${INK}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}

      <div style={{ marginBottom: 8 }}>
        <SubjectIconChip sid={id} size={44} />
      </div>

      <div style={{
        fontFamily: FF.body,
        fontSize: 12.5, fontWeight: 800,
        lineHeight: 1.2,
        color: disabled ? COLORS.textMuted : active ? COLORS.text : COLORS.text,
      }}>
        {name}
      </div>

      {!available ? (
        <div style={{
          fontFamily: FF.body, fontSize: 10, fontWeight: 700,
          color: COLORS.textMuted, marginTop: 4,
          fontStyle: 'italic',
        }}>
          {t.profileSelect.soon}
        </div>
      ) : incompatible ? (
        <div style={{
          fontFamily: FF.body, fontSize: 10, fontWeight: 700,
          color: COLORS.textMuted, marginTop: 4,
          fontStyle: 'italic',
        }}>
          {t.profileSelect.incompatible}
        </div>
      ) : (
        <div style={{
          fontFamily: FF.mono,
          fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.06em',
          color: active ? COLORS.streak : COLORS.textMuted,
          marginTop: 4,
        }}>
          {pool} {t.profileSelect.questionsLabel}
        </div>
      )}
    </button>
  );
}

// ── Confirm CTA (primary streak + press depth) ─────────────────────────
function ConfirmCTA({
  ready, label, onClick,
}: {
  ready: boolean;
  label: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const style: CSSProperties = {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '16px 24px',
    background: ready
      ? `linear-gradient(180deg, #FF6A47 0%, ${COLORS.streak} 100%)`
      : 'var(--bg-subtle)',
    color: ready ? '#fff' : COLORS.textMuted,
    border: `2px solid ${ready ? INK : COLORS.cardBorder}`,
    borderRadius: R.lg,
    fontFamily: FF.display,
    fontSize: 14, fontWeight: 900,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    cursor: ready ? 'pointer' : 'not-allowed',
    transition: 'transform 90ms, box-shadow 90ms',
    boxShadow: !ready
      ? 'none'
      : pressed
        ? `0 1px 0 0 ${INK}, 0 0 16px rgba(255,90,54,0.2)`
        : `0 6px 0 0 ${INK}, 0 0 32px rgba(255,90,54,0.3)`,
    transform: pressed && ready ? 'translateY(5px)' : 'none',
  };
  return (
    <button
      onClick={onClick}
      disabled={!ready}
      onMouseDown={() => ready && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => ready && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      {label}
      {ready && <ArrowRight size={18} strokeWidth={3} />}
    </button>
  );
}

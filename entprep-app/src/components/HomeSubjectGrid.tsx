import { useState } from 'react';
import type { CSSProperties } from 'react';
import { COLORS, FF, FW, SP, scoreColor, R, FS } from '../constants/styles';
import { useT } from '../locales';
import { pluralizeForms } from '../utils/formatters';
import { useNav } from '../contexts/NavigationContext';
import { Trophy } from 'lucide-react';
import { SubjectChip } from './ui/SubjectIcon';
import type { SubjectConfig, TestResult } from '../types';

const INK = 'var(--ink)';

interface Props {
  mandatory: SubjectConfig[];
  profile: SubjectConfig[];
  hist: TestResult[];
  poolSizes: Record<string, number>;
  bests: Record<string, { best: number }>;
  /** When set, tapping a subject calls this instead of navigating to its detail
   *  (used by the Theory screen to open конспекты instead of the question bank). */
  onPick?: (sid: string) => void;
}

export default function HomeSubjectGrid({ mandatory, profile, hist, poolSizes, bests, onPick }: Props) {
  const { nav } = useNav();
  const t = useT();
  const pick = (sid: string) =>
    onPick ? onPick(sid) : nav(sid === 'reading' ? 'test' : 'topics', sid);

  const subName = (id: string) => (t.subjects as Record<string, string>)[id] || id;

  const poolLabel = (pool: number) => `${pool} ${pluralizeForms(pool, t.rush.questionsWord)}`;

  const getStats = (s: SubjectConfig) => {
    const tests = hist.filter(h => h.su === s.id);
    const lastScore = tests.length ? tests[tests.length - 1].sc : null;
    const pb = bests[s.id];
    const pool = poolSizes[s.id] || s.pool || 0;
    return { tests, lastScore, pb, pool };
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Mandatory subjects */}
      <SectionEyebrow label={t.home.mandatory} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: SP.xl }}>
        {mandatory.map(s => (
          <SubjectRow
            key={s.id}
            subject={s}
            name={subName(s.id)}
            stats={getStats(s)}
            poolLabel={poolLabel}
            onClick={() => pick(s.id)}
          />
        ))}
      </div>

      {/* Profile subjects */}
      {profile.length > 0 && (
        <>
          <SectionEyebrow label={t.home.profile} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.map(s => (
              <SubjectRow
                key={s.id}
                subject={s}
                name={subName(s.id)}
                stats={getStats(s)}
                poolLabel={poolLabel}
                onClick={() => pick(s.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Section eyebrow ─────────────────────────────────────────────────────
function SectionEyebrow({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: FF.mono, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color: COLORS.textMuted,
      padding: '2px 4px',
      marginBottom: 8,
    }}>
      {label}
    </div>
  );
}

// ── Subject row — unified v2 horizontal card ────────────────────────────
function SubjectRow({
  subject: s,
  name,
  stats,
  poolLabel,
  onClick,
}: {
  subject: SubjectConfig;
  name: string;
  stats: { lastScore: number | null; pb: { best: number } | undefined; pool: number };
  poolLabel: (pool: number) => string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const { lastScore, pb, pool } = stats;
  const displayScore = lastScore !== null ? lastScore : null;
  const sColor = scoreColor(displayScore ?? 0);

  const style: CSSProperties = {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: 0,
    background: 'var(--bg-card)',
    border: `2px solid ${INK}`,
    borderRadius: R.lg,
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    transition: 'transform 80ms, box-shadow 80ms',
    boxShadow: pressed ? `0 1px 0 0 ${INK}` : `0 3px 0 0 ${INK}`,
    transform: pressed ? 'translateY(2px)' : 'none',
    padding: 0,
  };

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={style}
    >
      {/* Subject-colored thin accent stripe */}
      <div style={{
        width: 4, alignSelf: 'stretch',
        background: s.color,
      }} />

      {/* Icon chip — design-kit stamped style */}
      <span style={{ marginLeft: 12, display: 'inline-flex' }}>
        <SubjectChip sid={s.id} size={36} radius={10} />
      </span>

      {/* Name */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '10px 12px',
      }}>
        <span style={{
          fontFamily: FF.body,
          fontSize: 14, fontWeight: 800,
          lineHeight: 1.2,
          color: COLORS.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
        <span style={{
          fontFamily: FF.mono,
          fontSize: FS.xs, fontWeight: 700,
          letterSpacing: '0.06em',
          color: COLORS.textMuted,
          marginTop: 2,
        }}>
          {poolLabel(pool)}
        </span>
      </div>

      {/* Score column */}
      <div style={{
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
        paddingRight: 14, paddingLeft: 8,
      }}>
        {displayScore !== null ? (
          <span style={{
            fontFamily: FF.display,
            fontSize: 18, fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: sColor,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {displayScore}<span style={{ fontSize: 11, opacity: 0.7, fontWeight: 800 }}>%</span>
          </span>
        ) : (
          <span style={{
            fontFamily: FF.mono, fontSize: 11, fontWeight: 700,
            color: COLORS.textMuted, letterSpacing: '0.1em',
          }}>
            —
          </span>
        )}
        {pb && pb.best > (lastScore || 0) && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontFamily: FF.mono, fontSize: 9, fontWeight: 800,
            color: COLORS.xp, letterSpacing: '0.05em',
          }}>
            <Trophy size={9} strokeWidth={2.8} fill={COLORS.xp} />
            {pb.best}%
          </span>
        )}
      </div>
    </button>
  );
}

import React, { useMemo } from 'react';
import { CARD_COMPACT, COLORS, TYPE, SECTION_LABEL, SP, FS, R } from '../constants/styles';
import { useApp } from '../contexts/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useT } from '../locales';
import { weeklyActivity, timeByDifficulty, type Difficulty } from '../utils/analyticsHelpers';
import { calcTopicStats } from '../utils/adaptiveHelpers';
import { pluralizeForms } from '../utils/formatters';
import { BarChart3, Timer } from 'lucide-react';

interface SubjectAnalyticsProps {
  sid: string;
}

const MONO_NUM: React.CSSProperties = {
  ...TYPE.mono,
  fontVariantNumeric: 'tabular-nums',
};

// Stacked colors: correct (green) on top of wrong (red); donut: easy/medium/hard
const C_CORRECT = COLORS.win;
const C_WRONG = COLORS.red;
const DIFF_COLORS: Record<Difficulty, string> = {
  easy: COLORS.win,
  medium: COLORS.xp,
  hard: COLORS.red,
};

const MIN_TIME_SAMPLES = 10;

function fmtAvg(sec: number, minShort: string, secShort: string): string {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}${minShort} ${s}${secShort}` : `${s}${secShort}`;
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SP.sm, padding: `${SP.xl}px ${SP.lg}px`, minHeight: 120, textAlign: 'center' }}>
      {icon}
      <div style={{ ...TYPE.bodySmall }}>{text}</div>
    </div>
  );
}

/** Block 1: stacked weekly activity bars (last 10 Mon-based weeks) */
function WeeklyChart({ sid }: { sid: string }) {
  const { hist } = useApp();
  const t = useT();
  const weeks = useMemo(() => weeklyActivity(hist, sid, 10), [hist, sid]);
  const hasData = weeks.some(w => w.correct + w.wrong > 0);

  if (!hasData) {
    return <EmptyCard icon={<BarChart3 size={20} color="var(--text-muted)" />} text={t.analytics.weeklyEmpty} />;
  }

  const W = 320;
  const H = 130;
  const pad = { top: 8, right: 6, bottom: 18, left: 26 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const maxV = Math.max(...weeks.map(w => w.correct + w.wrong), 1);
  const barW = Math.min(16, (cw / weeks.length) * 0.62);
  const step = cw / weeks.length;
  // 3 Y ticks: 0, mid, max
  const ticks = [0, Math.round(maxV / 2), maxV];
  const months = t.analytics.monthsShort.split('|');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }} role="img" aria-label={t.analytics.weeklyTitle}>
      {ticks.map(v => {
        const y = pad.top + ch - (v / maxV) * ch;
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={pad.left - 5} y={y + 3} textAnchor="end" fontSize={8} fontFamily="'JetBrains Mono',monospace" fill="var(--text-muted)">{v}</text>
          </g>
        );
      })}
      {weeks.map((w, i) => {
        const total = w.correct + w.wrong;
        const x = pad.left + i * step + (step - barW) / 2;
        const hWrong = (w.wrong / maxV) * ch;
        const hCorrect = (w.correct / maxV) * ch;
        const yCorrect = pad.top + ch - hWrong - hCorrect;
        const label = `${w.weekStart.getDate()} ${months[w.weekStart.getMonth()]}`;
        return (
          <g key={i}>
            {total > 0 && (
              <>
                {/* wrong (bottom) */}
                {w.wrong > 0 && (
                  <rect x={x} y={pad.top + ch - hWrong} width={barW} height={hWrong} fill={C_WRONG} rx={w.correct > 0 ? 0 : 2} />
                )}
                {/* correct (top), rounded top corners */}
                {w.correct > 0 && (
                  <path d={`M${x},${yCorrect + hCorrect} L${x},${yCorrect + 2} Q${x},${yCorrect} ${x + 2},${yCorrect} L${x + barW - 2},${yCorrect} Q${x + barW},${yCorrect} ${x + barW},${yCorrect + 2} L${x + barW},${yCorrect + hCorrect} Z`} fill={C_CORRECT} />
                )}
              </>
            )}
            {i % 2 === 1 && (
              <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize={7.5} fontFamily="'JetBrains Mono',monospace" fill="var(--text-muted)">{label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Block 2: per-section accuracy rows with zone track + marker */
function TopicAccuracy({ sid }: { sid: string }) {
  const { hist, st } = useApp();
  const t = useT();
  const isKk = st.lang === 'kk';
  const stats = useMemo(() => calcTopicStats(sid, hist), [sid, hist]);
  const rows = useMemo(
    () => (stats || []).filter(s => s.pct >= 0).sort((a, b) => b.total - a.total).slice(0, 6),
    [stats],
  );

  if (rows.length === 0) {
    return <EmptyCard icon={<BarChart3 size={20} color="var(--text-muted)" />} text={t.analytics.accuracyEmpty} />;
  }

  const zoneColor = (pct: number) => (pct < 60 ? COLORS.red : pct < 80 ? COLORS.xp : COLORS.win);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.md }}>
      {rows.map(row => (
        <div key={row.id}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, marginBottom: SP.xs }}>
            <div style={{ fontSize: FS.base, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isKk && row.name_kk ? row.name_kk : row.name}
            </div>
            <div style={{ ...MONO_NUM, fontSize: FS.md, fontWeight: 700, color: zoneColor(row.pct), flexShrink: 0 }}>{row.pct}%</div>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: R.sm, overflow: 'visible', marginBottom: SP.xs }}>
            {/* zone segments: red 0-60, amber 60-80, green 80-100 */}
            <div style={{ position: 'absolute', left: 0, width: '60%', top: 0, bottom: 0, background: COLORS.red + '2e', borderRadius: '3px 0 0 3px' }} />
            <div style={{ position: 'absolute', left: '60%', width: '20%', top: 0, bottom: 0, background: COLORS.xp + '2e' }} />
            <div style={{ position: 'absolute', left: '80%', width: '20%', top: 0, bottom: 0, background: COLORS.win + '2e', borderRadius: '0 3px 3px 0' }} />
            {/* marker */}
            <div style={{ position: 'absolute', left: `${row.pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: R.pill, background: zoneColor(row.pct), border: '2px solid var(--bg-card)' }} />
          </div>
          <div style={{ ...TYPE.caption }}>
            <span style={MONO_NUM}>{row.total}</span> {pluralizeForms(row.total, t.analytics.attemptForms)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Block 3: donut of time share by difficulty + legend */
function TimeDonut({ sid }: { sid: string }) {
  const { hist } = useApp();
  const t = useT();
  const data = useMemo(() => timeByDifficulty(hist, sid), [hist, sid]);

  if (data.samples < MIN_TIME_SAMPLES) {
    const n = MIN_TIME_SAMPLES - data.samples;
    return (
      <EmptyCard
        icon={<Timer size={20} color="var(--text-muted)" />}
        text={t.analytics.timeEmpty.replace('{n}', String(n))}
      />
    );
  }

  const RADIUS = 40;
  const CIRC = 2 * Math.PI * RADIUS;
  const order: Difficulty[] = ['easy', 'medium', 'hard'];
  let offset = 0;
  const segments = order
    .map(k => {
      const len = data[k].share * CIRC;
      const seg = { key: k, len, offset };
      offset += len;
      return seg;
    })
    .filter(s => s.len > 0);

  const labels: Record<Difficulty, string> = {
    easy: t.analytics.easy,
    medium: t.analytics.medium,
    hard: t.analytics.hard,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.lg }}>
      <svg viewBox="0 0 110 110" width={110} height={110} style={{ flexShrink: 0 }} role="img" aria-label={t.analytics.timeTitle}>
        <g transform="rotate(-90 55 55)">
          <circle cx={55} cy={55} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={10} />
          {segments.map(s => (
            <circle
              key={s.key}
              cx={55}
              cy={55}
              r={RADIUS}
              fill="none"
              stroke={DIFF_COLORS[s.key]}
              strokeWidth={10}
              strokeDasharray={`${Math.max(0, s.len - 1.5)} ${CIRC - Math.max(0, s.len - 1.5)}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x={55} y={53} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily="'JetBrains Mono',monospace" fill="var(--text)">
          {fmtAvg(data.totalAvgSec, t.analytics.minShort, t.analytics.secShort)}
        </text>
        <text x={55} y={66} textAnchor="middle" fontSize={7} fill="var(--text-muted)">
          {t.analytics.avgPerQuestion}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, flex: 1, minWidth: 0 }}>
        {order.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
            <div style={{ width: 8, height: 8, borderRadius: R.pill, background: DIFF_COLORS[k], flexShrink: 0 }} />
            <div style={{ fontSize: FS.base, color: 'var(--text-body)', flex: 1 }}>{labels[k]}</div>
            <div style={{ ...MONO_NUM, fontSize: FS.base, fontWeight: 600, color: 'var(--text)' }}>
              {data[k].count > 0 ? fmtAvg(data[k].avgSec, t.analytics.minShort, t.analytics.secShort) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...CARD_COMPACT, flex: 1, minWidth: 0 }}>
      <div style={{ ...SECTION_LABEL }}>{title}</div>
      {children}
    </div>
  );
}

export default function SubjectAnalytics({ sid }: SubjectAnalyticsProps) {
  const t = useT();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  return (
    <div style={{ marginTop: SP.xxl }}>
      <h3 style={{ ...TYPE.h3, margin: `0 0 ${SP.md}px` }}>{t.analytics.title}</h3>
      <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: SP.md, marginBottom: SP.md }}>
        <Block title={t.analytics.weeklyTitle}>
          <WeeklyChart sid={sid} />
        </Block>
        <Block title={t.analytics.timeTitle}>
          <TimeDonut sid={sid} />
        </Block>
      </div>
      <Block title={t.analytics.accuracyTitle}>
        <TopicAccuracy sid={sid} />
      </Block>
    </div>
  );
}

import { SUBJECT_META } from '../../config/subjects';
import { FF } from '../../constants/styles';
import { useT } from '../../locales';
import { pluralizeForms } from '../../utils/formatters';
import SubjectIcon from './SubjectIcon';
import type { TestResult } from '../../types';

interface Props {
  hist: TestResult[];
}

interface SubjectGrowth {
  sid: string;
  name: string;
  color: string;
  firstAvg: number;
  latestAvg: number;
  improvement: number;
  tests: number;
}

export default function GrowthStats({ hist }: Props) {
  const t = useT();
  const tests = hist.filter(h => h.type !== 'fullent' && h.type !== 'rush' && h.su && h.sc != null);
  if (tests.length < 3) return null;

  // Group by subject
  const bySubject: Record<string, TestResult[]> = {};
  for (const t of tests) {
    if (!bySubject[t.su]) bySubject[t.su] = [];
    bySubject[t.su].push(t);
  }

  // Calculate growth per subject (first 3 avg vs latest 3 avg)
  const growth: SubjectGrowth[] = [];
  for (const [sid, subTests] of Object.entries(bySubject)) {
    if (subTests.length < 3) continue;
    const meta = SUBJECT_META[sid];
    if (!meta) continue;

    const sorted = [...subTests].sort((a, b) => a.dt.localeCompare(b.dt));
    const first3 = sorted.slice(0, 3);
    const latest3 = sorted.slice(-3);

    const firstAvg = Math.round(first3.reduce((s, t) => s + t.sc, 0) / first3.length);
    const latestAvg = Math.round(latest3.reduce((s, t) => s + t.sc, 0) / latest3.length);

    growth.push({
      sid,
      name: meta.name,
      color: meta.color,
      firstAvg,
      latestAvg,
      improvement: latestAvg - firstAvg,
      tests: subTests.length,
    });
  }

  if (growth.length === 0) return null;

  // Sort by improvement descending
  growth.sort((a, b) => b.improvement - a.improvement);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, fontFamily: FF.body,
        color: 'var(--text)', marginBottom: 12,
      }}>
        {t.analytics.growthTitle}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {growth.map(g => (
          <div key={g.sid} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--bg-subtle)',
          }}>
            <SubjectIcon sid={g.sid} size={18} color={g.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: FF.body }}>
                {g.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: FF.body }}>
                {g.firstAvg}% → {g.latestAvg}% · {g.tests} {pluralizeForms(g.tests, t.analytics.testsForms)}
              </div>
            </div>
            <div style={{
              fontSize: 15, fontWeight: 800,
              fontFamily: FF.mono,
              color: g.improvement > 0 ? '#58CC02' : g.improvement < 0 ? 'var(--text-muted)' : 'var(--text-dim)',
            }}>
              {g.improvement > 0 ? '+' : ''}{g.improvement}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

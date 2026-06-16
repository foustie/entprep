import { UNIS } from '../data/universities';
import { CARD_COMPACT, COLORS, FF, R } from '../constants/styles';
import { useNav } from '../contexts/NavigationContext';
import { useT } from '../locales';
import { pluralizeForms } from '../utils/formatters';
import { TrendingUp, GraduationCap, ChevronRight, Target } from 'lucide-react';
import type { TestResult } from '../types';
import { predictScore } from '../utils/predictScore';

/** Get universities sorted by how close they are to the predicted score */
function getUniMatches(predicted: number) {
  const passing = UNIS
    .filter(u => predicted >= u.min)
    .sort((a, b) => b.min - a.min)
    .slice(0, 3);

  const reach = UNIS
    .filter(u => predicted < u.min && u.min - predicted <= 20)
    .sort((a, b) => a.min - b.min)
    .slice(0, 2);

  return { passing, reach };
}

interface Props {
  hist: TestResult[];
}

export default function HomeScorePrediction({ hist }: Props) {
  const { nav } = useNav();
  const t = useT();

  const predicted = predictScore(hist);
  if (predicted === null) return null;

  const { passing, reach } = getUniMatches(predicted);
  const scoreColor = predicted >= 100 ? COLORS.green : predicted >= 70 ? COLORS.amber : COLORS.red;

  return (
    <div style={{
      ...CARD_COMPACT,
      padding: '16px',
      marginBottom: 12,
      borderLeft: `3px solid ${scoreColor}`,
    }}>
      {/* Score line */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: R.md,
            background: `${scoreColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={18} color={scoreColor} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {t.home.entPrediction}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800,
              fontFamily: FF.mono,
              color: scoreColor,
              lineHeight: 1,
            }}>
              {predicted}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>/140</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => nav('fullent')}
          style={{
            padding: '8px 14px', borderRadius: R.md,
            background: `${scoreColor}12`, border: `1px solid ${scoreColor}25`,
            color: scoreColor, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Target size={13} />
          {t.home.check}
        </button>
      </div>

      {/* University matches */}
      {(passing.length > 0 || reach.length > 0) && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
          }}>
            <GraduationCap size={11} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t.home.grants}
          </div>

          {passing.map(u => (
            <div key={u.n} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              fontSize: 12,
            }}>
              <span style={{ color: COLORS.green, fontSize: 11, flexShrink: 0 }}>&#10003;</span>
              <span style={{ flex: 1, color: 'var(--text)', fontWeight: 500 }}>{u.n}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: FF.mono }}>
                {t.home.from} {u.min}
              </span>
            </div>
          ))}

          {reach.map(u => (
            <div key={u.n} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              fontSize: 12,
            }}>
              <span style={{ color: COLORS.red, fontSize: 11, flexShrink: 0 }}>&#10007;</span>
              <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 500 }}>{u.n}</span>
              <span style={{ fontSize: 10, color: COLORS.amber, fontWeight: 700, fontFamily: FF.mono }}>
                +{u.min - predicted}
              </span>
            </div>
          ))}

          {reach.length > 0 && (
            <div style={{
              fontSize: 10, color: 'var(--text-secondary)', marginTop: 6,
              fontStyle: 'italic',
            }}>
              {t.home.reachHint
                .replace('{n}', String(reach[0].min - predicted))
                .replace('{uni}', reach[0].n)}
            </div>
          )}
        </div>
      )}

      {/* Link to full calculator */}
      <button
        onClick={() => nav('calc')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 0 0', marginTop: 8,
          background: 'none', border: 'none', borderTop: '1px solid var(--border)',
          cursor: 'pointer', color: COLORS.teal, fontSize: 11, fontWeight: 600,
        }}
      >
        {t.home.allUnis
          .replace('{n}', String(UNIS.length))
          .replace('{word}', pluralizeForms(UNIS.length, t.home.universityForms))}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

import React from 'react';
import { UNIS } from '../data/universities';
import { CARD_COMPACT, COLORS, TINT } from '../constants/styles';
import { useNav } from '../contexts/NavigationContext';
import { useApp } from '../contexts/AppContext';
import { useT } from '../locales';
import { TrendingUp, GraduationCap, ChevronRight, Target } from 'lucide-react';
import type { TestResult } from '../types';

/** Calculate predicted ENT score from test history */
function predictScore(hist: TestResult[]): number | null {
  const regular = hist.filter(t => t.type !== 'fullent' && t.sc != null);
  if (regular.length < 3) return null; // Need at least 3 tests for meaningful prediction

  // Weight recent tests more heavily (last 15 tests, exponential decay)
  const recent = regular.slice(-15);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < recent.length; i++) {
    const weight = 1 + (i / recent.length); // older=1.0, newest=~2.0
    weightedSum += (recent[i].sc || 0) * weight;
    weightTotal += weight;
  }
  const avgPct = weightedSum / weightTotal;

  // Map average % to ENT scale (140 max)
  // Avg% represents per-subject performance; ENT has different weights
  // but as rough estimate: score = avg% * 1.4
  return Math.round(avgPct * 1.4);
}

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
  const { st } = useApp();
  const t = useT();
  const isKk = st.lang === 'kk';

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
            width: 36, height: 36, borderRadius: 10,
            background: `${scoreColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={18} color={scoreColor} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {isKk ? 'ҰБТ болжамы' : 'Прогноз ЕНТ'}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800,
              fontFamily: "'JetBrains Mono',monospace",
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
            padding: '8px 14px', borderRadius: 10,
            background: `${scoreColor}12`, border: `1px solid ${scoreColor}25`,
            color: scoreColor, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Target size={13} />
          {isKk ? 'Тексеру' : 'Проверить'}
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
            {isKk ? 'Грант бойынша' : 'Гранты'}
          </div>

          {passing.map(u => (
            <div key={u.n} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              fontSize: 12,
            }}>
              <span style={{ color: COLORS.green, fontSize: 11, flexShrink: 0 }}>&#10003;</span>
              <span style={{ flex: 1, color: 'var(--text)', fontWeight: 500 }}>{u.n}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace" }}>
                {isKk ? 'бастап' : 'от'} {u.min}
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
              <span style={{ fontSize: 10, color: COLORS.amber, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                +{u.min - predicted}
              </span>
            </div>
          ))}

          {reach.length > 0 && (
            <div style={{
              fontSize: 10, color: 'var(--text-secondary)', marginTop: 6,
              fontStyle: 'italic',
            }}>
              {isKk
                ? `Тағы ${reach[0].min - predicted} балл жинасаң — ${reach[0].n} грантына өтесің`
                : `Ещё +${reach[0].min - predicted} баллов — и ${reach[0].n} на гранте`}
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
        {isKk ? `Барлық ${UNIS.length} университет` : `Все ${UNIS.length} университетов`}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

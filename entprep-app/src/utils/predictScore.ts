import type { TestResult } from '../types';

/** Calculate predicted ENT score from test history */
export function predictScore(hist: TestResult[]): number | null {
  const regular = hist.filter(t => t.type !== 'fullent' && t.sc != null);
  if (regular.length < 3) return null;

  const recent = regular.slice(-15);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < recent.length; i++) {
    const weight = 1 + (i / recent.length);
    weightedSum += (recent[i].sc || 0) * weight;
    weightTotal += weight;
  }
  const avgPct = weightedSum / weightTotal;

  return Math.round(avgPct * 1.4);
}

import { describe, it, expect } from 'vitest';
import { getRecommendation } from '../recommendationEngine';
import type { TestResult } from '../../types';

// TestResult.dt is stored as ru-RU `dd.mm.yyyy` (see Test.tsx). Build dates in the
// same format so getRecommendation's toISO/daysBetween logic sees realistic input.
const daysAgoRu = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('ru-RU');
};

const result = (su: string, sc: number, daysAgo: number): TestResult => ({
  su,
  sc,
  dt: daysAgoRu(daysAgo),
  type: 'regular',
});

describe('getRecommendation — recency rotation', () => {
  it('does NOT recommend a weak subject just practiced today when another weak subject exists', () => {
    // subA: weak (30%) and practiced TODAY. subB: equally weak but practiced 2 days ago.
    // Regression: before the recencyPenalty fix both scored priority 9 and subA (first
    // in the profile, just finished) won — so right after a Math test it suggested Math again.
    const hist: TestResult[] = [result('subA', 30, 0), result('subB', 30, 2)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('weak_subject');
    expect(rec.subject).toBe('subB');
  });

  it('still recommends a just-practiced subject if it is the ONLY weak one (penalty ≠ exclusion)', () => {
    // subA weak + practiced today; subB never practiced (not a candidate).
    const hist: TestResult[] = [result('subA', 30, 0)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('weak_subject');
    expect(rec.subject).toBe('subA');
  });

  it('prefers a weak subject practiced today over a non-weak alternative (penalty stays above fallbacks)', () => {
    // subA weak (30%) today; subB strong (90%) practiced 2 days ago. subA must still win:
    // 9 - 0.5 = 8.5 beats every lower-priority fallback (full_ent=5, default=4).
    const hist: TestResult[] = [result('subA', 30, 0), result('subB', 90, 2)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('weak_subject');
    expect(rec.subject).toBe('subA');
  });
});

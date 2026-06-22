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

describe('getRecommendation — diagnostic-first (cover every subject once)', () => {
  it('leads to a never-practiced subject instead of re-recommending the one just practiced', () => {
    // The original bug: after a Math test "next test" kept sending back to Math, because a
    // never-practiced subject (subB) was invisible to the weak/topic/not-practiced branches.
    const hist: TestResult[] = [result('subA', 30, 0)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('not_practiced_new');
    expect(rec.subject).toBe('subB');
  });

  it('prefers a never-practiced subject even over a weak subject practiced on another day (coverage before drilling)', () => {
    const hist: TestResult[] = [result('subA', 30, 2)]; // subA weak but practiced 2 days ago
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('not_practiced_new');
    expect(rec.subject).toBe('subB');
  });
});

describe('getRecommendation — weak-subject logic once every subject is practiced', () => {
  it('rotates away from a subject practiced today to another weak subject', () => {
    // Both practiced (so diagnostic-first does not fire). subA weak today, subB weak earlier:
    // the recency penalty (subA 9-0.5=8.5) must let subB (9) win.
    const hist: TestResult[] = [result('subA', 30, 0), result('subB', 30, 2)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('weak_subject');
    expect(rec.subject).toBe('subB');
  });

  it('still recommends a just-practiced subject if it is the only weak one (penalty ≠ exclusion)', () => {
    // Both practiced. subA weak today; subB strong. subA (8.5) must still beat every fallback.
    const hist: TestResult[] = [result('subA', 30, 0), result('subB', 90, 2)];
    const rec = getRecommendation(hist, ['subA', 'subB']);
    expect(rec.type).toBe('weak_subject');
    expect(rec.subject).toBe('subA');
  });
});

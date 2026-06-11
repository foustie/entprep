import { describe, it, expect } from 'vitest';
import { weeklyActivity, timeByDifficulty, subjectPracticeHistory } from '../analyticsHelpers';
import type { TestResult, QuestionDetail } from '../../types';

type TimedDetail = QuestionDetail & { tms?: number; df?: 'easy' | 'medium' | 'hard' };

function mkResult(over: Partial<TestResult> & { dt: string }): TestResult {
  return { su: 'math', sc: 50, ...over } as TestResult;
}

function qd(oks: boolean[]): QuestionDetail[] {
  return oks.map((ok, i) => ({ oi: i, ok }));
}

describe('subjectPracticeHistory', () => {
  it('keeps regular/duel entries for the subject and drops fullent and other subjects', () => {
    const hist: TestResult[] = [
      mkResult({ dt: '01.06.2026', type: 'regular' }),
      mkResult({ dt: '01.06.2026', type: 'duel' }),
      mkResult({ dt: '01.06.2026', type: 'fullent' }),
      mkResult({ dt: '01.06.2026', su: 'physics' }),
      mkResult({ dt: '01.06.2026' }), // no type = regular
    ];
    expect(subjectPracticeHistory(hist, 'math')).toHaveLength(3);
  });
});

describe('weeklyActivity', () => {
  // Fixed "now": Thursday 11 June 2026 → current week starts Monday 8 June 2026
  const now = new Date(2026, 5, 11);

  it('returns the requested number of Monday-based weeks, oldest first', () => {
    const res = weeklyActivity([], 'math', 10, now);
    expect(res).toHaveLength(10);
    expect(res[9].weekStart).toEqual(new Date(2026, 5, 8)); // current week
    expect(res[0].weekStart).toEqual(new Date(2026, 3, 6)); // 9 weeks back
    for (const w of res) {
      expect(w.weekStart.getDay()).toBe(1); // Monday
      expect(w.correct).toBe(0);
      expect(w.wrong).toBe(0);
    }
  });

  it('groups entries into weeks across month boundaries', () => {
    const hist: TestResult[] = [
      // Week of Mon 27 Apr – Sun 3 May 2026 spans the Apr/May boundary
      mkResult({ dt: '30.04.2026', qd: qd([true, true, false]) }),
      mkResult({ dt: '02.05.2026', qd: qd([true, false]) }),
    ];
    const res = weeklyActivity(hist, 'math', 10, now);
    const week = res.find(w => w.weekStart.getTime() === new Date(2026, 3, 27).getTime())!;
    expect(week).toBeDefined();
    expect(week.correct).toBe(3);
    expect(week.wrong).toBe(2);
    // Nothing leaked into neighbouring weeks
    const others = res.filter(w => w !== week);
    expect(others.every(w => w.correct === 0 && w.wrong === 0)).toBe(true);
  });

  it('falls back to co/to when qd is missing', () => {
    const hist: TestResult[] = [
      mkResult({ dt: '09.06.2026', co: 7, to: 10 }),
    ];
    const res = weeklyActivity(hist, 'math', 10, now);
    const cur = res[9];
    expect(cur.correct).toBe(7);
    expect(cur.wrong).toBe(3);
  });

  it('prefers qd counts over co/to when both present', () => {
    const hist: TestResult[] = [
      mkResult({ dt: '09.06.2026', co: 9, to: 10, qd: qd([true, false]) }),
    ];
    const res = weeklyActivity(hist, 'math', 10, now);
    expect(res[9].correct).toBe(1);
    expect(res[9].wrong).toBe(1);
  });

  it('ignores entries outside the window, fullent entries and bad dates', () => {
    const hist: TestResult[] = [
      mkResult({ dt: '01.01.2020', co: 5, to: 5 }), // too old
      mkResult({ dt: '09.06.2026', type: 'fullent', co: 5, to: 5 }),
      mkResult({ dt: 'garbage', co: 5, to: 5 }),
    ];
    const res = weeklyActivity(hist, 'math', 10, now);
    expect(res.every(w => w.correct === 0 && w.wrong === 0)).toBe(true);
  });

  it('returns all-zero buckets for empty history', () => {
    const res = weeklyActivity([], 'math', 10, now);
    expect(res.every(w => w.correct === 0 && w.wrong === 0)).toBe(true);
  });
});

describe('timeByDifficulty', () => {
  const timed = (tms: number | undefined, df?: 'easy' | 'medium' | 'hard'): TimedDetail =>
    ({ oi: 0, ok: true, tms, df });

  it('aggregates avg seconds and time share per difficulty', () => {
    const hist: TestResult[] = [
      mkResult({ dt: '09.06.2026', qd: [timed(10, 'easy'), timed(20, 'easy'), timed(30, 'medium')] as QuestionDetail[] }),
      mkResult({ dt: '08.06.2026', qd: [timed(40, 'hard')] as QuestionDetail[] }),
    ];
    const res = timeByDifficulty(hist, 'math');
    expect(res.samples).toBe(4);
    expect(res.easy.count).toBe(2);
    expect(res.easy.avgSec).toBe(15);
    expect(res.medium.avgSec).toBe(30);
    expect(res.hard.avgSec).toBe(40);
    expect(res.easy.share).toBeCloseTo(30 / 100);
    expect(res.hard.share).toBeCloseTo(40 / 100);
    expect(res.totalAvgSec).toBe(25);
  });

  it('ignores entries missing tms or df, and fullent results', () => {
    const hist: TestResult[] = [
      mkResult({
        dt: '09.06.2026',
        qd: [
          timed(undefined, 'easy'), // no tms
          timed(12), // no df
          { oi: 0, ok: true }, // plain detail
          timed(0, 'easy'), // zero time ignored
          timed(8, 'easy'), // the only valid one
        ] as QuestionDetail[],
      }),
      mkResult({ dt: '09.06.2026', type: 'fullent', qd: [timed(99, 'hard')] as QuestionDetail[] }),
    ];
    const res = timeByDifficulty(hist, 'math');
    expect(res.samples).toBe(1);
    expect(res.easy.count).toBe(1);
    expect(res.easy.avgSec).toBe(8);
    expect(res.hard.count).toBe(0);
  });

  it('returns zeros for empty history', () => {
    const res = timeByDifficulty([], 'math');
    expect(res.samples).toBe(0);
    expect(res.totalAvgSec).toBe(0);
    expect(res.easy.share).toBe(0);
  });
});

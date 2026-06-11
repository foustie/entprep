import { describe, it, expect } from 'vitest';
import {
  extractPacingSamples,
  statsFromSums,
  pacingBand,
  MIN_PLATFORM_N,
  MAX_SAMPLES_PER_POST,
} from '../pacingHelpers';
import type { TestResult, QuestionDetail } from '../../types';

function qd(over: Partial<QuestionDetail>): QuestionDetail {
  return { oi: 0, ok: true, ...over };
}

function result(over: Partial<TestResult>): TestResult {
  return { su: 'math', sc: 80, dt: '01.06.2026', ...over } as TestResult;
}

describe('extractPacingSamples', () => {
  it('extracts timed entries from a regular result under result.su', () => {
    const r = result({
      su: 'physics',
      qd: [
        qd({ tms: 30, df: 'easy' }),
        qd({ tms: 45, df: 'hard' }),
      ],
    });
    expect(extractPacingSamples(r)).toEqual([
      { subject: 'physics', samples: [{ df: 'easy', tms: 30 }, { df: 'hard', tms: 45 }] },
    ]);
  });

  it('skips entries missing tms or df, and invalid values', () => {
    const r = result({
      qd: [
        qd({ tms: 30 }), // no df
        qd({ df: 'easy' }), // no tms
        qd({ tms: 0, df: 'easy' }), // below min
        qd({ tms: 601, df: 'easy' }), // above cap
        qd({ tms: 12.5, df: 'easy' }), // non-integer
        qd({ tms: 20, df: 'impossible' as QuestionDetail['df'] }), // bad enum
        qd({ tms: 20, df: 'medium' }), // the only valid one
      ],
    });
    expect(extractPacingSamples(r)).toEqual([
      { subject: 'math', samples: [{ df: 'medium', tms: 20 }] },
    ]);
  });

  it('returns empty array when qd is missing or empty', () => {
    expect(extractPacingSamples(result({}))).toEqual([]);
    expect(extractPacingSamples(result({ qd: [] }))).toEqual([]);
  });

  it('groups fullent entries by per-entry su, skipping entries without su', () => {
    const r = result({
      type: 'fullent',
      su: 'fullent',
      qd: [
        qd({ su: 'math', tms: 10, df: 'easy' }),
        qd({ su: 'history', tms: 25, df: 'medium' }),
        qd({ su: 'math', tms: 40, df: 'hard' }),
        qd({ tms: 15, df: 'easy' }), // no su on a fullent entry → skipped
      ],
    });
    const groups = extractPacingSamples(r);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.subject === 'math')?.samples).toEqual([
      { df: 'easy', tms: 10 },
      { df: 'hard', tms: 40 },
    ]);
    expect(groups.find(g => g.subject === 'history')?.samples).toEqual([
      { df: 'medium', tms: 25 },
    ]);
  });

  it('falls back to _su on fullent entries', () => {
    const r = result({
      type: 'fullent',
      su: 'fullent',
      qd: [qd({ _su: 'biology', tms: 33, df: 'medium' })],
    });
    expect(extractPacingSamples(r)).toEqual([
      { subject: 'biology', samples: [{ df: 'medium', tms: 33 }] },
    ]);
  });

  it('caps samples per subject at MAX_SAMPLES_PER_POST', () => {
    const entries = Array.from({ length: MAX_SAMPLES_PER_POST + 50 }, () =>
      qd({ tms: 20, df: 'easy' }),
    );
    const groups = extractPacingSamples(result({ qd: entries }));
    expect(groups[0].samples).toHaveLength(MAX_SAMPLES_PER_POST);
  });
});

describe('statsFromSums', () => {
  it('computes mean and population stddev from running sums', () => {
    // samples: 10, 20, 30 → n=3, sum=60, sumSq=1400, mean=20, sd=sqrt(466.67-400)≈8.165
    const s = statsFromSums(3, 60, 1400);
    expect(s.n).toBe(3);
    expect(s.mean).toBe(20);
    expect(s.sd).toBeCloseTo(8.165, 3);
  });

  it('returns zeros for n = 0', () => {
    expect(statsFromSums(0, 0, 0)).toEqual({ n: 0, mean: 0, sd: 0 });
  });

  it('clamps negative variance from float error to 0', () => {
    // sum_sq/n slightly below mean^2 due to rounding
    const s = statsFromSums(2, 20, 199.9999999);
    expect(s.sd).toBe(0);
  });
});

describe('pacingBand', () => {
  it('returns null when stats are missing or n below threshold', () => {
    expect(pacingBand(undefined)).toBeNull();
    expect(pacingBand({ n: MIN_PLATFORM_N - 1, mean: 30, sd: 10 })).toBeNull();
  });

  it('returns rounded mean ± sd at the threshold', () => {
    expect(pacingBand({ n: MIN_PLATFORM_N, mean: 40, sd: 12.4 })).toEqual({ lo: 28, hi: 52 });
  });

  it('clamps the lower bound to at least 1 second', () => {
    expect(pacingBand({ n: 100, mean: 5, sd: 20 })).toEqual({ lo: 1, hi: 25 });
  });

  it('keeps hi >= lo', () => {
    const band = pacingBand({ n: 100, mean: 2, sd: 0 });
    expect(band).toEqual({ lo: 2, hi: 2 });
  });
});

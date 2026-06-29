import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs script module, no type declarations
import { splitData, stripQuestionKk, applyQuestionKk, isPassageShape } from '../utils/lang-split.mjs';

// PERF-2: language split must produce two language-self-contained arrays that preserve
// row order/count and the correct-answer index, so the runtime `_oi` (and the quarantine
// key `sid:_oi`) never shifts. These are the invariants S2 gates Phase 2 on.

describe('lang-split — flat question rows', () => {
  const rows = [
    {
      q: 'RU q1', o: ['a', 'b', 'c', 'd'], c: 2, e: 'RU e1', _topic: 't', _subtopic: 's',
      type: 'single', difficulty: 'medium',
      q_kk: 'KK q1', o_kk: ['c', 'a', 'd', 'b'], e_kk: 'KK e1',
    },
    // Untranslated row: no _kk fields at all.
    { q: 'RU q2', o: ['x', 'y'], c: 0, e: 'RU e2', _topic: 't' },
    // Matching row with pairs_kk.
    { q: 'RU q3', o: [], c: 0, e: '', type: 'matching', pairs: [['1', 'a']], pairs_kk: [['1', 'ä']], q_kk: 'KK q3' },
  ];

  const { ru, kk } = splitData(rows);

  it('preserves row count and order in both languages', () => {
    expect(ru).toHaveLength(rows.length);
    expect(kk).toHaveLength(rows.length);
  });

  it('RU view strips every _kk field but keeps RU content verbatim', () => {
    expect(ru[0]).toEqual({
      q: 'RU q1', o: ['a', 'b', 'c', 'd'], c: 2, e: 'RU e1', _topic: 't', _subtopic: 's',
      type: 'single', difficulty: 'medium',
    });
    expect(Object.keys(ru[0]).some(k => k.endsWith('_kk'))).toBe(false);
  });

  it('KK view bakes overrides in and drops _kk fields', () => {
    expect(kk[0].q).toBe('KK q1');
    expect(kk[0].o).toEqual(['c', 'a', 'd', 'b']);
    expect(kk[0].e).toBe('KK e1');
    expect(Object.keys(kk[0]).some(k => k.endsWith('_kk'))).toBe(false);
  });

  it('carries the correct-index c verbatim into both languages (no answer-key drift)', () => {
    expect(ru[0].c).toBe(2);
    expect(kk[0].c).toBe(2);
  });

  it('RU-falls-back for untranslated rows (KK row identical content, never dropped)', () => {
    expect(kk[1].q).toBe('RU q2');
    expect(kk[1].o).toEqual(['x', 'y']);
    expect(kk[1].e).toBe('RU e2');
  });

  it('applies pairs_kk for matching rows', () => {
    expect(kk[2].pairs).toEqual([['1', 'ä']]);
    expect(kk[2].q).toBe('KK q3');
  });
});

describe('lang-split — reading passages shape', () => {
  const passages = [
    {
      t: 'RU title', tx: 'RU body', t_kk: 'KK title', tx_kk: 'KK body',
      qs: [
        { q: 'RU pq', o: ['a', 'b'], c: 1, e: 'RU pe', q_kk: 'KK pq', o_kk: ['b', 'a'], e_kk: 'KK pe' },
        { q: 'RU pq2', o: ['c', 'd'], c: 0, e: '' }, // untranslated nested q
      ],
    },
  ];

  it('detects the passages shape', () => {
    expect(isPassageShape(passages)).toBe(true);
  });

  const { ru, kk } = splitData(passages);

  it('RU passage strips passage- and question-level _kk', () => {
    expect(ru[0].t).toBe('RU title');
    expect(ru[0].tx).toBe('RU body');
    expect('t_kk' in ru[0]).toBe(false);
    expect(ru[0].qs[0].q).toBe('RU pq');
    expect('q_kk' in ru[0].qs[0]).toBe(false);
  });

  it('KK passage bakes passage- and question-level KK with RU fallback', () => {
    expect(kk[0].t).toBe('KK title');
    expect(kk[0].tx).toBe('KK body');
    expect(kk[0].qs[0].q).toBe('KK pq');
    expect(kk[0].qs[0].o).toEqual(['b', 'a']);
    expect(kk[0].qs[0].c).toBe(1); // index preserved
    expect(kk[0].qs[1].q).toBe('RU pq2'); // untranslated falls back, not dropped
    expect(kk[0].qs).toHaveLength(2);
  });
});

describe('lang-split — pure helpers', () => {
  it('stripQuestionKk does not mutate input', () => {
    const q = { q: 'a', o: ['x'], c: 0, e: '', q_kk: 'b' };
    const out = stripQuestionKk(q);
    expect(q.q_kk).toBe('b');
    expect('q_kk' in out).toBe(false);
  });
  it('applyQuestionKk keeps RU option array when o_kk is empty', () => {
    const out = applyQuestionKk({ q: 'a', o: ['x', 'y'], c: 0, e: '', o_kk: [] });
    expect(out.o).toEqual(['x', 'y']);
  });
});

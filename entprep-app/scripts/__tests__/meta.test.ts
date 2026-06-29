import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs script module, no type declarations
import { computeMeta, flattenWithOi } from '../utils/meta.mjs';

// PERF-1: <sid>.meta.json must carry the SAME counts SubjectDetail used to derive from
// getPool → filterQuarantined (post-quarantine), keyed by the same `_oi` (non-reading:
// array index; reading passages: pi*5+qi), so the displayed numbers don't shift.

describe('meta — flat question rows', () => {
  const data = [
    { q: 'q0', o: ['a'], c: 0, e: '', _topic: 'algebra', _subtopic: 'linear' },
    { q: 'q1', o: ['a'], c: 0, e: '', _topic: 'algebra', _subtopic: 'quadratic' },
    { q: 'q2', o: ['a'], c: 0, e: '', _topic: 'geometry', _subtopic: 'linear' },
    { q: 'q3', o: ['a'], c: 0, e: '', _topic: 'geometry' }, // no subtopic
  ];

  it('counts topics/subtopics and total (no quarantine)', () => {
    const m = computeMeta(data, new Set());
    expect(m.total).toBe(4);
    expect(m.hasSubtopics).toBe(true);
    expect(m.topicCounts).toEqual({ algebra: 2, geometry: 2 });
    expect(m.subtopicCounts).toEqual({ linear: 2, quadratic: 1 });
  });

  it('excludes quarantined _oi from total and counts', () => {
    // _oi here is the array index; quarantine index 0 (algebra/linear) and 3 (geometry).
    const m = computeMeta(data, new Set([0, 3]));
    expect(m.total).toBe(2);
    expect(m.topicCounts).toEqual({ algebra: 1, geometry: 1 });
    expect(m.subtopicCounts).toEqual({ linear: 1, quadratic: 1 });
  });

  it('hasSubtopics is false when no row carries a subtopic', () => {
    const m = computeMeta([{ q: 'x', o: ['a'], c: 0, e: '', _topic: 't' }], new Set());
    expect(m.hasSubtopics).toBe(false);
    expect(m.subtopicCounts).toEqual({});
  });
});

describe('meta — reading passage shape', () => {
  const passages = [
    { t: 'P0', tx: '...', qs: [
      { q: 'p0q0', o: ['a'], c: 0, e: '', _topic: 'reading', _subtopic: 'main-idea' },
      { q: 'p0q1', o: ['a'], c: 0, e: '', _topic: 'reading', _subtopic: 'detail' },
    ] },
    { t: 'P1', tx: '...', qs: [
      { q: 'p1q0', o: ['a'], c: 0, e: '', _topic: 'reading', _subtopic: 'main-idea' },
    ] },
  ];

  it('flattens passages with _oi = pi*5 + qi', () => {
    const flat = flattenWithOi(passages);
    expect(flat.map((q: { _oi: number }) => q._oi)).toEqual([0, 1, 5]);
  });

  it('quarantine by the passage-derived _oi excludes the right question', () => {
    // Quarantine _oi=5 (p1q0). Remaining: p0q0 (main-idea), p0q1 (detail).
    const m = computeMeta(passages, new Set([5]));
    expect(m.total).toBe(2);
    expect(m.topicCounts).toEqual({ reading: 2 });
    expect(m.subtopicCounts).toEqual({ 'main-idea': 1, detail: 1 });
  });
});

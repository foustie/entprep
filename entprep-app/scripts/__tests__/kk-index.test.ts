import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs script module, no type declarations
import { computeFix, isMisKeyed, isExactPermutation } from '../utils/kk-index.mjs';

describe('I18N-1 detection (kk-index)', () => {
  it('flags a mis-keyed row: o_kk is an exact permutation of o with c misplaced', () => {
    const o = ['1s²2s²2p⁶3s¹', '1s²2s²2p⁶', '1s²2s²2p⁵', '1s²2s²2p⁶3s²'];
    const q = { q: 'Атом натрия', o, o_kk: o.slice().reverse(), c: 3 };
    // o[3] is the truly-correct option; o_kk[3] holds a different string -> mis-keyed.
    expect(isMisKeyed(q)).toBe(true);
    // The fix realigns o_kk to o's order.
    expect(computeFix(q)).toEqual(o);
  });

  it('passes an aligned row: o_kk identical order to o', () => {
    const q = { q: '', o: ['NaOH', 'Na₂O', 'NaCl'], o_kk: ['NaOH', 'Na₂O', 'NaCl'], c: 0 };
    expect(isMisKeyed(q)).toBe(false);
    expect(computeFix(q)).toBeNull();
  });

  it('passes a permuted row whose correct index still points to the right string', () => {
    // o_kk is a permutation, but the correct option (index 1) happens to be in place.
    const q = { q: '', o: ['A', 'B', 'C'], o_kk: ['C', 'B', 'A'], c: 1 };
    expect(isMisKeyed(q)).toBe(false);
  });

  it('ignores genuinely translated options (not a permutation -> I18N-2, out of scope)', () => {
    const q = { q: '', o: ['Yes', 'No'], o_kk: ['Иә', 'Жоқ'], c: 0 };
    expect(isExactPermutation(q.o, q.o_kk)).toBe(false);
    expect(isMisKeyed(q)).toBe(false);
  });

  it('ignores matching-type rows', () => {
    const q = { q: '', type: 'matching', o: ['A', 'B'], o_kk: ['B', 'A'], c: 0, pairs: [[1, 2]] };
    expect(isMisKeyed(q)).toBe(false);
  });

  it('handles multiple-answer (array c): mis-keyed when any correct index is displaced', () => {
    const q = { q: '', o: ['A', 'B', 'C', 'D'], o_kk: ['B', 'A', 'C', 'D'], c: [0, 2] };
    // o_kk[0]='B' != o[0]='A' -> displaced.
    expect(isMisKeyed(q)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { buildQd, clampQdTime, qdDifficulty, QD_TIME_CAP } from '../qdHelpers';
import type { Question } from '../../types';

const mkQ = (overrides: Partial<Question> = {}): Question => ({
  q: 'Q?',
  o: ['a', 'b', 'c', 'd'],
  c: 1,
  e: '',
  _oi: 7,
  _topic: 'tp1',
  _subtopic: 'stp1',
  ...overrides,
});

describe('qdHelpers', () => {
  describe('clampQdTime', () => {
    it('rounds to whole seconds', () => {
      expect(clampQdTime(4.4)).toBe(4);
      expect(clampQdTime(4.6)).toBe(5);
    });
    it('clamps to [0, 600]', () => {
      expect(clampQdTime(-3)).toBe(0);
      expect(clampQdTime(99999)).toBe(QD_TIME_CAP);
      expect(QD_TIME_CAP).toBe(600);
    });
    it('handles non-finite input', () => {
      expect(clampQdTime(NaN)).toBe(0);
      expect(clampQdTime(Infinity)).toBe(QD_TIME_CAP);
    });
  });

  describe('qdDifficulty', () => {
    it('returns the question difficulty', () => {
      expect(qdDifficulty(mkQ({ difficulty: 'hard' }))).toBe('hard');
    });
    it('defaults to medium when missing', () => {
      expect(qdDifficulty(mkQ())).toBe('medium');
    });
  });

  describe('buildQd', () => {
    it('carries tms and df on every entry', () => {
      const qs = [mkQ({ _oi: 0, difficulty: 'easy' }), mkQ({ _oi: 1, difficulty: 'hard' })];
      const qd = buildQd(qs, { 0: 1, 1: 0 }, { 0: 12.4, 1: 700 });
      expect(qd[0]).toMatchObject({ oi: 0, ok: true, tms: 12, df: 'easy', picked: 1 });
      expect(qd[1]).toMatchObject({ oi: 1, ok: false, tms: 600, df: 'hard', picked: 0 });
    });
    it('keeps topic/subtopic and leaves tms undefined for unanswered questions', () => {
      const qd = buildQd([mkQ()], {}, {});
      expect(qd[0]).toMatchObject({ oi: 7, ok: false, tp: 'tp1', stp: 'stp1', picked: null, df: 'medium' });
      expect(qd[0].tms).toBeUndefined();
    });
    it('works without a times map (backwards compatible call)', () => {
      const qd = buildQd([mkQ()], { 0: 1 });
      expect(qd[0].ok).toBe(true);
      expect(qd[0].tms).toBeUndefined();
      expect(qd[0].df).toBe('medium');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mergeData } from '../cloudSync';
import type { TestResult, Settings } from '../../types/index';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ST: Settings = { exp: true, tmr: true, shf: true };
const cd = (hist: TestResult[]) => ({ hist, prof: [] as string[], st: ST, srCards: [] });

// A Full-ENT result like the one in the bug report: sc is ALWAYS 0 for Full-ENT
// (no top-level score is stored), so the composite dedup key collides easily —
// which is exactly why these runs duplicated across a local+cloud sync.
const fullent = (over: Partial<TestResult> = {}): TestResult => ({
  type: 'fullent', su: 'fullent', sc: 0, co: 22, to: 140, dt: '15.06.2026', tm: 4321,
  sections: [{ sid: 'history', pts: 6 }, { sid: 'physics', pts: 0 }], ...over,
});

// ── Regression: one Full-ENT run shown twice (local + cloud copy of same run) ──
describe('mergeData — history dedup (Full-ENT duplicate bug)', () => {
  it('collapses the same id-less run present in both local and cloud to ONE', () => {
    const run = fullent(); // legacy entry, no id
    const merged = mergeData(cd([run]), cd([run]));
    expect(merged.hist).toHaveLength(1);
  });

  it('does not compound an already-duplicated history (2 + 2 → 1)', () => {
    // Models a history that already grew under the old counter-cap logic.
    const run = fullent();
    const merged = mergeData(cd([run, run]), cd([run, run]));
    expect(merged.hist).toHaveLength(1);
  });

  it('dedups by stable id even when score and time collide', () => {
    const a = fullent({ id: 'X' });
    const merged = mergeData(cd([a]), cd([{ ...a }])); // same id on both sides
    expect(merged.hist).toHaveLength(1);
    expect(merged.hist[0].id).toBe('X');
  });

  it('keeps two genuinely different runs (different id)', () => {
    const merged = mergeData(cd([fullent({ id: 'X' })]), cd([fullent({ id: 'Y' })]));
    expect(merged.hist).toHaveLength(2);
  });

  it('keeps two legacy runs that differ only in time taken', () => {
    const merged = mergeData(cd([fullent({ tm: 4321 })]), cd([fullent({ tm: 5000 })]));
    expect(merged.hist).toHaveLength(2);
  });

  it('preserves a cloud-only entry not present locally', () => {
    const local = fullent({ id: 'L' });
    const cloudOnly = fullent({ id: 'C' });
    const merged = mergeData(cd([local]), cd([local, cloudOnly]));
    expect(merged.hist.map(h => h.id).sort()).toEqual(['C', 'L']);
  });

  it('preserves a local-only entry not present in cloud', () => {
    const merged = mergeData(cd([fullent({ id: 'L' })]), cd([fullent({ id: 'C' })]));
    expect(merged.hist.map(h => h.id).sort()).toEqual(['C', 'L']);
  });

  it('returns the other side intact when one side is null', () => {
    expect(mergeData(cd([fullent({ id: 'X' })]), null).hist).toHaveLength(1);
    expect(mergeData(null, cd([fullent({ id: 'Y' })])).hist).toHaveLength(1);
  });
});

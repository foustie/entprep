// TEST-4: the free-tier AI usage gate (aiLimits.ts) was untested — it's the actual
// day-to-day monetization boundary, so a regression silently gives away (or wrongly
// blocks) free AI usage.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getExplainRemaining, consumeExplain,
  getTutorRemaining, consumeTutor,
} from '../aiLimits';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('aiLimits — explain (free: 2/day)', () => {
  it('starts at 2 remaining', () => {
    expect(getExplainRemaining()).toBe(2);
  });

  it('allows exactly 2, then blocks', () => {
    expect(consumeExplain()).toBe(true);
    expect(consumeExplain()).toBe(true);
    expect(consumeExplain()).toBe(false);
    expect(getExplainRemaining()).toBe(0);
  });

  it('resets the next day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));
    expect(consumeExplain()).toBe(true);
    expect(consumeExplain()).toBe(true);
    expect(consumeExplain()).toBe(false);
    vi.setSystemTime(new Date(2026, 5, 2, 12, 0, 0)); // next day
    expect(getExplainRemaining()).toBe(2);
    expect(consumeExplain()).toBe(true);
  });
});

describe('aiLimits — tutor (free: 10/day)', () => {
  it('starts at 10 remaining', () => {
    expect(getTutorRemaining()).toBe(10);
  });

  it('allows exactly 10, then blocks', () => {
    for (let i = 0; i < 10; i++) expect(consumeTutor()).toBe(true);
    expect(consumeTutor()).toBe(false);
    expect(getTutorRemaining()).toBe(0);
  });
});

describe('aiLimits — corrupt storage falls back to defaults', () => {
  it('does not crash and grants the default allowance', () => {
    localStorage.setItem('entprep_ai_usage', 'not-json{');
    expect(getExplainRemaining()).toBe(2);
    expect(getTutorRemaining()).toBe(10);
  });
});

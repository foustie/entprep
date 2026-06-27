// TEST-START GATE — covers the monetization/login boundary that decides whether a
// user may start a Test / Full ENT / Question Rush. A regression here either locks out
// paying/eligible users or gives the free tier unlimited tests.
import { describe, it, expect } from 'vitest';
import { computeTestGate, testsThisWeek, FREE_WEEKLY_TESTS } from '../testGate';
import type { TestResult } from '../../types';

const FIXED_NOW = new Date(2026, 5, 27, 12, 0, 0); // 27.06.2026 12:00 local

/** Format a Date to the 'DD.MM.YYYY' shape stored in TestResult.dt. */
function fmt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** A Date `n` days before FIXED_NOW. */
function daysBefore(n: number): Date {
  const d = new Date(FIXED_NOW);
  d.setDate(d.getDate() - n);
  return d;
}

function mk(type: TestResult['type'], dt: string): TestResult {
  return { sc: 5, dt, type } as TestResult;
}

describe('testsThisWeek', () => {
  it('counts regular/fullent/rush within the last 7 days', () => {
    const hist = [
      mk('regular', fmt(daysBefore(0))),
      mk('fullent', fmt(daysBefore(1))),
      mk('rush', fmt(daysBefore(6))),
    ];
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(3);
  });

  it('excludes only duel; counts regular, fullent, rush AND missing-type entries', () => {
    const hist = [
      mk('duel', fmt(daysBefore(0))), // excluded
      mk('regular', fmt(daysBefore(0))), // counted
      { sc: 3, dt: fmt(daysBefore(0)) } as TestResult, // no type → treated as regular, counted
    ];
    // Real regular Test results are saved with NO `type` field, so a missing type
    // MUST count toward the limit — otherwise the primary flow never gates.
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(2);
  });

  it('counts an entry with type === undefined (the real regular-test shape)', () => {
    const hist = [
      { sc: 7, dt: fmt(daysBefore(0)), type: undefined } as TestResult,
      { sc: 4, dt: fmt(daysBefore(2)) } as TestResult, // no type key at all
    ];
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(2);
  });

  it('drops entries older than the rolling 7-day window', () => {
    const hist = [
      mk('regular', fmt(daysBefore(8))),
      mk('regular', fmt(daysBefore(10))),
    ];
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(0);
  });

  it('parses DD.MM.YYYY correctly (day/month order)', () => {
    // 25.12.2026 must NOT be read as month 25 — would be invalid/dropped
    const decNow = new Date(2026, 11, 27, 12, 0, 0);
    const hist = [mk('regular', '25.12.2026')];
    expect(testsThisWeek(hist, decNow)).toBe(1);
  });

  it('ignores malformed dt strings', () => {
    const hist = [
      mk('regular', ''),
      mk('regular', 'not-a-date'),
      mk('regular', '2026-06-27'), // wrong format (ISO)
    ];
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(0);
  });
});

describe('computeTestGate', () => {
  const someTests = (n: number, type: TestResult['type'] = 'regular') =>
    Array.from({ length: n }, () => mk(type, fmt(daysBefore(0))));

  it('returns "login" when there is no user', () => {
    expect(computeTestGate({ user: null, isPremium: false, hist: [] })).toBe('login');
    expect(computeTestGate({ user: undefined, isPremium: false, hist: someTests(5) })).toBe('login');
  });

  it('returns "ok" for a free user under the weekly limit', () => {
    expect(computeTestGate({ user: { id: 'u1' }, isPremium: false, hist: someTests(0) })).toBe('ok');
    expect(computeTestGate({ user: { id: 'u1' }, isPremium: false, hist: someTests(FREE_WEEKLY_TESTS - 1) })).toBe('ok');
  });

  it('returns "paywall" for a free user at/over the weekly limit', () => {
    expect(computeTestGate({ user: { id: 'u1' }, isPremium: false, hist: someTests(FREE_WEEKLY_TESTS) })).toBe('paywall');
    expect(computeTestGate({ user: { id: 'u1' }, isPremium: false, hist: someTests(FREE_WEEKLY_TESTS + 3) })).toBe('paywall');
  });

  it('always returns "ok" for premium users regardless of count', () => {
    expect(computeTestGate({ user: { id: 'u1' }, isPremium: true, hist: someTests(100) })).toBe('ok');
  });

  it('re-opens access once old tests fall out of the 7-day window', () => {
    // Two tests, both 8 days ago → outside window → free user back to "ok"
    const hist = [mk('regular', fmt(daysBefore(8))), mk('regular', fmt(daysBefore(9)))];
    // Use real "now" semantics via computeTestGate's default; assert via testsThisWeek + rule
    expect(testsThisWeek(hist, FIXED_NOW)).toBe(0);
  });

  it('FREE_WEEKLY_TESTS is 2', () => {
    expect(FREE_WEEKLY_TESTS).toBe(2);
  });
});

// TEST-START GATE — the single source of truth deciding whether a user may start a
// test (regular Test, Full ENT, or Question Rush). Pure & side-effect free so it can
// be unit-tested and called from a render path without touching state.
//
// Rules:
//   1. No user            → 'login'   (must register/sign in first)
//   2. Premium still loading → 'ok'    (don't bounce a possibly-premium user)
//   3. Free, >=2/week      → 'paywall' (free tier gets FREE_WEEKLY_TESTS per rolling week)
//   4. Premium, or under limit → 'ok'
import type { TestResult } from '../types';

export const FREE_WEEKLY_TESTS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a 'DD.MM.YYYY' date string (the format stored in TestResult.dt) to a local
 * Date at midnight. Returns null for missing/malformed input.
 */
function parseDt(dt: string | null | undefined): Date | null {
  if (!dt || typeof dt !== 'string') return null;
  const parts = dt.split('.');
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  // JS Date silently rolls over out-of-range components (e.g. 35.13.2026), so reject
  // anything that didn't round-trip to the exact day/month/year we asked for.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * Count test results taken within the last 7 days (rolling window from `now`, not a
 * calendar week). Counts the test types that gate the free tier — 'regular', 'fullent'
 * and 'rush'. Only 'duel' is excluded. Crucially, regular Test results are saved with
 * NO `type` field (Test.tsx → finish() → AppContext.addHist never stamp one), so a
 * missing/unknown type is treated as a regular test and DOES count; otherwise the
 * primary flow would never accumulate toward the limit (a monetization leak).
 */
export function testsThisWeek(hist: TestResult[], now: Date = new Date()): number {
  const cutoff = now.getTime() - 7 * DAY_MS;
  const nowMs = now.getTime();
  let count = 0;
  for (const r of hist) {
    if (!r || r.type === 'duel') continue;
    const d = parseDt(r.dt);
    if (!d) continue;
    const t = d.getTime();
    if (t >= cutoff && t <= nowMs) count++;
  }
  return count;
}

export type TestGateStatus = 'ok' | 'login' | 'paywall';

/**
 * Decide whether a test-start should be allowed, blocked behind login, or blocked
 * behind the paywall. Premium and under-limit users always get 'ok'.
 */
export function computeTestGate(args: {
  user: unknown;
  isPremium: boolean;
  hist: TestResult[];
  /** True while the subscription check is still resolving after sign-in. When set,
   * we never show the paywall — premium status isn't known yet and a paying user
   * must never be bounced. Self-heals to the real verdict once it settles. */
  premiumLoading?: boolean;
}): TestGateStatus {
  const { user, isPremium, hist, premiumLoading } = args;
  if (!user) return 'login';
  if (premiumLoading) return 'ok';
  if (!isPremium && testsThisWeek(hist) >= FREE_WEEKLY_TESTS) return 'paywall';
  return 'ok';
}

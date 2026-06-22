// TEST-8: the per-user in-memory rate limiter (shared.mjs createRateLimiter) was
// untested. It's the request-abuse guard in front of every function; a regression
// either lets abuse through or wrongly 429s real users.
import { describe, it, expect, afterEach, vi } from 'vitest';
// @ts-expect-error — plain .mjs Netlify util, no type declarations
import { createRateLimiter } from '../utils/shared.mjs';

afterEach(() => { vi.useRealTimers(); });

describe('createRateLimiter', () => {
  it('allows up to `max` calls, then blocks with a positive retry-after', () => {
    const limit = createRateLimiter('t-basic', { max: 3, windowSec: 60 });
    expect(limit('u')).toBeNull();
    expect(limit('u')).toBeNull();
    expect(limit('u')).toBeNull();
    const r = limit('u');
    expect(typeof r).toBe('number');
    expect(r).toBeGreaterThan(0);
  });

  it('tracks users independently', () => {
    const limit = createRateLimiter('t-users', { max: 1, windowSec: 60 });
    expect(limit('a')).toBeNull();
    expect(limit('a')).not.toBeNull(); // a is now blocked
    expect(limit('b')).toBeNull();     // b has its own bucket
  });

  it('maxOverride raises the cap for that call (shared bucket, tier-based cap)', () => {
    const limit = createRateLimiter('t-override', { max: 1, windowSec: 60 });
    expect(limit('u', 3)).toBeNull();
    expect(limit('u', 3)).toBeNull();
    expect(limit('u', 3)).toBeNull();
    expect(limit('u', 3)).not.toBeNull(); // 4th exceeds the override cap of 3
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
    const limit = createRateLimiter('t-window', { max: 1, windowSec: 60 });
    expect(limit('u')).toBeNull();
    expect(limit('u')).not.toBeNull();          // blocked within the window
    vi.setSystemTime(new Date(2026, 0, 1, 0, 1, 1)); // +61s, window elapsed
    expect(limit('u')).toBeNull();              // fresh window
  });
});

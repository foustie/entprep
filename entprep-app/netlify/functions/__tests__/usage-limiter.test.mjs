// PAY-8 / OPS-7: the durable daily usage limiter (shared.mjs checkDailyLimit + kzDay),
// backed by the usage_limits table + increment_usage RPC (migration 20260629). Unlike
// the in-memory createRateLimiter, this counter must survive cold starts and be shared
// across instances — the tests below prove the limiter delegates to a shared store and
// fails OPEN on infra errors.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @ts-expect-error — plain .mjs Netlify util, no type declarations
import { checkDailyLimit, kzDay } from '../utils/shared.mjs';

const realFetch = globalThis.fetch;
const ENV = { ...process.env };

beforeEach(() => {
  // checkDailyLimit short-circuits to fail-open unless these are set, so set them; the
  // fetch itself is mocked per-test, so the values are irrelevant beyond being truthy.
  process.env.VITE_SUPABASE_URL = 'https://db.example.test';
  process.env.SUPABASE_SERVICE_KEY = 'service-key';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...ENV };
  vi.useRealTimers();
});

// A stateful fake of the increment_usage RPC + usage_limits table. The single shared
// `table` Map stands in for the Supabase row that ALL Netlify instances read/write —
// the whole point of PAY-8/OPS-7. Mirrors the SQL: atomic check-and-increment, returns
// the new count or -1 when the cap is already reached.
function makeFakeSupabase() {
  const table = new Map(); // "user|bucket|day" -> count
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    if (!String(url).includes('/rest/v1/rpc/increment_usage')) return { ok: false, json: async () => null };
    const { p_user_id, p_bucket, p_day, p_max } = JSON.parse(opts.body);
    const key = `${p_user_id}|${p_bucket}|${p_day}`;
    const cur = table.get(key) || 0;
    if (p_max < 1 || cur >= p_max) return { ok: true, json: async () => -1 };
    const next = cur + 1;
    table.set(key, next);
    return { ok: true, json: async () => next };
  };
  return { table, calls };
}

describe('kzDay', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(kzDay(new Date('2026-06-29T08:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses the KZ (Asia/Almaty, UTC+5) calendar day, not UTC', () => {
    // 2026-06-29T20:30:00Z is 2026-06-30 01:30 in Almaty (+5) → the KZ day has rolled over.
    expect(kzDay(new Date('2026-06-29T20:30:00Z'))).toBe('2026-06-30');
    // 2026-06-29T18:30:00Z is 2026-06-29 23:30 in Almaty → still the 29th.
    expect(kzDay(new Date('2026-06-29T18:30:00Z'))).toBe('2026-06-29');
  });
});

describe('checkDailyLimit', () => {
  it('allows up to `max`, then blocks (count never exceeds the cap)', async () => {
    makeFakeSupabase();
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: true, count: 1 });
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: true, count: 2 });
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: false, count: 2 });
    // Still blocked on subsequent attempts.
    expect((await checkDailyLimit('u', 'explain', 2)).allowed).toBe(false);
  });

  it('PERSISTENCE: a second "instance" sees the first instance\'s increments (shared store)', async () => {
    // The fake's single `table` Map IS the shared Supabase row. Two sequential calls
    // model two different Lambda instances hitting the same durable counter — something
    // the per-instance in-memory createRateLimiter could NOT do (that is the PAY-8 bug).
    const { table } = makeFakeSupabase();
    await checkDailyLimit('u', 'tutor', 10); // "instance A" → count 1
    await checkDailyLimit('u', 'tutor', 10); // "instance B" → count 2 (sees A's write)
    expect(table.get(`u|tutor|${kzDay()}`)).toBe(2);
  });

  it('tracks buckets and users independently', async () => {
    makeFakeSupabase();
    expect((await checkDailyLimit('a', 'explain', 1)).allowed).toBe(true);
    expect((await checkDailyLimit('a', 'explain', 1)).allowed).toBe(false); // a/explain exhausted
    expect((await checkDailyLimit('a', 'focus', 1)).allowed).toBe(true);    // different bucket
    expect((await checkDailyLimit('b', 'explain', 1)).allowed).toBe(true);  // different user
  });

  it('keys the window by KZ day (a new day resets the count)', async () => {
    makeFakeSupabase();
    expect((await checkDailyLimit('u', 'explain', 1, { day: '2026-06-29' })).allowed).toBe(true);
    expect((await checkDailyLimit('u', 'explain', 1, { day: '2026-06-29' })).allowed).toBe(false);
    expect((await checkDailyLimit('u', 'explain', 1, { day: '2026-06-30' })).allowed).toBe(true); // fresh day
  });

  it('sends the correct RPC payload (atomic check-and-increment args)', async () => {
    const { calls } = makeFakeSupabase();
    await checkDailyLimit('user-1', 'tutor-vision', 20, { day: '2026-06-29' });
    expect(calls[0].url).toContain('/rest/v1/rpc/increment_usage');
    expect(calls[0].body).toEqual({ p_user_id: 'user-1', p_bucket: 'tutor-vision', p_day: '2026-06-29', p_max: 20 });
  });

  it('FAIL-OPEN: RPC returns non-OK → allowed + degraded (never block a paying user on a DB hiccup)', async () => {
    globalThis.fetch = async () => ({ ok: false, json: async () => null });
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: true, count: 0, degraded: true });
  });

  it('FAIL-OPEN: fetch throws → allowed + degraded', async () => {
    globalThis.fetch = async () => { throw new Error('network down'); };
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: true, count: 0, degraded: true });
  });

  it('FAIL-OPEN: Supabase env not configured → allowed + degraded (no fetch attempted)', async () => {
    delete process.env.VITE_SUPABASE_URL;
    let called = false;
    globalThis.fetch = async () => { called = true; return { ok: true, json: async () => 1 }; };
    expect(await checkDailyLimit('u', 'explain', 2)).toEqual({ allowed: true, count: 0, degraded: true });
    expect(called).toBe(false);
  });

  it('tolerates array / object RPC response shapes (PostgREST variants)', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => [3] });
    expect(await checkDailyLimit('u', 'explain', 5)).toEqual({ allowed: true, count: 3 });
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ increment_usage: -1 }) });
    expect(await checkDailyLimit('u', 'explain', 5)).toEqual({ allowed: false, count: 5 });
  });
});

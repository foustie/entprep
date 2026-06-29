// PAY-9 (soft): study-plan-focus durable cost-cap. Unlike ai-explain this is NOT a hard
// 402 — focus is a graceful, visible-to-all polish, so over the daily cap the handler skips
// the AI call and returns empty focus (200), and free/premium get different ceilings
// (3 vs 30/day). Each test uses a distinct userId so the per-minute burst limiter (5/min)
// never accumulates across tests.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// @ts-expect-error — plain .mjs Netlify function, no type declarations
import handler from '../study-plan-focus.mjs';

const realFetch = globalThis.fetch;
const ENV = { ...process.env };

const FOCUS = {
  lang: 'ru',
  target: 120,
  examDate: '2026-09-01',
  weeks: [
    { weekNum: 1, phase: 'foundation', subjects: ['Математика'], topics: ['Алгебра'] },
    { weekNum: 2, phase: 'build', subjects: ['Физика'], topics: ['Кинематика'] },
  ],
  weak: [],
  strong: [],
};

function makeReq(body = FOCUS, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.authorization = 'Bearer test-token';
  return new Request('https://entprep.org/api/study-plan-focus', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function mockBackend({ userId = 'f-user', premium = false, quotaBlocked = false } = {}) {
  const calls = [];
  const quotaBodies = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) { calls.push('auth'); return { ok: true, json: async () => ({ id: userId }) }; }
    if (u.includes('/subscriptions')) { calls.push('premium'); return { ok: true, json: async () => (premium ? [{ is_active: true, expires_at: null }] : []) }; }
    if (u.includes('/rpc/increment_usage')) { calls.push('quota'); quotaBodies.push(JSON.parse(init.body)); return { ok: true, json: async () => (quotaBlocked ? -1 : 1) }; }
    if (u.includes('openrouter.ai')) { calls.push('ai'); return { ok: true, json: async () => ({ choices: [{ message: { content: '{"weeks":[{"weekNum":1,"focus":"Фокус","tips":[{"text":"Задача"}]}]}' } }] }) }; }
    calls.push('other'); return { ok: false, json: async () => null };
  };
  return { calls, quotaBodies };
}

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://db.example.test';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_KEY = 'service';
  process.env.AI_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-ai-key';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...ENV };
});

describe('study-plan-focus soft cost-cap (PAY-9)', () => {
  it('unauthorized request → 401', async () => {
    mockBackend({ userId: 'sf-unauth' });
    const res = await handler(makeReq(FOCUS, { auth: false }));
    expect(res.status).toBe(401);
  });

  it('free user OVER the cap → graceful {weeks:[]} 200, AI NOT called (no 402, no spend)', async () => {
    const { calls } = mockBackend({ userId: 'sf-over', premium: false, quotaBlocked: true });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);            // graceful, never 402
    expect(await res.json()).toEqual({ weeks: [] });
    expect(calls).toContain('quota');
    expect(calls).not.toContain('ai');       // AI spend skipped when capped
  });

  it('free user UNDER the cap → 200 with AI focus; quota cap = 3', async () => {
    const { calls, quotaBodies } = mockBackend({ userId: 'sf-under', premium: false, quotaBlocked: false });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(calls).toContain('quota');
    expect(calls).toContain('ai');
    expect(quotaBodies[0].p_max).toBe(3);    // FOCUS_FREE_DAILY
    expect((await res.json()).weeks.length).toBeGreaterThan(0);
  });

  it('premium user gets the higher ceiling: quota cap = 30', async () => {
    const { calls, quotaBodies } = mockBackend({ userId: 'sf-prem', premium: true, quotaBlocked: false });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(calls).toContain('quota');
    expect(quotaBodies[0].p_max).toBe(30);   // FOCUS_PREMIUM_DAILY
  });
});

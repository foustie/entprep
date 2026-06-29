// ai-tutor handler gate: proves auth (401), the DURABLE daily cap → 429 (PAY-8, now via
// checkDailyLimit), the happy path → 200, and the S4-R1 in-memory burst backstop → 429.
// Auth / premium / durable-quota / AI all flow through global.fetch; the burst limiter is
// in-memory so it does NOT appear as a fetch.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// @ts-expect-error — plain .mjs Netlify function, no type declarations
import handler from '../ai-tutor.mjs';

const realFetch = globalThis.fetch;
const ENV = { ...process.env };

const TUTOR = { messages: [{ role: 'user', content: 'Объясни теорему Пифагора' }], lang: 'ru', mode: 'chat' };

function makeReq(body = TUTOR, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.authorization = 'Bearer test-token';
  return new Request('https://entprep.org/api/ai-tutor', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function mockBackend({ userId = 't-user', premium = false, dailyBlocked = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) { calls.push('auth'); return { ok: true, json: async () => ({ id: userId }) }; }
    if (u.includes('/subscriptions')) { calls.push('premium'); return { ok: true, json: async () => (premium ? [{ is_active: true, expires_at: null }] : []) }; }
    if (u.includes('/rpc/increment_usage')) { calls.push('quota'); return { ok: true, json: async () => (dailyBlocked ? -1 : 1) }; }
    if (u.includes('openrouter.ai')) { calls.push('ai'); return { ok: true, json: async () => ({ choices: [{ message: { content: 'Теорема Пифагора: c² = a² + b².' } }] }) }; }
    calls.push('other'); return { ok: false, json: async () => null };
  };
  return { calls };
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

describe('ai-tutor handler gate', () => {
  it('unauthorized request → 401', async () => {
    mockBackend({ userId: 't-unauth' });
    const res = await handler(makeReq(TUTOR, { auth: false }));
    expect(res.status).toBe(401);
  });

  it('durable daily cap reached → 429, AI NOT called (PAY-8 fix)', async () => {
    const { calls } = mockBackend({ userId: 't-daily', dailyBlocked: true });
    const res = await handler(makeReq());
    expect(res.status).toBe(429);
    expect(calls).toContain('quota');
    expect(calls).not.toContain('ai');
    expect((await res.json()).error).toContain('Лимит'); // custom tutor daily message
  });

  it('within limits → 200 with text', async () => {
    const { calls } = mockBackend({ userId: 't-ok' });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(calls).toContain('ai');
    expect((await res.json()).text).toBeTruthy();
  });

  it('S4-R1 burst backstop: 21st call in the window → 429 (in-memory, generic message)', async () => {
    mockBackend({ userId: 't-burst' }); // daily always allowed (dailyBlocked:false)
    for (let i = 0; i < 20; i++) {
      const ok = await handler(makeReq());
      expect(ok.status).toBe(200);
    }
    const blocked = await handler(makeReq());
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('Слишком много запросов. Подождите.'); // rateLimitResponse, not the daily message
  });
});

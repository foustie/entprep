// PAY-9: ai-explain SERVER gate. Proves the DoD — unauthorized → 401; a free user over
// the daily quota → 402 (AI never called); an honest free user under quota → 200; and a
// premium user bypasses the quota entirely. The handler's auth, premium check, durable
// quota (increment_usage RPC) and the AI completion all flow through global.fetch, so we
// route fetch by URL to drive each path and assert what was / wasn't hit.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// @ts-expect-error — plain .mjs Netlify function, no type declarations
import handler from '../ai-explain.mjs';

const realFetch = globalThis.fetch;
const ENV = { ...process.env };

// No `subject` → the RAG path is skipped (subject falsy), keeping the AI fetch the only
// "ai" call. validateExplain passes on this single-choice shape.
const VALID = {
  question: 'Сколько будет 2+2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: 1,
  userAnswer: 0,
  questionType: 'single',
  lang: 'ru',
};

function makeReq(body = VALID, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.authorization = 'Bearer test-token';
  return new Request('https://entprep.org/api/ai-explain', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function mockBackend({ premium = false, quotaBlocked = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) { calls.push('auth'); return { ok: true, json: async () => ({ id: 'u1', email: 'u@x.io' }) }; }
    if (u.includes('/subscriptions')) { calls.push('premium'); return { ok: true, json: async () => (premium ? [{ is_active: true, expires_at: null }] : []) }; }
    if (u.includes('/rpc/increment_usage')) { calls.push('quota'); return { ok: true, json: async () => (quotaBlocked ? -1 : 1) }; }
    if (u.includes('openrouter.ai')) { calls.push('ai'); return { ok: true, json: async () => ({ choices: [{ message: { content: '{"short":"s","detailed":"d"}' } }] }) }; }
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

describe('ai-explain server gate (PAY-9)', () => {
  it('unauthorized request → 401 (no Bearer token)', async () => {
    mockBackend();
    const res = await handler(makeReq(VALID, { auth: false }));
    expect(res.status).toBe(401);
  });

  it('free user OVER the daily quota → 402, and the AI is NOT called', async () => {
    const { calls } = mockBackend({ premium: false, quotaBlocked: true });
    const res = await handler(makeReq());
    expect(res.status).toBe(402);
    expect(calls).toContain('quota');
    expect(calls).not.toContain('ai'); // blocked before any AI spend
    expect((await res.json()).error).toBeTruthy();
  });

  it('free user UNDER the daily quota → 200 (honest user passes the gate)', async () => {
    const { calls } = mockBackend({ premium: false, quotaBlocked: false });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(calls).toContain('quota'); // quota consulted + consumed atomically
    expect(calls).toContain('ai');    // proceeded to the AI call
    expect((await res.json()).short).toBeTruthy();
  });

  it('premium user BYPASSES the quota → 200, increment_usage never called', async () => {
    const { calls } = mockBackend({ premium: true });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(calls).not.toContain('quota'); // premium is uncapped
    expect(calls).toContain('ai');
  });

  it('blocked free user gets the Kazakh message when lang=kk', async () => {
    mockBackend({ quotaBlocked: true });
    const res = await handler(makeReq({ ...VALID, lang: 'kk' }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toContain('Premium'); // KK copy mentions Premium
  });
});

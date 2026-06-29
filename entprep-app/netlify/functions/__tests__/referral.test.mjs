import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeCode,
  validateBindCode,
  generateReferralCode,
  isSelfReferral,
  isNewAccount,
  REFERRAL_CAP,
} from '../referral.mjs';
import handler from '../referral.mjs';

const DAY = 24 * 60 * 60 * 1000;

// ── isSelfReferral (anti-fraud) ───────────────────────────────────────────────
describe('isSelfReferral', () => {
  it('flags an identical referrer/referee as self-referral', () => {
    expect(isSelfReferral('user-x', 'user-x')).toBe(true);
  });
  it('allows distinct referrer/referee', () => {
    expect(isSelfReferral('user-x', 'user-y')).toBe(false);
  });
  it('treats a missing id as not-a-valid-pair (never a free pass)', () => {
    expect(isSelfReferral(undefined, undefined)).toBe(true);
    expect(isSelfReferral(null, null)).toBe(true);
  });
});

// ── isNewAccount (qualification: genuinely new signup) ─────────────────────────
describe('isNewAccount', () => {
  const now = Date.parse('2026-06-29T00:00:00Z');
  it('accepts an account created within the window', () => {
    expect(isNewAccount({ created_at: new Date(now - 2 * DAY).toISOString() }, now, 30)).toBe(true);
  });
  it('rejects an account older than the window (anti-farm: no reactivating old alts)', () => {
    expect(isNewAccount({ created_at: new Date(now - 100 * DAY).toISOString() }, now, 30)).toBe(false);
  });
  it('rejects a user with no/garbage created_at', () => {
    expect(isNewAccount({}, now, 30)).toBe(false);
    expect(isNewAccount(null, now, 30)).toBe(false);
  });
});

// ── validateBindCode / normalizeCode / generateReferralCode ───────────────────
describe('validateBindCode', () => {
  it('rejects non-strings and empty/short/overlong input', () => {
    expect(validateBindCode(undefined)).toBeTruthy();
    expect(validateBindCode('')).toBeTruthy();
    expect(validateBindCode('ab')).toBeTruthy();
    expect(validateBindCode(12345)).toBeTruthy();
    expect(validateBindCode('A'.repeat(100))).toBeTruthy();
  });
  it('accepts a well-formed code', () => {
    expect(validateBindCode('ABC23K')).toBeNull();
  });
});

describe('normalizeCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeCode('  abc23k ')).toBe('ABC23K');
  });
});

describe('generateReferralCode', () => {
  it('returns an uppercase code of the requested length from an unambiguous alphabet', () => {
    const code = generateReferralCode(7);
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    expect(code).not.toMatch(/[01OIL]/);
  });
  it('is non-deterministic across calls', () => {
    expect(generateReferralCode(8)).not.toBe(generateReferralCode(8));
  });
});

// ── Stateful Supabase fake ────────────────────────────────────────────────────
// Models the DB invariants the guarantees rest on. The fraud-critical grant is a
// SINGLE atomic transaction (grant_referral_reward RPC): the fake mirrors its
// sequence — per-referee exactly-once (credited flag), the per-referrer cap counter
// (referral_credits), and the GREATEST(current,now)+days extend. failExtend models a
// whole-transaction failure (atomic rollback: nothing is mutated), which is exactly
// why a retry after a perceived failure is safe.
function makeSupabaseFake(users) {
  const db = {
    users,
    codes: [],
    referrals: [],
    subscriptions: [],
    referralCredits: [], // { referrer_id, credited_count }
    leaderboard: [],
    failExtend: false,
  };
  const ok = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
  const conflict = () => ok(409, { code: '23505', message: 'duplicate key value' });
  const matchEq = (url, field) => {
    const m = new RegExp(`${field}=eq\\.([^&]+)`).exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const fetchFake = vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : null;

    if (url.includes('/auth/v1/user')) {
      const auth = opts.headers?.Authorization || opts.headers?.authorization || '';
      const u = db.users[auth.replace('Bearer ', '')];
      return u ? ok(200, u) : ok(401, { error: 'unauthorized' });
    }

    if (url.includes('/rest/v1/referral_codes')) {
      if (method === 'GET') {
        const code = matchEq(url, 'code');
        const uid = matchEq(url, 'user_id');
        let rows = db.codes;
        if (code) rows = rows.filter((c) => c.code === code);
        if (uid) rows = rows.filter((c) => c.user_id === uid);
        return ok(200, rows);
      }
      if (method === 'POST') {
        if (db.codes.some((c) => c.code === body.code)) return conflict();
        db.codes.push({ user_id: body.user_id, code: body.code });
        return ok(201, [body]);
      }
    }

    if (url.includes('/rest/v1/referrals')) {
      if (method === 'POST') {
        if (db.referrals.some((r) => r.referee_id === body.referee_id)) return conflict();
        db.referrals.push({ referrer_id: body.referrer_id, referee_id: body.referee_id, credited: false });
        return ok(201, []);
      }
    }

    if (url.includes('/rest/v1/leaderboard')) {
      if (method === 'GET') {
        const uid = matchEq(url, 'user_id');
        return ok(200, db.leaderboard.filter((l) => l.user_id === uid).slice(0, 1));
      }
    }

    // The atomic grant. Mirrors grant_referral_reward(p_referee, p_days, p_cap).
    if (url.includes('/rest/v1/rpc/grant_referral_reward')) {
      if (method === 'POST') {
        // Whole-transaction failure → nothing mutated (atomic rollback).
        if (db.failExtend) { db.failExtend = false; return ok(500, { error: 'forced' }); }
        const referee = body.p_referee;
        const row = db.referrals.find((r) => r.referee_id === referee);
        if (!row) return ok(200, [{ result: 'no_binding', premium_until: null }]);
        if (row.credited) {
          const sub = db.subscriptions.find((s) => s.user_id === row.referrer_id);
          return ok(200, [{ result: 'already', premium_until: sub?.expires_at ?? null }]);
        }
        const referrer = row.referrer_id;
        let cc = db.referralCredits.find((c) => c.referrer_id === referrer);
        if (!cc) { cc = { referrer_id: referrer, credited_count: 0 }; db.referralCredits.push(cc); }
        if (cc.credited_count >= body.p_cap) return ok(200, [{ result: 'capped', premium_until: null }]);
        cc.credited_count += 1;
        row.credited = true;
        const now = Date.now();
        const existing = db.subscriptions.find((s) => s.user_id === referrer);
        const cur = existing && existing.expires_at ? Date.parse(existing.expires_at) : 0;
        const until = new Date((cur > now ? cur : now) + body.p_days * DAY).toISOString();
        if (existing) {
          existing.expires_at = until;
          existing.is_active = true;
          if (!['monthly', 'yearly'].includes(existing.plan)) existing.plan = 'referral';
        } else {
          db.subscriptions.push({ user_id: referrer, is_active: true, plan: 'referral', expires_at: until });
        }
        return ok(200, [{ result: 'granted', premium_until: until }]);
      }
    }

    return ok(404, { error: 'unhandled ' + method + ' ' + url });
  });

  return { db, fetchFake };
}

function bindReq(token, code) {
  return {
    method: 'POST',
    headers: { get: (k) => (k.toLowerCase() === 'authorization' ? `Bearer ${token}` : null) },
    json: async () => ({ action: 'bind', code }),
  };
}

const newAcct = (id, email) => ({ id, email, created_at: new Date(Date.now() - 1 * DAY).toISOString() });

describe('referral handler — atomic exactly-once + cap + QUAL (DoD)', () => {
  const REFERRER = 'referrer-uuid';
  const REFEREE = 'referee-uuid';

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'http://sb.test';
    process.env.SUPABASE_SERVICE_KEY = 'svc-key';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function seedQualified() {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    db.leaderboard.push({ user_id: REFEREE });
    vi.stubGlobal('fetch', fetchFake);
    return { db, fetchFake };
  }

  it('credits the referrer exactly once across a replayed bind (idempotent, +7d not +14)', async () => {
    const { db } = seedQualified();
    expect((await handler(bindReq(REFEREE, 'INVITE7'))).status).toBe(200);
    expect((await handler(bindReq(REFEREE, 'INVITE7'))).status).toBe(200); // replay

    expect(db.referrals).toHaveLength(1);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.referralCredits.find((c) => c.referrer_id === REFERRER).credited_count).toBe(1); // bumped once
    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    const grantedMs = Date.parse(sub.expires_at) - Date.now();
    expect(grantedMs).toBeGreaterThan(6.5 * DAY);
    expect(grantedMs).toBeLessThan(7.5 * DAY);
  });

  it('rejects a self-referral and grants nothing', async () => {
    const { db } = seedQualified();
    const res = await handler(bindReq(REFERRER, 'INVITE7'));
    expect(res.status).toBe(400);
    expect(db.subscriptions).toHaveLength(0);
  });

  // C1: the grant follows the PERSISTENT binding, not the code in the request.
  it('C1: a later bind with a DIFFERENT code never hijacks the credit to a new referrer', async () => {
    const ALICE = 'alice-referrer';
    const BOB = 'bob-attacker';
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [ALICE]: newAcct(ALICE, 'alice@x.kz'),
      [BOB]: newAcct(BOB, 'bob@x.kz'),
    });
    db.codes.push({ user_id: ALICE, code: 'ALICE1' }, { user_id: BOB, code: 'BOBBB1' });
    db.referrals.push({ referrer_id: ALICE, referee_id: REFEREE, credited: false }); // persistent: ALICE
    db.leaderboard.push({ user_id: REFEREE });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(REFEREE, 'BOBBB1'));
    expect(res.status).toBe(200);
    expect(db.subscriptions.find((s) => s.user_id === ALICE)).toBeTruthy();
    expect(db.subscriptions.find((s) => s.user_id === BOB)).toBeUndefined();
  });

  // QUAL: no completed test → bound but not credited; credits once the test exists.
  it('QUAL: binds but does NOT credit until the referee has completed a test', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res.status).toBe(200);
    expect(db.referrals[0].credited).toBe(false);
    expect(db.subscriptions).toHaveLength(0);

    db.leaderboard.push({ user_id: REFEREE }); // referee completes a test
    const res2 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res2.status).toBe(200);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.subscriptions.find((s) => s.user_id === REFERRER)).toBeTruthy();
  });

  it('QUAL: an old referee account is never credited even with a completed test', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: { id: REFEREE, email: 'old@x.kz', created_at: new Date(Date.now() - 200 * DAY).toISOString() },
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    db.leaderboard.push({ user_id: REFEREE });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res.status).toBe(200);
    expect(db.subscriptions).toHaveLength(0);
  });

  // CAP: a referrer at the cap earns nothing more.
  it('CAP: stops crediting a referrer past the per-account cap', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    db.referralCredits.push({ referrer_id: REFERRER, credited_count: REFERRAL_CAP }); // already at cap
    const FRESH = 'fresh-referee';
    db.users[FRESH] = newAcct(FRESH, 'fresh@x.kz');
    db.leaderboard.push({ user_id: FRESH });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(FRESH, 'INVITE7'));
    expect(res.status).toBe(200);
    expect(db.subscriptions.find((s) => s.user_id === REFERRER)).toBeUndefined(); // no grant
    expect(db.referrals.find((r) => r.referee_id === FRESH).credited).toBe(false);
  });

  // F2/C2: a failed grant transaction mutates nothing, and a retry grants once.
  it('a failed grant transaction rolls back fully and a retry grants exactly once', async () => {
    const { db } = seedQualified();
    db.failExtend = true;

    const r1 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r1.status).toBe(500);
    expect(db.referrals[0].credited).toBe(false);            // nothing mutated
    expect(db.referralCredits).toHaveLength(0);
    expect(db.subscriptions).toHaveLength(0);

    const r2 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r2.status).toBe(200);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.referralCredits.find((c) => c.referrer_id === REFERRER).credited_count).toBe(1);
    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    const grantedMs = Date.parse(sub.expires_at) - Date.now();
    expect(grantedMs).toBeGreaterThan(6.5 * DAY);
    expect(grantedMs).toBeLessThan(7.5 * DAY);
  });

  // Atomic extend: +7 stacks on an existing larger (e.g. purchased) expiry and never
  // reduces it or clobbers the paid plan label.
  it('stacks +7 on an existing purchased expiry and preserves the paid plan (no clobber)', async () => {
    const { db } = seedQualified();
    db.subscriptions.push({
      user_id: REFERRER, is_active: true, plan: 'monthly',
      expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
    });
    const res = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res.status).toBe(200);
    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    const remaining = Date.parse(sub.expires_at) - Date.now();
    expect(remaining).toBeGreaterThan(36.5 * DAY); // 30 + 7, never reduced
    expect(remaining).toBeLessThan(37.5 * DAY);
    expect(sub.plan).toBe('monthly'); // a referral grant must not downgrade a paid plan
  });

  it('rejects an unknown referral code', async () => {
    const { db } = seedQualified();
    const res = await handler(bindReq(REFEREE, 'NOSUCH'));
    expect(res.status).toBe(404);
    expect(db.subscriptions).toHaveLength(0);
  });

  it('rejects an unauthenticated caller', async () => {
    seedQualified();
    const res = await handler(bindReq('not-a-real-token', 'INVITE7'));
    expect(res.status).toBe(401);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeCode,
  validateBindCode,
  generateReferralCode,
  deriveReferralTxId,
  isSelfReferral,
  isNewAccount,
  computeReferralExpiry,
  REFERRAL_CAP,
} from '../referral.mjs';
import handler from '../referral.mjs';

const DAY = 24 * 60 * 60 * 1000;

// ── deriveReferralTxId (idempotency key — mirrors deriveRcTxId) ────────────────
describe('deriveReferralTxId (referral idempotency key)', () => {
  it('derives a stable per-referee id from the referee id', () => {
    expect(deriveReferralTxId('refUUID-1')).toBe('referral_refUUID-1');
  });
  it('yields the SAME key for a replayed credit (idempotent)', () => {
    const referee = 'b2c3-referee';
    expect(deriveReferralTxId(referee)).toBe(deriveReferralTxId(referee));
  });
  it('yields DISTINCT keys for distinct referees', () => {
    expect(deriveReferralTxId('referee-A')).not.toBe(deriveReferralTxId('referee-B'));
  });
  it('returns null on a missing/empty referee id (never collapses to a shared key)', () => {
    expect(deriveReferralTxId('')).toBeNull();
    expect(deriveReferralTxId(null)).toBeNull();
    expect(deriveReferralTxId(undefined)).toBeNull();
    expect(deriveReferralTxId(123)).toBeNull();
  });
});

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

// ── computeReferralExpiry (correct 7-day extension / stacking) ─────────────────
describe('computeReferralExpiry', () => {
  const now = Date.parse('2026-06-29T00:00:00Z');
  it('grants 7 days from now when there is no active premium', () => {
    expect(Date.parse(computeReferralExpiry(null, now, 7))).toBe(now + 7 * DAY);
  });
  it('stacks 7 days on top of an existing future expiry', () => {
    const existing = new Date(now + 10 * DAY).toISOString();
    expect(Date.parse(computeReferralExpiry(existing, now, 7))).toBe(now + 17 * DAY);
  });
  it('ignores an already-expired premium (extends from now)', () => {
    const expired = new Date(now - 10 * DAY).toISOString();
    expect(Date.parse(computeReferralExpiry(expired, now, 7))).toBe(now + 7 * DAY);
  });
});

// ── Stateful Supabase fake ────────────────────────────────────────────────────
// Models the invariants the exactly-once + anti-fraud guarantees rest on:
//   • UNIQUE(referrals.referee_id) and UNIQUE(payments.kaspi_tx_id) reject a dup
//     INSERT with 409 + 23505 (as PostgREST does);
//   • PATCH ...?credited=eq.false {credited:true} is an atomic compare-and-swap
//     (only rows still matching credited=false flip and are RETURNED);
//   • leaderboard rows are the server-verified "completed a test" signal.
function makeSupabaseFake(users) {
  const db = {
    users,
    codes: [],
    referrals: [],
    payments: [],
    subscriptions: [],
    leaderboard: [],
    failSubscriptionUpsert: false, // flip to force an extend failure (C2 rollback test)
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
      if (method === 'GET') {
        const referee = matchEq(url, 'referee_id');
        const referrer = matchEq(url, 'referrer_id');
        const credited = matchEq(url, 'credited');
        let rows = db.referrals;
        if (referee) rows = rows.filter((r) => r.referee_id === referee);
        if (referrer) rows = rows.filter((r) => r.referrer_id === referrer);
        if (credited != null) rows = rows.filter((r) => String(r.credited) === credited);
        return ok(200, rows.map((r) => ({ ...r })));
      }
      if (method === 'POST') {
        if (db.referrals.some((r) => r.referee_id === body.referee_id)) return conflict();
        db.referrals.push({ referrer_id: body.referrer_id, referee_id: body.referee_id, credited: false });
        return ok(201, []);
      }
      if (method === 'PATCH') {
        const referee = matchEq(url, 'referee_id');
        const wantCredited = matchEq(url, 'credited'); // CAS predicate ('false') or absent
        let rows = db.referrals.filter((r) => r.referee_id === referee);
        if (wantCredited != null) rows = rows.filter((r) => String(r.credited) === wantCredited);
        rows.forEach((r) => { r.credited = body.credited; });
        return ok(200, rows.map((r) => ({ ...r })));
      }
    }

    if (url.includes('/rest/v1/subscriptions')) {
      if (method === 'GET') {
        const uid = matchEq(url, 'user_id');
        return ok(200, db.subscriptions.filter((s) => s.user_id === uid));
      }
      if (method === 'POST') {
        if (db.failSubscriptionUpsert) { db.failSubscriptionUpsert = false; return ok(500, { error: 'forced' }); }
        const existing = db.subscriptions.find((s) => s.user_id === body.user_id);
        if (existing) Object.assign(existing, body);
        else db.subscriptions.push({ ...body });
        return ok(201, []);
      }
    }

    if (url.includes('/rest/v1/payments')) {
      if (method === 'POST') {
        if (db.payments.some((p) => p.kaspi_tx_id === body.kaspi_tx_id)) return conflict();
        db.payments.push({ ...body });
        return ok(201, []);
      }
    }

    if (url.includes('/rest/v1/leaderboard')) {
      if (method === 'GET') {
        const uid = matchEq(url, 'user_id');
        return ok(200, db.leaderboard.filter((l) => l.user_id === uid).slice(0, 1));
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

// A genuinely-qualified referee fixture: new account + (test row added in seed).
const newAcct = (id, email) => ({ id, email, created_at: new Date(Date.now() - 1 * DAY).toISOString() });

describe('referral handler — exactly-once, anti-fraud, C1–C4 + CAP + QUAL (DoD)', () => {
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

  // A fully-qualified referee (new account + 1 completed test).
  function seedQualified() {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    db.leaderboard.push({ user_id: REFEREE }); // referee completed a test
    vi.stubGlobal('fetch', fetchFake);
    return { db, fetchFake };
  }

  it('credits the referrer exactly once across a replayed bind (idempotent, +7d not +14)', async () => {
    const { db } = seedQualified();
    const r1 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r1.status).toBe(200);
    const r2 = await handler(bindReq(REFEREE, 'INVITE7')); // replay
    expect(r2.status).toBe(200);

    expect(db.referrals).toHaveLength(1);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.payments.filter((p) => p.kaspi_tx_id === `referral_${REFEREE}`)).toHaveLength(1);

    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    const grantedMs = Date.parse(sub.expires_at) - Date.now();
    expect(grantedMs).toBeGreaterThan(6.5 * DAY);
    expect(grantedMs).toBeLessThan(7.5 * DAY);
  });

  it('rejects a self-referral and grants nothing', async () => {
    const { db } = seedQualified();
    const res = await handler(bindReq(REFERRER, 'INVITE7'));
    expect(res.status).toBe(400);
    expect(db.payments).toHaveLength(0);
    expect(db.subscriptions).toHaveLength(0);
  });

  // C1: the grant must follow the PERSISTENT binding, not the code in the request.
  it('C1: a later bind with a DIFFERENT code never hijacks the credit to a new referrer', async () => {
    const ALICE = 'alice-referrer';
    const BOB = 'bob-attacker';
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [ALICE]: newAcct(ALICE, 'alice@x.kz'),
      [BOB]: newAcct(BOB, 'bob@x.kz'),
    });
    db.codes.push({ user_id: ALICE, code: 'ALICE1' }, { user_id: BOB, code: 'BOBBB1' });
    // Referee is already (persistently) bound to ALICE but not yet credited.
    db.referrals.push({ referrer_id: ALICE, referee_id: REFEREE, credited: false });
    db.leaderboard.push({ user_id: REFEREE });
    vi.stubGlobal('fetch', fetchFake);

    // Attacker tries to bind the same referee to BOB's code.
    const res = await handler(bindReq(REFEREE, 'BOBBB1'));
    expect(res.status).toBe(200);

    // The reward goes to ALICE (persistent binding), never BOB.
    expect(db.subscriptions.find((s) => s.user_id === ALICE)).toBeTruthy();
    expect(db.subscriptions.find((s) => s.user_id === BOB)).toBeUndefined();
    expect(db.payments.every((p) => p.user_id === ALICE)).toBe(true);
  });

  // QUAL: an unconfirmed-as-real referee (no completed test) binds but earns nothing.
  it('QUAL: binds but does NOT credit until the referee has completed a test', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: newAcct(REFEREE, 'newbie@x.kz'),
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    // NO leaderboard row → not qualified yet.
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res.status).toBe(200);
    expect(db.referrals).toHaveLength(1);
    expect(db.referrals[0].credited).toBe(false);
    expect(db.payments).toHaveLength(0);

    // Later, the referee completes a test → a retry credits exactly once.
    db.leaderboard.push({ user_id: REFEREE });
    const res2 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res2.status).toBe(200);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.payments.filter((p) => p.kaspi_tx_id === `referral_${REFEREE}`)).toHaveLength(1);
  });

  // QUAL: an OLD account can never be the referee (anti-farm on reactivated alts).
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
    expect(db.payments).toHaveLength(0);
  });

  // CAP: a referrer can only be rewarded for REFERRAL_CAP referees.
  it('CAP: stops crediting a referrer past the per-account cap', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFERRER]: newAcct(REFERRER, 'inviter@x.kz'),
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    // Referrer already at the cap (REFERRAL_CAP credited referees).
    for (let i = 0; i < REFERRAL_CAP; i++) {
      db.referrals.push({ referrer_id: REFERRER, referee_id: `prior-${i}`, credited: true });
    }
    const FRESH = 'fresh-referee';
    db.users[FRESH] = newAcct(FRESH, 'fresh@x.kz');
    db.leaderboard.push({ user_id: FRESH });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(FRESH, 'INVITE7'));
    expect(res.status).toBe(200);
    // No NEW grant for this referrer beyond the cap.
    expect(db.payments.filter((p) => p.kaspi_tx_id === `referral_${FRESH}`)).toHaveLength(0);
  });

  // C2: if the extend fails after the CAS win, credited rolls back and no marker
  // is left behind, so a later retry can re-claim and grant.
  it('C2: a failed extend rolls back cleanly and a retry still grants exactly once', async () => {
    const { db } = seedQualified();
    db.failSubscriptionUpsert = true; // first extend attempt fails

    const r1 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r1.status).toBe(500);
    // Rolled back: not credited, no payment marker stranded.
    expect(db.referrals[0].credited).toBe(false);
    expect(db.payments.filter((p) => p.kaspi_tx_id === `referral_${REFEREE}`)).toHaveLength(0);

    // Retry succeeds and grants exactly once.
    const r2 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r2.status).toBe(200);
    expect(db.referrals[0].credited).toBe(true);
    expect(db.payments.filter((p) => p.kaspi_tx_id === `referral_${REFEREE}`)).toHaveLength(1);
    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    const grantedMs = Date.parse(sub.expires_at) - Date.now();
    expect(grantedMs).toBeGreaterThan(6.5 * DAY);
    expect(grantedMs).toBeLessThan(7.5 * DAY);
  });

  it('rejects an unknown referral code', async () => {
    const { db } = seedQualified();
    const res = await handler(bindReq(REFEREE, 'NOSUCH'));
    expect(res.status).toBe(404);
    expect(db.payments).toHaveLength(0);
  });

  it('rejects an unauthenticated caller', async () => {
    seedQualified();
    const res = await handler(bindReq('not-a-real-token', 'INVITE7'));
    expect(res.status).toBe(401);
  });
});

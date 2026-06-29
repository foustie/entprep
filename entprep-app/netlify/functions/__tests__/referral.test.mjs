import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeCode,
  validateBindCode,
  generateReferralCode,
  deriveReferralTxId,
  isSelfReferral,
  isQualifiedReferee,
  computeReferralExpiry,
} from '../referral.mjs';
import handler from '../referral.mjs';

// ── deriveReferralTxId (idempotency key — mirrors deriveRcTxId) ────────────────
// The 7-day premium grant to the referrer is made exactly-once by the UNIQUE
// constraint on payments.kaspi_tx_id. That guarantee is only as good as the key:
// it must be STABLE per referee (replay → same key → 2nd INSERT hits 23505) and
// DISTINCT per referee (no two referees collapse into one grant slot), and must
// NEVER fall back to a shared 'referral_' sentinel that would dedupe every
// referral into a single grant row.
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

// ── isSelfReferral (anti-fraud: no self-referral) ─────────────────────────────
describe('isSelfReferral', () => {
  it('flags an identical referrer/referee as self-referral', () => {
    expect(isSelfReferral('user-x', 'user-x')).toBe(true);
  });

  it('allows distinct referrer/referee', () => {
    expect(isSelfReferral('user-x', 'user-y')).toBe(false);
  });

  it('is not fooled by a missing id (treats as not-allowed pairing)', () => {
    // Two undefineds must NOT be considered a valid (non-self) pair.
    expect(isSelfReferral(undefined, undefined)).toBe(true);
    expect(isSelfReferral(null, null)).toBe(true);
  });
});

// ── isQualifiedReferee (qualification gate) ───────────────────────────────────
describe('isQualifiedReferee', () => {
  it('qualifies a confirmed account (email_confirmed_at present)', () => {
    expect(isQualifiedReferee({ id: 'u', email_confirmed_at: '2026-06-29T00:00:00Z' })).toBe(true);
  });

  it('qualifies an account confirmed via confirmed_at', () => {
    expect(isQualifiedReferee({ id: 'u', confirmed_at: '2026-06-29T00:00:00Z' })).toBe(true);
  });

  it('does NOT qualify an unconfirmed account (anti-farm: unverified signups earn nothing)', () => {
    expect(isQualifiedReferee({ id: 'u' })).toBe(false);
    expect(isQualifiedReferee({ id: 'u', email_confirmed_at: null })).toBe(false);
  });

  it('does NOT qualify a null/garbage user', () => {
    expect(isQualifiedReferee(null)).toBe(false);
    expect(isQualifiedReferee(undefined)).toBe(false);
  });
});

// ── validateBindCode / normalizeCode ──────────────────────────────────────────
describe('validateBindCode', () => {
  it('rejects non-strings and empty/short input', () => {
    expect(validateBindCode(undefined)).toBeTruthy();
    expect(validateBindCode('')).toBeTruthy();
    expect(validateBindCode('ab')).toBeTruthy();
    expect(validateBindCode(12345)).toBeTruthy();
  });

  it('rejects absurdly long input', () => {
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

// ── generateReferralCode ──────────────────────────────────────────────────────
describe('generateReferralCode', () => {
  it('returns an uppercase code of the requested length from an unambiguous alphabet', () => {
    const code = generateReferralCode(7);
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    // unambiguous: no 0/O/1/I/L
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('is non-deterministic across calls (collision-resistant)', () => {
    const a = generateReferralCode(8);
    const b = generateReferralCode(8);
    expect(a).not.toBe(b);
  });
});

// ── computeReferralExpiry (correct 7-day extension / stacking) ─────────────────
describe('computeReferralExpiry', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-06-29T00:00:00Z');

  it('grants 7 days from now when the referrer has no active premium', () => {
    const out = Date.parse(computeReferralExpiry(null, now, 7));
    expect(out).toBe(now + 7 * DAY);
  });

  it('stacks 7 days on top of an existing future expiry', () => {
    const existing = new Date(now + 10 * DAY).toISOString();
    const out = Date.parse(computeReferralExpiry(existing, now, 7));
    expect(out).toBe(now + 17 * DAY);
  });

  it('ignores an already-expired premium (extends from now, not the past)', () => {
    const expired = new Date(now - 10 * DAY).toISOString();
    const out = Date.parse(computeReferralExpiry(expired, now, 7));
    expect(out).toBe(now + 7 * DAY);
  });
});

// ── Handler: end-to-end idempotency & self-referral (the headline DoD) ─────────
// A stateful in-memory fake of the Supabase REST + Auth Admin surface that the
// handler touches. It models the two DB invariants the exactly-once guarantee
// rests on: UNIQUE(referrals.referee_id) and UNIQUE(payments.kaspi_tx_id) both
// reject a duplicate INSERT with HTTP 409 + a 23505 body, exactly as PostgREST does.
function makeSupabaseFake(users) {
  const db = {
    users,                 // { token: { id, email, email_confirmed_at, ... } }
    codes: [],             // { user_id, code }
    referrals: [],         // { referrer_id, referee_id, credited }
    payments: [],          // { user_id, kaspi_tx_id, premium_until, ... }
    subscriptions: [],     // { user_id, is_active, expires_at, plan }
  };
  const ok = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
  const conflict = () => ok(409, { code: '23505', message: 'duplicate key value violates unique constraint' });

  const fetchFake = vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : null;

    // verifyAuth → /auth/v1/user, identified by the Bearer token
    if (url.includes('/auth/v1/user')) {
      const auth = opts.headers?.Authorization || opts.headers?.authorization || '';
      const token = auth.replace('Bearer ', '');
      const u = db.users[token];
      return u ? ok(200, u) : ok(401, { error: 'unauthorized' });
    }

    // referral_codes: GET by code, POST to create
    if (url.includes('/rest/v1/referral_codes')) {
      if (method === 'GET') {
        const m = /code=eq\.([^&]+)/.exec(url);
        const code = m ? decodeURIComponent(m[1]) : null;
        return ok(200, db.codes.filter((c) => c.code === code));
      }
      if (method === 'POST') {
        if (db.codes.some((c) => c.code === body.code)) return conflict();
        db.codes.push({ user_id: body.user_id, code: body.code });
        return ok(201, [body]);
      }
    }

    // referrals: POST (UNIQUE referee_id), PATCH (atomic CAS credited:false→true)
    if (url.includes('/rest/v1/referrals')) {
      if (method === 'POST') {
        if (db.referrals.some((r) => r.referee_id === body.referee_id)) return conflict();
        const row = { referrer_id: body.referrer_id, referee_id: body.referee_id, credited: false };
        db.referrals.push(row);
        return ok(201, [row]);
      }
      if (method === 'PATCH') {
        const m = /referee_id=eq\.([^&]+)/.exec(url);
        const referee = m ? decodeURIComponent(m[1]) : null;
        const rows = db.referrals.filter((r) => r.referee_id === referee && r.credited === false);
        rows.forEach((r) => { r.credited = true; });
        return ok(200, rows);
      }
    }

    // subscriptions: GET current, POST upsert (merge-duplicates on user_id)
    if (url.includes('/rest/v1/subscriptions')) {
      if (method === 'GET') {
        const m = /user_id=eq\.([^&]+)/.exec(url);
        const uid = m ? decodeURIComponent(m[1]) : null;
        return ok(200, db.subscriptions.filter((s) => s.user_id === uid));
      }
      if (method === 'POST') {
        const existing = db.subscriptions.find((s) => s.user_id === body.user_id);
        if (existing) Object.assign(existing, body);
        else db.subscriptions.push({ ...body });
        return ok(201, []);
      }
    }

    // payments: POST with UNIQUE(kaspi_tx_id) — the exactly-once grant gate
    if (url.includes('/rest/v1/payments')) {
      if (method === 'POST') {
        if (db.payments.some((p) => p.kaspi_tx_id === body.kaspi_tx_id)) return conflict();
        db.payments.push({ ...body });
        return ok(201, []);
      }
    }

    // auth admin: update user_metadata (premium cache)
    if (url.includes('/auth/v1/admin/users/')) {
      return ok(200, {});
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

describe('referral handler — exactly-once grant + anti-fraud (DoD)', () => {
  const REFERRER = 'referrer-uuid';
  const REFEREE = 'referee-uuid';
  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'http://sb.test';
    process.env.SUPABASE_SERVICE_KEY = 'svc-key';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function seed() {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: { id: REFEREE, email: 'newbie@x.kz', email_confirmed_at: '2026-06-29T00:00:00Z' },
      [REFERRER]: { id: REFERRER, email: 'inviter@x.kz', email_confirmed_at: '2026-06-01T00:00:00Z' },
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    vi.stubGlobal('fetch', fetchFake);
    return { db, fetchFake };
  }

  it('credits the referrer exactly once across a replayed bind (idempotent, no extra days)', async () => {
    const { db } = seed();

    const r1 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r1.status).toBe(200);

    // Replay the identical bind — must NOT grant a second time.
    const r2 = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(r2.status).toBe(200);

    // Exactly ONE referral row, ONE payment row keyed referral_<referee>, credited.
    expect(db.referrals).toHaveLength(1);
    expect(db.referrals[0].credited).toBe(true);
    const grants = db.payments.filter((p) => p.kaspi_tx_id === `referral_${REFEREE}`);
    expect(grants).toHaveLength(1);

    // Premium extended by exactly 7 days — NOT 14.
    const sub = db.subscriptions.find((s) => s.user_id === REFERRER);
    expect(sub).toBeTruthy();
    const grantedMs = Date.parse(sub.expires_at) - Date.now();
    expect(grantedMs).toBeGreaterThan(6.5 * DAY);
    expect(grantedMs).toBeLessThan(7.5 * DAY);
  });

  it('rejects a self-referral and grants nothing', async () => {
    const { db } = seed();
    // The referrer themselves opens their own code: caller == code owner.
    const res = await handler(bindReq(REFERRER, 'INVITE7'));
    expect(res.status).toBe(400);
    expect(db.payments).toHaveLength(0);
    expect(db.subscriptions).toHaveLength(0);
  });

  it('binds but does NOT credit an unqualified (unconfirmed) referee', async () => {
    const { db, fetchFake } = makeSupabaseFake({
      [REFEREE]: { id: REFEREE, email: 'unconfirmed@x.kz' }, // no email_confirmed_at
      [REFERRER]: { id: REFERRER, email: 'inviter@x.kz', email_confirmed_at: '2026-06-01T00:00:00Z' },
    });
    db.codes.push({ user_id: REFERRER, code: 'INVITE7' });
    vi.stubGlobal('fetch', fetchFake);

    const res = await handler(bindReq(REFEREE, 'INVITE7'));
    expect(res.status).toBe(200);
    expect(db.referrals).toHaveLength(1);        // bound
    expect(db.referrals[0].credited).toBe(false); // but not credited
    expect(db.payments).toHaveLength(0);          // no grant
  });

  it('rejects an unknown referral code', async () => {
    const { db } = seed();
    const res = await handler(bindReq(REFEREE, 'NOSUCH'));
    expect(res.status).toBe(404);
    expect(db.payments).toHaveLength(0);
  });

  it('rejects an unauthenticated caller', async () => {
    seed();
    const res = await handler(bindReq('not-a-real-token', 'INVITE7'));
    expect(res.status).toBe(401);
  });
});

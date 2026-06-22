import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { calcPremiumUntil } from '../utils/shared.mjs';
import { PLANS } from '../utils/constants.mjs';
import { detectPlan, verifySignature } from '../lemon-webhook.mjs';
import { determinePlan, verifyBearer } from '../revenuecat-webhook.mjs';

// ── calcPremiumUntil ──────────────────────────────────────────────────────────
// NOTE: calcPremiumUntil builds the Date with the LOCAL-time constructor
// (new Date(year, month, day)) then serializes with toISOString(). To stay
// timezone-independent we pin `now` with fake timers and assert on the LOCAL
// fields of the returned (parsed) Date, matching how the value was constructed.

describe('calcPremiumUntil', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setNow(y: number, m0: number, d: number) {
    // m0 is 0-based month. Use local time so it matches the constructor used inside.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m0, d, 12, 0, 0));
  }

  it('monthly = same day, next month', () => {
    setNow(2026, 5, 15); // 15 Jun 2026
    const d = new Date(calcPremiumUntil('monthly'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(15);
  });

  it('monthly rolls the year over from December', () => {
    setNow(2026, 11, 10); // 10 Dec 2026
    const d = new Date(calcPremiumUntil('monthly'));
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(10);
  });

  it('monthly overflows when next month is shorter (Jan 31 -> March)', () => {
    // Jan 31 + 1 month: new Date(2026, 1, 31) has no Feb 31 -> overflows to Mar 3 (2026 not leap).
    setNow(2026, 0, 31); // 31 Jan 2026
    const d = new Date(calcPremiumUntil('monthly'));
    // Documents CURRENT behavior: JS Date month-overflow lands in March.
    expect(d.getMonth()).toBe(2); // March
    expect(d.getFullYear()).toBe(2026);
  });

  it('yearly before September -> June 30 of the same calendar year', () => {
    setNow(2026, 4, 1); // 1 May 2026 (month index 4 < 8)
    const d = new Date(calcPremiumUntil('yearly'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(30);
  });

  it('yearly in August (month index 7) still uses the same calendar year', () => {
    // Boundary: getMonth() === 7 is < 8, so it does NOT roll to next year.
    setNow(2026, 7, 20); // 20 Aug 2026
    const d = new Date(calcPremiumUntil('yearly'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(30);
  });

  it('yearly in September (month index 8) rolls to next year June 30 (school-year boundary)', () => {
    setNow(2026, 8, 1); // 1 Sep 2026 (month index 8 >= 8)
    const d = new Date(calcPremiumUntil('yearly'));
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(30);
  });
});

// ── Payment amount resolution (PLANS) ────────────────────────────────────────
// activatePremium resolves amount via PLANS[plan]?.amount with a hardcoded
// fallback. We assert the live PLANS values (the path actually taken in prod).

describe('payment amount resolution (PLANS)', () => {
  it('monthly resolves to 2990', () => {
    expect(PLANS.monthly.amount).toBe(2990);
  });

  it('yearly resolves to 9990', () => {
    expect(PLANS.yearly.amount).toBe(9990);
  });

  it('mirrors the activatePremium resolution expression', () => {
    const resolve = (plan: string) =>
      (PLANS as Record<string, { amount: number }>)[plan]?.amount ||
      (plan === 'monthly' ? 2990 : 9990);
    expect(resolve('monthly')).toBe(2990);
    expect(resolve('yearly')).toBe(9990);
    // Unknown plan falls through to the legacy fallback branch.
    expect(resolve('weird')).toBe(9990);
  });
});

// ── Lemon detectPlan ─────────────────────────────────────────────────────────
// Without LEMON_*_VARIANT_IDS env set, the variant path is skipped and the
// event-name heuristic (the prod default) is exercised.

describe('lemon detectPlan (event-name fallback)', () => {
  it('subscription_created -> monthly', () => {
    expect(detectPlan('subscription_created', {})).toBe('monthly');
  });

  it('subscription_payment_success -> monthly', () => {
    expect(detectPlan('subscription_payment_success', {})).toBe('monthly');
  });

  it('order_created -> yearly', () => {
    expect(detectPlan('order_created', {})).toBe('yearly');
  });

  it('order_created with an unknown variant_id still -> yearly via fallback', () => {
    expect(detectPlan('order_created', { first_order_item: { variant_id: 111 } })).toBe('yearly');
  });
});

// ── RevenueCat determinePlan ─────────────────────────────────────────────────

describe('rc determinePlan', () => {
  it('product_id containing "yearly" -> yearly', () => {
    expect(determinePlan({ product_id: 'entprep_yearly' })).toBe('yearly');
  });

  it('product_id containing "annual" -> yearly', () => {
    expect(determinePlan({ product_id: 'pro_annual_v2' })).toBe('yearly');
  });

  it('product_id containing "monthly" -> monthly', () => {
    expect(determinePlan({ product_id: 'entprep_monthly' })).toBe('monthly');
  });

  it('missing product_id defaults to monthly', () => {
    expect(determinePlan({})).toBe('monthly');
  });
});

// ── Lemon HMAC signature verification ────────────────────────────────────────

describe('lemon verifySignature', () => {
  const SECRET = 'lemon_test_secret';
  const body = JSON.stringify({ meta: { event_name: 'order_created' } });
  const goodSig = createHmac('sha256', SECRET).update(body).digest('hex');

  it('accepts a correct HMAC-sha256 hex signature', () => {
    expect(verifySignature(body, goodSig, SECRET)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const bad = goodSig.slice(0, -1) + (goodSig.endsWith('a') ? 'b' : 'a');
    expect(verifySignature(body, bad, SECRET)).toBe(false);
  });

  it('rejects a signature of the wrong length (length guard)', () => {
    expect(verifySignature(body, 'deadbeef', SECRET)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const wrong = createHmac('sha256', 'other_secret').update(body).digest('hex');
    expect(verifySignature(body, wrong, SECRET)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    expect(verifySignature(body, goodSig, '')).toBe(false);
  });
});

// ── RevenueCat Bearer verification ───────────────────────────────────────────

describe('rc verifyBearer', () => {
  const SECRET = 'rc_test_secret';

  it('accepts the exact Bearer secret', () => {
    expect(verifyBearer(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it('rejects a wrong secret of the same length', () => {
    const wrong = 'x'.repeat(SECRET.length);
    expect(verifyBearer(`Bearer ${wrong}`, SECRET)).toBe(false);
  });

  it('rejects a header missing the Bearer prefix', () => {
    expect(verifyBearer(SECRET, SECRET)).toBe(false);
  });

  it('rejects an empty/absent header', () => {
    expect(verifyBearer('', SECRET)).toBe(false);
    expect(verifyBearer(null, SECRET)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    expect(verifyBearer('Bearer anything', '')).toBe(false);
    expect(verifyBearer('Bearer anything', undefined)).toBe(false);
  });
});

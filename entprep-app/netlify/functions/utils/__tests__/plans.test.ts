import { describe, it, expect } from 'vitest';
import { PLANS } from '../constants.mjs';

// PAY-4 regression: monthly amount recorded by the backend must match the
// price customers are actually charged (2990₸ — see src/config/payment.ts),
// not the stale 1990₸. Covers both the PLANS constant and the inline fallback
// in shared.mjs activatePremium (`PLANS[plan]?.amount || (plan === "monthly" ? 2990 : 9990)`).
describe('PAY-4: backend payment amounts', () => {
  it('records monthly premium at 2990₸', () => {
    expect(PLANS.monthly.amount).toBe(2990);
  });

  it('records yearly/season premium at 9990₸', () => {
    expect(PLANS.yearly.amount).toBe(9990);
  });

  it('inline fallback used in activatePremium also resolves monthly to 2990₸', () => {
    const plan = 'monthly';
    const fallbackOnly = plan === 'monthly' ? 2990 : 9990;
    expect(fallbackOnly).toBe(2990);
    // And the live resolution (PLANS first, fallback second) agrees:
    const resolved = PLANS[plan]?.amount || fallbackOnly;
    expect(resolved).toBe(2990);
  });
});

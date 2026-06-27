// ── Payment configuration ─────────────────────────────────────────────────
// Monetization via RevenueCat (Google Play + App Store).

// Plans (reference — actual prices come from stores via RevenueCat)
export const PLANS = {
  monthly: { amount: 2990, label: 'monthly' },
  yearly:  { amount: 9990, label: 'yearly' },
} as const;

export type PlanType = keyof typeof PLANS;

// RevenueCat product IDs (must match store products)
export const RC_PRODUCT_IDS = {
  monthly: 'entprep_monthly',
  yearly: 'entprep_yearly',
} as const;

// ── Web checkout (Lemon Squeezy) ──────────────────────────────────────────
// The web payment path (native uses RevenueCat IAP per Apple Guideline 3.1.1).
// These are LIVE Lemon Squeezy product checkout links — do not change without
// updating the corresponding product in the Lemon dashboard.
export const LEMON_CHECKOUT = {
  monthly: 'https://entprep.lemonsqueezy.com/checkout/buy/6dac2860-6f5a-4643-8eee-1981e3441d08',
  season: 'https://entprep.lemonsqueezy.com/checkout/buy/f2bd4267-eddc-4ba3-9e88-b43eee15dc9a',
} as const;

/** Lemon Squeezy checkout URL for a plan, with the buyer's email prefilled when known. */
export function lemonCheckoutUrl(plan: 'monthly' | 'season', email?: string | null): string {
  const base = plan === 'monthly' ? LEMON_CHECKOUT.monthly : LEMON_CHECKOUT.season;
  return email ? `${base}?checkout[email]=${encodeURIComponent(email)}` : base;
}

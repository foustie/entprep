-- Referral system: track who invited whom, grant 7-day Premium to both
CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  credited BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(referee_id) -- each user can only be referred once
);

-- Index for looking up referrals by referrer (to count how many they invited)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- RLS: users can read their own referrals (as referrer or referee)
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- Only service_role can insert/update (via Netlify function)
CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Anti-fraud additions (referral.mjs) ───────────────────────────────────────
-- Written IDEMPOTENTLY (IF NOT EXISTS / guarded ADD CONSTRAINT / DROP-then-CREATE
-- policy) so the whole file is safe to re-run against a DB that already has the
-- base table, mirroring 20260622_payments_audit_logs.sql.

-- Self-referral guard: a user can NEVER refer themselves. This is the DB backstop
-- to the application-level check in referral.mjs (defense in depth — attack vector #1).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_no_self_referral'
  ) THEN
    ALTER TABLE referrals
      ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referee_id);
  END IF;
END $$;

-- Referral codes: one opaque, shareable short code per user. The code is the only
-- token that travels in an invite link; it resolves back to the referrer here, so
-- a referrer's auth UUID is never exposed in a link. UNIQUE(code) lets referral.mjs
-- mint codes with collision-retry.
CREATE TABLE IF NOT EXISTS referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: a user can read their own code row; only service_role writes (via referral.mjs).
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own referral code" ON referral_codes;
CREATE POLICY "Users can read own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage referral codes" ON referral_codes;
CREATE POLICY "Service role can manage referral codes"
  ON referral_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Atomic premium extension used by the referral grant (referral.mjs grantReferral).
-- A SINGLE statement extends from the CURRENT committed expiry, so it can never
-- clobber a concurrently-written larger expiry — e.g. a subscription the referrer
-- JUST purchased, which a read-then-write upsert could downgrade to 7 days (harming
-- a paying user) — and it correctly STACKS multiple referral rewards. A paid plan
-- label (monthly/yearly) is preserved; only a non-paid row is labelled 'referral'.
--
-- SECURITY — this writes premium, so it must NEVER be a client-callable tap:
--   • SECURITY INVOKER (the default — not DEFINER): the body runs with the CALLER's
--     privileges. Called by the Netlify function (service_role) it bypasses RLS and
--     works; called by anon/authenticated it is blocked by the subscriptions RLS
--     (which has no INSERT/UPDATE policy for those roles) even if it were reachable.
--   • EXECUTE is revoked from PUBLIC/anon/authenticated so PostgREST does not expose
--     it to clients at all; only service_role may call it.
--   • p_days is hard-bounded (1..31) as defense in depth.
CREATE OR REPLACE FUNCTION extend_premium_days(p_user_id uuid, p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_until timestamptz;
BEGIN
  IF p_days IS NULL OR p_days <= 0 OR p_days > 31 THEN
    RAISE EXCEPTION 'extend_premium_days: invalid p_days %', p_days;
  END IF;
  INSERT INTO subscriptions (user_id, is_active, plan, expires_at, updated_at)
  VALUES (p_user_id, true, 'referral', now() + make_interval(days => p_days), now())
  ON CONFLICT (user_id) DO UPDATE
    SET expires_at = GREATEST(COALESCE(subscriptions.expires_at, now()), now()) + make_interval(days => p_days),
        is_active = true,
        plan = CASE WHEN subscriptions.plan IN ('monthly', 'yearly') THEN subscriptions.plan ELSE 'referral' END,
        updated_at = now()
  RETURNING expires_at INTO v_until;
  RETURN v_until;
END;
$$;

REVOKE ALL ON FUNCTION extend_premium_days(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION extend_premium_days(uuid, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION extend_premium_days(uuid, int) TO service_role;

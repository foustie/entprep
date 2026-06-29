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

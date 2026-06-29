-- Referral system: track who invited whom, grant 7-day Premium to the referrer
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

-- Per-referrer credited-referral counter. A dedicated row (not count(*) over
-- referrals) so the cap can be enforced ATOMICALLY: the UPDATE ... WHERE
-- credited_count < cap row-locks this one row, serializing concurrent grants to the
-- same referrer. Without it, k simultaneous binds for one referrer all read count<cap
-- (read-then-act) and all pass — the cap is bypassed (attack vector F1).
CREATE TABLE IF NOT EXISTS referral_credits (
  referrer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credited_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage referral credits" ON referral_credits;
CREATE POLICY "Service role can manage referral credits"
  ON referral_credits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- The ENTIRE referral grant in ONE atomic transaction: exactly-once per referee,
-- a per-referrer cap, and the premium extend. Atomicity is what makes it fraud-safe:
--   • Exactly-once (F2): the referee row is taken FOR UPDATE then its credited flag is
--     flipped false→true inside this same tx. A second concurrent call for the referee
--     blocks on the lock, then sees credited=true → 'already'. Because the flip, the
--     cap bump and the extend all commit (or roll back) TOGETHER, a perceived failure
--     after a server-side commit is still idempotent on retry (credited is already
--     true → 'already'); a true failure rolls everything back → a clean retry. There
--     is no flip-then-separately-rollback window, so the +7 can never double-apply.
--   • Cap (F1): the referral_credits row is row-locked by the conditional UPDATE, so
--     concurrent grants to one referrer serialize → at most p_cap ever pass.
--   • Referrer identity (C1): taken from the PERSISTENT referrals row, never a request code.
--   • Extend: GREATEST(current, now)+days never clobbers a concurrently-written larger
--     (e.g. just-purchased) expiry and preserves a paid plan label; it stacks (R2).
--
-- SECURITY: SECURITY INVOKER (default) — runs as the CALLER. service_role (the Netlify
-- function) bypasses RLS and works; anon/authenticated are blocked by RLS on every
-- table it writes even if reached. EXECUTE is revoked from PUBLIC/anon/authenticated so
-- PostgREST never exposes it to clients. p_days/p_cap are hard-bounded. This must NEVER
-- become a client-callable premium tap.
CREATE OR REPLACE FUNCTION grant_referral_reward(p_referee uuid, p_days int, p_cap int)
RETURNS TABLE(result text, premium_until timestamptz)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_credited boolean;
  v_count int;
  v_until timestamptz;
BEGIN
  IF p_days IS NULL OR p_days <= 0 OR p_days > 31
     OR p_cap IS NULL OR p_cap <= 0 OR p_cap > 1000 THEN
    RAISE EXCEPTION 'grant_referral_reward: invalid args (days=%, cap=%)', p_days, p_cap;
  END IF;

  -- Lock the persistent binding for this referee; referrer comes from THIS row (C1).
  SELECT referrer_id, credited INTO v_referrer, v_credited
    FROM referrals WHERE referee_id = p_referee FOR UPDATE;
  IF v_referrer IS NULL THEN
    RETURN QUERY SELECT 'no_binding'::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_credited THEN
    SELECT expires_at INTO v_until FROM subscriptions WHERE user_id = v_referrer;
    RETURN QUERY SELECT 'already'::text, v_until;
    RETURN;
  END IF;

  -- Atomic per-referrer cap. Row-locks referral_credits(v_referrer): concurrent
  -- grants to this referrer serialize here, so at most p_cap pass (F1). Checked
  -- BEFORE flipping credited, so a capped referee stays uncredited (retriable if
  -- the product ever raises the cap) and nothing is wasted.
  INSERT INTO referral_credits (referrer_id, credited_count)
    VALUES (v_referrer, 0) ON CONFLICT (referrer_id) DO NOTHING;
  UPDATE referral_credits
    SET credited_count = credited_count + 1, updated_at = now()
    WHERE referrer_id = v_referrer AND credited_count < p_cap
    RETURNING credited_count INTO v_count;
  IF v_count IS NULL THEN
    RETURN QUERY SELECT 'capped'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Mark the referee credited (exactly-once) and extend the referrer's premium.
  UPDATE referrals SET credited = true WHERE referee_id = p_referee;

  INSERT INTO subscriptions (user_id, is_active, plan, expires_at, updated_at)
    VALUES (v_referrer, true, 'referral', now() + make_interval(days => p_days), now())
  ON CONFLICT (user_id) DO UPDATE
    SET expires_at = GREATEST(COALESCE(subscriptions.expires_at, now()), now()) + make_interval(days => p_days),
        is_active = true,
        plan = CASE WHEN subscriptions.plan IN ('monthly', 'yearly') THEN subscriptions.plan ELSE 'referral' END,
        updated_at = now()
  RETURNING expires_at INTO v_until;

  RETURN QUERY SELECT 'granted'::text, v_until;
END;
$$;

REVOKE ALL ON FUNCTION grant_referral_reward(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION grant_referral_reward(uuid, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION grant_referral_reward(uuid, int, int) TO service_role;

-- QUAL hardening: the referral qualification gate trusts a `leaderboard` row as proof
-- the referee completed a server-verified test (leaderboard.mjs recomputes the score).
-- That proof is only sound if a client CANNOT forge a row by INSERTing directly via
-- PostgREST. The leaderboard table has no RLS migration in this repo and the client
-- reads it directly (Progress.tsx), so writes must be locked to service_role. The app
-- only ever writes leaderboard through leaderboard.mjs (service key); no client code
-- INSERTs it. Revoking client write privileges closes the forgery without touching
-- reads (SELECT) or the service-role submit path. (Surgical, idempotent; flagged to the
-- orchestrator as a cross-cutting change in S7-referral-builder.md.)
-- Guarded so a fresh rebuild where `leaderboard` does not exist yet does not error.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leaderboard'
  ) THEN
    -- FROM PUBLIC too: anon/authenticated inherit PUBLIC grants, so revoking only
    -- the named roles would leave a PUBLIC INSERT grant as a bypass.
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.leaderboard FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

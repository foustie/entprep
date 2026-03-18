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

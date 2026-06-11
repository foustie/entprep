-- Pacing vs platform: anonymous per-subject × difficulty answer-time aggregates.
--
-- DESIGN: instead of storing per-user samples we keep running sums per
-- (subject, difficulty): n (sample count), sum_sec (sum of seconds) and
-- sum_sq (sum of squared seconds). From these we can compute
--   mean = sum_sec / n
--   sd   = sqrt(max(0, sum_sq / n - mean^2))   -- population stddev
-- which is enough for an honest "platform band" of mean ± sd shown in the
-- analytics UI. No personal data is ever stored — only 13 × 3 aggregate rows —
-- so SELECT is safe to expose publicly. Writes go exclusively through the
-- /api/pacing Netlify function using the service key (which bypasses RLS);
-- there are intentionally NO insert/update/delete policies for anon/authenticated.

CREATE TABLE IF NOT EXISTS pacing_stats (
  subject text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  n bigint NOT NULL DEFAULT 0,
  sum_sec double precision NOT NULL DEFAULT 0,
  sum_sq double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, difficulty)
);

ALTER TABLE pacing_stats ENABLE ROW LEVEL SECURITY;

-- Aggregates are public and non-personal: anyone may read.
CREATE POLICY "Public read pacing aggregates" ON pacing_stats
  FOR SELECT TO anon, authenticated USING (true);

-- No write policies: only service_role (bypasses RLS) can insert/update.

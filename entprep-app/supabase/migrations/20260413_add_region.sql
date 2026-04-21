-- Add region field to profiles for regional analytics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT;

-- Index for regional analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_region ON profiles(region);

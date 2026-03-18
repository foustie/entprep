-- Promo codes system
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,           -- e.g. 'TEACHER2026', 'LAUNCH7'
  days integer NOT NULL DEFAULT 7,     -- Premium days granted
  max_uses integer NOT NULL DEFAULT 0, -- 0 = unlimited
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,              -- null = never expires
  note text,                           -- internal note (e.g. "for Telegram channel X")
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid REFERENCES promo_codes(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promo_id, user_id)            -- each user can redeem each code once
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write promo_codes (admin only)
-- Users can read their own redemptions
CREATE POLICY "Users can read own redemptions" ON promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

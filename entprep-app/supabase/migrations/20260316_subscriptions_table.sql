-- Subscriptions table: authoritative source for premium status.
-- Only service_role can write; users can read their own row via RLS.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  plan TEXT, -- 'monthly' or 'yearly'
  expires_at TIMESTAMPTZ,
  rc_customer_id TEXT, -- RevenueCat customer ID
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can read their own subscription, only service_role can write
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated = only service_role can write

-- PAY-7 + SEC-3: version the payments + audit_logs tables that the live DB already has.
-- These tables exist in production (used by shared.mjs activatePremium and admin-action.mjs)
-- but were never in repo migrations, so their schema was unversioned.
--
-- This migration is written IDEMPOTENTLY (IF NOT EXISTS / guarded ADD CONSTRAINT, re-runnable
-- de-dupe) so it is safe to run against the live DB. The only existing-data change is rewriting
-- legacy constant 'manual' kaspi_tx_id values to unique 'manual_<pk>' ids so the UNIQUE
-- constraint can be created (no rows are deleted). Columns are inferred from usage; CONFIRM
-- AGAINST THE LIVE SCHEMA before running (column types/defaults may differ).

-- ── payments ────────────────────────────────────────────────────────────────
-- Written by: shared.mjs activatePremium INSERT (user_id, amount, plan, kaspi_tx_id,
--             status, premium_until). Read by: lemon-webhook.mjs SELECT by kaspi_tx_id.
CREATE TABLE IF NOT EXISTS public.payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER,
  plan TEXT,                         -- 'monthly' or 'yearly'
  kaspi_tx_id TEXT,                  -- payment provider tx id (kaspi_*, lemon_*, or 'manual')
  status TEXT,                       -- 'completed', etc.
  premium_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PAY-7: enforce one payment row per provider transaction id. Guarded so re-running is safe.
-- Real (non-'manual') tx ids are unique per webhook event. Legacy manual grants all wrote the
-- constant 'manual' (admin-action.mjs), so the live table likely holds several duplicate
-- 'manual' rows that would make ADD CONSTRAINT abort. De-dupe them first by rewriting each to a
-- per-row unique id (manual_<pk>); this preserves every row (no data loss) and is idempotent
-- (after it runs there are no bare 'manual' rows left, so a re-run matches nothing). New manual
-- grants now mint a unique manual_<uuid> id in code, so this is a one-time legacy cleanup.
UPDATE public.payments
  SET kaspi_tx_id = 'manual_' || id::text
  WHERE kaspi_tx_id = 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_kaspi_tx_id_key'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_kaspi_tx_id_key UNIQUE (kaspi_tx_id);
  END IF;
END $$;

-- RLS: service_role only. No anon/authenticated policy = no client reads or writes.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payments'
      AND policyname = 'Service role can manage payments'
  ) THEN
    CREATE POLICY "Service role can manage payments"
      ON public.payments FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── audit_logs ──────────────────────────────────────────────────────────────
-- Written by: admin-action.mjs logAudit (admin_id, admin_email, action, details).
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT,
  details TEXT,                      -- JSON-stringified payload
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only. Admin reads go through the service-key Netlify function, not the client.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
      AND policyname = 'Service role can manage audit_logs'
  ) THEN
    CREATE POLICY "Service role can manage audit_logs"
      ON public.audit_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

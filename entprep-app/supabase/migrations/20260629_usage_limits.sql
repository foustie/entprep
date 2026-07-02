-- PAY-8 / OPS-7: durable per-user daily usage limiter.
--
-- Replaces the in-memory, per-instance Map (netlify/functions/utils/shared.mjs
-- createRateLimiter) for the DAILY monetization caps (AI tutor, tutor-vision, AI
-- explain, study-plan-focus). Netlify scales functions horizontally and recycles
-- them cold, so the in-memory counter multiplied across N warm instances (a free
-- user effectively got N x the cap — PAY-8) and reset to 0 on every cold start. A
-- Supabase-backed counter is shared across all instances and survives cold starts.
-- The in-memory limiter stays ONLY for short-window (per-minute) burst protection,
-- where a per-instance best-effort ceiling is acceptable (OPS-7).
--
-- Written IDEMPOTENTLY (IF NOT EXISTS / CREATE OR REPLACE / guarded policy), in the
-- same re-runnable style as 20260622_payments_audit_logs.sql, so it is safe to run
-- and re-run against the live DB. Service-role only (RLS) like subscriptions/payments:
-- the Netlify functions write it with the service key; clients never touch it (a
-- client-writable counter would re-open the very bypass this fixes).

-- ── usage_limits table ────────────────────────────────────────────────────────
-- One row per (user, bucket, KZ-local day). `count` = units consumed in that window.
-- `bucket` namespaces the cap ('tutor' | 'tutor-vision' | 'explain' | 'focus' | ...).
-- `day` is the KZ-local calendar day (Asia/Almaty), matching push-cron.mjs's KZ clock
-- and the client's local-day reset in src/utils/aiLimits.ts.
CREATE TABLE IF NOT EXISTS public.usage_limits (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket     TEXT NOT NULL,
  day        DATE NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bucket, day)
);

-- RLS: service_role only. No anon/authenticated policy = clients can neither read nor
-- write their own counters.
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_limits'
      AND policyname = 'Service role can manage usage_limits'
  ) THEN
    CREATE POLICY "Service role can manage usage_limits"
      ON public.usage_limits FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── increment_usage(): ATOMIC check-and-increment ─────────────────────────────
-- Returns the NEW count after incrementing when allowed (count was < max), or -1 when
-- the cap was already reached (no row touched). The whole check-and-increment is ONE
-- statement, so it is race-free across concurrent Lambda instances — unlike a
-- read-modify-write, which would repeat the lost-update class behind PAY-5.
--
-- Atomicity detail: INSERT ... ON CONFLICT DO UPDATE ... WHERE count < max.
--  * fresh window  -> INSERT writes count = 1 (always allowed; max is always >= 1),
--                     RETURNING yields 1.
--  * existing row, count < max -> UPDATE fires, RETURNING yields the new count.
--  * existing row, count = max -> WHERE is false, no row is touched, RETURNING is
--                     empty, v_count stays NULL, we return -1 (blocked).
-- SECURITY DEFINER so the table write runs with the owner's rights when invoked via
-- PostgREST RPC with the service key.
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_bucket  TEXT,
  p_day     DATE,
  p_max     INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_max < 1 THEN
    RETURN -1; -- a zero/negative cap blocks everything
  END IF;

  INSERT INTO public.usage_limits (user_id, bucket, day, count)
  VALUES (p_user_id, p_bucket, p_day, 1)
  ON CONFLICT (user_id, bucket, day)
  DO UPDATE SET count = public.usage_limits.count + 1, updated_at = now()
  WHERE public.usage_limits.count < p_max
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN -1; -- row exists and count >= max -> blocked, nothing incremented
  END IF;
  RETURN v_count; -- allowed; the new (post-increment) count
END;
$$;

-- Only service_role may execute the RPC (the functions call it with the service key).
-- IMPORTANT: Supabase's default privileges grant EXECUTE on new functions DIRECTLY to
-- anon/authenticated (not only via PUBLIC), so revoking PUBLIC alone is not enough —
-- verified live 2026-07-02: with only "FROM PUBLIC" the anon key could still call the
-- RPC and drive counters. Revoke the direct grants too.
REVOKE ALL ON FUNCTION public.increment_usage(UUID, TEXT, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, TEXT, DATE, INTEGER) TO service_role;

-- ── Cleanup: bound table growth ───────────────────────────────────────────────
-- usage_limits gains one row per (user, bucket, KZ-day) and is otherwise never deleted,
-- so it grows without limit. The limiter only ever reads/writes the CURRENT KZ day, so
-- any row older than a day is dead weight. purge_usage_limits() deletes rows older than
-- 2 days (a generous margin over the single-day TZ skew), reclaiming space. It is
-- idempotent (CREATE OR REPLACE) and safe to call any number of times.
CREATE OR REPLACE FUNCTION public.purge_usage_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.usage_limits WHERE day < (CURRENT_DATE - 2);
$$;

REVOKE ALL ON FUNCTION public.purge_usage_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_usage_limits() TO service_role;

-- Schedule a daily purge via pg_cron IF that extension is installed (Supabase ships it,
-- but it may be disabled on a given project). The DO block is guarded and idempotent:
-- it unschedules any prior job of the same name before (re)scheduling, so re-running this
-- migration never stacks duplicate cron jobs. If pg_cron is unavailable this is a no-op —
-- run the purge from an external scheduler instead, e.g. daily:
--     SELECT public.purge_usage_limits();
--   (equivalently: DELETE FROM public.usage_limits WHERE day < CURRENT_DATE - 2;)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_usage_limits') THEN
      PERFORM cron.unschedule('purge_usage_limits');
    END IF;
    PERFORM cron.schedule('purge_usage_limits', '17 0 * * *', 'SELECT public.purge_usage_limits();');
  END IF;
END $$;

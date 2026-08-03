-- WS6: Soft proctoring for school-125 WL MVP.
--
-- "Soft" is the operative word: this table only RECORDS tab-switch / blur /
-- fullscreen-exit signals during a Full-ENT simulation for a teacher to review
-- after the fact. There is NO camera, NO auto-fail, and scoring never reads
-- this table (see FullENT.tsx finishENT — score is computed purely from
-- answers). It exists so a teacher can see "this student left the tab 6
-- times" as a soft signal, nothing more.

CREATE TABLE IF NOT EXISTS public.proctor_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL DEFAULT '125',
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- client-generated FullENT session id (crypto.randomUUID())
  event_type TEXT NOT NULL CHECK (event_type IN (
    'visibility_hidden', 'blur', 'focus', 'fullscreen_exit', 'session_start', 'session_end'
  )),
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proctor_events_user_session ON public.proctor_events(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_events_created_at ON public.proctor_events(created_at);

ALTER TABLE public.proctor_events ENABLE ROW LEVEL SECURITY;

-- Students insert their own events (via the proctor.mjs Netlify function, which
-- forwards the user's own JWT-derived id — never trusts a client-supplied user_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctor_events'
      AND policyname = 'students_insert_own_events'
  ) THEN
    CREATE POLICY "students_insert_own_events"
      ON public.proctor_events FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Students can read their own events.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctor_events'
      AND policyname = 'students_read_own_events'
  ) THEN
    CREATE POLICY "students_read_own_events"
      ON public.proctor_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Teachers read events for students in their own class(es) — mirrors the
-- teacher_read_student_data / teacher_read_student_profiles pattern from
-- 20260331_teacher_classes.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctor_events'
      AND policyname = 'teacher_read_class_events'
  ) THEN
    CREATE POLICY "teacher_read_class_events"
      ON public.proctor_events FOR SELECT
      USING (
        user_id IN (
          SELECT cm.student_id FROM public.class_members cm
          JOIN public.classes c ON c.id = cm.class_id
          WHERE c.teacher_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Service role (Netlify functions using SUPABASE_SERVICE_KEY) has unrestricted access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctor_events'
      AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access"
      ON public.proctor_events FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

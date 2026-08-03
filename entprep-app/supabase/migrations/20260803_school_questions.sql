-- WS5: School test import + assign (school-125 WL MVP).
--
-- Lets a teacher on a school (white-label) build import a JSON question pack
-- and assign it to their class. The Netlify function `school-content.mjs` is
-- the PRIMARY access path and uses the service key (bypasses RLS), same
-- pattern as teacher.mjs / classes / class_members (20260331_teacher_classes.sql).
-- RLS below is a pragmatic defense-in-depth backstop for direct client reads,
-- not the main authorization mechanism — keep it simple for MVP.
--
-- Written IDEMPOTENTLY (IF NOT EXISTS / guarded policies), safe to re-run.

CREATE TABLE IF NOT EXISTS public.school_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,                 -- e.g. '125' (school-125). Retail = 'entprep'.
  subject text NOT NULL,                   -- free-form subject id/label chosen by the teacher
  title text,
  payload jsonb NOT NULL,                  -- array of Question-like objects OR { questions: [...] }
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_class_ids uuid[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_school_questions_tenant ON public.school_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_questions_created_by ON public.school_questions(created_by);
-- GIN index to support the `assigned_class_ids && ...` overlap lookup used by get_assigned.
CREATE INDEX IF NOT EXISTS idx_school_questions_assigned_class_ids ON public.school_questions USING GIN (assigned_class_ids);

ALTER TABLE public.school_questions ENABLE ROW LEVEL SECURITY;

-- Service role (Netlify functions) bypasses RLS entirely, but grant it explicitly too.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_questions'
      AND policyname = 'service_role_all_school_questions'
  ) THEN
    CREATE POLICY "service_role_all_school_questions" ON public.school_questions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Teachers (owners of a class row, per the classes/teacher_id model in
-- 20260331_teacher_classes.sql) can insert packs they create.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_questions'
      AND policyname = 'teachers_insert_own_packs'
  ) THEN
    CREATE POLICY "teachers_insert_own_packs" ON public.school_questions
      FOR INSERT
      WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM public.classes c WHERE c.teacher_id = auth.uid())
      );
  END IF;
END $$;

-- Teachers can read packs they created, or that any of their classes is assigned to.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_questions'
      AND policyname = 'teachers_read_own_or_assigned'
  ) THEN
    CREATE POLICY "teachers_read_own_or_assigned" ON public.school_questions
      FOR SELECT
      USING (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.classes c
          WHERE c.teacher_id = auth.uid() AND c.id = ANY(assigned_class_ids)
        )
      );
  END IF;
END $$;

-- Teachers can update (assign classes to) packs they created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_questions'
      AND policyname = 'teachers_update_own_packs'
  ) THEN
    CREATE POLICY "teachers_update_own_packs" ON public.school_questions
      FOR UPDATE
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- Students can read packs assigned to any class they belong to.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_questions'
      AND policyname = 'students_read_assigned_packs'
  ) THEN
    CREATE POLICY "students_read_assigned_packs" ON public.school_questions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.student_id = auth.uid() AND cm.class_id = ANY(assigned_class_ids)
        )
      );
  END IF;
END $$;

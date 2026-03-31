-- Teacher Dashboard: classes and memberships
-- Teachers are regular users who create a class

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,          -- e.g. "11Б"
  school text NOT NULL,        -- e.g. "НИШ Алматы"
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Class members (students)
CREATE TABLE IF NOT EXISTS class_members (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_invite ON classes(invite_code);
CREATE INDEX IF NOT EXISTS idx_class_members_student ON class_members(student_id);

-- RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;

-- Teacher can read/create their own classes
CREATE POLICY "teachers_own_classes" ON classes
  FOR ALL USING (auth.uid() = teacher_id);

-- Students can read classes they belong to
CREATE POLICY "students_read_class" ON classes
  FOR SELECT USING (
    id IN (SELECT class_id FROM class_members WHERE student_id = auth.uid())
  );

-- Teacher can manage members of their classes
CREATE POLICY "teacher_manage_members" ON class_members
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

-- Students can join (insert themselves) and read their own membership
CREATE POLICY "student_join_class" ON class_members
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "student_read_own" ON class_members
  FOR SELECT USING (student_id = auth.uid());

-- Teacher needs to read student profiles and user_data
-- Add policy for profiles: teachers can read profiles of their class members
CREATE POLICY "teacher_read_student_profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT cm.student_id FROM class_members cm
      JOIN classes c ON c.id = cm.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Teacher can read user_data of their students
CREATE POLICY "teacher_read_student_data" ON user_data
  FOR SELECT USING (
    id IN (
      SELECT cm.student_id FROM class_members cm
      JOIN classes c ON c.id = cm.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

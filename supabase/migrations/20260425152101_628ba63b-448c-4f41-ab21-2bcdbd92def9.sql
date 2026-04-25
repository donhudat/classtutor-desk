-- 1. Cột attachments cho assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Helper: học sinh hiện tại có thuộc lớp của assignment không?
CREATE OR REPLACE FUNCTION public.is_student_in_assignment(_assignment_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.class_enrollments e ON e.class_id = a.class_id
    JOIN public.students s ON s.id = e.student_id
    WHERE a.id = _assignment_id
      AND s.user_id = auth.uid()
      AND e.deleted_at IS NULL
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  );
$$;

-- Helper: phụ huynh hiện tại có con thuộc lớp của assignment không?
CREATE OR REPLACE FUNCTION public.is_parent_in_assignment(_assignment_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.class_enrollments e ON e.class_id = a.class_id
    JOIN public.students s ON s.id = e.student_id
    JOIN public.parents p ON p.id = s.parent_id
    WHERE a.id = _assignment_id
      AND p.user_id = auth.uid()
      AND e.deleted_at IS NULL
  );
$$;

-- 3. Tạo storage buckets (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-attachments', 'assignment-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-files', 'submission-files', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies cho assignment-attachments
-- Path convention: {tenant_id}/{assignment_id}/{filename}
DROP POLICY IF EXISTS "att_teacher_all" ON storage.objects;
CREATE POLICY "att_teacher_all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'assignment-attachments'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

DROP POLICY IF EXISTS "att_student_select" ON storage.objects;
CREATE POLICY "att_student_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND public.is_student_in_assignment(((storage.foldername(name))[2])::bigint)
);

DROP POLICY IF EXISTS "att_parent_select" ON storage.objects;
CREATE POLICY "att_parent_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND public.is_parent_in_assignment(((storage.foldername(name))[2])::bigint)
);

-- 5. Storage policies cho submission-files
-- Path convention: {tenant_id}/{assignment_id}/{student_id}/{filename}
DROP POLICY IF EXISTS "sub_teacher_all" ON storage.objects;
CREATE POLICY "sub_teacher_all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'submission-files'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

DROP POLICY IF EXISTS "sub_student_rw" ON storage.objects;
CREATE POLICY "sub_student_rw" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.is_student_self(((storage.foldername(name))[3])::bigint)
)
WITH CHECK (
  bucket_id = 'submission-files'
  AND public.is_student_self(((storage.foldername(name))[3])::bigint)
);

DROP POLICY IF EXISTS "sub_parent_select" ON storage.objects;
CREATE POLICY "sub_parent_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.is_parent_of_student(((storage.foldername(name))[3])::bigint)
);

-- 6. Triggers updated_at cho các bảng còn thiếu
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'assignments', 'submissions', 'class_sessions', 'classes',
    'students', 'parents', 'class_enrollments', 'profiles'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
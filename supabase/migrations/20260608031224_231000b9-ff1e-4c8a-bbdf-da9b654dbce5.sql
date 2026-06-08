
-- Fix 1: Drop overly-broad teacher storage policies that bypass tenant scoping
DROP POLICY IF EXISTS "assignment_attachments_teacher_all" ON storage.objects;
DROP POLICY IF EXISTS "submission_files_teacher_all" ON storage.objects;

-- Fix 2: Tighten student/parent SELECT policies for assignment-attachments
-- so only users enrolled in the related class (or parents of enrolled students)
-- can read the file, not every tenant member.
DROP POLICY IF EXISTS "att_student_select_v2" ON storage.objects;
DROP POLICY IF EXISTS "att_parent_select_v2" ON storage.objects;

CREATE POLICY "att_student_select_v3"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
  AND (storage.foldername(name))[2] = 'assignments'
  AND public.is_student_in_assignment(((storage.foldername(name))[3])::bigint)
);

CREATE POLICY "att_parent_select_v3"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
  AND (storage.foldername(name))[2] = 'assignments'
  AND public.is_parent_in_assignment(((storage.foldername(name))[3])::bigint)
);

-- Fix 3: Revoke EXECUTE from anon on SECURITY DEFINER RPCs that should only be
-- callable by signed-in teachers (the functions also self-check via is_teacher()).
REVOKE EXECUTE ON FUNCTION public.compute_tuition_for_class_month(bigint, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_tuition_for_tenant_month(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.compute_tuition_for_class_month(bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_tuition_for_tenant_month(date) TO authenticated;

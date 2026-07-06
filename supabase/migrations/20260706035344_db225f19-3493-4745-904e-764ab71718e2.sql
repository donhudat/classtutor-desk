
-- Restore working access to assignment-attachments bucket.
-- The v3 policies expected foldername[3] to be an assignment_id (bigint),
-- but files are actually stored at tenant-{id}/assignments/{ts}-{name},
-- so the ::bigint cast fails and downloads return 400.

DROP POLICY IF EXISTS "att_student_select_v3" ON storage.objects;
DROP POLICY IF EXISTS "att_parent_select_v3" ON storage.objects;
DROP POLICY IF EXISTS "att_teacher_all_v3" ON storage.objects;

-- Teachers manage files in their own tenant folder.
CREATE POLICY "att_teacher_all_v3"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
)
WITH CHECK (
  bucket_id = 'assignment-attachments'
  AND public.is_teacher()
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
);

-- Students in the tenant may read attachments in their tenant folder.
CREATE POLICY "att_student_select_v3"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
  AND public.has_role(auth.uid(), 'student'::app_role)
);

-- Parents in the tenant may read attachments in their tenant folder.
CREATE POLICY "att_parent_select_v3"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
  AND public.has_role(auth.uid(), 'parent'::app_role)
);

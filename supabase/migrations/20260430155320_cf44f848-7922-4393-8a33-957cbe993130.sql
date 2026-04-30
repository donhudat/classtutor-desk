
-- Path format: tenant-{n}/assignments/{timestamp}-filename
-- foldername[2] = 'assignments' (text), không phải số. Policy cũ cast sang bigint → lỗi.
-- Sửa: cho phép student/parent trong tenant đọc nếu file thuộc bucket assignment-attachments
-- và folder đầu khớp tenant của họ.

DROP POLICY IF EXISTS att_student_select ON storage.objects;
DROP POLICY IF EXISTS att_parent_select ON storage.objects;
DROP POLICY IF EXISTS assignment_attachments_student_read ON storage.objects;

CREATE POLICY "att_student_select_v2"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
);

CREATE POLICY "att_parent_select_v2"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (storage.foldername(name))[1] = ('tenant-' || (public.current_tenant_id())::text)
);


DROP POLICY IF EXISTS "submission_files_student_insert" ON storage.objects;
CREATE POLICY "submission_files_student_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submission-files'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[3] = s.id::text
  )
);

DROP POLICY IF EXISTS "submission_files_student_select" ON storage.objects;
CREATE POLICY "submission_files_student_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submission-files'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[3] = s.id::text
  )
);

DROP POLICY IF EXISTS "submission_files_student_delete" ON storage.objects;
CREATE POLICY "submission_files_student_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'submission-files'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[3] = s.id::text
  )
);

DROP POLICY IF EXISTS "submission_files_parent_select" ON storage.objects;
CREATE POLICY "submission_files_parent_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submission-files'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.parents p ON p.id = s.parent_id
    WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[3] = s.id::text
  )
);

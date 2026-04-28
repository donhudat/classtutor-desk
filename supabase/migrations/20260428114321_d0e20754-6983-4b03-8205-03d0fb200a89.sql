
-- 1) Fix tuition function: use correct enum value 'absent_excused'
CREATE OR REPLACE FUNCTION public.compute_tuition_for_class_month(_class_id bigint, _month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant bigint;
  v_count integer := 0;
  v_month_start date := date_trunc('month', _month)::date;
  v_month_end date := (date_trunc('month', _month) + interval '1 month')::date;
  rec RECORD;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.classes WHERE id = _class_id AND deleted_at IS NULL;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  IF NOT (public.is_teacher() AND v_tenant = public.current_tenant_id()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR rec IN
    SELECT
      e.id AS enrollment_id,
      e.student_id,
      e.price_per_session,
      COALESCE(SUM(CASE WHEN a.status IN ('attended','late') THEN 1 ELSE 0 END), 0)::int AS attended_count,
      COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0)::int AS late_count,
      COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
      COALESCE(SUM(CASE WHEN a.status = 'absent_excused' THEN 1 ELSE 0 END), 0)::int AS excused_count,
      COUNT(s.id)::int AS session_count
    FROM public.class_enrollments e
    LEFT JOIN public.class_sessions s
      ON s.class_id = e.class_id
     AND s.deleted_at IS NULL
     AND s.starts_at >= v_month_start
     AND s.starts_at < v_month_end
    LEFT JOIN public.attendances a
      ON a.session_id = s.id AND a.student_id = e.student_id
    WHERE e.class_id = _class_id
      AND e.deleted_at IS NULL
      AND e.start_date < v_month_end
      AND (e.end_date IS NULL OR e.end_date >= v_month_start)
    GROUP BY e.id, e.student_id, e.price_per_session
  LOOP
    INSERT INTO public.payments (
      tenant_id, student_id, class_enrollment_id, month,
      session_count, attended_count, late_count, absent_count, excused_count,
      price_per_session, total_amount, paid_amount, status, computed_at
    ) VALUES (
      v_tenant, rec.student_id, rec.enrollment_id, v_month_start,
      rec.session_count, rec.attended_count, rec.late_count, rec.absent_count, rec.excused_count,
      rec.price_per_session,
      (rec.attended_count + rec.late_count) * rec.price_per_session,
      0,
      CASE WHEN (rec.attended_count + rec.late_count) * rec.price_per_session = 0 THEN 'paid'::payment_status ELSE 'unpaid'::payment_status END,
      now()
    )
    ON CONFLICT (class_enrollment_id, month) DO UPDATE SET
      session_count = EXCLUDED.session_count,
      attended_count = EXCLUDED.attended_count,
      late_count = EXCLUDED.late_count,
      absent_count = EXCLUDED.absent_count,
      excused_count = EXCLUDED.excused_count,
      price_per_session = EXCLUDED.price_per_session,
      total_amount = EXCLUDED.total_amount,
      status = CASE
        WHEN payments.paid_amount >= EXCLUDED.total_amount AND EXCLUDED.total_amount > 0 THEN 'paid'::payment_status
        WHEN payments.paid_amount > 0 AND payments.paid_amount < EXCLUDED.total_amount THEN 'partial'::payment_status
        WHEN EXCLUDED.total_amount = 0 THEN 'paid'::payment_status
        ELSE 'unpaid'::payment_status
      END,
      computed_at = now(),
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2) Storage policies for assignment-attachments (teachers manage; students/parents in class can read)
DROP POLICY IF EXISTS "assignment_attachments_teacher_all" ON storage.objects;
CREATE POLICY "assignment_attachments_teacher_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'assignment-attachments' AND public.is_teacher())
WITH CHECK (bucket_id = 'assignment-attachments' AND public.is_teacher());

DROP POLICY IF EXISTS "assignment_attachments_student_read" ON storage.objects;
CREATE POLICY "assignment_attachments_student_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-attachments');

-- 3) Storage policies for submission-files
-- Path convention: <assignment_id>/<student_id>/<filename>
DROP POLICY IF EXISTS "submission_files_teacher_all" ON storage.objects;
CREATE POLICY "submission_files_teacher_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'submission-files' AND public.is_teacher())
WITH CHECK (bucket_id = 'submission-files' AND public.is_teacher());

DROP POLICY IF EXISTS "submission_files_student_insert" ON storage.objects;
CREATE POLICY "submission_files_student_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submission-files'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[2] = s.id::text
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
      AND (storage.foldername(name))[2] = s.id::text
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
      AND (storage.foldername(name))[2] = s.id::text
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
      AND (storage.foldername(name))[2] = s.id::text
  )
);

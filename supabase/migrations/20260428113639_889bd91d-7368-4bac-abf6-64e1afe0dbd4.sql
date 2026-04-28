
-- Function: compute tuition for a class for a given month (first day of month)
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
  -- permission check: only teacher in same tenant
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
      COALESCE(SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END), 0)::int AS excused_count,
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

-- Add unique constraint to support upsert if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_enrollment_month_unique'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_enrollment_month_unique UNIQUE (class_enrollment_id, month);
  END IF;
END $$;

-- Convenience: compute for all active classes in the teacher's tenant for a month
CREATE OR REPLACE FUNCTION public.compute_tuition_for_tenant_month(_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant bigint;
  v_total integer := 0;
  v_added integer;
  c RECORD;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL OR NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR c IN
    SELECT id FROM public.classes
    WHERE tenant_id = v_tenant AND deleted_at IS NULL
  LOOP
    v_added := public.compute_tuition_for_class_month(c.id, _month);
    v_total := v_total + v_added;
  END LOOP;

  RETURN v_total;
END;
$$;

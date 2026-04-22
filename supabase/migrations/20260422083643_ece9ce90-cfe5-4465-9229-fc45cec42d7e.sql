-- ============================================================================
-- MIGRATION 2/2: Enable RLS + policies + auto tenant_id trigger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-fill tenant_id on insert from current user's profile (defense-in-depth)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- ENABLE RLS on all tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TENANTS — only owner sees own tenant
-- ----------------------------------------------------------------------------
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

CREATE POLICY "tenant_owner_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (id = public.current_tenant_id() AND public.is_teacher());

-- ----------------------------------------------------------------------------
-- PROFILES — user sees self; teacher sees all in tenant
-- ----------------------------------------------------------------------------
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.is_teacher()));

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.is_teacher()))
  WITH CHECK (id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.is_teacher()));

CREATE POLICY "profiles_teacher_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

-- ----------------------------------------------------------------------------
-- USER_ROLES — readable by self & teacher in same tenant; only teacher can write
-- ----------------------------------------------------------------------------
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.is_teacher()));

CREATE POLICY "user_roles_teacher_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

-- ----------------------------------------------------------------------------
-- Generic "teacher full / scoped read" policy generator macro is verbose,
-- so we write each table explicitly for clarity.
-- ----------------------------------------------------------------------------

-- PARENTS
CREATE POLICY "parents_teacher_all" ON public.parents
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "parents_self_select" ON public.parents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- STUDENTS
CREATE POLICY "students_teacher_all" ON public.students
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "students_self_select" ON public.students
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "students_parent_select" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(id));

-- CLASSES
CREATE POLICY "classes_teacher_all" ON public.classes
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "classes_student_select" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_student_in_class(id));

CREATE POLICY "classes_parent_select" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_parent_child_in_class(id));

-- CLASS_ENROLLMENTS
CREATE POLICY "enrollments_teacher_all" ON public.class_enrollments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "enrollments_student_select" ON public.class_enrollments
  FOR SELECT TO authenticated
  USING (public.is_student_self(student_id));

CREATE POLICY "enrollments_parent_select" ON public.class_enrollments
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- CLASS_SESSIONS
CREATE POLICY "sessions_teacher_all" ON public.class_sessions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "sessions_student_select" ON public.class_sessions
  FOR SELECT TO authenticated
  USING (public.is_student_in_class(class_id));

CREATE POLICY "sessions_parent_select" ON public.class_sessions
  FOR SELECT TO authenticated
  USING (public.is_parent_child_in_class(class_id));

-- ATTENDANCES
CREATE POLICY "attendances_teacher_all" ON public.attendances
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "attendances_student_select" ON public.attendances
  FOR SELECT TO authenticated
  USING (public.is_student_self(student_id));

CREATE POLICY "attendances_parent_select" ON public.attendances
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- ASSIGNMENTS
CREATE POLICY "assignments_teacher_all" ON public.assignments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "assignments_student_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_student_in_class(class_id));

CREATE POLICY "assignments_parent_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_parent_child_in_class(class_id));

-- SUBMISSIONS — student can insert/update own; teacher full; parent read-only
CREATE POLICY "submissions_teacher_all" ON public.submissions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "submissions_student_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (public.is_student_self(student_id));

CREATE POLICY "submissions_student_insert" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_student_self(student_id));

CREATE POLICY "submissions_student_update" ON public.submissions
  FOR UPDATE TO authenticated
  USING (public.is_student_self(student_id) AND status IN ('draft','submitted'))
  WITH CHECK (public.is_student_self(student_id) AND status IN ('draft','submitted'));

CREATE POLICY "submissions_parent_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- SUBMISSION_FILES — same access as parent submission
CREATE POLICY "subfiles_teacher_all" ON public.submission_files
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "subfiles_student_select" ON public.submission_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s
                 WHERE s.id = submission_id AND public.is_student_self(s.student_id)));

CREATE POLICY "subfiles_student_insert" ON public.submission_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s
                      WHERE s.id = submission_id AND public.is_student_self(s.student_id)));

CREATE POLICY "subfiles_parent_select" ON public.submission_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s
                 WHERE s.id = submission_id AND public.is_parent_of_student(s.student_id)));

-- FEEDBACKS
CREATE POLICY "feedbacks_teacher_all" ON public.feedbacks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "feedbacks_student_select" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (public.is_student_self(student_id));

CREATE POLICY "feedbacks_parent_select" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- PAYMENTS — teacher full; parent read-only of own children. Student NO access.
CREATE POLICY "payments_teacher_all" ON public.payments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_teacher());

CREATE POLICY "payments_parent_select" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));

-- AUDIT_LOGS — teacher read only; inserts via SECURITY DEFINER only
CREATE POLICY "audit_teacher_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_teacher());

-- ----------------------------------------------------------------------------
-- Fix WARN: set search_path on the existing trigger function created earlier
-- (set_updated_at was created without explicit SET search_path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
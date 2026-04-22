-- ============================================================================
-- MIGRATION 1/2: Schema, enums, tables, indexes, helper functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('teacher', 'student', 'parent');
CREATE TYPE public.attendance_status AS ENUM ('attended', 'late', 'absent', 'absent_excused');
CREATE TYPE public.session_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'graded', 'returned');

-- ----------------------------------------------------------------------------
-- TENANTS — top-level isolation boundary
-- ----------------------------------------------------------------------------
CREATE TABLE public.tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id UUID,                       -- FK added later (depends on profiles)
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- PROFILES — 1:1 with auth.users, carries tenant + display info
-- login_id is the human-friendly handle (e.g. tnt12_stu_a7k9m2)
-- The hack: auth email = login_id || '@app.local'
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  login_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
-- Partial unique: only enforce uniqueness on non-deleted rows
CREATE UNIQUE INDEX profiles_login_id_unique ON public.profiles (login_id) WHERE deleted_at IS NULL;
CREATE INDEX profiles_tenant_idx ON public.profiles (tenant_id);

-- Now we can add the tenants.owner_user_id FK
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_owner_fk FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id);

-- ----------------------------------------------------------------------------
-- USER_ROLES — separate table (security best practice, prevents privilege escalation)
-- A user can have multiple roles in theory; in practice 1 role per user in MVP
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX user_roles_tenant_idx ON public.user_roles (tenant_id);

-- ----------------------------------------------------------------------------
-- PARENTS — domain entity (1 user can be a parent record)
-- ----------------------------------------------------------------------------
CREATE TABLE public.parents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (user_id)
);
CREATE INDEX parents_tenant_idx ON public.parents (tenant_id);

-- ----------------------------------------------------------------------------
-- STUDENTS — references parent (nullable: a student may exist before parent linked)
-- ----------------------------------------------------------------------------
CREATE TABLE public.students (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES public.parents(id),
  date_of_birth DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (user_id)
);
CREATE INDEX students_tenant_idx ON public.students (tenant_id);
CREATE INDEX students_parent_idx ON public.students (parent_id);

-- ----------------------------------------------------------------------------
-- CLASSES — schedule stored as structured JSON: [{dayOfWeek:1-7, startTime, endTime}]
-- ----------------------------------------------------------------------------
CREATE TABLE public.classes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  subject TEXT,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX classes_tenant_idx ON public.classes (tenant_id);

-- ----------------------------------------------------------------------------
-- CLASS_ENROLLMENTS — student enrolls in class with a price snapshot.
-- Mid-month transfers create a NEW row (old gets end_date set). Tuition
-- computed PER ENROLLMENT, then aggregated for parent display.
-- ----------------------------------------------------------------------------
CREATE TABLE public.class_enrollments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  class_id BIGINT NOT NULL REFERENCES public.classes(id),
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  price_per_session BIGINT NOT NULL CHECK (price_per_session >= 0),  -- VND, integer
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX enrollments_tenant_idx ON public.class_enrollments (tenant_id);
CREATE INDEX enrollments_class_idx ON public.class_enrollments (class_id);
CREATE INDEX enrollments_student_idx ON public.class_enrollments (student_id);

-- ----------------------------------------------------------------------------
-- CLASS_SESSIONS — concrete scheduled occurrences. Stored UTC; VN month derived.
-- ----------------------------------------------------------------------------
CREATE TABLE public.class_sessions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  class_id BIGINT NOT NULL REFERENCES public.classes(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  note TEXT,
  attendance_taken_at TIMESTAMPTZ,           -- non-null = attendance has been recorded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);
CREATE INDEX sessions_tenant_idx ON public.class_sessions (tenant_id);
CREATE INDEX sessions_class_starts_idx ON public.class_sessions (class_id, starts_at);
-- Prevent batch-generate duplicates
CREATE UNIQUE INDEX sessions_unique_slot ON public.class_sessions (class_id, starts_at) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- ATTENDANCES — one row per (session, student)
-- ----------------------------------------------------------------------------
CREATE TABLE public.attendances (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  session_id BIGINT NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  status public.attendance_status NOT NULL,
  checked_in_at TIMESTAMPTZ,
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX attendances_tenant_idx ON public.attendances (tenant_id);
CREATE INDEX attendances_student_idx ON public.attendances (student_id);

-- ----------------------------------------------------------------------------
-- ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE public.assignments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  class_id BIGINT NOT NULL REFERENCES public.classes(id),
  session_id BIGINT REFERENCES public.class_sessions(id),
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (max_score > 0),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX assignments_tenant_idx ON public.assignments (tenant_id);
CREATE INDEX assignments_class_idx ON public.assignments (class_id);

-- ----------------------------------------------------------------------------
-- SUBMISSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE public.submissions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  assignment_id BIGINT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  content TEXT,
  status public.submission_status NOT NULL DEFAULT 'submitted',
  score NUMERIC(5,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX submissions_tenant_idx ON public.submissions (tenant_id);
CREATE INDEX submissions_student_idx ON public.submissions (student_id);

-- ----------------------------------------------------------------------------
-- SUBMISSION_FILES — files stored in Supabase Storage bucket 'submissions'
-- storage_path = 'tenant_{id}/submission_{id}/{filename}'
-- ----------------------------------------------------------------------------
CREATE TABLE public.submission_files (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- 10MB
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX submission_files_submission_idx ON public.submission_files (submission_id);

-- ----------------------------------------------------------------------------
-- FEEDBACKS — per (session, student). Distinct from per-assignment feedback.
-- ----------------------------------------------------------------------------
CREATE TABLE public.feedbacks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  session_id BIGINT NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX feedbacks_tenant_idx ON public.feedbacks (tenant_id);
CREATE INDEX feedbacks_student_idx ON public.feedbacks (student_id);

-- ----------------------------------------------------------------------------
-- PAYMENTS — one row per (enrollment, month). Aggregate at app layer for student totals.
-- month stored as DATE = first day of month in VN timezone (e.g. 2025-04-01)
-- ----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id),
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  class_enrollment_id BIGINT NOT NULL REFERENCES public.class_enrollments(id),
  month DATE NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  attended_count INTEGER NOT NULL DEFAULT 0 CHECK (attended_count >= 0),
  late_count INTEGER NOT NULL DEFAULT 0 CHECK (late_count >= 0),
  absent_count INTEGER NOT NULL DEFAULT 0 CHECK (absent_count >= 0),
  excused_count INTEGER NOT NULL DEFAULT 0 CHECK (excused_count >= 0),
  price_per_session BIGINT NOT NULL CHECK (price_per_session >= 0),
  total_amount BIGINT NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status public.payment_status NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  note TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_enrollment_id, month)
);
CREATE INDEX payments_tenant_month_idx ON public.payments (tenant_id, month);
CREATE INDEX payments_student_month_idx ON public.payments (student_id, month);

-- ----------------------------------------------------------------------------
-- AUDIT_LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_created_idx ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_entity_idx ON public.audit_logs (entity, entity_id);

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER) — used by RLS to avoid recursion
-- ----------------------------------------------------------------------------

-- Returns the tenant_id of the currently authenticated user
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- Role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Is the auth user a teacher in their tenant?
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'teacher'); $$;

-- Is the auth user the student with given id?
CREATE OR REPLACE FUNCTION public.is_student_self(_student_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = _student_id AND user_id = auth.uid());
$$;

-- Is the auth user a parent of the given student?
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.parents p ON p.id = s.parent_id
    WHERE s.id = _student_id AND p.user_id = auth.uid()
  );
$$;

-- Is the auth student enrolled in the given class (active)?
CREATE OR REPLACE FUNCTION public.is_student_in_class(_class_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = _class_id
      AND s.user_id = auth.uid()
      AND e.deleted_at IS NULL
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  );
$$;

-- Is the auth parent's child enrolled in the given class?
CREATE OR REPLACE FUNCTION public.is_parent_child_in_class(_class_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_enrollments e
    JOIN public.students s ON s.id = e.student_id
    JOIN public.parents p ON p.id = s.parent_id
    WHERE e.class_id = _class_id
      AND p.user_id = auth.uid()
      AND e.deleted_at IS NULL
  );
$$;

-- ----------------------------------------------------------------------------
-- TIMESTAMP TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','profiles','parents','students','classes','class_enrollments',
    'class_sessions','attendances','assignments','submissions','feedbacks','payments'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;
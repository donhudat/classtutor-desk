
-- Helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'super_admin'::app_role); $$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Read-only policies for super admin
CREATE POLICY "super_admin_read_tenants" ON public.tenants
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_students" ON public.students
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_parents" ON public.parents
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_classes" ON public.classes
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_enrollments" ON public.class_enrollments
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_sessions" ON public.class_sessions
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_attendances" ON public.attendances
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_assignments" ON public.assignments
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super_admin_read_submissions" ON public.submissions
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Mark platform tenant
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;

-- Create platform tenant if not exists
INSERT INTO public.tenants (name, is_platform)
SELECT 'Platform', true
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE is_platform = true);


-- Super admin read all audit logs
CREATE POLICY "super_admin_read_audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Allow authenticated users to insert their own audit rows
GRANT INSERT ON public.audit_logs TO authenticated;

CREATE POLICY "audit_self_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Activity logging RPC
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _entity text DEFAULT 'session',
  _entity_id text DEFAULT NULL,
  _meta jsonb DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_tenant bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs(tenant_id, user_id, action, entity, entity_id, after)
  VALUES (v_tenant, auth.uid(), _action, _entity, _entity_id, _meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) TO authenticated;

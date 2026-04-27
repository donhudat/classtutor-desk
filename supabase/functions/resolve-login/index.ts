// resolve-login: public function — resolve tenant_id from a login_id + role
// so students/parents only need to enter login + password (no center code).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  login_id: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/i),
  role: z.enum(["student", "parent"]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dữ liệu không hợp lệ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const login_id = parsed.data.login_id.toLowerCase();

    // Find profiles whose login_id matches AND have the requested role.
    // We use the admin client (bypasses RLS) but only return tenant_id —
    // no PII is leaked.
    const { data, error } = await admin
      .from("profiles")
      .select("id, tenant_id, user_roles!inner(role)")
      .eq("login_id", login_id)
      .eq("user_roles.role", parsed.data.role)
      .is("deleted_at", null)
      .limit(2);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Không tìm thấy tài khoản" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.length > 1) {
      // Ambiguous — login_id collides across tenants. Should not happen in
      // practice (login_id is unique-per-tenant; collisions across tenants
      // are rare). Ask the user to contact their teacher.
      return new Response(
        JSON.stringify({ error: "Login ID bị trùng — liên hệ giáo viên" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ tenant_id: data[0].tenant_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Lỗi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
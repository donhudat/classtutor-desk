// register-teacher: tạo tenant mới + auth user + profile + role=teacher
// Public endpoint, verify_jwt = false
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
  tenant_name: z.string().trim().min(1).max(100),
  login_id: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/i, "Chỉ chữ, số, gạch dưới"),
  phone: z.string().trim().max(20).optional().nullable(),
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
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { email, password, full_name, tenant_name, login_id, phone } =
      parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1) Tạo auth user (email confirmed luôn cho MVP self-serve teacher)
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({
          error: createErr?.message ?? "Không tạo được tài khoản",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const userId = created.user.id;

    // helper: rollback nếu lỗi giữa chừng
    const rollback = async () => {
      await admin.auth.admin.deleteUser(userId);
    };

    // 2) Tạo tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: tenant_name, owner_user_id: null })
      .select("id")
      .single();
    if (tenantErr || !tenant) {
      await rollback();
      return new Response(
        JSON.stringify({ error: tenantErr?.message ?? "Lỗi tạo tenant" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3) Tạo profile
    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      tenant_id: tenant.id,
      full_name,
      login_id,
      email,
      phone: phone ?? null,
      must_change_password: false,
      is_active: true,
    });
    if (profileErr) {
      await admin.from("tenants").delete().eq("id", tenant.id);
      await rollback();
      const msg = profileErr.message.includes("login_id")
        ? "Login ID đã tồn tại"
        : profileErr.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Gán role teacher
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: "teacher",
    });
    if (roleErr) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.from("tenants").delete().eq("id", tenant.id);
      await rollback();
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Cập nhật owner_user_id (sau khi profile đã tồn tại để thoả FK)
    await admin
      .from("tenants")
      .update({ owner_user_id: userId })
      .eq("id", tenant.id);

    return new Response(
      JSON.stringify({ tenant_id: tenant.id, user_id: userId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

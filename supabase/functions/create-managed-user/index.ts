// create-managed-user: teacher tạo student/parent trong tenant của mình.
// Yêu cầu JWT của teacher. Server verify role + tenant.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  role: z.enum(["student", "parent"]),
  full_name: z.string().trim().min(1).max(100),
  login_id: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/i),
  phone: z.string().trim().max(20).optional().nullable(),
  date_of_birth: z.string().optional().nullable(), // YYYY-MM-DD, only for student
  parent_id: z.number().int().positive().optional().nullable(),
});

function randomPassword(len = 10) {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Thiếu token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jwt = authHeader.replace("Bearer ", "");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client với JWT để verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Verify caller là teacher của tenant nào
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", callerId)
      .maybeSingle();
    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Profile không tồn tại" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "teacher")
      .eq("tenant_id", callerProfile.tenant_id)
      .maybeSingle();
    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Chỉ giáo viên mới được tạo tài khoản" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
    const { role, full_name, login_id, phone, date_of_birth, parent_id } =
      parsed.data;
    const tenantId = callerProfile.tenant_id;

    // Map login_id -> virtual email (đã chốt convention)
    const virtualEmail =
      `tnt${tenantId}_${role.slice(0, 3)}_${login_id.toLowerCase()}@app.local`;
    const password = randomPassword(10);

    // 1) Auth user
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: virtualEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name, login_id, role },
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
    const newUserId = created.user.id;
    const rollback = async () => {
      await admin.auth.admin.deleteUser(newUserId);
    };

    // 2) Profile
    const { error: profileErr } = await admin.from("profiles").insert({
      id: newUserId,
      tenant_id: tenantId,
      full_name,
      login_id: login_id.toLowerCase(),
      email: virtualEmail,
      phone: phone ?? null,
      must_change_password: false,
      is_active: true,
    });
    if (profileErr) {
      await rollback();
      const msg = profileErr.message.includes("login_id")
        ? "Login ID đã tồn tại trong lớp của bạn"
        : profileErr.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Role
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: newUserId,
      tenant_id: tenantId,
      role,
    });
    if (roleErr) {
      await admin.from("profiles").delete().eq("id", newUserId);
      await rollback();
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Domain row
    let domainId: number | null = null;
    if (role === "student") {
      const { data, error } = await admin
        .from("students")
        .insert({
          tenant_id: tenantId,
          user_id: newUserId,
          parent_id: parent_id ?? null,
          date_of_birth: date_of_birth ?? null,
        })
        .select("id")
        .single();
      if (error) {
        await admin.from("user_roles").delete().eq("user_id", newUserId);
        await admin.from("profiles").delete().eq("id", newUserId);
        await rollback();
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      domainId = data.id;
    } else {
      const { data, error } = await admin
        .from("parents")
        .insert({
          tenant_id: tenantId,
          user_id: newUserId,
          phone: phone ?? null,
        })
        .select("id")
        .single();
      if (error) {
        await admin.from("user_roles").delete().eq("user_id", newUserId);
        await admin.from("profiles").delete().eq("id", newUserId);
        await rollback();
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      domainId = data.id;
    }

    return new Response(
      JSON.stringify({
        user_id: newUserId,
        domain_id: domainId,
        login_id: login_id.toLowerCase(),
        password, // hiển thị 1 lần cho teacher
      }),
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

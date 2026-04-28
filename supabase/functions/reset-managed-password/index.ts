// reset-managed-password: teacher reset password cho student/parent trong tenant của mình.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  user_id: z.string().uuid(),
  // optional: cho phép teacher tự nhập; nếu không thì sinh random
  new_password: z.string().min(6).max(72).optional().nullable(),
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

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(jwt);
    const callerId = claimsRes?.claims?.sub;
    if (claimsErr || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Verify caller là teacher
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
    const tenantId = callerProfile.tenant_id;

    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "teacher")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Chỉ giáo viên mới được reset mật khẩu" }),
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
    const { user_id, new_password } = parsed.data;

    // Verify target nằm trong tenant + chỉ student/parent (không cho reset teacher khác)
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, tenant_id, login_id")
      .eq("id", user_id)
      .maybeSingle();
    if (!targetProfile || targetProfile.tenant_id !== tenantId) {
      return new Response(
        JSON.stringify({ error: "Không tìm thấy người dùng trong lớp của bạn" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!targetRole || (targetRole.role !== "student" && targetRole.role !== "parent")) {
      return new Response(
        JSON.stringify({ error: "Chỉ được reset mật khẩu cho học sinh/phụ huynh" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const password = new_password || randomPassword(10);
    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, {
      password,
    });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mark must_change_password để khuyến cáo (không bắt buộc enforce)
    await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", user_id);

    return new Response(
      JSON.stringify({
        login_id: targetProfile.login_id,
        password,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
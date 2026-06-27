import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) return respond({ error: "Unauthorized" }, 401);

    // Use admin client to check caller role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!callerProfile || !["super_admin", "md"].includes(callerProfile.role)) {
      return respond({ error: "Forbidden: insufficient permissions" }, 403);
    }

    const body = await req.json();
    const { email, password, full_name, role, employee_id, department_id, phone } = body;

    if (!email || !password || !full_name || !role) {
      return respond({ error: "Missing required fields: email, password, full_name, role" }, 400);
    }

    // MD can only be created by MD
    if (role === "md" && callerProfile.role !== "md") {
      return respond({ error: "Only a Medical Director can create another MD account" }, 403);
    }

    // Create user with Admin API (does not affect caller's session)
    const { data: newUserData, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role },
    });

    if (createErr) {
      if (createErr.message.includes("already registered") || createErr.message.includes("already exists")) {
        return respond({ error: "An account with this email already exists." }, 400);
      }
      return respond({ error: createErr.message }, 400);
    }

    if (!newUserData.user) {
      return respond({ error: "Failed to create user account" }, 500);
    }

    // Update profile with all fields (trigger already created the basic profile)
    const { error: profileErr } = await adminClient.from("profiles").update({
      full_name: full_name.trim(),
      employee_id: employee_id || null,
      role,
      department_id: department_id || null,
      phone: phone?.trim() || null,
    }).eq("id", newUserData.user.id);

    if (profileErr) {
      // Profile update failed but user was created — log and return partial success
      console.error("Profile update failed:", profileErr.message);
    }

    return respond({
      user: { id: newUserData.user.id, email: newUserData.user.email },
    });
  } catch (err) {
    console.error("create-user error:", err);
    return respond({ error: String(err) }, 500);
  }
});

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing environment variables:", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey, anonKey: !!anonKey });
      return respond({ error: "Server configuration error. Missing required environment variables." }, 500);
    }

    // Verify requesting user
    // Verify requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized: No authorization header provided" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      console.error("Caller auth error:", callerErr?.message);
      return respond({ error: "Unauthorized: Invalid session" }, 401);
    }
    // Use admin client to check caller role

    // Use admin client to check caller role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!callerProfile || !["super_admin", "md"].includes(callerProfile.role)) {
      console.error("Forbidden: caller", callerProfile?.role, callerUser.id);
      return respond({ error: "Forbidden: You do not have permission to create users" }, 403);
    }

    const body = await req.json();
    const { email, password, full_name, role, employee_id, department_id, phone } = body;

    if (!email || !password || !full_name || !role) {
      return respond({ error: "Missing required fields: email, password, full_name, role" }, 400);
    // MD can only be created by MD
    }

    // MD can only be created by MD
    if (role === "md" && callerProfile.role !== "md") {
    // Create user with Admin API
      return respond({ error: "Only a Medical Director can create another MD account" }, 403);
    }

    // Create user with Admin API
    const { data: newUserData, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role },
    });

    if (createErr) {
      console.error("Create user error:", createErr.message);
      if (createErr.message.includes("already registered") || createErr.message.includes("already exists") || createErr.message.includes("duplicate")) {
        return respond({ error: "An account with this email already exists." }, 400);
      }
      return respond({ error: `Failed to create user: ${createErr.message}` }, 400);
    }

    // Retry profile update up to 3 times with delays
    if (!newUserData || !newUserData.user) {
      return respond({ error: "Failed to create user account: no user data returned" }, 500);
    }

    // Retry profile update up to 3 times with delays
    let profileUpdated = false;
    let profileErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error: updErr } = await adminClient.from("profiles").update({
        full_name: full_name.trim(),
        employee_id: employee_id || null,
        role,
        department_id: department_id || null,
        phone: phone?.trim() || null,
      }).eq("id", newUserData.user.id);
      if (!updErr) {
        profileUpdated = true;
        break;
      }
      profileErr = updErr;
      console.warn(`Profile update attempt ${attempt} failed:`, updErr.message);
      if (attempt < 3) {
      // Fallback to upsert
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }

    if (!profileUpdated) {
      // Fallback to upsert
      const { error: upsertErr } = await adminClient.from("profiles").upsert({
        id: newUserData.user.id,
        full_name: full_name.trim(),
        employee_id: employee_id || null,
        role,
        department_id: department_id || null,
        phone: phone?.trim() || null,
        email: newUserData.user.email,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    // Log audit
      }, { onConflict: "id" });
      if (upsertErr) {
        console.error("Profile upsert failed:", upsertErr.message);
      }
    }

    // Log audit
    await adminClient.from("audit_logs").insert({
      user_id: callerUser.id,
      action: "create",
      entity_type: "user",
      entity_id: newUserData.user.id,
      details: { email, full_name, role, employee_id, created_by: callerUser.id },
    });

    return respond({
      success: true,
      user: { id: newUserData.user.id, email: newUserData.user.email },
      message: `User ${full_name} created successfully with role ${role}.`,
    });
  } catch (err) {
    console.error("create-user edge function error:", err);
    return respond({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});

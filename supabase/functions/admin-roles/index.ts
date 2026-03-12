/**
 * Edge Function: admin-roles
 * Secure role management via service_role
 * 
 * Endpoints:
 * - POST /grant-role: Assign a role to a user
 * - POST /revoke-role: Remove a role from a user
 * 
 * Security:
 * - Requires authenticated user with admin_kraflo role
 * - Validates all inputs
 * - Prevents self-demotion scenarios
 * - Logs all role changes for audit
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GrantRoleRequest {
  action: "grant";
  target_user_id: string;
  role: "admin_kraflo" | "admin_empresa";
}

interface RevokeRoleRequest {
  action: "revoke";
  role_id: string;
}

type RoleRequest = GrantRoleRequest | RevokeRoleRequest;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-roles] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from token
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      console.error("[admin-roles] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = userData.user.id;
    console.log(`[admin-roles] Request from user: ${callerId}`);

    // Validate caller is admin_kraflo
    const { data: isAdminKraflo, error: roleCheckError } = await supabase.rpc("is_admin_kraflo", {
      _user_id: callerId,
    });

    if (roleCheckError) {
      console.error("[admin-roles] Role check error:", roleCheckError.message);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isAdminKraflo) {
      console.warn(`[admin-roles] Access denied for user: ${callerId}`);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas admin_kraflo pode gerenciar roles." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RoleRequest = await req.json();
    console.log(`[admin-roles] Action: ${body.action}`);

    if (body.action === "grant") {
      return await handleGrantRole(supabase, callerId, body);
    } else if (body.action === "revoke") {
      return await handleRevokeRole(supabase, callerId, body);
    } else {
      return new Response(
        JSON.stringify({ error: "Ação inválida. Use 'grant' ou 'revoke'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[admin-roles] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGrantRole(
  supabase: any,
  callerId: string,
  request: GrantRoleRequest
) {
  const { target_user_id, role } = request;

  // Validate inputs
  if (!target_user_id || typeof target_user_id !== "string") {
    return new Response(
      JSON.stringify({ error: "target_user_id é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!role || !["admin_kraflo", "admin_empresa"].includes(role)) {
    return new Response(
      JSON.stringify({ error: "role inválida. Use 'admin_kraflo' ou 'admin_empresa'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate target user exists and get empresa_id
  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nome_completo, email, empresa_id")
    .eq("id", target_user_id)
    .single();

  if (profileError || !targetProfile) {
    console.error("[admin-roles] Target user not found:", target_user_id);
    return new Response(
      JSON.stringify({ error: "Usuário alvo não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate empresa_id for admin_empresa role (empresa-scoped role requires empresa)
  if (role === "admin_empresa" && !targetProfile.empresa_id) {
    console.warn(`[admin-roles] Cannot grant admin_empresa to user without empresa: ${target_user_id}`);
    return new Response(
      JSON.stringify({ error: "Não é possível atribuir admin_empresa a usuário sem empresa vinculada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if role already exists
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", target_user_id)
    .eq("role", role)
    .single();

  if (existingRole) {
    return new Response(
      JSON.stringify({ error: "Este usuário já possui esta role" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Insert role
  const { data: newRole, error: insertError } = await supabase
    .from("user_roles")
    .insert({
      user_id: target_user_id,
      role: role,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[admin-roles] Insert error:", insertError.message);
    return new Response(
      JSON.stringify({ error: "Erro ao atribuir role" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[admin-roles] Role granted: ${role} to ${target_user_id} by ${callerId}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Role atribuída com sucesso",
      role: newRole 
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRevokeRole(
  supabase: any,
  callerId: string,
  request: RevokeRoleRequest
) {
  const { role_id } = request;

  // Validate inputs
  if (!role_id || typeof role_id !== "string") {
    return new Response(
      JSON.stringify({ error: "role_id é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get role details before deletion
  const { data: roleToDelete, error: roleError } = await supabase
    .from("user_roles")
    .select("id, user_id, role")
    .eq("id", role_id)
    .single();

  if (roleError || !roleToDelete) {
    console.error("[admin-roles] Role not found:", role_id);
    return new Response(
      JSON.stringify({ error: "Role não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prevent self-demotion from admin_kraflo
  if (roleToDelete.user_id === callerId && roleToDelete.role === "admin_kraflo") {
    console.warn(`[admin-roles] Blocked self-demotion attempt by ${callerId}`);
    return new Response(
      JSON.stringify({ error: "Você não pode revogar sua própria role de admin_kraflo" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if this would leave no admin_kraflo users
  if (roleToDelete.role === "admin_kraflo") {
    const { count, error: countError } = await supabase
      .from("user_roles")
      .select("id", { count: "exact" })
      .eq("role", "admin_kraflo");

    if (!countError && count !== null && count <= 1) {
      console.warn(`[admin-roles] Blocked last admin_kraflo removal attempt`);
      return new Response(
        JSON.stringify({ error: "Não é possível revogar a última role admin_kraflo do sistema" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Delete role
  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("id", role_id);

  if (deleteError) {
    console.error("[admin-roles] Delete error:", deleteError.message);
    return new Response(
      JSON.stringify({ error: "Erro ao revogar role" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[admin-roles] Role revoked: ${roleToDelete.role} from ${roleToDelete.user_id} by ${callerId}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Role revogada com sucesso" 
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../src/integrations/supabase/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  const allowOrigin = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-correlation-id",
  } as Record<string, string>;
}

export function getServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export type SupabaseClient = ReturnType<typeof getServiceClient>;

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "");
}

export function isServiceRoleToken(token: string | null): boolean {
  return Boolean(token && token === SUPABASE_SERVICE_ROLE_KEY);
}

export async function getUserFromToken(token: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

export async function assertAdmin(userId: string) {
  const supabase = getServiceClient();
  
  // Check if user is admin_kraflo
  const { data: isAdminKraflo, error: err1 } = await supabase.rpc("is_admin_kraflo", {
    _user_id: userId,
  });
  
  if (err1) {
    console.error("Error checking is_admin_kraflo:", err1);
  }
  
  if (isAdminKraflo) return true;
  
  // Check if user is admin_empresa
  const { data: hasAdminRole, error: err2 } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin_empresa",
  });
  
  if (err2) {
    console.error("Error checking has_role:", err2);
  }
  
  return Boolean(hasAdminRole);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}


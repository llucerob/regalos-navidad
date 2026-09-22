import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente con la clave service_role: SOLO servidor. Se salta las políticas RLS,
 * por eso cada acción que lo use debe validar antes quién llama y qué puede hacer.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  }
  cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

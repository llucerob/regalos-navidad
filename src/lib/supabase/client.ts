"use client";
import { createBrowserClient } from "@supabase/ssr";

let cliente: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente de navegador: solo se usa para subir archivos con URL firmada. */
export function supabaseNavegador() {
  if (!cliente) {
    cliente = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return cliente;
}

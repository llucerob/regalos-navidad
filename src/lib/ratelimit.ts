import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";

/** IP del visitante, hasheada (no guardamos la IP en claro). */
export async function claveVisitante(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "desconocida").split(",")[0].trim();
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

/** true = permitido, false = excedió el límite. Ante un fallo de la base, no bloquea. */
export async function limitar(accion: string, max: number, ventanaSegundos: number): Promise<boolean> {
  try {
    const clave = `${accion}:${await claveVisitante()}`;
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_clave: clave,
      p_max: max,
      p_ventana_seg: ventanaSegundos,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

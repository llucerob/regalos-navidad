import "server-only";
import { redirect } from "next/navigation";
import { supabaseServidor } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import type { Perfil, Rol } from "./types";

export interface Staff {
  userId: string;
  email: string | null;
  perfil: Perfil;
}

/** Devuelve el funcionario autenticado y activo, o null. Verifica el token contra Supabase Auth. */
export async function obtenerStaff(): Promise<Staff | null> {
  try {
    const supabase = await supabaseServidor();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: perfil } = await supabaseAdmin()
      .from("perfiles")
      .select("user_id, nombre, email, rol, activo")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!perfil || !perfil.activo) return null;
    return { userId: data.user.id, email: data.user.email ?? null, perfil: perfil as Perfil };
  } catch {
    return null;
  }
}

/** Exige sesión de funcionario. Si se indican roles, exige uno de ellos. */
export async function requerirStaff(roles?: Rol[]): Promise<Staff> {
  const staff = await obtenerStaff();
  if (!staff) redirect("/admin/login");
  if (roles && !roles.includes(staff.perfil.rol)) redirect("/admin?sin_permiso=1");
  return staff;
}

export const puedeRevisar = (rol: Rol) => rol === "admin" || rol === "revisor";

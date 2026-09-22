"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/server";
import { requerirStaff } from "@/lib/auth";
import { obtenerCampana } from "@/lib/datos";
import { apoderadoSchema } from "@/lib/schemas";
import { esFechaIso } from "@/lib/fechas";
import { normalizarRut } from "@/lib/rut";
import { armarCorreo } from "@/lib/correos/plantillas";
import { encolarCorreo, encolarYEnviar, enviarDeCola, enviarPrueba, procesarCola } from "@/lib/correos/enviar";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import type { Beneficiario, Estado, Inscripcion, Rol, TipoCorreo } from "@/lib/types";

/** Vuelve a una página con un mensaje (se muestra como aviso). */
function volver(ruta: string, mensaje: string, tipo: "ok" | "error" = "ok"): never {
  const sep = ruta.includes("?") ? "&" : "?";
  redirect(`${ruta}${sep}msg=${encodeURIComponent(mensaje)}&tipo=${tipo}`);
}
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ───────────────────────────── Sesión ─────────────────────────────────

export async function iniciarSesion(formData: FormData) {
  const email = texto(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/admin/login?error=credenciales");

  const { data: perfil } = await supabaseAdmin().from("perfiles").select("activo").eq("user_id", data.user.id).maybeSingle();
  if (!perfil?.activo) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=sinperfil");
  }
  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ─────────────────────── Revisión de inscripciones ────────────────────

const DESTINO_ESTADO: Record<string, Estado> = {
  aprobar: "aprobada",
  observar: "observada",
  rechazar: "rechazada",
  revision: "en_revision",
};

export async function cambiarEstado(formData: FormData) {
  const staff = await requerirStaff(["admin", "revisor"]);
  const id = texto(formData, "id");
  const destino = `/admin/inscripciones/${id}`;
  const nuevo = DESTINO_ESTADO[texto(formData, "accion")];
  if (!nuevo) volver(destino, "Acción inválida.", "error");

  const observacion = texto(formData, "observacion");
  const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.clave, formData.get(`chk_${i.clave}`) === "on"]));

  if (nuevo === "aprobada" && !Object.values(checklist).every(Boolean)) {
    volver(destino, "Para aprobar debe marcar todos los puntos de verificación.", "error");
  }
  if ((nuevo === "observada" || nuevo === "rechazada") && observacion.length < 5) {
    volver(destino, "Escriba el motivo o lo que debe corregir el apoderado (mínimo 5 caracteres).", "error");
  }

  const db = supabaseAdmin();
  const { data: actual } = await db.from("inscripciones").select("*").eq("id", id).maybeSingle();
  if (!actual) volver("/admin/inscripciones", "Inscripción no encontrada.", "error");
  const ins = actual as Inscripcion;

  const { error } = await db
    .from("inscripciones")
    .update({
      estado: nuevo,
      observacion: nuevo === "observada" || nuevo === "rechazada" ? observacion : null,
      checklist,
      revisado_por: staff.userId,
      revisado_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    const dup = error.code === "23505";
    volver(destino, dup ? "No se puede reactivar: alguno de los RUT ya está inscrito en otra inscripción de esta campaña." : "No se pudo actualizar el estado.", "error");
  }

  await db.from("historial_estados").insert({
    inscripcion_id: id,
    estado_anterior: ins.estado,
    estado_nuevo: nuevo,
    comentario: observacion || null,
    usuario_id: staff.userId,
    usuario_nombre: staff.perfil.nombre,
  });

  if (ins.apoderado_email && (nuevo === "aprobada" || nuevo === "observada" || nuevo === "rechazada")) {
    const tipo: TipoCorreo = nuevo === "aprobada" ? "aprobada" : nuevo === "observada" ? "observada" : "rechazada";
    const [{ data: benef }, campana] = await Promise.all([
      db.from("beneficiarios").select("tipo,nombres,apellidos").eq("inscripcion_id", id),
      obtenerCampana(ins.campana_id),
    ]);
    const { asunto, html } = armarCorreo(tipo, {
      nombreApoderado: ins.apoderado_nombres,
      folio: ins.folio,
      campanaNombre: campana?.nombre ?? "Regalos de Navidad",
      observacion,
      beneficiarios: ((benef ?? []) as Pick<Beneficiario, "tipo" | "nombres" | "apellidos">[]).map((b) => ({
        nombre: `${b.nombres} ${b.apellidos}`,
        tipo: b.tipo,
      })),
    });
    const destinatario = ins.apoderado_email;
    after(async () => {
      await encolarYEnviar({ inscripcionId: id, campanaId: ins.campana_id, tipo, destinatario, asunto, html });
    });
  }

  revalidatePath("/admin", "layout");
  volver(destino, `Inscripción marcada como "${nuevo.replace("_", " ")}".${ins.apoderado_email ? " Se enviará un correo al apoderado." : ""}`);
}

export async function editarApoderado(formData: FormData) {
  const staff = await requerirStaff(["admin", "revisor"]);
  const id = texto(formData, "id");
  const destino = `/admin/inscripciones/${id}`;
  const parsed = apoderadoSchema.safeParse({
    rut: texto(formData, "rut"),
    nombres: texto(formData, "nombres"),
    apellidos: texto(formData, "apellidos"),
    telefono: texto(formData, "telefono"),
    email: texto(formData, "email"),
    direccion: texto(formData, "direccion"),
    sectorId: texto(formData, "sectorId"),
  });
  if (!parsed.success) volver(destino, parsed.error.issues[0]?.message ?? "Datos inválidos.", "error");
  const a = parsed.data;
  const db = supabaseAdmin();
  const { error } = await db
    .from("inscripciones")
    .update({
      apoderado_rut: normalizarRut(a.rut),
      apoderado_nombres: a.nombres,
      apoderado_apellidos: a.apellidos,
      apoderado_telefono: a.telefono,
      apoderado_email: a.email ? a.email.toLowerCase() : null,
      direccion: a.direccion,
      sector_id: a.sectorId,
    })
    .eq("id", id);
  if (error) volver(destino, "No se pudieron guardar los cambios.", "error");
  await db.from("historial_estados").insert({
    inscripcion_id: id,
    estado_anterior: null,
    estado_nuevo: (await db.from("inscripciones").select("estado").eq("id", id).single()).data?.estado ?? "recibida",
    comentario: "Se editaron los datos del apoderado",
    usuario_id: staff.userId,
    usuario_nombre: staff.perfil.nombre,
  });
  revalidatePath(destino);
  volver(destino, "Datos del apoderado actualizados.");
}

// ─────────────────────────────── Entrega ──────────────────────────────

export async function marcarEntrega(formData: FormData) {
  const staff = await requerirStaff();
  const id = texto(formData, "beneficiarioId");
  const volverA = texto(formData, "volverA") || "/admin/entrega";
  const deshacer = texto(formData, "accion") === "deshacer";
  const db = supabaseAdmin();
  const { data: b } = await db.from("beneficiarios").select("id,inscripcion_id,activo").eq("id", id).maybeSingle();
  if (!b || !b.activo) volver(volverA, "Beneficiario no encontrado.", "error");
  const { data: ins } = await db.from("inscripciones").select("estado").eq("id", b.inscripcion_id).single();
  if (ins?.estado !== "aprobada") volver(volverA, "Solo se puede entregar a inscripciones aprobadas.", "error");
  await db
    .from("beneficiarios")
    .update(deshacer ? { entregado_at: null, entregado_por: null } : { entregado_at: new Date().toISOString(), entregado_por: staff.userId })
    .eq("id", id);
  volver(volverA, deshacer ? "Entrega deshecha." : "Entrega registrada.");
}

// ─────────────────────────────── Campañas ─────────────────────────────

export async function guardarCampana(formData: FormData) {
  await requerirStaff(["admin"]);
  const id = texto(formData, "id");
  const anio = Number(texto(formData, "anio"));
  const nombre = texto(formData, "nombre");
  const fechas = {
    fecha_inicio: texto(formData, "fecha_inicio"),
    fecha_fin: texto(formData, "fecha_fin"),
    fecha_entrega: texto(formData, "fecha_entrega") || null,
    fecha_referencia_edad: texto(formData, "fecha_referencia_edad"),
  };
  const ruta = "/admin/campanas";
  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100) volver(ruta, "Año inválido.", "error");
  if (nombre.length < 3) volver(ruta, "Ingrese un nombre para la campaña.", "error");
  if (!esFechaIso(fechas.fecha_inicio) || !esFechaIso(fechas.fecha_fin) || !esFechaIso(fechas.fecha_referencia_edad) || (fechas.fecha_entrega && !esFechaIso(fechas.fecha_entrega))) {
    volver(ruta, "Revise las fechas.", "error");
  }
  if (fechas.fecha_fin < fechas.fecha_inicio) volver(ruta, "La fecha de cierre no puede ser anterior a la de inicio.", "error");

  const activa = formData.get("activa") === "on";
  const db = supabaseAdmin();
  if (activa) await db.from("campanas").update({ activa: false }).neq("id", id || "00000000-0000-0000-0000-000000000000");

  const fila = { anio, nombre, decreto: texto(formData, "decreto") || null, ...fechas, activa };
  const { error } = id ? await db.from("campanas").update(fila).eq("id", id) : await db.from("campanas").insert(fila);
  if (error) volver(ruta, error.code === "23505" ? "Ya existe una campaña de ese año." : "No se pudo guardar la campaña.", "error");
  revalidatePath("/", "layout");
  volver(ruta, "Campaña guardada.");
}

// ─────────────────────────────── Sectores ─────────────────────────────

export async function crearSector(formData: FormData) {
  await requerirStaff(["admin"]);
  const nombre = texto(formData, "nombre");
  if (nombre.length < 2) volver("/admin/sectores", "Ingrese el nombre del sector.", "error");
  const { error } = await supabaseAdmin().from("sectores").insert({ nombre, orden: Number(texto(formData, "orden")) || 10 });
  if (error) volver("/admin/sectores", error.code === "23505" ? "Ese sector ya existe." : "No se pudo crear el sector.", "error");
  volver("/admin/sectores", "Sector creado.");
}

export async function alternarSector(formData: FormData) {
  await requerirStaff(["admin"]);
  const id = texto(formData, "id");
  await supabaseAdmin().from("sectores").update({ activo: texto(formData, "activo") === "true" }).eq("id", id);
  volver("/admin/sectores", "Sector actualizado.");
}

// ─────────────────────────────── Usuarios ─────────────────────────────

const ROLES: Rol[] = ["admin", "revisor", "digitador"];

export async function crearUsuario(formData: FormData) {
  await requerirStaff(["admin"]);
  const nombre = texto(formData, "nombre");
  const email = texto(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol = texto(formData, "rol") as Rol;
  const ruta = "/admin/usuarios";
  if (nombre.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) volver(ruta, "Ingrese nombre y un correo válido.", "error");
  if (password.length < 10) volver(ruta, "La contraseña temporal debe tener al menos 10 caracteres.", "error");
  if (!ROLES.includes(rol)) volver(ruta, "Rol inválido.", "error");

  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) volver(ruta, `No se pudo crear el usuario: ${error?.message ?? "error desconocido"}`, "error");
  const { error: errPerfil } = await db.from("perfiles").insert({ user_id: data.user.id, nombre, email, rol });
  if (errPerfil) {
    await db.auth.admin.deleteUser(data.user.id);
    volver(ruta, "No se pudo crear el perfil del usuario.", "error");
  }
  volver(ruta, `Usuario ${email} creado. Entréguele la contraseña temporal por un canal seguro.`);
}

export async function actualizarUsuario(formData: FormData) {
  const yo = await requerirStaff(["admin"]);
  const userId = texto(formData, "userId");
  const rol = texto(formData, "rol") as Rol;
  const activo = texto(formData, "activo") === "true";
  const ruta = "/admin/usuarios";
  if (!ROLES.includes(rol)) volver(ruta, "Rol inválido.", "error");
  if (userId === yo.userId && (!activo || rol !== "admin")) {
    volver(ruta, "No puede quitarse a sí mismo el acceso de administrador.", "error");
  }
  await supabaseAdmin().from("perfiles").update({ rol, activo }).eq("user_id", userId);
  volver(ruta, "Usuario actualizado.");
}

// ─────────────────────────────── Correos ──────────────────────────────

export async function procesarCorreos() {
  await requerirStaff(["admin"]);
  const r = await procesarCola(20);
  revalidatePath("/admin/correos");
  volver("/admin/correos", `Enviados: ${r.enviados}. Con error: ${r.errores}. Pendientes restantes: ${r.restantes}.`, r.errores ? "error" : "ok");
}

export async function reintentarCorreo(formData: FormData) {
  await requerirStaff(["admin"]);
  const id = texto(formData, "id");
  await supabaseAdmin().from("correos_log").update({ estado: "pendiente", intentos: 0 }).eq("id", id);
  const r = await enviarDeCola(id);
  volver("/admin/correos", r.ok ? "Correo enviado." : `No se pudo enviar: ${r.error}`, r.ok ? "ok" : "error");
}

export async function probarCorreo(formData: FormData) {
  const staff = await requerirStaff(["admin"]);
  const destino = texto(formData, "destino") || staff.email || "";
  const r = await enviarPrueba(destino);
  volver("/admin/correos", r.ok ? `Correo de prueba enviado a ${destino}.` : `Falló el envío: ${r.error}`, r.ok ? "ok" : "error");
}

export async function encolarAvisoEntrega(formData: FormData) {
  await requerirStaff(["admin"]);
  const campana = await obtenerCampana(texto(formData, "campanaId"));
  const mensaje = texto(formData, "mensaje");
  const ruta = "/admin/correos";
  if (!campana) volver(ruta, "Campaña no encontrada.", "error");
  if (mensaje.length < 10) volver(ruta, "Escriba el mensaje del aviso (mínimo 10 caracteres).", "error");

  const db = supabaseAdmin();
  const { data } = await db
    .from("inscripciones")
    .select("id,apoderado_nombres,apoderado_email")
    .eq("campana_id", campana.id)
    .eq("estado", "aprobada")
    .not("apoderado_email", "is", null);
  const vistos = new Set<string>();
  let n = 0;
  for (const i of data ?? []) {
    const email = String(i.apoderado_email).toLowerCase();
    if (vistos.has(email)) continue;
    vistos.add(email);
    const { asunto, html } = armarCorreo("aviso_entrega", {
      nombreApoderado: i.apoderado_nombres,
      campanaNombre: campana.nombre,
      mensaje,
      fechaEntrega: texto(formData, "fecha"),
      horarioEntrega: texto(formData, "horario"),
      lugarEntrega: texto(formData, "lugar"),
    });
    if (await encolarCorreo({ inscripcionId: i.id, campanaId: campana.id, tipo: "aviso_entrega", destinatario: email, asunto, html })) n++;
  }
  volver(ruta, `${n} correos quedaron en cola. Use "Procesar pendientes" para enviarlos en tandas.`);
}

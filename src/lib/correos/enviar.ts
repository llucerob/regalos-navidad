import "server-only";
import { supabaseAdmin } from "../supabase/admin";
import { correoConfigurado, obtenerTransporte, remitente, responderA } from "./transport";
import type { TipoCorreo } from "../types";

const MAX_INTENTOS = 3;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NuevoCorreo {
  inscripcionId?: string | null;
  campanaId?: string | null;
  tipo: TipoCorreo;
  destinatario: string;
  asunto: string;
  html: string;
}

/** Deja el correo en la cola (tabla correos_log) sin enviarlo todavía. */
export async function encolarCorreo(c: NuevoCorreo): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("correos_log")
    .insert({
      inscripcion_id: c.inscripcionId ?? null,
      campana_id: c.campanaId ?? null,
      tipo: c.tipo,
      destinatario: c.destinatario,
      asunto: c.asunto,
      cuerpo_html: c.html,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[correos] no se pudo encolar:", error.message);
    return null;
  }
  return data.id as string;
}

/** Envía un correo de la cola. Nunca lanza: registra el resultado y lo devuelve. */
export async function enviarDeCola(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  const { data: fila } = await db.from("correos_log").select("*").eq("id", id).maybeSingle();
  if (!fila) return { ok: false, error: "Correo no encontrado" };
  if (fila.estado === "enviado") return { ok: true };

  await db.from("correos_log").update({ intentos: fila.intentos + 1 }).eq("id", id);
  try {
    if (!correoConfigurado()) throw new Error("Correo no configurado (GMAIL_USER / GMAIL_APP_PASSWORD).");
    await obtenerTransporte().sendMail({
      from: remitente(),
      to: fila.destinatario,
      replyTo: responderA(),
      subject: fila.asunto,
      html: fila.cuerpo_html,
    });
    await db.from("correos_log").update({ estado: "enviado", enviado_at: new Date().toISOString(), ultimo_error: null }).eq("id", id);
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await db.from("correos_log").update({ estado: "error", ultimo_error: mensaje.slice(0, 500) }).eq("id", id);
    return { ok: false, error: mensaje };
  }
}

/** Encola y envía de inmediato (comprobante, aprobada, etc.). Un fallo no rompe el flujo. */
export async function encolarYEnviar(c: NuevoCorreo): Promise<{ ok: boolean; error?: string }> {
  const id = await encolarCorreo(c);
  if (!id) return { ok: false, error: "No se pudo registrar el correo" };
  return enviarDeCola(id);
}

/** Procesa correos pendientes o con error (hasta MAX_INTENTOS), con pausa entre envíos. */
export async function procesarCola(limite = 25): Promise<{ enviados: number; errores: number; restantes: number }> {
  const db = supabaseAdmin();
  const pausa = Number(process.env.MAIL_DELAY_MS ?? 1200);
  const { data: filas } = await db
    .from("correos_log")
    .select("id")
    .in("estado", ["pendiente", "error"])
    .lt("intentos", MAX_INTENTOS)
    .order("created_at", { ascending: true })
    .limit(limite);

  let enviados = 0;
  let errores = 0;
  for (const f of filas ?? []) {
    const r = await enviarDeCola(f.id);
    if (r.ok) enviados++;
    else errores++;
    await esperar(pausa);
  }
  const { count } = await db
    .from("correos_log")
    .select("id", { count: "exact", head: true })
    .in("estado", ["pendiente", "error"])
    .lt("intentos", MAX_INTENTOS);
  return { enviados, errores, restantes: count ?? 0 };
}

/** Correo de prueba (no se registra en la cola). Sirve para validar la contraseña de aplicación. */
export async function enviarPrueba(destino: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!correoConfigurado()) throw new Error("Falta configurar GMAIL_USER y GMAIL_APP_PASSWORD.");
    await obtenerTransporte().sendMail({
      from: remitente(),
      to: destino,
      replyTo: responderA(),
      subject: "Prueba de correo · Regalos de Navidad Coinco",
      text: "Si recibe este mensaje, el envío de correos del sistema está funcionando.",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

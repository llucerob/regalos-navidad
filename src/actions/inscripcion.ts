"use server";

import { randomInt } from "node:crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { obtenerStaff, puedeRevisar } from "@/lib/auth";
import { limitar } from "@/lib/ratelimit";
import { campanaActiva } from "@/lib/datos";
import { estadoCampana, hoyChile } from "@/lib/fechas";
import { formatearRut, normalizarRut } from "@/lib/rut";
import { erroresZod, inscripcionSchema, validarReglasNegocio } from "@/lib/schemas";
import {
  crearSubidasFirmadas, validarMetaArchivo, verificarArchivos,
  type SolicitudSubida, type SubidaFirmada,
} from "@/lib/storage";
import { armarCorreo } from "@/lib/correos/plantillas";
import { encolarYEnviar } from "@/lib/correos/enviar";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import type { ArchivoRef, Resultado, TipoDoc } from "@/lib/types";

const CLAVES_HOGAR: TipoDoc[] = ["cartola_rsh", "certificado_residencia"];
const CLAVES_BENEFICIARIO: TipoDoc[] = ["cedula", "certificado_nacimiento", "carnet_control_sano", "carnet_control_embarazo"];
const ALFABETO_FOLIO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1

function generarFolio(anio: number): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO_FOLIO[randomInt(ALFABETO_FOLIO.length)];
  return `NAV${String(anio).slice(-2)}-${s}`;
}

/** Paso previo a subir archivos: el servidor valida y entrega URLs firmadas de un solo uso. */
export async function prepararSubidas(
  sesion: string,
  archivos: SolicitudSubida[],
): Promise<Resultado<{ subidas: SubidaFirmada[] }>> {
  if (!/^[0-9a-f-]{36}$/i.test(sesion)) return { ok: false, error: "Sesión de carga inválida." };
  if (!archivos.length || archivos.length > 40) return { ok: false, error: "Cantidad de archivos inválida." };
  for (const a of archivos) {
    const err = validarMetaArchivo(a);
    if (err) return { ok: false, error: err };
  }
  const staff = await obtenerStaff();
  if (!staff && !(await limitar("subidas", 60, 3600))) {
    return { ok: false, error: "Demasiadas cargas seguidas. Espere unos minutos e intente de nuevo." };
  }
  try {
    return { ok: true, subidas: await crearSubidasFirmadas(sesion, archivos) };
  } catch (e) {
    console.error("[prepararSubidas]", e);
    return { ok: false, error: "No se pudo preparar la carga de archivos. Intente nuevamente." };
  }
}

export async function enviarInscripcion(entrada: unknown): Promise<Resultado<{ id: string; folio: string }>> {
  const parsed = inscripcionSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, error: "Revise los datos marcados en el formulario.", campos: erroresZod(parsed.error) };
  }
  const p = parsed.data;
  const canal = p.modo;

  const staff = await obtenerStaff();
  if (canal === "presencial" && !staff) return { ok: false, error: "Su sesión de funcionario expiró. Vuelva a ingresar." };
  if (canal === "online" && !(await limitar("inscribir", 6, 3600))) {
    return { ok: false, error: "Se realizaron demasiados envíos desde su conexión. Intente de nuevo más tarde." };
  }

  const campana = await campanaActiva();
  if (!campana) return { ok: false, error: "No hay una campaña de inscripción activa." };
  const estadoC = estadoCampana(campana);
  if (estadoC !== "abierta") {
    return {
      ok: false,
      error: estadoC === "proxima" ? "Las inscripciones aún no comienzan." : "El período de inscripción ya terminó.",
    };
  }

  const errores = validarReglasNegocio(p, { canal, fechaReferencia: campana.fecha_referencia_edad, hoy: hoyChile() });
  const claveInvalida =
    Object.keys(p.docsHogar).some((k) => !CLAVES_HOGAR.includes(k as TipoDoc)) ||
    p.beneficiarios.some((b) => Object.keys(b.docs).some((k) => !CLAVES_BENEFICIARIO.includes(k as TipoDoc)));
  if (claveInvalida) return { ok: false, error: "Documentos inválidos en el formulario." };
  if (Object.keys(errores).length) return { ok: false, error: "Revise los datos marcados en el formulario.", campos: errores };

  const db = supabaseAdmin();

  // Sector válido
  const { data: sector } = await db.from("sectores").select("id").eq("id", p.apoderado.sectorId).eq("activo", true).maybeSingle();
  if (!sector) return { ok: false, error: "Sector inválido.", campos: { "apoderado.sectorId": "Seleccione un sector válido" } };

  // Archivos: existen en Storage y pertenecen a esta sesión de carga
  const todos: ArchivoRef[] = [
    ...Object.values(p.docsHogar).flat(),
    ...p.beneficiarios.flatMap((b) => Object.values(b.docs).flat()),
  ];
  const errArchivos = await verificarArchivos(p.uploadSession, todos);
  if (errArchivos) return { ok: false, error: errArchivos };

  // Duplicados en la campaña
  const ruts = p.beneficiarios.map((b) => normalizarRut(b.rut));
  const { data: dup } = await db.from("beneficiarios").select("rut").eq("campana_id", campana.id).eq("activo", true).in("rut", ruts);
  if (dup?.length) {
    const yaInscritos = new Set(dup.map((d) => d.rut as string));
    const campos: Record<string, string> = {};
    ruts.forEach((r, i) => {
      if (yaInscritos.has(r)) campos[`beneficiarios.${i}.rut`] = "Este RUT ya está inscrito en la campaña";
    });
    return {
      ok: false,
      error: `El RUT ${[...yaInscritos].map(formatearRut).join(", ")} ya se encuentra inscrito en esta campaña. Si cree que es un error, consulte en la Municipalidad.`,
      campos,
    };
  }

  // Estado inicial
  const aprobarDirecto = canal === "presencial" && !!p.aprobarDirecto && !!staff && puedeRevisar(staff.perfil.rol);
  const ahora = new Date().toISOString();

  // Inscripción (reintenta si el folio aleatorio ya existe)
  let inscripcionId = "";
  let folio = "";
  for (let intento = 0; intento < 5 && !inscripcionId; intento++) {
    folio = generarFolio(campana.anio);
    const { data, error } = await db
      .from("inscripciones")
      .insert({
        folio,
        campana_id: campana.id,
        canal,
        estado: aprobarDirecto ? "aprobada" : "recibida",
        apoderado_rut: normalizarRut(p.apoderado.rut),
        apoderado_nombres: p.apoderado.nombres.trim(),
        apoderado_apellidos: p.apoderado.apellidos.trim(),
        apoderado_telefono: p.apoderado.telefono,
        apoderado_email: p.apoderado.email ? p.apoderado.email.trim().toLowerCase() : null,
        direccion: p.apoderado.direccion.trim(),
        sector_id: p.apoderado.sectorId,
        residencia_acreditada_con: p.residenciaCon,
        tramo_declarado: p.tramo,
        checklist: aprobarDirecto ? Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.clave, true])) : {},
        revisado_por: aprobarDirecto ? staff!.userId : null,
        revisado_at: aprobarDirecto ? ahora : null,
        creado_por: staff?.userId ?? null,
        acepta_datos: true,
        acepta_datos_at: ahora,
      })
      .select("id")
      .single();
    if (!error && data) inscripcionId = data.id as string;
    else if (error && error.code !== "23505") {
      console.error("[enviarInscripcion] insert inscripcion", error);
      return { ok: false, error: "No se pudo guardar la inscripción. Intente nuevamente." };
    }
  }
  if (!inscripcionId) return { ok: false, error: "No se pudo generar un folio. Intente nuevamente." };

  const deshacer = async () => {
    await db.from("inscripciones").delete().eq("id", inscripcionId); // cascada
  };

  // Beneficiarios
  const { data: creados, error: errB } = await db
    .from("beneficiarios")
    .insert(
      p.beneficiarios.map((b) => ({
        inscripcion_id: inscripcionId,
        campana_id: campana.id,
        tipo: b.tipo,
        rut: normalizarRut(b.rut),
        nombres: b.nombres.trim(),
        apellidos: b.apellidos.trim(),
        fecha_nacimiento: b.tipo === "nino" ? b.fechaNacimiento : b.fechaNacimiento || null,
        sexo: b.tipo === "gestante" ? "F" : b.sexo,
        documento_identidad: b.tipo === "nino" ? b.documentoIdentidad : null,
        fecha_probable_parto: b.tipo === "gestante" ? b.fechaProbableParto || null : null,
        cantidad_bebes_esperados: b.tipo === "gestante" ? (b.cantidadBebesEsperados ?? 1) : 1,
      })),
    )
    .select("id");
  if (errB || !creados || creados.length !== p.beneficiarios.length) {
    await deshacer();
    if (errB?.code === "23505") {
      return { ok: false, error: "Uno de los RUT ya se encuentra inscrito en esta campaña." };
    }
    console.error("[enviarInscripcion] insert beneficiarios", errB);
    return { ok: false, error: "No se pudo guardar los beneficiarios. Intente nuevamente." };
  }

  // Documentos
  const filasDocs: Record<string, unknown>[] = [];
  const origen = canal === "presencial" ? "funcionario" : "apoderado";
  for (const [tipo, archivos] of Object.entries(p.docsHogar)) {
    for (const a of archivos) {
      filasDocs.push({ inscripcion_id: inscripcionId, beneficiario_id: null, tipo, storage_path: a.path, nombre_original: a.nombre, mime: a.mime, tamano: a.tamano, origen });
    }
  }
  p.beneficiarios.forEach((b, i) => {
    for (const [tipo, archivos] of Object.entries(b.docs)) {
      for (const a of archivos) {
        filasDocs.push({ inscripcion_id: inscripcionId, beneficiario_id: creados[i].id, tipo, storage_path: a.path, nombre_original: a.nombre, mime: a.mime, tamano: a.tamano, origen });
      }
    }
  });
  if (filasDocs.length) {
    const { error: errD } = await db.from("documentos").insert(filasDocs);
    if (errD) {
      await deshacer();
      console.error("[enviarInscripcion] insert documentos", errD);
      return { ok: false, error: "No se pudo guardar los documentos. Intente nuevamente." };
    }
  }

  await db.from("historial_estados").insert({
    inscripcion_id: inscripcionId,
    estado_anterior: null,
    estado_nuevo: aprobarDirecto ? "aprobada" : "recibida",
    comentario: canal === "presencial" ? "Inscripción presencial" : "Inscripción en línea",
    usuario_id: staff?.userId ?? null,
    usuario_nombre: staff?.perfil.nombre ?? "Apoderado",
  });

  // Comprobante por correo (no bloquea la respuesta)
  const email = p.apoderado.email ? p.apoderado.email.trim().toLowerCase() : "";
  if (email) {
    const { asunto, html } = armarCorreo(aprobarDirecto ? "aprobada" : "comprobante", {
      nombreApoderado: p.apoderado.nombres.trim(),
      folio,
      campanaNombre: campana.nombre,
      beneficiarios: p.beneficiarios.map((b) => ({ nombre: `${b.nombres.trim()} ${b.apellidos.trim()}`, tipo: b.tipo })),
    });
    after(async () => {
      await encolarYEnviar({ inscripcionId, campanaId: campana.id, tipo: aprobarDirecto ? "aprobada" : "comprobante", destinatario: email, asunto, html });
    });
  }

  return { ok: true, id: inscripcionId, folio };
}

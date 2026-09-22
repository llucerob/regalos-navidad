"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/ratelimit";
import { normalizarRut, validarRut } from "@/lib/rut";
import { verificarArchivos } from "@/lib/storage";
import { docsRequeridosBeneficiario, docsRequeridosHogar } from "@/lib/documentos";
import { docsSchema } from "@/lib/schemas";
import { z } from "zod";
import type { Beneficiario, Campana, Documento, Estado, Inscripcion, Resultado, TipoDoc } from "@/lib/types";

export interface VistaConsulta {
  folio: string;
  estado: Estado;
  observacion: string | null;
  campanaNombre: string;
  apoderado: string;
  creada: string;
  puedeCorregir: boolean;
  hogar: { tipo: TipoDoc; requerido: boolean; cantidad: number }[];
  beneficiarios: {
    id: string;
    nombre: string;
    tipo: "nino" | "gestante";
    docs: { tipo: TipoDoc; requerido: boolean; cantidad: number }[];
  }[];
}

async function cargar(folio: string, rut: string) {
  const db = supabaseAdmin();
  const { data: ins } = await db
    .from("inscripciones")
    .select("*")
    .eq("folio", folio.trim().toUpperCase())
    .eq("apoderado_rut", normalizarRut(rut))
    .maybeSingle();
  return ins as Inscripcion | null;
}

const NO_ENCONTRADA = "No encontramos una inscripción con ese folio y RUT. Revise que estén escritos correctamente.";

export async function consultarEstado(folio: string, rut: string): Promise<Resultado<{ vista: VistaConsulta }>> {
  if (!folio?.trim() || !validarRut(rut ?? "")) return { ok: false, error: "Ingrese el folio y un RUT válido." };
  if (!(await limitar("consulta", 12, 600))) return { ok: false, error: "Demasiadas consultas seguidas. Espere unos minutos." };

  const ins = await cargar(folio, rut);
  if (!ins) return { ok: false, error: NO_ENCONTRADA };

  const db = supabaseAdmin();
  const [{ data: benef }, { data: docs }, { data: campana }] = await Promise.all([
    db.from("beneficiarios").select("*").eq("inscripcion_id", ins.id).order("created_at"),
    db.from("documentos").select("beneficiario_id,tipo").eq("inscripcion_id", ins.id),
    db.from("campanas").select("*").eq("id", ins.campana_id).single(),
  ]);
  const cuenta = (benefId: string | null, tipo: TipoDoc) =>
    ((docs ?? []) as Pick<Documento, "beneficiario_id" | "tipo">[]).filter((d) => d.beneficiario_id === benefId && d.tipo === tipo).length;

  const reqHogar = docsRequeridosHogar(ins.residencia_acreditada_con);
  const vista: VistaConsulta = {
    folio: ins.folio,
    estado: ins.estado,
    observacion: ins.estado === "observada" || ins.estado === "rechazada" ? ins.observacion : null,
    campanaNombre: (campana as Campana).nombre,
    apoderado: `${ins.apoderado_nombres} ${ins.apoderado_apellidos}`,
    creada: ins.created_at,
    puedeCorregir: ins.estado === "observada" && (campana as Campana).activa,
    hogar: (["cartola_rsh", "certificado_residencia"] as TipoDoc[]).map((t) => ({
      tipo: t,
      requerido: reqHogar.includes(t),
      cantidad: cuenta(null, t),
    })),
    beneficiarios: ((benef ?? []) as Beneficiario[]).map((b) => {
      const req = docsRequeridosBeneficiario(b.tipo, b.documento_identidad);
      return {
        id: b.id,
        nombre: `${b.nombres} ${b.apellidos}`,
        tipo: b.tipo,
        docs: req.map((t) => ({ tipo: t, requerido: true, cantidad: cuenta(b.id, t) })),
      };
    }),
  };
  return { ok: true, vista };
}

const entradaSchema = z.object({
  folio: z.string().min(5).max(30),
  rut: z.string().refine(validarRut),
  sesion: z.uuid(),
  mensaje: z.string().trim().max(500).optional(),
  documentos: z
    .array(z.object({ beneficiarioId: z.uuid().nullable(), tipo: z.string(), archivos: docsSchema.valueType }))
    .min(1)
    .max(30),
});

/** El apoderado envía documentos faltantes cuando la inscripción está "observada". */
export async function agregarDocumentos(entrada: unknown): Promise<Resultado> {
  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: "Datos inválidos. Revise e intente de nuevo." };
  const { folio, rut, sesion, documentos, mensaje } = parsed.data;
  if (!(await limitar("corregir", 10, 3600))) return { ok: false, error: "Demasiados intentos. Espere unos minutos." };

  const ins = await cargar(folio, rut);
  if (!ins) return { ok: false, error: NO_ENCONTRADA };
  if (ins.estado !== "observada") return { ok: false, error: "Esta inscripción no admite cambios en este momento." };

  const db = supabaseAdmin();
  const { data: campana } = await db.from("campanas").select("activa").eq("id", ins.campana_id).single();
  if (!campana?.activa) return { ok: false, error: "La campaña ya no está activa." };

  const { data: benef } = await db.from("beneficiarios").select("id").eq("inscripcion_id", ins.id);
  const idsValidos = new Set((benef ?? []).map((b) => b.id as string));
  const tiposValidos: TipoDoc[] = ["cedula", "certificado_nacimiento", "carnet_control_sano", "carnet_control_embarazo", "cartola_rsh", "certificado_residencia"];

  const refs = documentos.flatMap((d) => d.archivos);
  for (const d of documentos) {
    if (!tiposValidos.includes(d.tipo as TipoDoc)) return { ok: false, error: "Tipo de documento inválido." };
    if (d.beneficiarioId && !idsValidos.has(d.beneficiarioId)) return { ok: false, error: "Beneficiario inválido." };
    if (!d.archivos.length) return { ok: false, error: "Adjunte al menos un archivo en cada documento." };
  }
  const errArch = await verificarArchivos(sesion, refs);
  if (errArch) return { ok: false, error: errArch };

  const filas = documentos.flatMap((d) =>
    d.archivos.map((a) => ({
      inscripcion_id: ins.id,
      beneficiario_id: d.beneficiarioId,
      tipo: d.tipo,
      storage_path: a.path,
      nombre_original: a.nombre,
      mime: a.mime,
      tamano: a.tamano,
      origen: "apoderado",
    })),
  );
  const { error } = await db.from("documentos").insert(filas);
  if (error) return { ok: false, error: "No se pudieron guardar los documentos. Intente nuevamente." };

  await db.from("inscripciones").update({ estado: "recibida" }).eq("id", ins.id);
  await db.from("historial_estados").insert({
    inscripcion_id: ins.id,
    estado_anterior: "observada",
    estado_nuevo: "recibida",
    comentario: mensaje ? `Documentos reenviados por el apoderado. Mensaje: ${mensaje}` : "Documentos reenviados por el apoderado",
    usuario_nombre: "Apoderado",
  });
  return { ok: true };
}

import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";
import { BUCKET_DOCUMENTOS, TAMANO_MAX_ARCHIVO, TIPOS_MIME_PERMITIDOS } from "./constants";
import type { ArchivoRef } from "./types";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export interface SolicitudSubida {
  clave: string; // identificador que usa el cliente para mapear la respuesta
  nombre: string;
  mime: string;
  tamano: number;
}

export interface SubidaFirmada {
  clave: string;
  path: string;
  token: string;
}

export function validarMetaArchivo(a: SolicitudSubida): string | null {
  if (!TIPOS_MIME_PERMITIDOS.includes(a.mime)) return `"${a.nombre}": solo se permiten fotos (JPG, PNG, WEBP) o PDF.`;
  if (a.tamano <= 0 || a.tamano > TAMANO_MAX_ARCHIVO) return `"${a.nombre}": el archivo debe pesar menos de 5 MB.`;
  return null;
}

/** Crea URLs firmadas de subida en cargas/<sesion>/<uuid>.<ext>. */
export async function crearSubidasFirmadas(sesion: string, archivos: SolicitudSubida[]): Promise<SubidaFirmada[]> {
  const bucket = supabaseAdmin().storage.from(BUCKET_DOCUMENTOS);
  const salida: SubidaFirmada[] = [];
  for (const a of archivos) {
    const path = `cargas/${sesion}/${randomUUID()}.${EXTENSION[a.mime]}`;
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "No se pudo preparar la subida");
    salida.push({ clave: a.clave, path, token: data.token });
  }
  return salida;
}

/** Comprueba que cada archivo referenciado exista de verdad en Storage y pertenezca a la sesión. */
export async function verificarArchivos(sesion: string, refs: ArchivoRef[]): Promise<string | null> {
  if (!refs.length) return null;
  const prefijo = `cargas/${sesion}`;
  for (const r of refs) {
    if (!r.path.startsWith(`${prefijo}/`) || r.path.includes("..")) return "Uno de los archivos no es válido. Vuelva a adjuntarlo.";
  }
  const { data, error } = await supabaseAdmin().storage.from(BUCKET_DOCUMENTOS).list(prefijo, { limit: 200 });
  if (error) return "No se pudo verificar los archivos subidos. Intente nuevamente.";
  const existentes = new Set((data ?? []).map((o) => `${prefijo}/${o.name}`));
  for (const r of refs) {
    if (!existentes.has(r.path)) return `El archivo "${r.nombre}" no terminó de subirse. Vuelva a adjuntarlo.`;
  }
  return null;
}

export async function urlFirmada(path: string, segundos = 600): Promise<string | null> {
  const { data } = await supabaseAdmin().storage.from(BUCKET_DOCUMENTOS).createSignedUrl(path, segundos);
  return data?.signedUrl ?? null;
}

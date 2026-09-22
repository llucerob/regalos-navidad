"use client";

import { supabaseNavegador } from "./supabase/client";
import { prepararSubidas } from "@/actions/inscripcion";
import { BUCKET_DOCUMENTOS, TAMANO_MAX_ARCHIVO, TIPOS_MIME_PERMITIDOS } from "./constants";
import type { ArchivoRef } from "./types";

/** Reduce fotos de celular (varios MB) a ~1600 px JPEG para subir rápido con datos móviles. */
export async function prepararArchivo(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function validarArchivoLocal(file: File): string | null {
  if (!TIPOS_MIME_PERMITIDOS.includes(file.type)) return `"${file.name}": use una foto (JPG, PNG, WEBP) o un PDF.`;
  return null;
}

export interface ItemSubida {
  id: string;
  file: File;
}

/**
 * Sube los archivos directo a Storage con URLs firmadas por el servidor.
 * `yaSubidos` evita repetir cargas si el envío se reintenta.
 */
export async function subirArchivos(
  sesion: string,
  items: ItemSubida[],
  yaSubidos: Map<string, ArchivoRef>,
  alAvanzar?: (hechos: number, total: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pendientes = items.filter((i) => !yaSubidos.has(i.id));
  if (!pendientes.length) return { ok: true };

  const preparados: { id: string; file: File }[] = [];
  for (const p of pendientes) {
    const file = await prepararArchivo(p.file);
    if (file.size > TAMANO_MAX_ARCHIVO) return { ok: false, error: `"${p.file.name}" pesa más de 5 MB. Use una foto más liviana o un PDF más pequeño.` };
    preparados.push({ id: p.id, file });
  }

  const r = await prepararSubidas(
    sesion,
    preparados.map((p) => ({ clave: p.id, nombre: p.file.name, mime: p.file.type, tamano: p.file.size })),
  );
  if (!r.ok) return { ok: false, error: r.error };

  const bucket = supabaseNavegador().storage.from(BUCKET_DOCUMENTOS);
  let hechos = 0;
  for (const s of r.subidas) {
    const p = preparados.find((x) => x.id === s.clave)!;
    const { error } = await bucket.uploadToSignedUrl(s.path, s.token, p.file, { contentType: p.file.type });
    if (error) return { ok: false, error: `No se pudo subir "${p.file.name}". Revise su conexión e intente de nuevo.` };
    yaSubidos.set(s.clave, { path: s.path, nombre: p.file.name, mime: p.file.type, tamano: p.file.size });
    alAvanzar?.(++hechos, preparados.length);
  }
  return { ok: true };
}

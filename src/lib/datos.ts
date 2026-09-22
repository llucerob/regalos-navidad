import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { urlFirmada } from "./storage";
import { calcularEdad } from "./edad";
import type {
  Beneficiario, Campana, Canal, Documento, Estado, Inscripcion, Sector,
} from "./types";

const TAM_PAGINA_DB = 1000;

/** Trae todas las filas paginando de a 1000 (límite de PostgREST). */
export async function traerTodo<T>(
  fabrica: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA_DB) {
    const { data, error } = await fabrica(desde, desde + TAM_PAGINA_DB - 1);
    if (error) throw new Error(error.message);
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < TAM_PAGINA_DB) break;
  }
  return filas;
}

export async function campanaActiva(): Promise<Campana | null> {
  const { data } = await supabaseAdmin().from("campanas").select("*").eq("activa", true).maybeSingle();
  return (data as Campana) ?? null;
}

export async function obtenerCampana(id: string): Promise<Campana | null> {
  const { data } = await supabaseAdmin().from("campanas").select("*").eq("id", id).maybeSingle();
  return (data as Campana) ?? null;
}

export async function listarCampanas(): Promise<Campana[]> {
  const { data } = await supabaseAdmin().from("campanas").select("*").order("anio", { ascending: false });
  return (data ?? []) as Campana[];
}

export async function listarSectores(soloActivos = false): Promise<Sector[]> {
  let q = supabaseAdmin().from("sectores").select("*").order("orden").order("nombre");
  if (soloActivos) q = q.eq("activo", true);
  const { data } = await q;
  return (data ?? []) as Sector[];
}

/** Campaña elegida en la URL (?campana=) o, por defecto, la activa o la más reciente. */
export async function resolverCampana(idSolicitado?: string): Promise<Campana | null> {
  if (idSolicitado) {
    const c = await obtenerCampana(idSolicitado);
    if (c) return c;
  }
  return (await campanaActiva()) ?? (await listarCampanas())[0] ?? null;
}

// ─────────────────────────────── Listado ───────────────────────────────

export interface FiltrosInscripciones {
  campanaId: string;
  estado?: Estado;
  canal?: Canal;
  sectorId?: string;
  q?: string;
  pagina?: number;
  porPagina?: number;
}

export interface FilaInscripcion extends Inscripcion {
  beneficiarios: Pick<Beneficiario, "tipo" | "nombres" | "apellidos" | "rut" | "activo">[];
  sectores: { nombre: string } | null;
}

const limpiarBusqueda = (q: string) => q.replace(/[%,()*\\'"]/g, " ").trim();

export async function listarInscripciones(f: FiltrosInscripciones) {
  const db = supabaseAdmin();
  const porPagina = f.porPagina ?? 25;
  const pagina = Math.max(f.pagina ?? 1, 1);

  let query = db
    .from("inscripciones")
    .select("*, beneficiarios(tipo,nombres,apellidos,rut,activo), sectores(nombre)", { count: "exact" })
    .eq("campana_id", f.campanaId)
    .order("created_at", { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  if (f.estado) query = query.eq("estado", f.estado);
  if (f.canal) query = query.eq("canal", f.canal);
  if (f.sectorId) query = query.eq("sector_id", f.sectorId);

  const q = f.q ? limpiarBusqueda(f.q) : "";
  if (q) {
    const sinPuntos = q.replace(/\./g, "");
    const patrones = Array.from(new Set([q, sinPuntos]));
    const { data: benef } = await db
      .from("beneficiarios")
      .select("inscripcion_id")
      .eq("campana_id", f.campanaId)
      .or(patrones.flatMap((p) => [`rut.ilike.%${p}%`, `nombres.ilike.%${p}%`, `apellidos.ilike.%${p}%`]).join(","))
      .limit(300);
    const ids = Array.from(new Set((benef ?? []).map((b) => b.inscripcion_id as string)));
    const condiciones = patrones.flatMap((p) => [
      `folio.ilike.%${p}%`,
      `apoderado_rut.ilike.%${p}%`,
      `apoderado_nombres.ilike.%${p}%`,
      `apoderado_apellidos.ilike.%${p}%`,
    ]);
    if (ids.length) condiciones.push(`id.in.(${ids.join(",")})`);
    query = query.or(condiciones.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { filas: (data ?? []) as unknown as FilaInscripcion[], total: count ?? 0, pagina, porPagina };
}

// ─────────────────────────────── Detalle ───────────────────────────────

export interface DocumentoConUrl extends Documento {
  url: string | null;
}

export async function detalleInscripcion(id: string) {
  const db = supabaseAdmin();
  const { data: inscripcion } = await db
    .from("inscripciones")
    .select("*, sectores(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!inscripcion) return null;

  const [{ data: beneficiarios }, { data: documentos }, { data: historial }, { data: campana }] = await Promise.all([
    db.from("beneficiarios").select("*").eq("inscripcion_id", id).order("created_at"),
    db.from("documentos").select("*").eq("inscripcion_id", id).order("created_at"),
    db.from("historial_estados").select("*").eq("inscripcion_id", id).order("created_at", { ascending: false }),
    db.from("campanas").select("*").eq("id", (inscripcion as Inscripcion).campana_id).maybeSingle(),
  ]);

  const docs: DocumentoConUrl[] = await Promise.all(
    ((documentos ?? []) as Documento[]).map(async (d) => ({ ...d, url: await urlFirmada(d.storage_path, 900) })),
  );

  return {
    inscripcion: inscripcion as Inscripcion & { sectores: { nombre: string } | null },
    beneficiarios: (beneficiarios ?? []) as Beneficiario[],
    documentos: docs,
    historial: (historial ?? []) as {
      id: string; estado_anterior: string | null; estado_nuevo: string; comentario: string | null;
      usuario_nombre: string | null; created_at: string;
    }[],
    campana: campana as Campana,
  };
}

// ───────────────────────────── Estadísticas ────────────────────────────

export interface Estadisticas {
  totalInscripciones: number;
  porEstado: Record<Estado, number>;
  porCanal: Record<Canal, number>;
  ninos: number;
  gestantes: number;
  entregados: number;
  porSector: { sector: string; inscripciones: number; beneficiarios: number }[];
  porEdad: { etiqueta: string; F: number; M: number; otro: number; total: number }[];
}

export async function estadisticas(campana: Campana): Promise<Estadisticas> {
  const db = supabaseAdmin();
  const [insc, benef, sectores] = await Promise.all([
    traerTodo<{ id: string; estado: Estado; canal: Canal; sector_id: string | null }>((d, h) =>
      db.from("inscripciones").select("id,estado,canal,sector_id").eq("campana_id", campana.id).range(d, h),
    ),
    traerTodo<Pick<Beneficiario, "inscripcion_id" | "tipo" | "fecha_nacimiento" | "sexo" | "activo" | "entregado_at">>((d, h) =>
      db.from("beneficiarios").select("inscripcion_id,tipo,fecha_nacimiento,sexo,activo,entregado_at").eq("campana_id", campana.id).range(d, h),
    ),
    listarSectores(),
  ]);

  const porEstado: Record<Estado, number> = { recibida: 0, en_revision: 0, observada: 0, aprobada: 0, rechazada: 0 };
  const porCanal: Record<Canal, number> = { online: 0, presencial: 0 };
  const sectorDe = new Map<string, string | null>();
  for (const i of insc) {
    porEstado[i.estado]++;
    porCanal[i.canal]++;
    sectorDe.set(i.id, i.sector_id);
  }

  const nombreSector = new Map(sectores.map((s) => [s.id, s.nombre]));
  const acumSector = new Map<string, { inscripciones: number; beneficiarios: number }>();
  const clave = (id: string | null | undefined) => (id ? nombreSector.get(id) ?? "Sin sector" : "Sin sector");
  for (const i of insc) {
    if (i.estado === "rechazada") continue;
    const k = clave(i.sector_id);
    const a = acumSector.get(k) ?? { inscripciones: 0, beneficiarios: 0 };
    a.inscripciones++;
    acumSector.set(k, a);
  }

  const edades = new Map<string, { F: number; M: number; otro: number }>();
  let ninos = 0, gestantes = 0, entregados = 0;
  for (const b of benef) {
    if (!b.activo) continue;
    const k = clave(sectorDe.get(b.inscripcion_id));
    const a = acumSector.get(k) ?? { inscripciones: 0, beneficiarios: 0 };
    a.beneficiarios++;
    acumSector.set(k, a);
    if (b.entregado_at) entregados++;
    if (b.tipo === "gestante") { gestantes++; continue; }
    ninos++;
    const anios = b.fecha_nacimiento ? calcularEdad(b.fecha_nacimiento, campana.fecha_referencia_edad).anios : -1;
    const etiqueta = anios < 0 ? "Sin fecha" : anios === 0 ? "Menos de 1 año" : anios === 1 ? "1 año" : `${anios} años`;
    const e = edades.get(etiqueta) ?? { F: 0, M: 0, otro: 0 };
    if (b.sexo === "F") e.F++; else if (b.sexo === "M") e.M++; else e.otro++;
    edades.set(etiqueta, e);
  }

  const orden = ["Menos de 1 año", "1 año", "2 años", "3 años", "4 años", "Sin fecha"];
  return {
    totalInscripciones: insc.length,
    porEstado,
    porCanal,
    ninos,
    gestantes,
    entregados,
    porSector: Array.from(acumSector, ([sector, v]) => ({ sector, ...v })).sort((a, b) => b.beneficiarios - a.beneficiarios),
    porEdad: orden
      .filter((o) => edades.has(o))
      .map((o) => {
        const e = edades.get(o)!;
        return { etiqueta: o, ...e, total: e.F + e.M + e.otro };
      }),
  };
}

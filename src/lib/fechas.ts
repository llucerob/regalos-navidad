import { ZONA_HORARIA } from "./constants";
import type { Campana } from "./types";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha de hoy en Chile como yyyy-mm-dd. */
export function hoyChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function esFechaIso(valor: string | null | undefined): valor is string {
  if (!valor) return false;
  const m = ISO.exec(valor);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** dd-mm-yyyy para mostrar. */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso || !ISO.test(iso.slice(0, 10))) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA_HORARIA,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatearFechaLarga(iso: string | null | undefined): string {
  if (!iso || !esFechaIso(iso.slice(0, 10))) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", dateStyle: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export type EstadoCampana = "proxima" | "abierta" | "cerrada" | "inactiva";

export function estadoCampana(c: Pick<Campana, "activa" | "fecha_inicio" | "fecha_fin">, hoy = hoyChile()): EstadoCampana {
  if (!c.activa) return "inactiva";
  if (hoy < c.fecha_inicio) return "proxima";
  if (hoy > c.fecha_fin) return "cerrada";
  return "abierta";
}

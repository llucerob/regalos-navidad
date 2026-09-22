import { esFechaIso } from "./fechas";

/** Suma años a una fecha ISO. Un 29-feb pasa al 28-feb en años no bisiestos. */
export function sumarAnios(iso: string, anios: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ny = y + anios;
  const ultimoDia = new Date(Date.UTC(ny, m, 0)).getUTCDate();
  const nd = Math.min(d, ultimoDia);
  return `${ny}-${String(m).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export const EDAD_MAXIMA_ANIOS = 5; // se entrega hasta 4 años, 11 meses y 30 días

/**
 * ¿Cumple el requisito de edad? Elegible si a la fecha de referencia aún no
 * cumple 5 años (es decir, tiene como máximo 4 años, 11 meses y 30 días).
 */
export function esElegiblePorEdad(fechaNacimiento: string, fechaReferencia: string): boolean {
  if (!esFechaIso(fechaNacimiento) || !esFechaIso(fechaReferencia)) return false;
  if (fechaNacimiento > fechaReferencia) return false; // aún no nace a la fecha de entrega
  return sumarAnios(fechaNacimiento, EDAD_MAXIMA_ANIOS) > fechaReferencia;
}

export interface EdadDetallada {
  anios: number;
  meses: number;
  dias: number;
}

/** Edad cumplida a una fecha dada (años, meses, días). */
export function calcularEdad(fechaNacimiento: string, fechaReferencia: string): EdadDetallada {
  const [y1, m1, d1] = fechaNacimiento.split("-").map(Number);
  const [y2, m2, d2] = fechaReferencia.split("-").map(Number);
  let anios = y2 - y1;
  let meses = m2 - m1;
  let dias = d2 - d1;
  if (dias < 0) {
    meses -= 1;
    dias += new Date(Date.UTC(y2, m2 - 1, 0)).getUTCDate();
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios: Math.max(anios, 0), meses: Math.max(meses, 0), dias: Math.max(dias, 0) };
}

export function edadTexto(fechaNacimiento: string, fechaReferencia: string): string {
  if (fechaNacimiento > fechaReferencia) return "aún no nace a la fecha";
  const e = calcularEdad(fechaNacimiento, fechaReferencia);
  const partes: string[] = [];
  if (e.anios) partes.push(`${e.anios} ${e.anios === 1 ? "año" : "años"}`);
  if (e.meses) partes.push(`${e.meses} ${e.meses === 1 ? "mes" : "meses"}`);
  if (!partes.length) partes.push(`${e.dias} ${e.dias === 1 ? "día" : "días"}`);
  return partes.join(" ");
}

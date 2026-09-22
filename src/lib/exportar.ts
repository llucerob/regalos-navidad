import "server-only";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "./supabase/admin";
import { traerTodo, listarSectores } from "./datos";
import { calcularEdad, edadTexto } from "./edad";
import { formatearFecha, formatearFechaHora } from "./fechas";
import { formatearRut } from "./rut";
import { ETIQUETA_CANAL, ETIQUETA_ESTADO } from "./constants";
import type { Beneficiario, Campana, Estado, Inscripcion } from "./types";

const AZUL = "FF003169";
const AMARILLO = "FFFFBA2F";

interface FilaBase {
  ins: Inscripcion;
  b: Beneficiario;
  sector: string;
}

async function cargarFilas(campana: Campana, estados: Estado[]): Promise<FilaBase[]> {
  const db = supabaseAdmin();
  const [ins, benef, sectores] = await Promise.all([
    traerTodo<Inscripcion>((d, h) =>
      db.from("inscripciones").select("*").eq("campana_id", campana.id).in("estado", estados).order("created_at").range(d, h),
    ),
    traerTodo<Beneficiario>((d, h) =>
      db.from("beneficiarios").select("*").eq("campana_id", campana.id).eq("activo", true).range(d, h),
    ),
    listarSectores(),
  ]);
  const porId = new Map(ins.map((i) => [i.id, i]));
  const nombreSector = new Map(sectores.map((s) => [s.id, s.nombre]));
  const filas: FilaBase[] = [];
  for (const b of benef) {
    const i = porId.get(b.inscripcion_id);
    if (!i) continue;
    filas.push({ ins: i, b, sector: i.sector_id ? nombreSector.get(i.sector_id) ?? "Sin sector" : "Sin sector" });
  }
  return filas.sort(
    (a, b) =>
      a.sector.localeCompare(b.sector, "es") ||
      a.ins.apoderado_apellidos.localeCompare(b.ins.apoderado_apellidos, "es") ||
      a.b.apellidos.localeCompare(b.b.apellidos, "es"),
  );
}

const tipoTexto = (b: Beneficiario) =>
  b.tipo === "gestante" ? "Madre gestante" : b.sexo === "F" ? "Niña" : b.sexo === "M" ? "Niño" : "Niño/a";

function encabezado(hoja: ExcelJS.Worksheet, fila = 1) {
  const r = hoja.getRow(fila);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  r.alignment = { vertical: "middle", wrapText: true };
  r.height = 30;
  hoja.views = [{ state: "frozen", ySplit: fila }];
}

export async function generarExportacion(
  campana: Campana,
  estados: Estado[],
  formato: "xlsx" | "csv",
): Promise<{ buffer: Buffer; nombre: string; mime: string }> {
  const filas = await cargarFilas(campana, estados);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Regalos de Navidad - Municipalidad de Coinco";
  wb.created = new Date();

  // ── Hoja 1: Inscritos (una fila por beneficiario) ──
  const h1 = wb.addWorksheet("Inscritos");
  h1.columns = [
    { header: "Folio", key: "folio", width: 16 },
    { header: "Estado", key: "estado", width: 13 },
    { header: "Canal", key: "canal", width: 12 },
    { header: "Fecha inscripción", key: "fecha", width: 17 },
    { header: "Tipo", key: "tipo", width: 15 },
    { header: "RUT beneficiario", key: "rut", width: 15 },
    { header: "Nombres", key: "nombres", width: 22 },
    { header: "Apellidos", key: "apellidos", width: 22 },
    { header: "Fecha nacimiento", key: "nac", width: 15 },
    { header: "Edad a fecha de referencia", key: "edad", width: 18 },
    { header: "Años cumplidos", key: "anios", width: 10 },
    { header: "Fecha probable de parto", key: "fpp", width: 15 },
    { header: "RUT apoderado", key: "arut", width: 15 },
    { header: "Apoderado", key: "apoderado", width: 30 },
    { header: "Teléfono", key: "tel", width: 15 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Dirección", key: "dir", width: 34 },
    { header: "Sector / Junta de Vecinos", key: "sector", width: 24 },
    { header: "Entregado", key: "entregado", width: 11 },
  ];
  for (const { ins, b, sector } of filas) {
    const cumplidos = b.tipo === "nino" && b.fecha_nacimiento ? calcularEdad(b.fecha_nacimiento, campana.fecha_referencia_edad).anios : null;
    h1.addRow({
      folio: ins.folio,
      estado: ETIQUETA_ESTADO[ins.estado],
      canal: ETIQUETA_CANAL[ins.canal],
      fecha: formatearFechaHora(ins.created_at),
      tipo: tipoTexto(b),
      rut: formatearRut(b.rut),
      nombres: b.nombres,
      apellidos: b.apellidos,
      nac: formatearFecha(b.fecha_nacimiento),
      edad: b.fecha_nacimiento ? edadTexto(b.fecha_nacimiento, campana.fecha_referencia_edad) : "",
      anios: cumplidos,
      fpp: formatearFecha(b.fecha_probable_parto),
      arut: formatearRut(ins.apoderado_rut),
      apoderado: `${ins.apoderado_nombres} ${ins.apoderado_apellidos}`,
      tel: ins.apoderado_telefono,
      email: ins.apoderado_email ?? "",
      dir: ins.direccion,
      sector,
      entregado: b.entregado_at ? "Sí" : "No",
    });
  }
  encabezado(h1);
  h1.autoFilter = { from: "A1", to: { row: 1, column: h1.columns.length } };

  if (formato === "csv") {
    const csv = Buffer.from(await wb.csv.writeBuffer());
    return {
      buffer: Buffer.concat([Buffer.from("﻿", "utf8"), csv]), // BOM: Excel abre bien las tildes
      nombre: `inscritos-${campana.anio}.csv`,
      mime: "text/csv; charset=utf-8",
    };
  }

  // ── Hoja 2: Resumen para la compra (edad × sexo) ──
  const h2 = wb.addWorksheet("Resumen compra");
  h2.addRow([`${campana.nombre} · fecha de referencia de edad: ${formatearFecha(campana.fecha_referencia_edad)}`]).font = { bold: true, size: 12 };
  h2.addRow([`Estados incluidos: ${estados.map((e) => ETIQUETA_ESTADO[e]).join(", ")}`]);
  h2.addRow([]);
  const cab = h2.addRow(["Grupo", "Niñas", "Niños", "Otro", "Total"]);
  const resumen = new Map<string, { F: number; M: number; otro: number }>();
  let gestantes = 0;
  for (const { b } of filas) {
    if (b.tipo === "gestante") { gestantes++; continue; }
    const anios = b.fecha_nacimiento ? calcularEdad(b.fecha_nacimiento, campana.fecha_referencia_edad).anios : -1;
    const k = anios < 0 ? "Sin fecha" : anios === 0 ? "Menos de 1 año" : anios === 1 ? "1 año" : `${anios} años`;
    const r = resumen.get(k) ?? { F: 0, M: 0, otro: 0 };
    if (b.sexo === "F") r.F++; else if (b.sexo === "M") r.M++; else r.otro++;
    resumen.set(k, r);
  }
  const primeraDato = h2.rowCount + 1;
  for (const k of ["Menos de 1 año", "1 año", "2 años", "3 años", "4 años", "Sin fecha"]) {
    const r = resumen.get(k);
    if (!r) continue;
    const n = h2.rowCount + 1;
    h2.addRow([k, r.F, r.M, r.otro, { formula: `SUM(B${n}:D${n})`, result: r.F + r.M + r.otro }]);
  }
  const ultimaDato = h2.rowCount;
  const nG = h2.rowCount + 1;
  h2.addRow(["Madres gestantes", "", "", "", gestantes]);
  const tot = h2.addRow([
    "TOTAL",
    { formula: `SUM(B${primeraDato}:B${ultimaDato})` },
    { formula: `SUM(C${primeraDato}:C${ultimaDato})` },
    { formula: `SUM(D${primeraDato}:D${ultimaDato})` },
    { formula: `SUM(E${primeraDato}:E${nG})` },
  ]);
  tot.font = { bold: true };
  tot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARILLO } };
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  h2.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];

  // ── Hoja 3: Por sector ──
  const h3 = wb.addWorksheet("Por sector");
  h3.columns = [
    { header: "Sector / Junta de Vecinos", key: "s", width: 30 },
    { header: "Inscripciones", key: "i", width: 15 },
    { header: "Niñas y niños", key: "n", width: 15 },
    { header: "Madres gestantes", key: "g", width: 17 },
    { header: "Total beneficiarios", key: "t", width: 19 },
  ];
  const porSector = new Map<string, { ins: Set<string>; n: number; g: number }>();
  for (const { ins, b, sector } of filas) {
    const a = porSector.get(sector) ?? { ins: new Set<string>(), n: 0, g: 0 };
    a.ins.add(ins.id);
    if (b.tipo === "gestante") a.g++; else a.n++;
    porSector.set(sector, a);
  }
  for (const [s, a] of [...porSector].sort((x, y) => x[0].localeCompare(y[0], "es"))) {
    const n = h3.rowCount + 1;
    h3.addRow({ s, i: a.ins.size, n: a.n, g: a.g, t: { formula: `C${n}+D${n}`, result: a.n + a.g } });
  }
  encabezado(h3);

  // ── Hoja 4: Lista de entrega (con columna para firma) ──
  const h4 = wb.addWorksheet("Lista de entrega");
  h4.columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Sector", key: "sector", width: 22 },
    { header: "Beneficiario", key: "b", width: 32 },
    { header: "RUT beneficiario", key: "rut", width: 15 },
    { header: "Edad", key: "edad", width: 14 },
    { header: "Adulto responsable", key: "a", width: 30 },
    { header: "RUT adulto", key: "arut", width: 15 },
    { header: "Teléfono", key: "tel", width: 14 },
    { header: "Nombre y firma de quien retira", key: "firma", width: 36 },
  ];
  filas.forEach(({ ins, b, sector }, idx) => {
    const r = h4.addRow({
      n: idx + 1,
      sector,
      b: `${b.apellidos}, ${b.nombres}`,
      rut: formatearRut(b.rut),
      edad: b.tipo === "gestante" ? "Gestante" : b.fecha_nacimiento ? edadTexto(b.fecha_nacimiento, campana.fecha_referencia_edad) : "",
      a: `${ins.apoderado_apellidos}, ${ins.apoderado_nombres}`,
      arut: formatearRut(ins.apoderado_rut),
      tel: ins.apoderado_telefono,
      firma: "",
    });
    r.height = 24;
    r.border = { bottom: { style: "thin", color: { argb: "FFBBBBBB" } } };
  });
  encabezado(h4);
  h4.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    nombre: `inscritos-${campana.anio}.xlsx`,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

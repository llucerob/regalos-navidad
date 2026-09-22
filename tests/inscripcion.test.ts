/**
 * Prueba de la orquestación de enviarInscripcion con una base de datos en memoria
 * (simula el cliente de Supabase). Verifica reglas de negocio, duplicados, deshacer y canales.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calcularDv } from "../src/lib/rut";
import { hoyChile } from "../src/lib/fechas";

// ───────────── Base de datos falsa mínima ─────────────
type Row = Record<string, any>;
const db: { tablas: Record<string, Row[]>; archivos: Set<string> } = { tablas: {}, archivos: new Set() };
const enviados: any[] = [];
let staff: any = null;

class Consulta {
  op: "select" | "insert" | "update" | "delete" = "select";
  filtros: ((r: Row) => boolean)[] = [];
  datos: any;
  devolver = false;
  unico: "single" | "maybe" | null = null;
  constructor(private t: string) {}
  select() { if (this.op !== "select") this.devolver = true; return this; }
  insert(d: any) { this.op = "insert"; this.datos = d; return this; }
  update(d: any) { this.op = "update"; this.datos = d; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) { this.filtros.push((r) => r[c] === v); return this; }
  in(c: string, v: any[]) { this.filtros.push((r) => v.includes(r[c])); return this; }
  single() { this.unico = "single"; return this; }
  maybeSingle() { this.unico = "maybe"; return this; }
  then(ok?: (v: any) => unknown, ko?: (e: any) => unknown): Promise<unknown> { return Promise.resolve(this.ejecutar()).then(ok, ko); }

  ejecutar(): { data: any; error: any } {
    const tabla = (db.tablas[this.t] ??= []);
    const coincide = () => tabla.filter((r) => this.filtros.every((f) => f(r)));
    if (this.op === "select") {
      const filas = coincide();
      if (this.unico) return { data: filas[0] ?? null, error: this.unico === "single" && !filas[0] ? { message: "sin filas" } : null };
      return { data: filas, error: null };
    }
    if (this.op === "insert") {
      const nuevos: Row[] = [];
      for (const d of Array.isArray(this.datos) ? this.datos : [this.datos]) {
        const fila = { id: crypto.randomUUID(), activo: true, ...d };
        const dupFolio = this.t === "inscripciones" && tabla.some((r) => r.folio === fila.folio);
        const dupRut = this.t === "beneficiarios" && tabla.some((r) => r.campana_id === fila.campana_id && r.rut === fila.rut && r.activo && fila.activo);
        if (dupFolio || dupRut) return { data: null, error: { code: "23505", message: "duplicate key" } };
        tabla.push(fila);
        nuevos.push(fila);
      }
      if (!this.devolver) return { data: null, error: null };
      return { data: this.unico ? nuevos[0] : nuevos, error: null };
    }
    if (this.op === "update") { coincide().forEach((r) => Object.assign(r, this.datos)); return { data: null, error: null }; }
    // delete (con cascada por inscripcion_id)
    const borrar = coincide();
    db.tablas[this.t] = tabla.filter((r) => !borrar.includes(r));
    if (this.t === "inscripciones") {
      for (const hija of ["beneficiarios", "documentos", "historial_estados"]) {
        db.tablas[hija] = (db.tablas[hija] ?? []).filter((r) => !borrar.some((b) => b.id === r.inscripcion_id));
      }
    }
    return { data: null, error: null };
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (t: string) => new Consulta(t),
    storage: {
      from: () => ({
        list: async (prefijo: string) => ({
          data: [...db.archivos].filter((p) => p.startsWith(`${prefijo}/`)).map((p) => ({ name: p.slice(prefijo.length + 1) })),
          error: null,
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/auth", () => ({
  obtenerStaff: async () => staff,
  puedeRevisar: (rol: string) => rol === "admin" || rol === "revisor",
}));
vi.mock("@/lib/ratelimit", () => ({ limitar: async () => true }));
vi.mock("@/lib/correos/enviar", () => ({ encolarYEnviar: async (c: any) => void enviados.push(c) }));
vi.mock("@/lib/datos", () => ({
  campanaActiva: async () => db.tablas.campanas.find((c) => c.activa) ?? null,
}));

import { enviarInscripcion } from "../src/actions/inscripcion";

// ───────────── Datos de prueba ─────────────
const rutDe = (n: string) => `${n}-${calcularDv(n)}`;
const sesion = () => crypto.randomUUID();
const CAMPANA_ID = "camp-1";
const SECTOR_ID = crypto.randomUUID();

function sumarDias(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function payload(s: string, extra: Record<string, unknown> = {}, rutNino = "21345678") {
  const ref = (n: string) => {
    const path = `cargas/${s}/${n}.jpg`;
    db.archivos.add(path);
    return [{ path, nombre: `${n}.jpg`, mime: "image/jpeg", tamano: 1000 }];
  };
  return {
    uploadSession: s,
    modo: "online",
    apoderado: { rut: rutDe("12345678"), nombres: "Ana", apellidos: "Pérez", telefono: "912345678", email: "ana@example.com", direccion: "Calle 123, Coinco", sectorId: SECTOR_ID },
    residenciaCon: "rsh",
    tramo: "hasta_40",
    beneficiarios: [
      { tipo: "nino", rut: rutDe(rutNino), nombres: "Luz", apellidos: "Pérez", fechaNacimiento: "2024-03-10", sexo: "F", documentoIdentidad: "cedula", docs: { cedula: ref(`c${rutNino}`), carnet_control_sano: ref(`s${rutNino}`) } },
    ],
    docsHogar: { cartola_rsh: ref("cartola") },
    aceptaDatos: true,
    ...extra,
  };
}

beforeEach(() => {
  const hoy = hoyChile();
  db.tablas = {
    campanas: [{ id: CAMPANA_ID, anio: 2026, nombre: "Regalos 2026", activa: true, fecha_inicio: sumarDias(hoy, -30), fecha_fin: sumarDias(hoy, 30), fecha_referencia_edad: sumarDias(hoy, 90) }],
    sectores: [{ id: SECTOR_ID, nombre: "Centro", activo: true }],
  };
  db.archivos.clear();
  enviados.length = 0;
  staff = null;
});

describe("enviarInscripcion", () => {
  it("registra una inscripción en línea completa y envía el comprobante", async () => {
    const s = sesion();
    const r = await enviarInscripcion(payload(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.folio).toMatch(/^NAV26-[A-Z2-9]{6}$/);
    const ins = db.tablas.inscripciones[0];
    expect(ins).toMatchObject({ canal: "online", estado: "recibida", apoderado_rut: "12345678-5", apoderado_email: "ana@example.com" });
    expect(db.tablas.beneficiarios).toHaveLength(1);
    expect(db.tablas.beneficiarios[0]).toMatchObject({ tipo: "nino", sexo: "F", documento_identidad: "cedula" });
    expect(db.tablas.documentos).toHaveLength(3);
    expect(db.tablas.documentos.filter((d) => d.beneficiario_id === null)).toHaveLength(1);
    expect(db.tablas.historial_estados).toHaveLength(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ tipo: "comprobante", destinatario: "ana@example.com" });
  });

  it("rechaza un RUT ya inscrito y no deja datos a medias", async () => {
    expect((await enviarInscripcion(payload(sesion()))).ok).toBe(true);
    const r = await enviarInscripcion(payload(sesion()));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campos?.["beneficiarios.0.rut"]).toBeDefined();
    expect(db.tablas.inscripciones).toHaveLength(1);
  });

  it("permite reinscribir un RUT cuya inscripción anterior fue rechazada", async () => {
    await enviarInscripcion(payload(sesion()));
    db.tablas.inscripciones[0].estado = "rechazada";
    db.tablas.beneficiarios[0].activo = false; // lo hace el trigger en la base real
    expect((await enviarInscripcion(payload(sesion()))).ok).toBe(true);
    expect(db.tablas.inscripciones).toHaveLength(2);
  });

  it("no acepta inscripciones fuera de plazo", async () => {
    const hoy = hoyChile();
    db.tablas.campanas[0].fecha_fin = sumarDias(hoy, -1);
    const r = await enviarInscripcion(payload(sesion()));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/terminó/) });
    db.tablas.campanas[0].fecha_fin = sumarDias(hoy, 30);
    db.tablas.campanas[0].fecha_inicio = sumarDias(hoy, 1);
    expect(await enviarInscripcion(payload(sesion()))).toMatchObject({ ok: false, error: expect.stringMatching(/aún no comienzan/) });
  });

  it("rechaza un niño que a la fecha de referencia ya cumplió 5 años", async () => {
    const p = payload(sesion());
    p.beneficiarios[0].fechaNacimiento = "2015-01-01";
    const r = await enviarInscripcion(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campos?.["beneficiarios.0.fechaNacimiento"]).toMatch(/edad/);
  });

  it("rechaza si un archivo referenciado no existe en Storage", async () => {
    const s = sesion();
    const p = payload(s);
    db.archivos.delete(p.docsHogar.cartola_rsh[0].path);
    const r = await enviarInscripcion(p);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/no terminó de subirse/) });
    expect(db.tablas.inscripciones ?? []).toHaveLength(0);
  });

  it("rechaza archivos de otra sesión de carga", async () => {
    const p = payload(sesion());
    p.docsHogar.cartola_rsh[0].path = `cargas/${sesion()}/ajeno.jpg`;
    const r = await enviarInscripcion(p);
    expect(r.ok).toBe(false);
  });

  it("exige correo y documentos en línea, pero no en presencial", async () => {
    const sinNada = payload(sesion(), { docsHogar: {} });
    sinNada.apoderado.email = "";
    sinNada.beneficiarios[0].docs = {} as never;
    const online = await enviarInscripcion(sinNada);
    expect(online.ok).toBe(false);
    if (!online.ok) {
      expect(online.campos?.["apoderado.email"]).toBeDefined();
      expect(online.campos?.["docsHogar.cartola_rsh"]).toBeDefined();
    }
    // presencial sin sesión de funcionario
    expect((await enviarInscripcion({ ...sinNada, modo: "presencial" })).ok).toBe(false);
    // presencial con funcionario digitador: queda "recibida", sin correo
    staff = { userId: "u1", perfil: { rol: "digitador", nombre: "Digi" } };
    const r = await enviarInscripcion({ ...sinNada, modo: "presencial", aprobarDirecto: true });
    expect(r.ok).toBe(true);
    expect(db.tablas.inscripciones[0]).toMatchObject({ canal: "presencial", estado: "recibida", creado_por: "u1" });
    expect(enviados).toHaveLength(0);
  });

  it("un revisor puede aprobar de inmediato en el registro presencial", async () => {
    staff = { userId: "u2", perfil: { rol: "revisor", nombre: "Rev" } };
    const r = await enviarInscripcion(payload(sesion(), { modo: "presencial", aprobarDirecto: true }));
    expect(r.ok).toBe(true);
    const ins = db.tablas.inscripciones[0];
    expect(ins).toMatchObject({ estado: "aprobada", revisado_por: "u2" });
    expect(Object.values(ins.checklist).every(Boolean)).toBe(true);
    expect(enviados[0]).toMatchObject({ tipo: "aprobada" });
  });

  it("descarta el honeypot y datos inválidos sin tocar la base", async () => {
    expect((await enviarInscripcion(payload(sesion(), { sitioWeb: "http://spam.example" }))).ok).toBe(false);
    expect((await enviarInscripcion({ nada: true })).ok).toBe(false);
    expect(db.tablas.inscripciones ?? []).toHaveLength(0);
  });
});

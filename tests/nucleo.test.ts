import { describe, expect, it } from "vitest";
import { calcularDv, formatearRut, normalizarRut, validarRut } from "../src/lib/rut";
import { calcularEdad, edadTexto, esElegiblePorEdad, sumarAnios } from "../src/lib/edad";
import { estadoCampana, esFechaIso, hoyChile } from "../src/lib/fechas";
import { inscripcionSchema, validarReglasNegocio } from "../src/lib/schemas";

describe("RUT", () => {
  it("calcula dígito verificador", () => {
    expect(calcularDv("12345678")).toBe("5");
    expect(calcularDv("76086428")).toBe("5");
    expect(calcularDv("11111111")).toBe("1");
    expect(calcularDv("10000004")).toBe("0");
    expect(calcularDv("10000013")).toBe("K");
  });
  it("valida y normaliza", () => {
    expect(validarRut("12.345.678-5")).toBe(true);
    expect(validarRut("12345678-5")).toBe(true);
    expect(validarRut("12.345.678-9")).toBe(false);
    expect(validarRut("11.111.111-1")).toBe(false); // repetidos
    expect(validarRut("abc")).toBe(false);
    expect(normalizarRut("12.345.678-5")).toBe("12345678-5");
    expect(formatearRut("123456785")).toBe("12.345.678-5");
  });
  it("acepta DV K", () => {
    expect(validarRut("10000013-K")).toBe(true);
    expect(validarRut("10000013-k")).toBe(true);
  });
});

describe("Elegibilidad por edad (hasta 4 años, 11 meses y 30 días)", () => {
  const ref = "2026-12-15";
  it("acepta un recién nacido y un niño de 4a 11m 30d", () => {
    expect(esElegiblePorEdad("2026-12-01", ref)).toBe(true);
    expect(esElegiblePorEdad("2021-12-16", ref)).toBe(true); // cumple 5 mañana
  });
  it("rechaza quien cumple 5 años a la fecha de referencia", () => {
    expect(esElegiblePorEdad("2021-12-15", ref)).toBe(false);
    expect(esElegiblePorEdad("2020-01-01", ref)).toBe(false);
  });
  it("rechaza nacimientos posteriores a la referencia y fechas inválidas", () => {
    expect(esElegiblePorEdad("2027-01-01", ref)).toBe(false);
    expect(esElegiblePorEdad("2023-02-30", ref)).toBe(false);
  });
  it("maneja 29 de febrero", () => {
    expect(sumarAnios("2024-02-29", 5)).toBe("2029-02-28");
  });
  it("calcula edad en texto", () => {
    expect(calcularEdad("2023-03-10", "2026-12-15")).toEqual({ anios: 3, meses: 9, dias: 5 });
    expect(edadTexto("2026-10-01", ref)).toBe("2 meses");
    expect(edadTexto("2025-12-15", ref)).toBe("1 año");
  });
});

describe("Fechas y campaña", () => {
  it("valida ISO", () => {
    expect(esFechaIso("2026-02-29")).toBe(false);
    expect(esFechaIso("2024-02-29")).toBe(true);
  });
  it("hoyChile usa zona de Chile", () => {
    expect(hoyChile(new Date("2026-09-22T01:30:00Z"))).toBe("2026-09-21"); // 22:30 en Santiago
  });
  it("estado de campaña", () => {
    const c = { activa: true, fecha_inicio: "2026-08-01", fecha_fin: "2026-10-31" };
    expect(estadoCampana(c, "2026-09-21")).toBe("abierta");
    expect(estadoCampana(c, "2026-10-31")).toBe("abierta");
    expect(estadoCampana(c, "2026-11-01")).toBe("cerrada");
    expect(estadoCampana(c, "2026-07-31")).toBe("proxima");
    expect(estadoCampana({ ...c, activa: false }, "2026-09-21")).toBe("inactiva");
  });
});

describe("Esquema de inscripción", () => {
  const rutDe = (n: string) => `${n}-${calcularDv(n)}`;
  const archivo = { path: "cargas/abc/12345678.jpg", nombre: "a.jpg", mime: "image/jpeg", tamano: 1000 };
  const base = () => ({
    uploadSession: crypto.randomUUID(),
    modo: "online" as const,
    apoderado: {
      rut: "12.345.678-5",
      nombres: "Ana",
      apellidos: "Pérez",
      telefono: "+56 9 1234 5678",
      email: "ana@example.com",
      direccion: "Calle 123, Coinco",
      sectorId: crypto.randomUUID(),
    },
    residenciaCon: "rsh" as const,
    tramo: "hasta_40" as const,
    beneficiarios: [
      {
        tipo: "nino" as const,
        rut: rutDe("21345678"),
        nombres: "Luz",
        apellidos: "Pérez",
        fechaNacimiento: "2023-05-01",
        sexo: "F" as const,
        documentoIdentidad: "cedula" as const,
        docs: { cedula: [archivo], carnet_control_sano: [archivo] },
      },
    ],
    docsHogar: { cartola_rsh: [archivo] },
    aceptaDatos: true as const,
  });
  const ctx = { canal: "online" as const, fechaReferencia: "2026-12-15", hoy: "2026-09-21" };

  it("acepta un formulario completo", () => {
    const r = inscripcionSchema.safeParse(base());
    expect(r.success).toBe(true);
    if (r.success) expect(validarReglasNegocio(r.data, ctx)).toEqual({});
  });
  it("detecta niño fuera de rango de edad y documentos faltantes", () => {
    const p = base();
    p.beneficiarios[0].fechaNacimiento = "2019-01-01";
    p.beneficiarios[0].docs = { cedula: [archivo] } as never;
    const r = inscripcionSchema.parse(p);
    const e = validarReglasNegocio(r, ctx);
    expect(e["beneficiarios.0.fechaNacimiento"]).toMatch(/edad/);
    expect(e["beneficiarios.0.docs.carnet_control_sano"]).toBeDefined();
  });
  it("exige cartola y, si acredita con certificado, también el certificado", () => {
    const p = { ...base(), residenciaCon: "certificado_jv" as const };
    const e = validarReglasNegocio(inscripcionSchema.parse(p), ctx);
    expect(e["docsHogar.certificado_residencia"]).toBeDefined();
    expect(e["docsHogar.cartola_rsh"]).toBeUndefined();
  });
  it("en registro presencial los documentos son opcionales y el correo también", () => {
    const p = base();
    p.apoderado.email = "";
    p.beneficiarios[0].docs = {} as never;
    p.docsHogar = {} as never;
    const e = validarReglasNegocio(inscripcionSchema.parse({ ...p, modo: "presencial" }), { ...ctx, canal: "presencial" });
    expect(e).toEqual({});
  });
  it("detecta RUT repetido y rechaza honeypot lleno", () => {
    const p = base();
    p.beneficiarios.push({ ...p.beneficiarios[0] });
    expect(validarReglasNegocio(inscripcionSchema.parse(p), ctx)["beneficiarios.1.rut"]).toBeDefined();
    expect(inscripcionSchema.safeParse({ ...base(), sitioWeb: "http://spam" }).success).toBe(false);
  });
  it("rechaza si no acepta el uso de datos", () => {
    expect(inscripcionSchema.safeParse({ ...base(), aceptaDatos: false }).success).toBe(false);
  });
});

import { z } from "zod";
import { validarRut } from "./rut";
import { esFechaIso } from "./fechas";
import { esElegiblePorEdad } from "./edad";
import { docsRequeridosBeneficiario, docsRequeridosHogar } from "./documentos";
import {
  MAX_ARCHIVOS_POR_DOCUMENTO,
  MAX_BENEFICIARIOS_POR_FORMULARIO,
  TAMANO_MAX_ARCHIVO,
  TIPOS_MIME_PERMITIDOS,  
  MAX_BEBES_ESPERADOS,  
} from "./constants";
import type { Canal } from "./types";

export const archivoRefSchema = z.object({
  path: z.string().min(10).max(300),
  nombre: z.string().max(200),
  mime: z.string().refine((m) => TIPOS_MIME_PERMITIDOS.includes(m), "Formato de archivo no permitido"),
  tamano: z.number().int().positive().max(TAMANO_MAX_ARCHIVO, "El archivo supera los 5 MB"),
});

export const docsSchema = z.record(z.string(), z.array(archivoRefSchema).max(MAX_ARCHIVOS_POR_DOCUMENTO));

const texto = (min: number, max: number, etiqueta: string) =>
  z
    .string()
    .trim()
    .min(min, `${etiqueta}: mínimo ${min} caracteres`)
    .max(max, `${etiqueta}: máximo ${max} caracteres`);

const rutSchema = z.string().refine(validarRut, "RUT inválido. Revise el número y el dígito verificador");

export const beneficiarioSchema = z.object({
  tipo: z.enum(["nino", "gestante"]),
  rut: rutSchema,
  nombres: texto(2, 80, "Nombres"),
  apellidos: texto(2, 80, "Apellidos"),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(["F", "M", "otro"]).optional(),
  documentoIdentidad: z.enum(["cedula", "certificado_nacimiento"]).optional(),
  fechaProbableParto: z.string().optional(),
  cantidadBebesEsperados: z.number().int().min(1).max(MAX_BEBES_ESPERADOS).optional(),
  docs: docsSchema.default({}),
});

export const apoderadoSchema = z.object({
  rut: rutSchema,
  nombres: texto(2, 80, "Nombres"),
  apellidos: texto(2, 80, "Apellidos"),
  telefono: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 8 && v.length <= 12, "Ingrese un teléfono válido (por ejemplo 9 1234 5678)"),
  email: z.union([z.literal(""), z.email("Correo electrónico inválido")]).optional(),
  direccion: texto(5, 200, "Dirección"),
  sectorId: z.uuid("Seleccione su sector o Junta de Vecinos"),
});

export const inscripcionSchema = z.object({
  uploadSession: z.uuid(),
  modo: z.enum(["online", "presencial"]),
  apoderado: apoderadoSchema,
  residenciaCon: z.enum(["rsh", "certificado_jv"]),
  tramo: z.enum(["hasta_40", "no_sabe", "superior"]),
  beneficiarios: z
    .array(beneficiarioSchema)
    .min(1, "Agregue al menos un niño, niña o madre gestante")
    .max(MAX_BENEFICIARIOS_POR_FORMULARIO, `Máximo ${MAX_BENEFICIARIOS_POR_FORMULARIO} beneficiarios por formulario`),
  docsHogar: docsSchema.default({}),
  aceptaDatos: z.literal(true, { error: "Debe aceptar el uso de sus datos para continuar" }),
  // Solo registro presencial (funcionarios revisor/administrador)
  aprobarDirecto: z.boolean().optional(),
  // Honeypot: los humanos no lo ven ni lo llenan
  sitioWeb: z.string().max(0).optional(),
});

export type InscripcionPayload = z.infer<typeof inscripcionSchema>;
export type BeneficiarioPayload = z.infer<typeof beneficiarioSchema>;

/** Reglas que dependen de la campaña y del canal. Devuelve errores por ruta. */
export function validarReglasNegocio(
  p: InscripcionPayload,
  ctx: { canal: Canal; fechaReferencia: string; hoy: string },
): Record<string, string> {
  const errores: Record<string, string> = {};

  if (ctx.canal === "online" && !p.apoderado.email) {
    errores["apoderado.email"] = "Ingrese un correo electrónico para enviarle el comprobante";
  }
  //if (p.tramo === "hasta_40" || p.tramo === "no_sabe") {
    /* válido; el revisor verifica con la cartola */
  //}

  const vistos = new Set<string>();
  p.beneficiarios.forEach((b, i) => {
    const base = `beneficiarios.${i}`;
    const rutNorm = b.rut.replace(/[^0-9kK]/g, "").toUpperCase();
    if (vistos.has(rutNorm)) errores[`${base}.rut`] = "Este RUT está repetido en el formulario";
    vistos.add(rutNorm);

    if (b.tipo === "nino") {
      if (!b.fechaNacimiento || !esFechaIso(b.fechaNacimiento)) {
        errores[`${base}.fechaNacimiento`] = "Ingrese la fecha de nacimiento";
      } else if (b.fechaNacimiento > ctx.hoy) {
        errores[`${base}.fechaNacimiento`] = "La fecha de nacimiento no puede ser futura";
      } else if (!esElegiblePorEdad(b.fechaNacimiento, ctx.fechaReferencia)) {
        errores[`${base}.fechaNacimiento`] =
          "No cumple el requisito de edad: se entrega hasta los 4 años, 11 meses y 30 días";
      }
      if (!b.sexo) errores[`${base}.sexo`] = "Seleccione niña o niño";
      if (!b.documentoIdentidad) errores[`${base}.documentoIdentidad`] = "Indique con qué documento se identifica";
    } else if (b.fechaProbableParto) {
      if (!esFechaIso(b.fechaProbableParto)) errores[`${base}.fechaProbableParto`] = "Fecha inválida";
    }

    if (ctx.canal === "online") {
      for (const tipo of docsRequeridosBeneficiario(b.tipo, b.documentoIdentidad)) {
        if (!b.docs?.[tipo]?.length) errores[`${base}.docs.${tipo}`] = "Falta adjuntar este documento";
      }
    }
  });

  if (ctx.canal === "online") {
    for (const tipo of docsRequeridosHogar(p.residenciaCon)) {
      if (!p.docsHogar?.[tipo]?.length) errores[`docsHogar.${tipo}`] = "Falta adjuntar este documento";
    }
  }
  return errores;
}

export function erroresZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const ruta = issue.path.join(".");
    if (!(ruta in out)) out[ruta] = issue.message;
  }
  return out;
}

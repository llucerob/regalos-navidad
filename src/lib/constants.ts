import type { Estado, TipoDoc, Rol, Canal } from "./types";

export const NOMBRE_INSTITUCION = "Ilustre Municipalidad de Coinco";
export const ZONA_HORARIA = "America/Santiago";

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  recibida: "Recibida",
  en_revision: "En revisión",
  observada: "Observada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export const DESCRIPCION_ESTADO: Record<Estado, string> = {
  recibida: "Recibimos su inscripción. Un funcionario revisará los documentos.",
  en_revision: "Un funcionario está revisando sus documentos.",
  observada: "Falta corregir o completar algo. Revise el mensaje y envíe los documentos.",
  aprobada: "Su inscripción fue aprobada. Los regalos se entregarán en diciembre.",
  rechazada: "Su inscripción no cumple los requisitos. Revise el motivo indicado.",
};

// Colores de estado dentro de la paleta institucional
export const COLOR_ESTADO: Record<Estado, string> = {
  recibida: "bg-coinco-celeste/20 text-coinco-azul ring-coinco-celeste/60",
  en_revision: "bg-coinco-amarillo/25 text-coinco-azul ring-coinco-amarillo/70",
  observada: "bg-coinco-amarillo text-coinco-azul ring-coinco-amarillo",
  aprobada: "bg-coinco-verde/15 text-[#00694a] ring-coinco-verde/50",
  rechazada: "bg-coinco-rojo/15 text-[#b3202f] ring-coinco-rojo/50",
};

export const ETIQUETA_DOC: Record<TipoDoc, string> = {
  cedula: "Cédula de identidad",
  certificado_nacimiento: "Certificado de nacimiento",
  carnet_control_sano: "Carnet de control sano",
  carnet_control_embarazo: "Carnet de control de embarazo",
  cartola_rsh: "Cartola del Registro Social de Hogares",
  certificado_residencia: "Certificado de residencia (Junta de Vecinos)",
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  revisor: "Revisor",
  digitador: "Digitador (registro presencial)",
};

export const ETIQUETA_CANAL: Record<Canal, string> = {
  online: "En línea",
  presencial: "Presencial",
};

export const OPCIONES_TRAMO = [
  { valor: "hasta_40", texto: "Mi hogar está en el tramo del 40% o menos" },
  { valor: "no_sabe", texto: "No estoy seguro(a) / lo verifica el funcionario con mi cartola" },
  { valor: "superior", texto: "Mi hogar está en un tramo superior al 40%" },
] as const;

// Embarazo múltiple: cuántos regalos de recién nacido reservar por esa inscripción.
export const MAX_BEBES_ESPERADOS = 4;
export const ETIQUETA_BEBES_ESPERADOS: Record<number, string> = {
  1: "Uno",
  2: "Mellizos o gemelos",
  3: "Trillizos",
  4: "4 o más",
};
export const OPCIONES_BEBES_ESPERADOS = [1, 2, 3, 4].map((n) => ({ valor: n, texto: ETIQUETA_BEBES_ESPERADOS[n] }));

// Archivos
export const TIPOS_MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const TAMANO_MAX_ARCHIVO = 5 * 1024 * 1024; // 5 MB (el bucket admite hasta 6 MB)
export const MAX_ARCHIVOS_POR_DOCUMENTO = 3;
export const MAX_BENEFICIARIOS_POR_FORMULARIO = 6;
export const BUCKET_DOCUMENTOS = "documentos";

// Checklist del revisor (claves guardadas en inscripciones.checklist)
export const CHECKLIST_ITEMS = [
  { clave: "residencia", texto: "La residencia en Coinco está acreditada (cartola RSH o certificado de la Junta de Vecinos)" },
  { clave: "tramo", texto: "La cartola muestra el tramo del 40% o menos" },
  { clave: "identidad", texto: "Las cédulas / certificados de nacimiento y carnets corresponden a los beneficiarios" },
  { clave: "edad", texto: "Los niños y niñas tienen hasta 4 años, 11 meses y 30 días a la fecha de referencia" },
] as const;

export const CONTACTO_TELEFONO = process.env.NEXT_PUBLIC_CONTACTO_TELEFONO ?? "";
export const CONTACTO_HORARIO = process.env.NEXT_PUBLIC_CONTACTO_HORARIO ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

import type { TipoBeneficiario, TipoDoc } from "./types";

/** Documentos que debe presentar cada beneficiario según las bases. */
export function docsRequeridosBeneficiario(
  tipo: TipoBeneficiario,
  documentoIdentidad?: "cedula" | "certificado_nacimiento" | null,
): TipoDoc[] {
  if (tipo === "gestante") return ["cedula", "carnet_control_embarazo"];
  return [documentoIdentidad === "certificado_nacimiento" ? "certificado_nacimiento" : "cedula", "carnet_control_sano"];
}

/** Documentos del hogar. La cartola siempre se pide: con ella se verifica el tramo del 40%. */
export function docsRequeridosHogar(residenciaCon: "rsh" | "certificado_jv"): TipoDoc[] {
  return residenciaCon === "certificado_jv" ? ["cartola_rsh", "certificado_residencia"] : ["cartola_rsh"];
}

export type Estado = "recibida" | "en_revision" | "observada" | "aprobada" | "rechazada";
export type Canal = "online" | "presencial";
export type Rol = "admin" | "revisor" | "digitador";
export type TipoBeneficiario = "nino" | "gestante";
export type Sexo = "F" | "M" | "otro";
export type TipoDoc =
  | "cedula"
  | "certificado_nacimiento"
  | "carnet_control_sano"
  | "carnet_control_embarazo"
  | "cartola_rsh"
  | "certificado_residencia";
export type TipoCorreo = "comprobante" | "observada" | "aprobada" | "rechazada" | "aviso_entrega";

export interface Campana {
  id: string;
  anio: number;
  nombre: string;
  decreto: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_entrega: string | null;
  fecha_referencia_edad: string;
  activa: boolean;
}

export interface Sector {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

export interface Inscripcion {
  id: string;
  folio: string;
  campana_id: string;
  canal: Canal;
  estado: Estado;
  apoderado_rut: string;
  apoderado_nombres: string;
  apoderado_apellidos: string;
  apoderado_telefono: string;
  apoderado_email: string | null;
  direccion: string;
  sector_id: string | null;
  residencia_acreditada_con: "rsh" | "certificado_jv";
  tramo_declarado: "hasta_40" | "no_sabe";
  observacion: string | null;
  checklist: Record<string, boolean>;
  revisado_por: string | null;
  revisado_at: string | null;
  creado_por: string | null;
  acepta_datos: boolean;
  created_at: string;
  updated_at: string;
}

export interface Beneficiario {
  id: string;
  inscripcion_id: string;
  campana_id: string;
  tipo: TipoBeneficiario;
  rut: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: Sexo | null;
  documento_identidad: "cedula" | "certificado_nacimiento" | null;
  fecha_probable_parto: string | null;
  activo: boolean;
  entregado_at: string | null;
  entregado_por: string | null;
}

export interface Documento {
  id: string;
  inscripcion_id: string;
  beneficiario_id: string | null;
  tipo: TipoDoc;
  storage_path: string;
  nombre_original: string | null;
  mime: string | null;
  tamano: number | null;
  origen: "apoderado" | "funcionario";
  created_at: string;
}

export interface Perfil {
  user_id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
}

/** Referencia a un archivo ya subido a Storage (carga directa con URL firmada). */
export interface ArchivoRef {
  path: string;
  nombre: string;
  mime: string;
  tamano: number;
}

export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string; campos?: Record<string, string> };

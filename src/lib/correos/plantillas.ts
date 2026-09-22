import { SITE_URL, NOMBRE_INSTITUCION, CONTACTO_TELEFONO } from "../constants";
import type { TipoCorreo } from "../types";

export interface DatosCorreo {
  nombreApoderado: string;
  folio?: string;
  campanaNombre: string;
  beneficiarios?: { nombre: string; tipo: "nino" | "gestante" }[];
  observacion?: string | null;
  mensaje?: string; // aviso masivo
  fechaEntrega?: string;
  lugarEntrega?: string;
  horarioEntrega?: string;
}

export const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");

const AZUL = "#003169";
const AMARILLO = "#ffba2f";
const CELESTE = "#00ceff";
const VERDE = "#00a87a";
const ROJO = "#ff4153";

function boton(texto: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:${AZUL};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:15px">${esc(texto)}</a>`;
}

function caja(color: string, html: string) {
  return `<div style="border-left:4px solid ${color};background:#f5f8fc;padding:12px 16px;margin:16px 0;border-radius:4px;color:#1b2b40;font-size:15px;line-height:1.5">${html}</div>`;
}

function listaBeneficiarios(b?: DatosCorreo["beneficiarios"]) {
  if (!b?.length) return "";
  const items = b
    .map((x) => `<li style="margin:2px 0">${esc(x.nombre)} <span style="color:#5b6b80">(${x.tipo === "gestante" ? "madre en gestación" : "niño/a"})</span></li>`)
    .join("");
  return `<p style="margin:16px 0 4px;font-weight:700;color:${AZUL}">Beneficiarios inscritos</p><ul style="margin:0;padding-left:20px;color:#1b2b40;font-size:15px">${items}</ul>`;
}

function layout(titulo: string, cuerpo: string) {
  const logo = `${SITE_URL}/logo-horizontal-blanco.png`;
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${AZUL};padding:20px 28px"><img src="${logo}" alt="${NOMBRE_INSTITUCION}" height="52" style="display:block;height:52px;width:auto;border:0"></td></tr>
<tr><td style="height:5px;background:${AMARILLO};line-height:5px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${AZUL}">${esc(titulo)}</h1>
${cuerpo}
</td></tr>
<tr><td style="padding:18px 28px;background:#f5f8fc;color:#5b6b80;font-size:12px;line-height:1.5">
${NOMBRE_INSTITUCION} · Agua del Arenal${CONTACTO_TELEFONO ? `<br>Consultas: ${esc(CONTACTO_TELEFONO)}` : ""}<br>
Este mensaje se envió porque se usó su correo en una inscripción a los Regalos de Navidad. Puede responder a este correo si necesita ayuda.
</td></tr>
</table></td></tr></table></body></html>`;
}

export function armarCorreo(tipo: TipoCorreo, d: DatosCorreo): { asunto: string; html: string } {
  const saludo = `<p style="margin:0 0 12px;color:#1b2b40;font-size:15px;line-height:1.5">Hola ${esc(d.nombreApoderado)},</p>`;
  const urlConsulta = `${SITE_URL}/consulta${d.folio ? `?folio=${encodeURIComponent(d.folio)}` : ""}`;
  const folioTxt = d.folio ? ` (Folio ${d.folio})` : "";
  const p = (t: string) => `<p style="margin:0 0 12px;color:#1b2b40;font-size:15px;line-height:1.5">${t}</p>`;

  switch (tipo) {
    case "comprobante":
      return {
        asunto: `Comprobante de inscripción · ${d.campanaNombre}${folioTxt}`,
        html: layout(
          "Recibimos su inscripción",
          saludo +
            p(`Su inscripción a <b>${esc(d.campanaNombre)}</b> fue recibida correctamente.`) +
            caja(CELESTE, `<b>N° de folio: ${esc(d.folio ?? "")}</b><br>Guárdelo: lo necesitará para consultar el estado de su inscripción.`) +
            listaBeneficiarios(d.beneficiarios) +
            p(`<br>Un funcionario municipal revisará los documentos presentados. Le avisaremos por este mismo correo si su inscripción es aprobada o si necesitamos que corrija o complete algo.`) +
            `<p style="margin:20px 0 0">${boton("Consultar estado", urlConsulta)}</p>`,
        ),
      };
    case "observada":
      return {
        asunto: `Su inscripción necesita correcciones${folioTxt}`,
        html: layout(
          "Necesitamos que corrija o complete su inscripción",
          saludo +
            p(`Revisamos su inscripción a <b>${esc(d.campanaNombre)}</b> y hay algo que debe corregir o completar:`) +
            caja(AMARILLO, esc(d.observacion ?? "Revise los documentos presentados.")) +
            p(`Puede enviar los documentos desde el sistema o acercarse a la Municipalidad de Coinco. Recuerde que las inscripciones tienen un plazo de cierre.`) +
            `<p style="margin:20px 0 0">${boton("Corregir mi inscripción", urlConsulta)}</p>`,
        ),
      };
    case "aprobada":
      return {
        asunto: `Inscripción aprobada · ${d.campanaNombre}${folioTxt}`,
        html: layout(
          "¡Su inscripción fue aprobada!",
          saludo +
            p(`Su inscripción a <b>${esc(d.campanaNombre)}</b> quedó <b style="color:${VERDE}">aprobada</b>.`) +
            listaBeneficiarios(d.beneficiarios) +
            p(`<br>Los regalos se entregarán en diciembre. Le informaremos la fecha, el lugar y el horario por este mismo medio.`) +
            `<p style="margin:20px 0 0">${boton("Ver mi inscripción", urlConsulta)}</p>`,
        ),
      };
    case "rechazada":
      return {
        asunto: `Resultado de su inscripción${folioTxt}`,
        html: layout(
          "Su inscripción no pudo ser aprobada",
          saludo +
            p(`Revisamos su inscripción a <b>${esc(d.campanaNombre)}</b> y, lamentablemente, no cumple los requisitos:`) +
            caja(ROJO, esc(d.observacion ?? "No cumple los requisitos establecidos.")) +
            p(`Si cree que hay un error, puede acercarse a la Municipalidad de Coinco o responder a este correo.`),
        ),
      };
    case "aviso_entrega": {
      const filas = [
        d.fechaEntrega ? `<b>Fecha:</b> ${esc(d.fechaEntrega)}` : "",
        d.horarioEntrega ? `<b>Horario:</b> ${esc(d.horarioEntrega)}` : "",
        d.lugarEntrega ? `<b>Lugar:</b> ${esc(d.lugarEntrega)}` : "",
      ].filter(Boolean);
      return {
        asunto: `Entrega de Regalos de Navidad · ${d.campanaNombre}`,
        html: layout(
          "Información sobre la entrega de regalos",
          saludo +
            (filas.length ? caja(VERDE, filas.join("<br>")) : "") +
            p(esc(d.mensaje ?? "")),
        ),
      };
    }
  }
}

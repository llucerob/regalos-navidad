import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporte: Transporter | null = null;

export function correoConfigurado(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/**
 * SMTP de Google Workspace con contraseña de aplicación (requiere verificación en dos pasos
 * activa en la cuenta remitente). Puerto 465 con SSL.
 */
export function obtenerTransporte(): Transporter {
  if (transporte) return transporte;
  if (!correoConfigurado()) throw new Error("Correo no configurado: falta GMAIL_USER o GMAIL_APP_PASSWORD.");
  transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "") },
  });
  return transporte;
}

export function remitente(): string {
  const nombre = (process.env.MAIL_FROM_NAME ?? "Municipalidad de Coinco").replace(/"/g, "");
  return `"${nombre}" <${process.env.GMAIL_USER}>`;
}

export function responderA(): string | undefined {
  return process.env.MAIL_REPLY_TO || undefined;
}

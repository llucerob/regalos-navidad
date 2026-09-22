import type { Metadata } from "next";
import { Alerta, AvisoUrl, Boton, Tarjeta, Titulo } from "@/components/ui";
import { Campo, Entrada } from "@/components/campos";
import { requerirStaff } from "@/lib/auth";
import { resolverCampana } from "@/lib/datos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { correoConfigurado } from "@/lib/correos/transport";
import { formatearFechaHora } from "@/lib/fechas";
import { encolarAvisoEntrega, probarCorreo, procesarCorreos, reintentarCorreo } from "@/actions/admin";

export const metadata: Metadata = { title: "Correos" };

const COLOR = { enviado: "text-[#00694a]", pendiente: "text-[#7a5200]", error: "text-[#b3202f]" } as const;

export default async function Correos({ searchParams }: { searchParams: Promise<{ msg?: string; tipo?: string }> }) {
  const staff = await requerirStaff(["admin"]);
  const sp = await searchParams;
  const campana = await resolverCampana();
  const db = supabaseAdmin();
  const [{ data: filas }, pend, err, ok] = await Promise.all([
    db.from("correos_log").select("*").order("created_at", { ascending: false }).limit(60),
    db.from("correos_log").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    db.from("correos_log").select("id", { count: "exact", head: true }).eq("estado", "error"),
    db.from("correos_log").select("id", { count: "exact", head: true }).eq("estado", "enviado"),
  ]);
  const configurado = correoConfigurado();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <Titulo sub="Comprobantes y avisos que el sistema envía desde la cuenta de Google Workspace configurada.">Correos</Titulo>

      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-bold text-coinco-azul">Cuenta de envío</p>
            {configurado
              ? <p className="text-sm text-slate-600">Configurada: <b>{process.env.GMAIL_USER}</b> (contraseña de aplicación)</p>
              : <p className="text-sm font-semibold text-[#b3202f]">No configurada. Defina GMAIL_USER y GMAIL_APP_PASSWORD en las variables de entorno.</p>}
          </div>
          <form action={probarCorreo} className="flex flex-wrap items-end gap-2">
            <Campo id="prueba" etiqueta="Enviar prueba a"><Entrada id="prueba" name="destino" type="email" defaultValue={staff.email ?? ""} required /></Campo>
            <Boton variante="secundario" className="min-h-11">Enviar prueba</Boton>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>Enviados: <b className={COLOR.enviado}>{ok.count ?? 0}</b></span>
          <span>Pendientes: <b className={COLOR.pendiente}>{pend.count ?? 0}</b></span>
          <span>Con error: <b className={COLOR.error}>{err.count ?? 0}</b></span>
          <form action={procesarCorreos} className="ml-auto"><Boton variante="primario" className="min-h-10">Procesar pendientes y errores</Boton></form>
        </div>
        <p className="mt-2 text-xs text-slate-500">Cada correo con error se reintenta hasta 3 veces. También puede automatizarlo llamando a /api/correos/procesar desde un cron (ver README).</p>
      </Tarjeta>

      {campana && (
        <Tarjeta>
          <h2 className="mb-1 font-bold text-coinco-azul">Aviso de entrega (masivo)</h2>
          <p className="mb-3 text-sm text-slate-600">Se encola un correo para el adulto responsable de cada inscripción <b>aprobada</b> de {campana.nombre} que tenga correo (uno por dirección). Luego use “Procesar pendientes” para enviarlos en tandas.</p>
          <form action={encolarAvisoEntrega} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="campanaId" value={campana.id} />
            <Campo id="av-fecha" etiqueta="Fecha"><Entrada id="av-fecha" name="fecha" placeholder="Ej.: sábado 13 de diciembre" /></Campo>
            <Campo id="av-hora" etiqueta="Horario"><Entrada id="av-hora" name="horario" placeholder="Ej.: 10:00 a 13:00 hrs" /></Campo>
            <Campo id="av-lugar" etiqueta="Lugar"><Entrada id="av-lugar" name="lugar" placeholder="Ej.: Gimnasio Municipal" /></Campo>
            <div className="sm:col-span-3">
              <label htmlFor="av-msg" className="mb-1 block text-sm font-semibold text-coinco-azul">Mensaje <span className="text-coinco-rojo">*</span></label>
              <textarea id="av-msg" name="mensaje" rows={4} required minLength={10} className="w-full rounded-lg border border-slate-300 p-3" placeholder="Ej.: Recuerde presentar su cédula de identidad al retirar los regalos." />
            </div>
            <div className="sm:col-span-3"><Boton variante="acento">Encolar aviso</Boton></div>
          </form>
        </Tarjeta>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-coinco-azul text-left text-xs uppercase text-white"><tr><th className="px-4 py-3">Fecha</th><th>Tipo</th><th>Destinatario</th><th>Asunto</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {(filas ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Todavía no se han enviado correos.</td></tr>}
            {(filas ?? []).map((f) => (
              <tr key={f.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2.5 whitespace-nowrap">{formatearFechaHora(f.created_at)}</td>
                <td>{String(f.tipo).replace("_", " ")}</td>
                <td className="max-w-48 truncate">{f.destinatario}</td>
                <td className="max-w-64 truncate">{f.asunto}</td>
                <td className={`font-bold ${COLOR[f.estado as keyof typeof COLOR]}`}>{f.estado}{f.ultimo_error && <span className="block max-w-56 truncate text-xs font-normal text-slate-500" title={f.ultimo_error}>{f.ultimo_error}</span>}</td>
                <td className="pr-3 text-right">
                  {f.estado !== "enviado" && (
                    <form action={reintentarCorreo}><input type="hidden" name="id" value={f.id} /><button className="font-bold text-coinco-azul underline">Reintentar</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!configurado && <Alerta tipo="aviso">Sin la cuenta de correo configurada, los correos quedan registrados con error y se pueden reenviar más tarde.</Alerta>}
    </div>
  );
}

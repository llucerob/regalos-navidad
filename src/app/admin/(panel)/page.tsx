import Link from "next/link";
import type { Metadata } from "next";
import { Alerta, Tarjeta, Titulo } from "@/components/ui";
import { SelectorCampana } from "@/components/SelectorCampana";
import { requerirStaff } from "@/lib/auth";
import { estadisticas, resolverCampana } from "@/lib/datos";
import { estadoCampana, formatearFecha } from "@/lib/fechas";
import { COLOR_ESTADO, ETIQUETA_ESTADO } from "@/lib/constants";
import type { Estado } from "@/lib/types";

export const metadata: Metadata = { title: "Resumen" };

const ORDEN: Estado[] = ["recibida", "en_revision", "observada", "aprobada", "rechazada"];
const ETIQUETA_ESTADO_CAMPANA = { abierta: "Abierta", proxima: "Aún no comienza", cerrada: "Cerrada", inactiva: "Inactiva" } as const;

export default async function Resumen({ searchParams }: { searchParams: Promise<{ campana?: string; sin_permiso?: string }> }) {
  await requerirStaff();
  const sp = await searchParams;
  const campana = await resolverCampana(sp.campana);
  if (!campana) {
    return (
      <>
        <Titulo>Resumen</Titulo>
        <Alerta tipo="aviso">No hay campañas creadas. Un administrador debe crear una en “Campañas”.</Alerta>
      </>
    );
  }
  const st = await estadisticas(campana);
  const pendientes = st.porEstado.recibida + st.porEstado.en_revision;
  const totalBenef = st.ninos + st.gestantes;
  const maxSector = Math.max(1, ...st.porSector.map((s) => s.beneficiarios));

  return (
    <>
      {sp.sin_permiso && <Alerta tipo="aviso" className="mb-4">No tiene permiso para acceder a esa sección.</Alerta>}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Titulo sub={`Inscripciones del ${formatearFecha(campana.fecha_inicio)} al ${formatearFecha(campana.fecha_fin)} · Estado: ${ETIQUETA_ESTADO_CAMPANA[estadoCampana(campana)]}`}>
          {campana.nombre}
        </Titulo>
        <SelectorCampana actualId={campana.id} />
      </div>

      {pendientes > 0 && (
        <Alerta tipo="aviso" className="mb-5">
          <b>{pendientes}</b> {pendientes === 1 ? "inscripción espera" : "inscripciones esperan"} revisión.{" "}
          <Link className="font-bold underline" href={`/admin/inscripciones?campana=${campana.id}&estado=recibida`}>Ver pendientes</Link>
        </Alerta>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {ORDEN.map((e) => (
          <Link key={e} href={`/admin/inscripciones?campana=${campana.id}&estado=${e}`}
            className={`rounded-2xl p-4 ring-1 ring-inset transition hover:brightness-95 ${COLOR_ESTADO[e]}`}>
            <p className="text-3xl font-extrabold">{st.porEstado[e]}</p>
            <p className="text-sm font-semibold">{ETIQUETA_ESTADO[e]}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Tarjeta>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total de inscripciones</p>
          <p className="text-4xl font-extrabold text-coinco-azul">{st.totalInscripciones}</p>
          <p className="mt-1 text-sm text-slate-600">En línea: <b>{st.porCanal.online}</b> · Presenciales: <b>{st.porCanal.presencial}</b></p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Beneficiarios (sin rechazadas)</p>
          <p className="text-4xl font-extrabold text-coinco-azul">{totalBenef}</p>
          <p className="mt-1 text-sm text-slate-600">Niñas y niños: <b>{st.ninos}</b> · Madres gestantes: <b>{st.gestantes}</b></p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Entregas registradas</p>
          <p className="text-4xl font-extrabold text-coinco-azul">{st.entregados}</p>
          <p className="mt-1 text-sm text-slate-600">Se registran en la sección “Entrega”.</p>
        </Tarjeta>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="mb-1 font-bold text-coinco-azul">Niñas y niños por edad</h2>
          <p className="mb-3 text-xs text-slate-500">Edad al {formatearFecha(campana.fecha_referencia_edad)} (fecha de referencia). Útil para planificar la compra.</p>
          {st.porEdad.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay niñas ni niños inscritos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="py-2">Edad</th><th className="text-right">Niñas</th><th className="text-right">Niños</th><th className="text-right">Otro</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {st.porEdad.map((r) => (
                    <tr key={r.etiqueta} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{r.etiqueta}</td><td className="text-right">{r.F}</td><td className="text-right">{r.M}</td><td className="text-right">{r.otro}</td><td className="text-right font-bold">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-3 font-bold text-coinco-azul">Beneficiarios por sector</h2>
          {st.porSector.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos todavía.</p>
          ) : (
            <ul className="space-y-2.5">
              {st.porSector.map((s) => (
                <li key={s.sector}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{s.sector}</span><span className="font-bold">{s.beneficiarios}</span></div>
                  <div className="mt-1 h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-coinco-azul" style={{ width: `${(s.beneficiarios / maxSector) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

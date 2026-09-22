import Link from "next/link";
import type { Metadata } from "next";
import { AvisoUrl, InsigniaEstado, Tarjeta, Titulo, claseBoton } from "@/components/ui";
import { SelectorCampana } from "@/components/SelectorCampana";
import { requerirStaff } from "@/lib/auth";
import { listarInscripciones, listarSectores, resolverCampana } from "@/lib/datos";
import { formatearFechaHora } from "@/lib/fechas";
import { formatearRut } from "@/lib/rut";
import { ETIQUETA_CANAL, ETIQUETA_ESTADO } from "@/lib/constants";
import type { Canal, Estado } from "@/lib/types";

export const metadata: Metadata = { title: "Inscripciones" };

type SP = { campana?: string; estado?: string; canal?: string; sector?: string; q?: string; pagina?: string; msg?: string; tipo?: string };
const ESTADOS = Object.keys(ETIQUETA_ESTADO) as Estado[];

export default async function ListaInscripciones({ searchParams }: { searchParams: Promise<SP> }) {
  await requerirStaff();
  const sp = await searchParams;
  const campana = await resolverCampana(sp.campana);
  if (!campana) return <Titulo>No hay campañas</Titulo>;

  const estado = ESTADOS.includes(sp.estado as Estado) ? (sp.estado as Estado) : undefined;
  const canal = sp.canal === "online" || sp.canal === "presencial" ? (sp.canal as Canal) : undefined;
  const pagina = Math.max(Number(sp.pagina) || 1, 1);
  const [{ filas, total, porPagina }, sectores] = await Promise.all([
    listarInscripciones({ campanaId: campana.id, estado, canal, sectorId: sp.sector || undefined, q: sp.q, pagina }),
    listarSectores(),
  ]);
  const paginas = Math.max(Math.ceil(total / porPagina), 1);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ campana: campana.id });
    for (const k of ["estado", "canal", "sector", "q"] as const) if (sp[k]) p.set(k, sp[k]!);
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return `/admin/inscripciones?${p}`;
  };

  return (
    <>
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Titulo sub={`${total} ${total === 1 ? "resultado" : "resultados"}`}>Inscripciones</Titulo>
        <SelectorCampana actualId={campana.id} ocultos={{ estado: sp.estado, canal: sp.canal, sector: sp.sector, q: sp.q }} />
      </div>

      <Tarjeta className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input type="hidden" name="campana" value={campana.id} />
          <input name="q" defaultValue={sp.q} placeholder="Buscar por RUT, nombre o folio" aria-label="Buscar" className="min-h-11 rounded-lg border border-slate-300 px-3" />
          <select name="estado" defaultValue={estado ?? ""} aria-label="Estado" className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
          </select>
          <select name="canal" defaultValue={canal ?? ""} aria-label="Canal" className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
            <option value="">Todos los canales</option>
            <option value="online">En línea</option>
            <option value="presencial">Presencial</option>
          </select>
          <select name="sector" defaultValue={sp.sector ?? ""} aria-label="Sector" className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
            <option value="">Todos los sectores</option>
            {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button className={claseBoton("primario")}>Filtrar</button>
        </form>
      </Tarjeta>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-coinco-azul text-left text-xs uppercase tracking-wide text-white">
            <tr><th className="px-4 py-3">Folio</th><th>Adulto responsable</th><th>Beneficiarios</th><th>Sector</th><th>Canal</th><th>Estado</th><th /></tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No hay inscripciones con esos filtros.</td></tr>}
            {filas.map((f) => {
              const benef = f.beneficiarios.filter((b) => b.activo || f.estado === "rechazada");
              return (
                <tr key={f.id} className="border-t border-slate-100 align-top hover:bg-coinco-fondo/60">
                  <td className="px-4 py-3"><p className="font-bold text-coinco-azul">{f.folio}</p><p className="text-xs text-slate-500">{formatearFechaHora(f.created_at)}</p></td>
                  <td className="py-3 pr-3"><p className="font-semibold">{f.apoderado_nombres} {f.apoderado_apellidos}</p><p className="text-xs text-slate-500">{formatearRut(f.apoderado_rut)}</p></td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{benef.length}</p>
                    <p className="max-w-56 truncate text-xs text-slate-500">{benef.map((b) => b.nombres.split(" ")[0]).join(", ")}</p>
                  </td>
                  <td className="py-3 pr-3">{f.sectores?.nombre ?? "—"}</td>
                  <td className="py-3 pr-3">{ETIQUETA_CANAL[f.canal]}</td>
                  <td className="py-3 pr-3"><InsigniaEstado estado={f.estado} /></td>
                  <td className="py-3 pr-4 text-right"><Link href={`/admin/inscripciones/${f.id}`} className="font-bold text-coinco-azul underline">Abrir</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          {pagina > 1 ? <Link className={claseBoton("secundario")} href={qs({ pagina: pagina - 1 })}>← Anterior</Link> : <span />}
          <span className="text-slate-600">Página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link className={claseBoton("secundario")} href={qs({ pagina: pagina + 1 })}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

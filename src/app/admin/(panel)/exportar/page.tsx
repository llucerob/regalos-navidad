import type { Metadata } from "next";
import { Alerta, Tarjeta, Titulo, claseBoton } from "@/components/ui";
import { SelectorCampana } from "@/components/SelectorCampana";
import { requerirStaff } from "@/lib/auth";
import { estadisticas, resolverCampana } from "@/lib/datos";
import { estadoCampana, formatearFecha, hoyChile } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/lib/constants";
import type { Estado } from "@/lib/types";

export const metadata: Metadata = { title: "Exportar inscritos" };
const ESTADOS: Estado[] = ["aprobada", "recibida", "en_revision", "observada", "rechazada"];

export default async function Exportar({ searchParams }: { searchParams: Promise<{ campana?: string }> }) {
  await requerirStaff(["admin"]);
  const { campana: id } = await searchParams;
  const campana = await resolverCampana(id);
  if (!campana) return <Titulo>No hay campañas</Titulo>;
  const st = await estadisticas(campana);
  const abierta = estadoCampana(campana) === "abierta";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Titulo sub="Descargue el conglomerado de inscritos para la compra y la entrega.">Exportar inscritos</Titulo>
        <SelectorCampana actualId={campana.id} />
      </div>

      {abierta && (
        <Alerta tipo="aviso" className="mb-4">
          La inscripción sigue abierta hasta el {formatearFecha(campana.fecha_fin)}: la exportación refleja los datos de este momento. Para el proceso de compra, exporte después del cierre y con todas las inscripciones ya revisadas.
        </Alerta>
      )}
      {st.porEstado.recibida + st.porEstado.en_revision > 0 && (
        <Alerta tipo="aviso" className="mb-4">
          Hay <b>{st.porEstado.recibida + st.porEstado.en_revision}</b> inscripciones sin revisar. Por defecto solo se exportan las <b>aprobadas</b>.
        </Alerta>
      )}

      <Tarjeta>
        <form action="/api/exportar" method="get" className="space-y-5">
          <input type="hidden" name="campana" value={campana.id} />
          <fieldset>
            <legend className="mb-2 font-bold text-coinco-azul">¿Qué inscripciones incluir?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ESTADOS.map((e) => (
                <label key={e} className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-slate-200 px-3 py-2.5 has-[:checked]:border-coinco-azul has-[:checked]:bg-coinco-azul/5">
                  <input type="checkbox" name="estados" value={e} defaultChecked={e === "aprobada"} className="size-5 accent-[#003169]" />
                  <span className="font-semibold">{ETIQUETA_ESTADO[e]}</span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{st.porEstado[e]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-bold text-coinco-azul">Formato</legend>
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="formato" value="xlsx" defaultChecked className="accent-[#003169]" /> Excel (.xlsx) con 4 hojas</label>
              <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="formato" value="csv" className="accent-[#003169]" /> CSV (solo listado)</label>
            </div>
          </fieldset>
          <button className={claseBoton("acento", "px-7")}>Descargar</button>
        </form>
      </Tarjeta>

      <Tarjeta className="mt-5">
        <h2 className="mb-2 font-bold text-coinco-azul">Qué contiene el Excel</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px] text-slate-700">
          <li><b>Inscritos:</b> una fila por beneficiario, con datos del adulto responsable, dirección, sector y edad al {formatearFecha(campana.fecha_referencia_edad)}.</li>
          <li><b>Resumen compra:</b> cantidad de niñas y niños por edad y sexo, y de madres gestantes.</li>
          <li><b>Por sector:</b> inscripciones y beneficiarios por sector o Junta de Vecinos.</li>
          <li><b>Lista de entrega:</b> ordenada por sector, con columna para nombre y firma de quien retira.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">Hoy: {formatearFecha(hoyChile())}. El archivo contiene datos personales: guárdelo en un lugar seguro y no lo comparta por canales abiertos.</p>
      </Tarjeta>
    </div>
  );
}

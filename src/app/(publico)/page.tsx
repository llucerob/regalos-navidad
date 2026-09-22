import { EnlaceBoton, Tarjeta, Alerta } from "@/components/ui";
import { campanaActiva } from "@/lib/datos";
import { estadoCampana, formatearFechaLarga } from "@/lib/fechas";
import { CONTACTO_HORARIO, CONTACTO_TELEFONO } from "@/lib/constants";
import type { Campana } from "@/lib/types";

export const dynamic = "force-dynamic";

const ESTADO_TEXTO = {
  abierta: { texto: "Inscripciones abiertas", clase: "bg-coinco-verde text-white" },
  proxima: { texto: "Próximamente", clase: "bg-coinco-amarillo text-coinco-azul" },
  cerrada: { texto: "Inscripciones cerradas", clase: "bg-coinco-rojo text-white" },
  inactiva: { texto: "Sin campaña activa", clase: "bg-white/20 text-white" },
} as const;

export default async function Portada() {
  let campana: Campana | null = null;
  try {
    campana = await campanaActiva();
  } catch {
    campana = null;
  }
  const estado = campana ? estadoCampana(campana) : "inactiva";
  const abierta = estado === "abierta";

  return (
    <>
      <section className="bg-coinco-azul text-white">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:pt-14">
          <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${ESTADO_TEXTO[estado].clase}`}>
            {ESTADO_TEXTO[estado].texto}
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Regalos de Navidad <span className="text-coinco-amarillo">{campana?.anio ?? ""}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90">
            Inscripción para madres en proceso de gestación, niñas y niños de la comuna de Coinco.
          </p>
          {campana && (
            <p className="mt-3 text-white/80">
              Inscripciones del <b className="text-white">{formatearFechaLarga(campana.fecha_inicio)}</b> al{" "}
              <b className="text-white">{formatearFechaLarga(campana.fecha_fin)}</b>. Entrega en diciembre.
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {abierta && <EnlaceBoton href="/inscripcion" variante="acento" className="px-7 py-3 text-base">Inscribir ahora</EnlaceBoton>}
            <EnlaceBoton href="/consulta" variante="blanco" className="px-7 py-3 text-base">
              Consultar mi inscripción
            </EnlaceBoton>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        {!abierta && (
          <Alerta tipo="aviso">
            {estado === "proxima" && "Las inscripciones aún no comienzan. Vuelva en la fecha indicada."}
            {estado === "cerrada" && "El período de inscripción ya terminó. Si ya se inscribió, puede consultar el estado de su inscripción."}
            {estado === "inactiva" && "En este momento no hay una campaña de inscripción activa."}
          </Alerta>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-extrabold text-coinco-azul">¿Quiénes pueden inscribirse?</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tarjeta>
              <p className="text-3xl" aria-hidden>🤰</p>
              <h3 className="mt-2 font-bold text-coinco-azul">Madres en proceso de gestación</h3>
              <p className="mt-1 text-sm text-slate-600">Con carnet de control de embarazo al día.</p>
            </Tarjeta>
            <Tarjeta>
              <p className="text-3xl" aria-hidden>🧒</p>
              <h3 className="mt-2 font-bold text-coinco-azul">Niñas y niños</h3>
              <p className="mt-1 text-sm text-slate-600">Hasta 4 años, 11 meses y 30 días. Con carnet de control sano.</p>
            </Tarjeta>
            <Tarjeta>
              <p className="text-3xl" aria-hidden>🏠</p>
              <h3 className="mt-2 font-bold text-coinco-azul">Residentes de Coinco</h3>
              <p className="mt-1 text-sm text-slate-600">Hogares del tramo del 40% del Registro Social de Hogares.</p>
            </Tarjeta>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-extrabold text-coinco-azul">Qué necesita para inscribirse</h2>
          <Tarjeta>
            <ul className="space-y-3 text-[15px]">
              <li><b className="text-coinco-azul">Madres en gestación:</b> cédula de identidad y carnet de control de embarazo.</li>
              <li><b className="text-coinco-azul">Niñas y niños:</b> cédula de identidad (o certificado de nacimiento si aún no tiene cédula) y carnet de control sano.</li>
              <li><b className="text-coinco-azul">Residencia:</b> cartola del Registro Social de Hogares o certificado de residencia de la Junta de Vecinos. La cartola se usa también para verificar el tramo del 40%.</li>
            </ul>
          </Tarjeta>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-extrabold text-coinco-azul">Cómo se inscribe</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["1", "Inscríbase", "En línea desde este sitio, o de forma presencial en la Ilustre Municipalidad de Coinco. Lo hace el adulto responsable."],
              ["2", "Revisamos sus documentos", "Un funcionario verifica la cartola y los documentos. Si falta algo, le avisamos por correo y puede corregirlo."],
              ["3", "Retire los regalos en diciembre", "Le informaremos la fecha, el lugar y el horario de entrega."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <span className="grid size-9 place-items-center rounded-full bg-coinco-amarillo font-extrabold text-coinco-azul">{n}</span>
                <h3 className="mt-3 font-bold text-coinco-azul">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {(CONTACTO_TELEFONO || CONTACTO_HORARIO) && (
          <Alerta tipo="info">
            ¿Necesita ayuda? Atención presencial en la Municipalidad de Coinco.
            {CONTACTO_HORARIO && <> Horario: {CONTACTO_HORARIO}.</>}
            {CONTACTO_TELEFONO && <> Teléfono: {CONTACTO_TELEFONO}.</>}
          </Alerta>
        )}
      </div>
    </>
  );
}

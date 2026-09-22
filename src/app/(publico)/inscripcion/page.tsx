import type { Metadata } from "next";
import { Alerta, EnlaceBoton, Titulo } from "@/components/ui";
import { FormularioInscripcion } from "@/components/FormularioInscripcion";
import { campanaActiva, listarSectores } from "@/lib/datos";
import { estadoCampana, formatearFechaLarga, hoyChile } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inscripción" };

export default async function PaginaInscripcion() {
  const campana = await campanaActiva().catch(() => null);
  const estado = campana ? estadoCampana(campana) : "inactiva";

  if (!campana || estado !== "abierta") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Titulo>Inscripción a Regalos de Navidad</Titulo>
        <Alerta tipo="aviso">
          {estado === "proxima" && campana && `Las inscripciones comienzan el ${formatearFechaLarga(campana.fecha_inicio)}.`}
          {estado === "cerrada" && campana && `El período de inscripción terminó el ${formatearFechaLarga(campana.fecha_fin)}.`}
          {(estado === "inactiva" || !campana) && "En este momento no hay una campaña de inscripción activa."}
        </Alerta>
        <div className="mt-5"><EnlaceBoton href="/consulta" variante="secundario">Consultar mi inscripción</EnlaceBoton></div>
      </div>
    );
  }

  const sectores = await listarSectores(true);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Titulo sub={`${campana.nombre} · Inscripciones hasta el ${formatearFechaLarga(campana.fecha_fin)}`}>Inscripción en línea</Titulo>
      <FormularioInscripcion
        modo="online"
        hoy={hoyChile()}
        sectores={sectores.map((s) => ({ id: s.id, nombre: s.nombre }))}
        campana={{ nombre: campana.nombre, fechaReferenciaEdad: campana.fecha_referencia_edad, fechaFin: campana.fecha_fin }}
      />
    </div>
  );
}

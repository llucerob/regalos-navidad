import type { Metadata } from "next";
import { Alerta, Titulo } from "@/components/ui";
import { FormularioInscripcion } from "@/components/FormularioInscripcion";
import { puedeRevisar, requerirStaff } from "@/lib/auth";
import { campanaActiva, listarSectores } from "@/lib/datos";
import { estadoCampana, formatearFechaLarga, hoyChile } from "@/lib/fechas";

export const metadata: Metadata = { title: "Nueva inscripción presencial" };

export default async function NuevaPresencial() {
  const staff = await requerirStaff();
  const campana = await campanaActiva();
  const estado = campana ? estadoCampana(campana) : "inactiva";
  if (!campana || estado !== "abierta") {
    return (
      <>
        <Titulo>Nueva inscripción presencial</Titulo>
        <Alerta tipo="aviso">
          {campana && estado === "cerrada"
            ? `El período de inscripción terminó el ${formatearFechaLarga(campana.fecha_fin)}. Un administrador puede extender la fecha de cierre en “Campañas”.`
            : "No hay una campaña abierta para inscribir."}
        </Alerta>
      </>
    );
  }
  const sectores = await listarSectores(true);
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo sub="Ingrese los datos con la persona presente y revise sus documentos originales.">Nueva inscripción presencial</Titulo>
      <FormularioInscripcion
        modo="presencial"
        hoy={hoyChile()}
        sectores={sectores.map((s) => ({ id: s.id, nombre: s.nombre }))}
        campana={{ nombre: campana.nombre, fechaReferenciaEdad: campana.fecha_referencia_edad, fechaFin: campana.fecha_fin }}
        puedeAprobarDirecto={puedeRevisar(staff.perfil.rol)}
      />
    </div>
  );
}

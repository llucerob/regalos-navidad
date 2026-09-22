import type { Metadata } from "next";
import { Alerta, EnlaceBoton, Tarjeta } from "@/components/ui";
import { BotonImprimir } from "@/components/BotonImprimir";

export const metadata: Metadata = { title: "Inscripción recibida" };

export default async function Exito({ searchParams }: { searchParams: Promise<{ folio?: string }> }) {
  const { folio } = await searchParams;
  const folioSeguro = /^[A-Z0-9-]{6,20}$/.test(folio ?? "") ? folio : null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Tarjeta className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-coinco-verde text-3xl text-white" aria-hidden>✓</div>
        <h1 className="mt-4 text-3xl font-extrabold text-coinco-azul">¡Inscripción recibida!</h1>
        {folioSeguro && (
          <>
            <p className="mt-4 text-slate-600">Su número de folio es:</p>
            <p className="mt-1 select-all rounded-xl bg-coinco-fondo py-3 text-3xl font-extrabold tracking-widest text-coinco-azul">{folioSeguro}</p>
            <p className="mt-2 text-sm text-slate-500">Anótelo o tome una captura de pantalla: lo necesitará, junto con su RUT, para consultar el estado.</p>
          </>
        )}
        <Alerta tipo="info" className="mt-6 text-left">
          <b>¿Qué sigue?</b> Un funcionario municipal revisará los documentos. Le avisaremos por correo si su inscripción es aprobada o si debe corregir o completar algo.
          Revise también su carpeta de spam.
        </Alerta>
        <div className="no-imprimir mt-6 flex flex-wrap justify-center gap-3">
          <BotonImprimir />
          <EnlaceBoton href={`/consulta${folioSeguro ? `?folio=${folioSeguro}` : ""}`} variante="secundario">Consultar estado</EnlaceBoton>
          <EnlaceBoton href="/" variante="fantasma">Volver al inicio</EnlaceBoton>
        </div>
      </Tarjeta>
    </div>
  );
}

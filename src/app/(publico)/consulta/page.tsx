import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { ConsultaEstado } from "@/components/ConsultaEstado";

export const metadata: Metadata = { title: "Consultar inscripción" };

export default async function PaginaConsulta({ searchParams }: { searchParams: Promise<{ folio?: string }> }) {
  const { folio } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Titulo sub="Ingrese el folio de su comprobante y el RUT del adulto responsable.">Consultar mi inscripción</Titulo>
      <ConsultaEstado folioInicial={(folio ?? "").toUpperCase().slice(0, 20)} />
    </div>
  );
}

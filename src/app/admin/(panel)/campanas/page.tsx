import type { Metadata } from "next";
import { AvisoUrl, Boton, Tarjeta, Titulo } from "@/components/ui";
import { Campo, Entrada } from "@/components/campos";
import { requerirStaff } from "@/lib/auth";
import { listarCampanas } from "@/lib/datos";
import { guardarCampana } from "@/actions/admin";
import type { Campana } from "@/lib/types";

export const metadata: Metadata = { title: "Campañas" };

function FormCampana({ c }: { c?: Campana }) {
  const id = c?.id ?? "nueva";
  return (
    <form action={guardarCampana} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <Campo id={`a-${id}`} etiqueta="Año"><Entrada id={`a-${id}`} name="anio" type="number" required defaultValue={c?.anio ?? new Date().getFullYear() + (c ? 0 : 1)} /></Campo>
      <Campo id={`n-${id}`} etiqueta="Nombre" className="lg:col-span-2"><Entrada id={`n-${id}`} name="nombre" required defaultValue={c?.nombre ?? ""} placeholder="Regalos de Navidad 2027" /></Campo>
      <Campo id={`d-${id}`} etiqueta="N° de decreto (opcional)"><Entrada id={`d-${id}`} name="decreto" defaultValue={c?.decreto ?? ""} /></Campo>
      <Campo id={`i-${id}`} etiqueta="Inicio de inscripciones"><Entrada id={`i-${id}`} name="fecha_inicio" type="date" required defaultValue={c?.fecha_inicio} /></Campo>
      <Campo id={`f-${id}`} etiqueta="Cierre (último día)"><Entrada id={`f-${id}`} name="fecha_fin" type="date" required defaultValue={c?.fecha_fin} /></Campo>
      <Campo id={`e-${id}`} etiqueta="Fecha de entrega"><Entrada id={`e-${id}`} name="fecha_entrega" type="date" defaultValue={c?.fecha_entrega ?? ""} /></Campo>
      <Campo id={`r-${id}`} etiqueta="Fecha de referencia de edad" ayuda="Hasta 4 años, 11 meses y 30 días a esta fecha (recomendado: día de la entrega)."><Entrada id={`r-${id}`} name="fecha_referencia_edad" type="date" required defaultValue={c?.fecha_referencia_edad} /></Campo>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold sm:col-span-2 lg:col-span-4">
        <input type="checkbox" name="activa" defaultChecked={c?.activa} className="size-5 accent-[#003169]" />
        Campaña activa (la que se muestra al público; solo puede haber una)
      </label>
      <div className="sm:col-span-2 lg:col-span-4"><Boton type="submit">{c ? "Guardar cambios" : "Crear campaña"}</Boton></div>
    </form>
  );
}

export default async function Campanas({ searchParams }: { searchParams: Promise<{ msg?: string; tipo?: string }> }) {
  await requerirStaff(["admin"]);
  const sp = await searchParams;
  const campanas = await listarCampanas();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <Titulo sub="Cada año tiene su campaña. Las fechas de inscripción se validan en el formulario público y en el registro presencial.">Campañas</Titulo>
      {campanas.map((c) => (
        <Tarjeta key={c.id}>
          <h2 className="mb-3 font-bold text-coinco-azul">{c.nombre} {c.activa && <span className="ml-2 rounded-full bg-coinco-verde px-2 py-0.5 text-xs text-white">Activa</span>}</h2>
          <FormCampana c={c} />
        </Tarjeta>
      ))}
      <Tarjeta>
        <h2 className="mb-3 font-bold text-coinco-azul">Nueva campaña</h2>
        <FormCampana />
      </Tarjeta>
    </div>
  );
}

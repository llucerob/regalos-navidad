import type { Metadata } from "next";
import { AvisoUrl, Boton, Tarjeta, Titulo } from "@/components/ui";
import { Campo, Entrada } from "@/components/campos";
import { requerirStaff } from "@/lib/auth";
import { listarSectores } from "@/lib/datos";
import { alternarSector, crearSector } from "@/actions/admin";

export const metadata: Metadata = { title: "Sectores" };

export default async function Sectores({ searchParams }: { searchParams: Promise<{ msg?: string; tipo?: string }> }) {
  await requerirStaff(["admin"]);
  const sp = await searchParams;
  const sectores = await listarSectores();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <Titulo sub="Sectores o Juntas de Vecinos que aparecen en el formulario. Desactive en lugar de borrar para no perder el historial.">Sectores</Titulo>
      <Tarjeta>
        <form action={crearSector} className="flex flex-wrap items-end gap-3">
          <Campo id="s-nombre" etiqueta="Nuevo sector" className="min-w-0 flex-1"><Entrada id="s-nombre" name="nombre" required placeholder="Ej.: Junta de Vecinos N° 1" /></Campo>
          <Campo id="s-orden" etiqueta="Orden" className="w-24"><Entrada id="s-orden" name="orden" type="number" defaultValue={10} /></Campo>
          <Boton type="submit">Agregar</Boton>
        </form>
      </Tarjeta>
      <Tarjeta className="p-0 sm:p-0">
        <ul className="divide-y divide-slate-100">
          {sectores.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className={s.activo ? "font-semibold" : "text-slate-400 line-through"}>{s.nombre}</span>
              <form action={alternarSector}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="activo" value={String(!s.activo)} />
                <Boton variante="fantasma" className="min-h-9 text-sm">{s.activo ? "Desactivar" : "Activar"}</Boton>
              </form>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

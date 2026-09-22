import type { Metadata } from "next";
import { Alerta, AvisoUrl, Boton, Tarjeta, Titulo, claseBoton } from "@/components/ui";
import { requerirStaff } from "@/lib/auth";
import { campanaActiva } from "@/lib/datos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { marcarEntrega } from "@/actions/admin";
import { formatearRut } from "@/lib/rut";
import { formatearFechaHora } from "@/lib/fechas";
import type { Beneficiario, Inscripcion } from "@/lib/types";

export const metadata: Metadata = { title: "Entrega de regalos" };

type Fila = Beneficiario & { inscripciones: Pick<Inscripcion, "folio" | "estado" | "apoderado_rut" | "apoderado_nombres" | "apoderado_apellidos"> };

export default async function Entrega({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string; tipo?: string }> }) {
  await requerirStaff();
  const sp = await searchParams;
  const campana = await campanaActiva();
  if (!campana) return (<><Titulo>Entrega de regalos</Titulo><Alerta tipo="aviso">No hay una campaña activa.</Alerta></>);

  const db = supabaseAdmin();
  const q = (sp.q ?? "").replace(/[%,()*\\'"]/g, " ").trim();
  let filas: Fila[] = [];
  if (q.length >= 3) {
    const patrones = Array.from(new Set([q, q.replace(/\./g, "")]));
    const [{ data: porBenef }, { data: porApoderado }] = await Promise.all([
      db.from("beneficiarios").select("id")
        .eq("campana_id", campana.id)
        .or(patrones.flatMap((p) => [`rut.ilike.%${p}%`, `nombres.ilike.%${p}%`, `apellidos.ilike.%${p}%`]).join(","))
        .limit(50),
      db.from("inscripciones").select("id")
        .eq("campana_id", campana.id)
        .or(patrones.flatMap((p) => [`folio.ilike.%${p}%`, `apoderado_rut.ilike.%${p}%`, `apoderado_nombres.ilike.%${p}%`, `apoderado_apellidos.ilike.%${p}%`]).join(","))
        .limit(50),
    ]);
    const idsIns = (porApoderado ?? []).map((i) => i.id as string);
    const idsBenef = (porBenef ?? []).map((b) => b.id as string);
    const condiciones = [idsBenef.length && `id.in.(${idsBenef.join(",")})`, idsIns.length && `inscripcion_id.in.(${idsIns.join(",")})`].filter(Boolean).join(",");
    if (condiciones) {
      const { data } = await db
        .from("beneficiarios")
        .select("*, inscripciones!inner(folio,estado,apoderado_rut,apoderado_nombres,apoderado_apellidos)")
        .eq("activo", true)
        .or(condiciones)
        .order("apellidos")
        .limit(60);
      filas = (data ?? []) as unknown as Fila[];
    }
  }

  const { count: totalAprobados } = await db.from("beneficiarios").select("id, inscripciones!inner(estado)", { count: "exact", head: true })
    .eq("campana_id", campana.id).eq("activo", true).eq("inscripciones.estado", "aprobada");
  const { count: entregados } = await db.from("beneficiarios").select("id, inscripciones!inner(estado)", { count: "exact", head: true })
    .eq("campana_id", campana.id).eq("activo", true).eq("inscripciones.estado", "aprobada").not("entregado_at", "is", null);

  const volverA = `/admin/entrega?q=${encodeURIComponent(sp.q ?? "")}`;
  return (
    <div className="mx-auto max-w-3xl">
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <Titulo sub={`${campana.nombre} · ${entregados ?? 0} de ${totalAprobados ?? 0} beneficiarios aprobados ya recibieron su regalo`}>Entrega de regalos</Titulo>
      <Tarjeta className="mb-5">
        <form className="flex flex-wrap gap-3">
          <input name="q" defaultValue={sp.q} autoFocus placeholder="RUT o nombre del beneficiario o del adulto responsable, o folio" aria-label="Buscar" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3" />
          <button className={claseBoton("primario")}>Buscar</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Escriba al menos 3 caracteres.</p>
      </Tarjeta>

      {q.length >= 3 && filas.length === 0 && <Alerta tipo="aviso">No se encontraron beneficiarios inscritos con ese dato.</Alerta>}
      <div className="space-y-3">
        {filas.map((b) => {
          const aprobada = b.inscripciones.estado === "aprobada";
          return (
            <Tarjeta key={b.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-coinco-azul">{b.nombres} {b.apellidos}</p>
                <p className="text-sm text-slate-600">{formatearRut(b.rut)} · {b.tipo === "gestante" ? "Madre en gestación" : b.sexo === "F" ? "Niña" : "Niño"}</p>
                <p className="text-sm text-slate-500">Adulto responsable: {b.inscripciones.apoderado_nombres} {b.inscripciones.apoderado_apellidos} ({formatearRut(b.inscripciones.apoderado_rut)}) · Folio {b.inscripciones.folio}</p>
                {!aprobada && <p className="mt-1 text-sm font-semibold text-[#b3202f]">Inscripción {b.inscripciones.estado.replace("_", " ")}: no corresponde entregar.</p>}
              </div>
              {aprobada && (b.entregado_at ? (
                <form action={marcarEntrega} className="text-right">
                  <input type="hidden" name="beneficiarioId" value={b.id} /><input type="hidden" name="volverA" value={volverA} /><input type="hidden" name="accion" value="deshacer" />
                  <p className="mb-1 text-sm font-bold text-[#00694a]">✓ Entregado {formatearFechaHora(b.entregado_at)}</p>
                  <Boton variante="fantasma" className="min-h-9 text-sm">Deshacer</Boton>
                </form>
              ) : (
                <form action={marcarEntrega}>
                  <input type="hidden" name="beneficiarioId" value={b.id} /><input type="hidden" name="volverA" value={volverA} /><input type="hidden" name="accion" value="entregar" />
                  <Boton className="bg-coinco-verde hover:brightness-95">Registrar entrega</Boton>
                </form>
              ))}
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}

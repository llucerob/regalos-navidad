import { listarCampanas } from "@/lib/datos";

/** Selector de campaña por GET (?campana=). Conserva otros parámetros como campos ocultos. */
export async function SelectorCampana({ actualId, ocultos = {} }: { actualId: string; ocultos?: Record<string, string | undefined> }) {
  const campanas = await listarCampanas();
  if (campanas.length <= 1) return null;
  return (
    <form className="no-imprimir flex items-center gap-2 text-sm">
      {Object.entries(ocultos).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <label htmlFor="campana" className="font-semibold text-coinco-azul">Campaña</label>
      <select id="campana" name="campana" defaultValue={actualId} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2">
        {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? " (activa)" : ""}</option>)}
      </select>
      <button className="min-h-10 rounded-lg bg-coinco-azul px-3 font-semibold text-white">Ver</button>
    </form>
  );
}

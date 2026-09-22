import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Alerta, AvisoUrl, Boton, InsigniaEstado, Tarjeta, cx } from "@/components/ui";
import { Campo, Entrada, Seleccion } from "@/components/campos";
import { puedeRevisar, requerirStaff } from "@/lib/auth";
import { detalleInscripcion, listarSectores, type DocumentoConUrl } from "@/lib/datos";
import { docsRequeridosBeneficiario, docsRequeridosHogar } from "@/lib/documentos";
import { edadTexto, esElegiblePorEdad } from "@/lib/edad";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { formatearRut } from "@/lib/rut";
import { cambiarEstado, editarApoderado } from "@/actions/admin";
import { CHECKLIST_ITEMS, ETIQUETA_CANAL, ETIQUETA_DOC, ETIQUETA_ESTADO } from "@/lib/constants";
import type { TipoDoc } from "@/lib/types";

export const metadata: Metadata = { title: "Revisar inscripción" };

function Documentos({ docs, requeridos }: { docs: DocumentoConUrl[]; requeridos: TipoDoc[] }) {
  const tipos = Array.from(new Set<TipoDoc>([...requeridos, ...docs.map((d) => d.tipo)]));
  return (
    <div className="space-y-3">
      {tipos.map((t) => {
        const lista = docs.filter((d) => d.tipo === t);
        return (
          <div key={t}>
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-coinco-azul">
              {ETIQUETA_DOC[t]}
              {lista.length === 0 && requeridos.includes(t) && <span className="rounded-full bg-coinco-rojo/15 px-2 py-0.5 text-xs font-bold text-[#b3202f]">Falta</span>}
            </p>
            {lista.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {lista.map((d) => (
                  <li key={d.id} className="w-36">
                    <a href={d.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-slate-300 hover:ring-2 hover:ring-coinco-azul">
                      {d.mime?.startsWith("image/") && d.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.url} alt={ETIQUETA_DOC[t]} className="h-28 w-full bg-slate-100 object-cover" />
                      ) : (
                        <span className="grid h-28 place-items-center bg-coinco-rojo/10 text-2xl font-extrabold text-coinco-rojo">PDF</span>
                      )}
                    </a>
                    <p className="mt-1 truncate text-xs text-slate-500" title={d.nombre_original ?? ""}>{d.nombre_original}</p>
                    <p className="text-[11px] text-slate-400">{formatearFechaHora(d.created_at)} · {d.origen === "funcionario" ? "Funcionario" : "Apoderado"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function DetalleInscripcion({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; tipo?: string }> }) {
  const staff = await requerirStaff();
  const { id } = await params;
  const sp = await searchParams;
  const d = await detalleInscripcion(id);
  if (!d) notFound();
  const { inscripcion: ins, beneficiarios, documentos, historial, campana } = d;
  const sectores = await listarSectores();
  const revisa = puedeRevisar(staff.perfil.rol);
  const docsHogar = documentos.filter((x) => !x.beneficiario_id);

  return (
    <>
      <p className="mb-3 text-sm"><Link href={`/admin/inscripciones?campana=${ins.campana_id}`} className="font-semibold text-coinco-azul underline">← Volver al listado</Link></p>
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{campana.nombre}</p>
          <h1 className="text-3xl font-extrabold text-coinco-azul">Folio {ins.folio}</h1>
          <p className="text-sm text-slate-600">{ETIQUETA_CANAL[ins.canal]} · {formatearFechaHora(ins.created_at)}</p>
        </div>
        <InsigniaEstado estado={ins.estado} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Apoderado */}
          <Tarjeta>
            <h2 className="mb-3 text-lg font-bold text-coinco-azul">Adulto responsable</h2>
            <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
              {[
                ["Nombre", `${ins.apoderado_nombres} ${ins.apoderado_apellidos}`],
                ["RUT", formatearRut(ins.apoderado_rut)],
                ["Teléfono", ins.apoderado_telefono],
                ["Correo", ins.apoderado_email ?? "—"],
                ["Dirección", ins.direccion],
                ["Sector", ins.sectores?.nombre ?? "—"],
                ["Acredita residencia con", ins.residencia_acreditada_con === "rsh" ? "Cartola RSH" : "Certificado Junta de Vecinos"],
                ["Tramo declarado", ins.tramo_declarado === "hasta_40" ? "40% o menos" : "No sabe (verificar con cartola)"],
              ].map(([t, v]) => (
                <div key={t}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{t}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {revisa && (
              <details className="mt-4 rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-bold text-coinco-azul">Corregir datos del adulto responsable</summary>
                <form action={editarApoderado} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={ins.id} />
                  <Campo id="e-rut" etiqueta="RUT"><Entrada id="e-rut" name="rut" defaultValue={formatearRut(ins.apoderado_rut)} required /></Campo>
                  <Campo id="e-tel" etiqueta="Teléfono"><Entrada id="e-tel" name="telefono" defaultValue={ins.apoderado_telefono} required /></Campo>
                  <Campo id="e-nom" etiqueta="Nombres"><Entrada id="e-nom" name="nombres" defaultValue={ins.apoderado_nombres} required /></Campo>
                  <Campo id="e-ape" etiqueta="Apellidos"><Entrada id="e-ape" name="apellidos" defaultValue={ins.apoderado_apellidos} required /></Campo>
                  <Campo id="e-mail" etiqueta="Correo"><Entrada id="e-mail" name="email" type="email" defaultValue={ins.apoderado_email ?? ""} /></Campo>
                  <Campo id="e-sec" etiqueta="Sector">
                    <Seleccion id="e-sec" name="sectorId" defaultValue={ins.sector_id ?? ""} required>
                      {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}{s.activo ? "" : " (inactivo)"}</option>)}
                    </Seleccion>
                  </Campo>
                  <Campo id="e-dir" etiqueta="Dirección" className="sm:col-span-2"><Entrada id="e-dir" name="direccion" defaultValue={ins.direccion} required /></Campo>
                  <div className="sm:col-span-2"><Boton type="submit" variante="secundario">Guardar cambios</Boton></div>
                </form>
              </details>
            )}
          </Tarjeta>

          {/* Documentos del hogar */}
          <Tarjeta>
            <h2 className="mb-3 text-lg font-bold text-coinco-azul">Documentos del hogar</h2>
            <Documentos docs={docsHogar} requeridos={docsRequeridosHogar(ins.residencia_acreditada_con)} />
            {ins.canal === "presencial" && docsHogar.length === 0 && <p className="text-sm text-slate-500">Registro presencial: sin copias digitalizadas.</p>}
          </Tarjeta>

          {/* Beneficiarios */}
          {beneficiarios.map((b) => {
            const elegible = b.tipo === "nino" && b.fecha_nacimiento ? esElegiblePorEdad(b.fecha_nacimiento, campana.fecha_referencia_edad) : null;
            return (
              <Tarjeta key={b.id} className={cx(!b.activo && "opacity-70")}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-coinco-azul">{b.nombres} {b.apellidos}</h2>
                    <p className="text-sm text-slate-600">{formatearRut(b.rut)} · {b.tipo === "gestante" ? "Madre en gestación" : b.sexo === "F" ? "Niña" : b.sexo === "M" ? "Niño" : "Niño/a"}</p>
                  </div>
                  {b.entregado_at && <span className="rounded-full bg-coinco-verde/15 px-3 py-1 text-xs font-bold text-[#00694a]">Entregado {formatearFechaHora(b.entregado_at)}</span>}
                </div>
                {b.tipo === "nino" && b.fecha_nacimiento && (
                  <Alerta tipo={elegible ? "ok" : "error"} className="mb-3">
                    Nació el {formatearFecha(b.fecha_nacimiento)} · Edad al {formatearFecha(campana.fecha_referencia_edad)}: <b>{edadTexto(b.fecha_nacimiento, campana.fecha_referencia_edad)}</b>.{" "}
                    {elegible ? "Cumple el requisito de edad." : "NO cumple el requisito de edad."}
                  </Alerta>
                )}
                {b.tipo === "gestante" && b.fecha_probable_parto && <p className="mb-3 text-sm">Fecha probable de parto: <b>{formatearFecha(b.fecha_probable_parto)}</b></p>}
                <Documentos docs={documentos.filter((x) => x.beneficiario_id === b.id)} requeridos={docsRequeridosBeneficiario(b.tipo, b.documento_identidad)} />
              </Tarjeta>
            );
          })}
        </div>

        {/* Panel de revisión */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Tarjeta>
            <h2 className="mb-1 text-lg font-bold text-coinco-azul">Revisión</h2>
            <p className="mb-3 text-sm text-slate-600">Estado actual: <b>{ETIQUETA_ESTADO[ins.estado]}</b></p>
            {ins.observacion && <Alerta tipo="aviso" className="mb-3"><b>Último mensaje:</b> {ins.observacion}</Alerta>}
            {revisa ? (
              <form action={cambiarEstado} className="space-y-4">
                <input type="hidden" name="id" value={ins.id} />
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-coinco-azul">Verificación (necesaria para aprobar)</legend>
                  <div className="space-y-2">
                    {CHECKLIST_ITEMS.map((i) => (
                      <label key={i.clave} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input type="checkbox" name={`chk_${i.clave}`} defaultChecked={!!ins.checklist?.[i.clave]} className="mt-0.5 size-5 shrink-0 accent-[#003169]" />
                        <span>{i.texto}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="obs" className="mb-1 block text-sm font-bold text-coinco-azul">Mensaje al apoderado</label>
                  <textarea id="obs" name="observacion" rows={4} defaultValue={ins.observacion ?? ""} placeholder="Obligatorio al observar o rechazar. Se envía por correo." className="w-full rounded-lg border border-slate-300 p-3 text-[15px]" />
                </div>
                <div className="grid gap-2">
                  <button name="accion" value="aprobar" className="min-h-11 rounded-lg bg-coinco-verde px-4 font-bold text-white hover:brightness-95">✓ Aprobar</button>
                  <button name="accion" value="observar" className="min-h-11 rounded-lg bg-coinco-amarillo px-4 font-bold text-coinco-azul hover:brightness-95">Observar (pedir corrección)</button>
                  <button name="accion" value="rechazar" className="min-h-11 rounded-lg bg-coinco-rojo px-4 font-bold text-white hover:brightness-95">Rechazar</button>
                  {ins.estado === "recibida" && <button name="accion" value="revision" className="min-h-11 rounded-lg border-2 border-coinco-azul px-4 font-bold text-coinco-azul hover:bg-coinco-azul/5">Tomar en revisión</button>}
                </div>
                {!ins.apoderado_email && <p className="text-xs text-slate-500">Esta inscripción no tiene correo: el apoderado no recibirá aviso automático.</p>}
              </form>
            ) : (
              <Alerta tipo="info">Su rol solo permite registrar inscripciones. La revisión la realizan revisores y administradores.</Alerta>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-3 text-lg font-bold text-coinco-azul">Historial</h2>
            <ol className="space-y-3 border-l-2 border-coinco-amarillo pl-4">
              {historial.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-semibold">{ETIQUETA_ESTADO[h.estado_nuevo as keyof typeof ETIQUETA_ESTADO] ?? h.estado_nuevo}</p>
                  {h.comentario && <p className="text-slate-600">{h.comentario}</p>}
                  <p className="text-xs text-slate-400">{formatearFechaHora(h.created_at)} · {h.usuario_nombre ?? "Sistema"}</p>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { agregarDocumentos, consultarEstado, type VistaConsulta } from "@/actions/consulta";
import { Alerta, Boton, InsigniaEstado, Tarjeta } from "./ui";
import { Campo, Entrada, SelectorArchivos, type ArchivoLocal } from "./campos";
import { subirArchivos } from "@/lib/upload-client";
import { formatearRut, validarRut } from "@/lib/rut";
import { formatearFechaHora } from "@/lib/fechas";
import { DESCRIPCION_ESTADO, ETIQUETA_DOC } from "@/lib/constants";
import type { ArchivoRef } from "@/lib/types";

export function ConsultaEstado({ folioInicial }: { folioInicial: string }) {
  const [folio, setFolio] = useState(folioInicial);
  const [rut, setRut] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaConsulta | null>(null);

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!folio.trim()) return setError("Ingrese el folio.");
    if (!validarRut(rut)) return setError("El RUT no es válido. Revise el número y el dígito verificador.");
    setCargando(true);
    const r = await consultarEstado(folio, rut);
    setCargando(false);
    if (!r.ok) {
      setVista(null);
      return setError(r.error);
    }
    setVista(r.vista);
  }

  return (
    <div className="space-y-5">
      <Tarjeta>
        <form onSubmit={consultar} className="grid gap-4 sm:grid-cols-2">
          <Campo id="c-folio" etiqueta="N° de folio" requerido ayuda="Está en su comprobante. Ejemplo: NAV26-K7M2QX">
            <Entrada id="c-folio" value={folio} autoCapitalize="characters" onChange={(e) => setFolio(e.target.value.toUpperCase())} />
          </Campo>
          <Campo id="c-rut" etiqueta="RUT del adulto responsable" requerido ayuda="Ejemplo: 12.345.678-5">
            <Entrada id="c-rut" value={rut} onChange={(e) => setRut(e.target.value)} onBlur={() => validarRut(rut) && setRut(formatearRut(rut))} />
          </Campo>
          <div className="sm:col-span-2">
            <Boton type="submit" disabled={cargando}>{cargando ? "Consultando…" : "Consultar"}</Boton>
          </div>
        </form>
      </Tarjeta>

      {error && <Alerta tipo="error">{error}</Alerta>}
      {vista && <Resultado vista={vista} rut={rut} onActualizar={consultar} />}
    </div>
  );
}

function Resultado({ vista, rut, onActualizar }: { vista: VistaConsulta; rut: string; onActualizar: () => void }) {
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Folio {vista.folio}</p>
          <h2 className="text-xl font-extrabold text-coinco-azul">{vista.apoderado}</h2>
          <p className="text-sm text-slate-500">{vista.campanaNombre} · Recibida el {formatearFechaHora(vista.creada)}</p>
        </div>
        <InsigniaEstado estado={vista.estado} />
      </div>

      <Alerta tipo={vista.estado === "aprobada" ? "ok" : vista.estado === "rechazada" ? "error" : vista.estado === "observada" ? "aviso" : "info"} className="mt-4">
        {DESCRIPCION_ESTADO[vista.estado]}
      </Alerta>
      {vista.observacion && (
        <div className="mt-3 rounded-lg bg-coinco-fondo p-4 text-[15px]">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje del funcionario</p>
          <p className="whitespace-pre-line">{vista.observacion}</p>
        </div>
      )}

      <h3 className="mb-2 mt-5 font-bold text-coinco-azul">Beneficiarios</h3>
      <ul className="space-y-1 text-[15px]">
        {vista.beneficiarios.map((b) => (
          <li key={b.id} className="rounded-lg bg-coinco-fondo px-3 py-2">
            {b.nombre} <span className="text-slate-500">· {b.tipo === "gestante" ? "Madre en gestación" : "Niño/a"}</span>
          </li>
        ))}
      </ul>

      {vista.puedeCorregir && <Correccion vista={vista} rut={rut} onListo={onActualizar} />}
    </Tarjeta>
  );
}

function Correccion({ vista, rut, onListo }: { vista: VistaConsulta; rut: string; onListo: () => void }) {
  const sesion = useRef(crypto.randomUUID());
  const subidos = useRef(new Map<string, ArchivoRef>());
  const [archivos, setArchivos] = useState<Record<string, ArchivoLocal[]>>({});
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const clave = (benef: string | null, tipo: string) => `${benef ?? "hogar"}|${tipo}`;

  async function enviar() {
    setError(null);
    const seleccion = Object.entries(archivos).filter(([, l]) => l.length);
    if (!seleccion.length) return setError("Adjunte al menos un documento.");
    setEnviando(true);
    const sub = await subirArchivos(sesion.current, seleccion.flatMap(([, l]) => l.map((a) => ({ id: a.id, file: a.file }))), subidos.current);
    if (!sub.ok) {
      setEnviando(false);
      return setError(sub.error);
    }
    const r = await agregarDocumentos({
      folio: vista.folio,
      rut,
      sesion: sesion.current,
      mensaje: mensaje.trim() || undefined,
      documentos: seleccion.map(([k, l]) => {
        const [benef, tipo] = k.split("|");
        return { beneficiarioId: benef === "hogar" ? null : benef, tipo, archivos: l.map((a) => subidos.current.get(a.id)!) };
      }),
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setListo(true);
    onListo();
  }

  if (listo) return <Alerta tipo="ok" className="mt-5">¡Listo! Recibimos sus documentos. Un funcionario los revisará y le avisaremos por correo.</Alerta>;

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-lg font-bold text-coinco-azul">Corregir o completar documentos</h3>
      <p className="mb-4 text-sm text-slate-600">Adjunte solo los documentos que se le pidieron. Puede reemplazar uno enviando una foto o PDF nuevo.</p>
      <div className="space-y-3">
        {vista.hogar.filter((h) => h.requerido).map((h) => (
          <SelectorArchivos key={h.tipo} id={`c-h-${h.tipo}`} etiqueta={ETIQUETA_DOC[h.tipo]} ayuda={h.cantidad ? `Ya entregó ${h.cantidad} archivo(s).` : "Falta este documento."}
            archivos={archivos[clave(null, h.tipo)] ?? []} onChange={(a) => setArchivos((s) => ({ ...s, [clave(null, h.tipo)]: a }))} />
        ))}
        {vista.beneficiarios.map((b) =>
          b.docs.map((d) => (
            <SelectorArchivos key={`${b.id}${d.tipo}`} id={`c-${b.id}-${d.tipo}`} etiqueta={`${ETIQUETA_DOC[d.tipo]} — ${b.nombre}`} ayuda={d.cantidad ? `Ya entregó ${d.cantidad} archivo(s).` : "Falta este documento."}
              archivos={archivos[clave(b.id, d.tipo)] ?? []} onChange={(a) => setArchivos((s) => ({ ...s, [clave(b.id, d.tipo)]: a }))} />
          )),
        )}
      </div>
      <Campo id="c-msg" etiqueta="Mensaje para el funcionario (opcional)" className="mt-4">
        <Entrada id="c-msg" value={mensaje} maxLength={500} onChange={(e) => setMensaje(e.target.value)} />
      </Campo>
      {error && <Alerta tipo="error" className="mt-4">{error}</Alerta>}
      <div className="mt-4">
        <Boton type="button" variante="acento" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar documentos"}</Boton>
      </div>
    </div>
  );
}

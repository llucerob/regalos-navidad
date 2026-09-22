"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "./ui";
import { MAX_ARCHIVOS_POR_DOCUMENTO } from "@/lib/constants";
import { validarArchivoLocal } from "@/lib/upload-client";

export interface ArchivoLocal {
  id: string;
  file: File;
}

export function Campo({
  id, etiqueta, ayuda, error, requerido, children, className,
}: {
  id: string; etiqueta: string; ayuda?: string; error?: string; requerido?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-coinco-azul">
        {etiqueta} {requerido && <span className="text-coinco-rojo" aria-hidden>*</span>}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && <p role="alert" className="mt-1 text-sm font-medium text-[#b3202f]">{error}</p>}
    </div>
  );
}

const claseControl = (error?: string) =>
  cx(
    "block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-400",
    error ? "border-coinco-rojo ring-1 ring-coinco-rojo" : "border-slate-300 focus:border-coinco-azul",
  );

export function Entrada({ error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...props} aria-invalid={!!error} className={cx(claseControl(error), className)} />;
}

export function Seleccion({ error, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select {...props} aria-invalid={!!error} className={cx(claseControl(error), className)}>
      {children}
    </select>
  );
}

export function GrupoOpciones<T extends string>({
  nombre, valor, opciones, onChange, error, columnas = false,
}: {
  nombre: string; valor: T | ""; opciones: { valor: T; texto: string; detalle?: string }[];
  onChange: (v: T) => void; error?: string; columnas?: boolean;
}) {
  return (
    <div>
      <div className={cx("grid gap-2", columnas && "sm:grid-cols-2")} role="radiogroup">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={cx(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-2 bg-white px-3 py-2.5 text-[15px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-coinco-celeste",
              valor === o.valor ? "border-coinco-azul bg-coinco-azul/5" : "border-slate-200 hover:border-coinco-azul/50",
            )}
          >
            <input type="radio" name={nombre} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} className="mt-1 size-4 accent-[#003169]" />
            <span>
              <span className="font-semibold text-slate-900">{o.texto}</span>
              {o.detalle && <span className="block text-sm text-slate-500">{o.detalle}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-[#b3202f]">{error}</p>}
    </div>
  );
}

function VistaPrevia({ file }: { file: File }) {
  const url = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-12 rounded object-cover ring-1 ring-slate-200" />
  ) : (
    <span className="grid size-12 place-items-center rounded bg-coinco-rojo/10 text-xs font-bold text-coinco-rojo">PDF</span>
  );
}

export function SelectorArchivos({
  id, etiqueta, ayuda, requerido, archivos, onChange, error, max = MAX_ARCHIVOS_POR_DOCUMENTO,
}: {
  id: string; etiqueta: string; ayuda?: string; requerido?: boolean; archivos: ArchivoLocal[];
  onChange: (a: ArchivoLocal[]) => void; error?: string; max?: number;
}) {
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    setErrorLocal(null);
    const nuevos: ArchivoLocal[] = [];
    for (const f of Array.from(lista)) {
      const err = validarArchivoLocal(f);
      if (err) { setErrorLocal(err); continue; }
      if (archivos.length + nuevos.length >= max) { setErrorLocal(`Máximo ${max} archivos por documento.`); break; }
      nuevos.push({ id: crypto.randomUUID(), file: f });
    }
    if (nuevos.length) onChange([...archivos, ...nuevos]);
  }

  return (
    <div className={cx("rounded-xl border-2 border-dashed p-3 sm:p-4", error ? "border-coinco-rojo bg-coinco-rojo/5" : archivos.length ? "border-coinco-verde/60 bg-coinco-verde/5" : "border-slate-300 bg-white")}>
      <p className="text-sm font-semibold text-coinco-azul">
        {etiqueta} {requerido && <span className="text-coinco-rojo" aria-hidden>*</span>}
      </p>
      {ayuda && <p className="mt-0.5 text-xs text-slate-500">{ayuda}</p>}

      {archivos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <VistaPrevia file={a.file} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{a.file.name}</span>
                <span className="text-xs text-slate-500">{(a.file.size / 1024 / 1024).toFixed(1)} MB</span>
              </span>
              <button type="button" onClick={() => onChange(archivos.filter((x) => x.id !== a.id))} className="min-h-9 rounded-md px-3 text-sm font-semibold text-[#b3202f] hover:bg-coinco-rojo/10">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {archivos.length < max && (
        <label htmlFor={id} className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-coinco-azul px-4 py-2 text-sm font-semibold text-white hover:bg-coinco-azul-oscuro has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-coinco-celeste has-[:focus-visible]:ring-offset-2">
          <span aria-hidden>＋</span> {archivos.length ? "Agregar otra foto o PDF" : "Adjuntar foto o PDF"}
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => { agregar(e.target.files); e.target.value = ""; }}
          />
        </label>
      )}
      {(errorLocal || error) && <p role="alert" className="mt-2 text-sm font-medium text-[#b3202f]">{errorLocal ?? error}</p>}
    </div>
  );
}

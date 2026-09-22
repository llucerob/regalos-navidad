import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { COLOR_ESTADO, ETIQUETA_ESTADO } from "@/lib/constants";
import type { Estado } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "acento" | "peligro" | "fantasma" | "blanco";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-coinco-azul text-white hover:bg-coinco-azul-oscuro",
  secundario: "border-2 border-coinco-azul bg-white text-coinco-azul hover:bg-coinco-azul/5",
  acento: "bg-coinco-amarillo text-coinco-azul hover:brightness-95",
  peligro: "bg-coinco-rojo text-white hover:brightness-95",
  fantasma: "text-coinco-azul hover:bg-coinco-azul/10",
  blanco: "border-2 border-white text-white hover:bg-white/10",
};
export const claseBoton = (v: Variante = "primario", extra?: string) => cx(BASE, VARIANTES[v], extra);

export function Boton({
  variante = "primario",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button {...props} className={claseBoton(variante, className)} />;
}

export function EnlaceBoton({
  href,
  variante = "primario",
  className,
  children,
  ...rest
}: { href: string; variante?: Variante; className?: string; children: ReactNode; target?: string; download?: boolean }) {
  return (
    <Link href={href} className={claseBoton(variante, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6", className)}>{children}</div>;
}

export function Alerta({
  tipo = "info",
  children,
  className,
}: {
  tipo?: "info" | "ok" | "aviso" | "error";
  children: ReactNode;
  className?: string;
}) {
  const estilos = {
    info: "border-coinco-celeste bg-coinco-celeste/10 text-coinco-azul",
    ok: "border-coinco-verde bg-coinco-verde/10 text-[#00553d]",
    aviso: "border-coinco-amarillo bg-coinco-amarillo/15 text-[#5c4100]",
    error: "border-coinco-rojo bg-coinco-rojo/10 text-[#9b1a28]",
  }[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={cx("rounded-lg border-l-4 px-4 py-3 text-[15px] leading-relaxed", estilos, className)}>
      {children}
    </div>
  );
}

export function InsigniaEstado({ estado }: { estado: Estado }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset", COLOR_ESTADO[estado])}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-coinco-azul sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-slate-600">{sub}</p>}
    </div>
  );
}

/** Mensaje de resultado que las acciones del panel dejan en la URL (?msg=&tipo=). */
export function AvisoUrl({ msg, tipo }: { msg?: string; tipo?: string }) {
  if (!msg) return null;
  return (
    <Alerta tipo={tipo === "error" ? "error" : "ok"} className="mb-4">
      {msg}
    </Alerta>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function NavAdmin({ items }: { items: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((i) => {
        const activo = i.href === "/admin" ? ruta === "/admin" : ruta.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={activo ? "page" : undefined}
            className={cx("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition", activo ? "bg-coinco-amarillo text-coinco-azul" : "text-white hover:bg-white/10")}>
            {i.texto}
          </Link>
        );
      })}
    </nav>
  );
}

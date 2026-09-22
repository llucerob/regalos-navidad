import Image from "next/image";
import Link from "next/link";
import { requerirStaff } from "@/lib/auth";
import { cerrarSesion } from "@/actions/admin";
import { NavAdmin } from "@/components/NavAdmin";
import { ETIQUETA_ROL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const staff = await requerirStaff();
  const admin = staff.perfil.rol === "admin";
  const items = [
    { href: "/admin", texto: "Resumen" },
    { href: "/admin/inscripciones", texto: "Inscripciones" },
    { href: "/admin/nueva", texto: "Nueva (presencial)" },
    { href: "/admin/entrega", texto: "Entrega" },
    ...(admin
      ? [
          { href: "/admin/exportar", texto: "Exportar" },
          { href: "/admin/correos", texto: "Correos" },
          { href: "/admin/campanas", texto: "Campañas" },
          { href: "/admin/sectores", texto: "Sectores" },
          { href: "/admin/usuarios", texto: "Usuarios" },
        ]
      : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="bg-coinco-azul text-white no-imprimir">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" aria-label="Panel de inscripciones">
              <Image src="/logo-horizontal-blanco.png" alt="Ilustre Municipalidad de Coinco" width={1316} height={487} className="h-10 w-auto sm:h-12" priority />
            </Link>
            <div className="flex items-center gap-3 text-right text-sm">
              <div className="hidden sm:block">
                <p className="font-semibold leading-tight">{staff.perfil.nombre}</p>
                <p className="text-xs text-white/70">{ETIQUETA_ROL[staff.perfil.rol]}</p>
              </div>
              <form action={cerrarSesion}>
                <button className="min-h-10 rounded-lg border border-white/40 px-3 text-sm font-semibold hover:bg-white/10">Salir</button>
              </form>
            </div>
          </div>
          <div className="mt-3"><NavAdmin items={items} /></div>
        </div>
        <div className="h-1.5 bg-coinco-amarillo" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

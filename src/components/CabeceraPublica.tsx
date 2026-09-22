import Image from "next/image";
import Link from "next/link";

export function CabeceraPublica() {
  return (
    <header className="bg-coinco-azul text-white no-imprimir">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="Inicio - Ilustre Municipalidad de Coinco">
          <Image src="/logo-horizontal-blanco.png" alt="Ilustre Municipalidad de Coinco" width={1316} height={487} priority className="h-11 w-auto sm:h-14" />
        </Link>
        <nav className="flex items-center text-xs font-semibold whitespace-nowrap sm:gap-3 sm:text-sm">
          <Link href="/inscripcion" className="rounded-lg px-2.5 py-2 hover:bg-white/10 sm:px-3">Inscribirse</Link>
          <Link href="/consulta" className="rounded-lg px-2.5 py-2 hover:bg-white/10 sm:px-3">Consultar estado</Link>
        </nav>
      </div>
      <div className="h-1.5 bg-coinco-amarillo" />
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className="mt-12 bg-coinco-azul py-6 text-center text-sm text-white/80 no-imprimir">
      <p className="font-semibold text-white">Ilustre Municipalidad de Coinco · Agua del Arenal</p>
      <p className="mt-1">Entrega de Regalos de Navidad</p>
    </footer>
  );
}

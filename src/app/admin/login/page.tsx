import type { Metadata } from "next";
import Image from "next/image";
import { iniciarSesion } from "@/actions/admin";
import { Alerta, Boton, Tarjeta } from "@/components/ui";
import { Campo, Entrada } from "@/components/campos";

export const metadata: Metadata = { title: "Ingreso de funcionarios" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-coinco-azul px-4 py-10">
      <div className="w-full max-w-md">
        <Image src="/logo-horizontal-blanco.png" alt="Ilustre Municipalidad de Coinco" width={1316} height={487} className="mx-auto mb-6 h-16 w-auto" priority />
        <Tarjeta>
          <h1 className="text-xl font-extrabold text-coinco-azul">Ingreso de funcionarios</h1>
          <p className="mb-4 text-sm text-slate-600">Panel de inscripciones · Regalos de Navidad</p>
          {error && (
            <Alerta tipo="error" className="mb-4">
              {error === "sinperfil" ? "Su usuario no tiene acceso a este panel. Consulte con el administrador." : "Correo o contraseña incorrectos."}
            </Alerta>
          )}
          <form action={iniciarSesion} className="space-y-4">
            <Campo id="email" etiqueta="Correo institucional">
              <Entrada id="email" name="email" type="email" required autoComplete="username" />
            </Campo>
            <Campo id="password" etiqueta="Contraseña">
              <Entrada id="password" name="password" type="password" required autoComplete="current-password" />
            </Campo>
            <Boton type="submit" className="w-full">Ingresar</Boton>
          </form>
        </Tarjeta>
      </div>
    </main>
  );
}

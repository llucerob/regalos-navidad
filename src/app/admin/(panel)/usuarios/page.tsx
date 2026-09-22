import type { Metadata } from "next";
import { Alerta, AvisoUrl, Boton, Tarjeta, Titulo } from "@/components/ui";
import { Campo, Entrada, Seleccion } from "@/components/campos";
import { requerirStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { actualizarUsuario, crearUsuario } from "@/actions/admin";
import { ETIQUETA_ROL } from "@/lib/constants";
import type { Perfil, Rol } from "@/lib/types";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ msg?: string; tipo?: string }> }) {
  const yo = await requerirStaff(["admin"]);
  const sp = await searchParams;
  const { data } = await supabaseAdmin().from("perfiles").select("*").order("nombre");
  const perfiles = (data ?? []) as Perfil[];
  const roles = Object.keys(ETIQUETA_ROL) as Rol[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AvisoUrl msg={sp.msg} tipo={sp.tipo} />
      <Titulo sub="Funcionarios con acceso al panel.">Usuarios</Titulo>
      <Alerta tipo="info">
        <b>Administrador:</b> todo, incluida la exportación. <b>Revisor:</b> revisa y aprueba inscripciones y registra presenciales. <b>Digitador:</b> solo registra inscripciones presenciales y consulta.
      </Alerta>

      <Tarjeta>
        <h2 className="mb-3 font-bold text-coinco-azul">Nuevo usuario</h2>
        <form action={crearUsuario} className="grid gap-3 sm:grid-cols-2">
          <Campo id="u-nom" etiqueta="Nombre completo"><Entrada id="u-nom" name="nombre" required /></Campo>
          <Campo id="u-mail" etiqueta="Correo"><Entrada id="u-mail" name="email" type="email" required /></Campo>
          <Campo id="u-pass" etiqueta="Contraseña temporal" ayuda="Mínimo 10 caracteres. Entréguela por un canal seguro."><Entrada id="u-pass" name="password" type="text" minLength={10} required autoComplete="off" /></Campo>
          <Campo id="u-rol" etiqueta="Rol">
            <Seleccion id="u-rol" name="rol" defaultValue="revisor">{roles.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</Seleccion>
          </Campo>
          <div className="sm:col-span-2"><Boton type="submit">Crear usuario</Boton></div>
        </form>
      </Tarjeta>

      <Tarjeta className="p-0 sm:p-0">
        <ul className="divide-y divide-slate-100">
          {perfiles.map((p) => (
            <li key={p.user_id} className="px-5 py-4">
              <form action={actualizarUsuario} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="userId" value={p.user_id} />
                <div className="min-w-0 flex-1">
                  <p className={p.activo ? "font-bold" : "font-bold text-slate-400 line-through"}>{p.nombre} {p.user_id === yo.userId && <span className="text-xs font-normal text-slate-500">(usted)</span>}</p>
                  <p className="truncate text-sm text-slate-500">{p.email}</p>
                </div>
                <Seleccion name="rol" defaultValue={p.rol} aria-label="Rol" className="w-auto">{roles.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</Seleccion>
                <Seleccion name="activo" defaultValue={String(p.activo)} aria-label="Estado" className="w-auto"><option value="true">Activo</option><option value="false">Desactivado</option></Seleccion>
                <Boton variante="secundario" className="min-h-11">Guardar</Boton>
              </form>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

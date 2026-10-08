"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enviarInscripcion } from "@/actions/inscripcion";
import { Alerta, Boton, Tarjeta } from "./ui";
import { Campo, Entrada, GrupoOpciones, Seleccion, SelectorArchivos, type ArchivoLocal } from "./campos";
import { subirArchivos } from "@/lib/upload-client";
import { docsRequeridosBeneficiario, docsRequeridosHogar } from "@/lib/documentos";
import { edadTexto, esElegiblePorEdad } from "@/lib/edad";
import { esFechaIso, formatearFecha } from "@/lib/fechas";
import { formatearRut, limpiarRut, validarRut } from "@/lib/rut";
import { ETIQUETA_DOC, MAX_BENEFICIARIOS_POR_FORMULARIO } from "@/lib/constants";
import type { ArchivoRef, TipoDoc } from "@/lib/types";

interface BenefForm {
  key: string;
  tipo: "nino" | "gestante";
  rut: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: "" | "F" | "M" | "otro";
  documentoIdentidad: "cedula" | "certificado_nacimiento";
  fechaProbableParto: string;
  docs: Record<string, ArchivoLocal[]>;
}

interface Props {
  modo: "online" | "presencial";
  campana: { nombre: string; fechaReferenciaEdad: string; fechaFin: string };
  hoy: string;
  sectores: { id: string; nombre: string }[];
  puedeAprobarDirecto?: boolean;
}

type Errores = Record<string, string>;

const PASOS = ["Responsable", "Beneficiarios", "Documentos", "Enviar"];

const nuevoBenef = (tipo: "nino" | "gestante"): BenefForm => ({
  key: crypto.randomUUID(),
  tipo,
  rut: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  sexo: "",
  documentoIdentidad: "cedula",
  fechaProbableParto: "",
  docs: {},
});

function pasoDeError(clave: string): number {
  if (clave.startsWith("apoderado") || clave === "tramo" || clave === "residenciaCon") return 0;
  if (clave.startsWith("docsHogar") || clave.includes(".docs.")) return 2;
  if (clave.startsWith("beneficiarios")) return 1;
  return 3;
}

export function FormularioInscripcion({ modo, campana, hoy, sectores, puedeAprobarDirecto }: Props) {
  const router = useRouter();
  const online = modo === "online";
  const sesion = useRef(crypto.randomUUID());
  const subidos = useRef(new Map<string, ArchivoRef>());
  const arriba = useRef<HTMLDivElement>(null);

  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState("");

  const [ap, setAp] = useState({ rut: "", nombres: "", apellidos: "", telefono: "", email: "", direccion: "", sectorId: "" });
  const [residenciaCon, setResidenciaCon] = useState<"rsh" | "certificado_jv">("rsh");
  const [tramo, setTramo] = useState<"" | "hasta_40" | "no_sabe" | "superior">("");
  const [benefs, setBenefs] = useState<BenefForm[]>([]);
  const [docsHogar, setDocsHogar] = useState<Record<string, ArchivoLocal[]>>({});
  const [acepta, setAcepta] = useState(false);
  const [aprobarDirecto, setAprobarDirecto] = useState(false);
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot

  const actualizarBenef = (key: string, cambios: Partial<BenefForm>) =>
    setBenefs((l) => l.map((b) => (b.key === key ? { ...b, ...cambios } : b)));

  // ───────────── Validación por paso (el servidor vuelve a validar todo) ─────────────
  function validar(p: number): Errores {
    const e: Errores = {};
    if (p === 0) {
      if (!validarRut(ap.rut)) e["apoderado.rut"] = "RUT inválido. Revise el número y el dígito verificador.";
      if (ap.nombres.trim().length < 2) e["apoderado.nombres"] = "Ingrese los nombres.";
      if (ap.apellidos.trim().length < 2) e["apoderado.apellidos"] = "Ingrese los apellidos.";
      const tel = ap.telefono.replace(/\D/g, "");
      if (tel.length < 8 || tel.length > 12) e["apoderado.telefono"] = "Ingrese un teléfono válido (por ejemplo 9 1234 5678).";
      if (ap.email && !/^\S+@\S+\.\S+$/.test(ap.email)) e["apoderado.email"] = "Correo electrónico inválido.";
      if (online && !ap.email) e["apoderado.email"] = "Ingrese un correo para enviarle el comprobante y los avisos.";
      if (ap.direccion.trim().length < 5) e["apoderado.direccion"] = "Ingrese su dirección.";
      if (!ap.sectorId) e["apoderado.sectorId"] = "Seleccione su sector o Junta de Vecinos.";
      if (!tramo) e["tramo"] = "Seleccione una opción.";
      //if (tramo === "superior") e["tramo"] = "Solo pueden inscribirse hogares del tramo del 40% del Registro Social de Hogares.";
    }
    if (p === 1) {
      if (!benefs.length) e["beneficiarios"] = "Agregue al menos un niño, niña o madre en gestación.";
      const vistos = new Set<string>();
      benefs.forEach((b, i) => {
        const k = `beneficiarios.${i}`;
        if (b.nombres.trim().length < 2) e[`${k}.nombres`] = "Ingrese los nombres.";
        if (b.apellidos.trim().length < 2) e[`${k}.apellidos`] = "Ingrese los apellidos.";
        if (!validarRut(b.rut)) e[`${k}.rut`] = "RUT inválido.";
        else if (vistos.has(limpiarRut(b.rut))) e[`${k}.rut`] = "Este RUT está repetido en el formulario.";
        vistos.add(limpiarRut(b.rut));
        if (b.tipo === "nino") {
          if (!esFechaIso(b.fechaNacimiento)) e[`${k}.fechaNacimiento`] = "Ingrese la fecha de nacimiento.";
          else if (b.fechaNacimiento > hoy) e[`${k}.fechaNacimiento`] = "La fecha no puede ser futura.";
          else if (!esElegiblePorEdad(b.fechaNacimiento, campana.fechaReferenciaEdad))
            e[`${k}.fechaNacimiento`] = "No cumple el requisito de edad (hasta 4 años, 11 meses y 30 días).";
          if (!b.sexo) e[`${k}.sexo`] = "Seleccione niña o niño.";
        } else if (b.fechaProbableParto && !esFechaIso(b.fechaProbableParto)) {
          e[`${k}.fechaProbableParto`] = "Fecha inválida.";
        }
      });
    }
    if (p === 2 && online) {
      for (const t of docsRequeridosHogar(residenciaCon)) if (!docsHogar[t]?.length) e[`docsHogar.${t}`] = "Falta adjuntar este documento.";
      benefs.forEach((b, i) => {
        for (const t of docsRequeridosBeneficiario(b.tipo, b.documentoIdentidad)) {
          if (!b.docs[t]?.length) e[`beneficiarios.${i}.docs.${t}`] = "Falta adjuntar este documento.";
        }
      });
    }
    if (p === 3 && !acepta) e["aceptaDatos"] = "Debe aceptar para poder enviar la inscripción.";
    return e;
  }

  function irA(destino: number) {
    setPaso(destino);
    setTimeout(() => arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function siguiente() {
    const e = validar(paso);
    setErrores(e);
    if (Object.keys(e).length) {
      setErrorGeneral("Revise los campos marcados en rojo.");
      return;
    }
    setErrorGeneral(null);
    irA(paso + 1);
  }

  async function enviar() {
    for (let p = 0; p <= 3; p++) {
      const e = validar(p);
      if (Object.keys(e).length) {
        setErrores(e);
        setErrorGeneral("Faltan datos por completar. Revise los campos marcados en rojo.");
        irA(p);
        return;
      }
    }
    setEnviando(true);
    setErrorGeneral(null);
    setErrores({});

    // 1) Subir archivos directo a Storage
    const items = [
      ...Object.values(docsHogar).flat(),
      ...benefs.flatMap((b) => Object.values(b.docs).flat()),
    ].map((a) => ({ id: a.id, file: a.file }));
    setProgreso(items.length ? "Subiendo documentos…" : "Enviando inscripción…");
    const sub = await subirArchivos(sesion.current, items, subidos.current, (h, t) => setProgreso(`Subiendo documentos ${h} de ${t}…`));
    if (!sub.ok) {
      setEnviando(false);
      setErrorGeneral(sub.error);
      return;
    }

    // 2) Enviar el formulario con las referencias
    const refs = (lista: ArchivoLocal[] | undefined) => (lista ?? []).map((a) => subidos.current.get(a.id)!).filter(Boolean);
    const mapaDocs = (docs: Record<string, ArchivoLocal[]>) =>
      Object.fromEntries(Object.entries(docs).filter(([, l]) => l.length).map(([t, l]) => [t, refs(l)]));

    setProgreso("Enviando inscripción…");
    const res = await enviarInscripcion({
      uploadSession: sesion.current,
      modo,
      apoderado: { ...ap, email: ap.email.trim() },
      residenciaCon,
      tramo,
      beneficiarios: benefs.map((b) => ({
        tipo: b.tipo,
        rut: b.rut,
        nombres: b.nombres,
        apellidos: b.apellidos,
        fechaNacimiento: b.fechaNacimiento || undefined,
        sexo: b.tipo === "gestante" ? "F" : b.sexo || undefined,
        documentoIdentidad: b.tipo === "nino" ? b.documentoIdentidad : undefined,
        fechaProbableParto: b.fechaProbableParto || undefined,
        docs: mapaDocs(b.docs),
      })),
      docsHogar: mapaDocs(docsHogar),
      aceptaDatos: acepta,
      aprobarDirecto: puedeAprobarDirecto ? aprobarDirecto : undefined,
      sitioWeb,
    });
    setEnviando(false);

    if (!res.ok) {
      setErrorGeneral(res.error);
      if (res.campos && Object.keys(res.campos).length) {
        setErrores(res.campos);
        irA(Math.min(...Object.keys(res.campos).map(pasoDeError)));
      }
      return;
    }
    if (online) router.push(`/inscripcion/exito?folio=${encodeURIComponent(res.folio)}`);
    else router.push(`/admin/inscripciones/${res.id}?msg=${encodeURIComponent(`Inscripción registrada. Folio ${res.folio}.`)}&tipo=ok`);
  }

  const err = (k: string) => errores[k];

  // ─────────────────────────────── Render ───────────────────────────────
  return (
    <div ref={arriba} className="scroll-mt-4">
      <ol className="mb-5 grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Pasos de la inscripción">
        {PASOS.map((t, i) => (
          <li key={t} aria-current={i === paso ? "step" : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full ${i < paso ? "bg-coinco-verde" : i === paso ? "bg-coinco-amarillo" : "bg-slate-300"}`} />
            <p className={`mt-1.5 truncate text-[11px] font-bold sm:text-sm ${i === paso ? "text-coinco-azul" : "text-slate-500"}`}>
              <span className="hidden sm:inline">{i + 1}. </span>
              {t}
            </p>
          </li>
        ))}
      </ol>

      {errorGeneral && <Alerta tipo="error" className="mb-4">{errorGeneral}</Alerta>}

      {/* Honeypot: invisible para personas */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} />
        </label>
      </div>

      {/* ── Paso 1: adulto responsable ── */}
      {paso === 0 && (
        <Tarjeta>
          <h2 className="mb-1 text-xl font-bold text-coinco-azul">Datos del adulto responsable</h2>
          <p className="mb-5 text-sm text-slate-600">Es la persona que inscribe y retirará los regalos.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ap-rut" etiqueta="RUT" requerido error={err("apoderado.rut")} ayuda="Ejemplo: 12.345.678-5">
              <Entrada id="ap-rut" value={ap.rut} inputMode="text" autoComplete="off" error={err("apoderado.rut")}
                onChange={(e) => setAp({ ...ap, rut: e.target.value })}
                onBlur={() => validarRut(ap.rut) && setAp((a) => ({ ...a, rut: formatearRut(a.rut) }))} />
            </Campo>
            <Campo id="ap-tel" etiqueta="Teléfono de contacto" requerido error={err("apoderado.telefono")}>
              <Entrada id="ap-tel" type="tel" inputMode="tel" autoComplete="tel" value={ap.telefono} error={err("apoderado.telefono")}
                onChange={(e) => setAp({ ...ap, telefono: e.target.value })} />
            </Campo>
            <Campo id="ap-nom" etiqueta="Nombres" requerido error={err("apoderado.nombres")}>
              <Entrada id="ap-nom" autoComplete="given-name" value={ap.nombres} error={err("apoderado.nombres")} onChange={(e) => setAp({ ...ap, nombres: e.target.value })} />
            </Campo>
            <Campo id="ap-ape" etiqueta="Apellidos" requerido error={err("apoderado.apellidos")}>
              <Entrada id="ap-ape" autoComplete="family-name" value={ap.apellidos} error={err("apoderado.apellidos")} onChange={(e) => setAp({ ...ap, apellidos: e.target.value })} />
            </Campo>
            <Campo id="ap-mail" etiqueta="Correo electrónico" requerido={online} error={err("apoderado.email")}
              ayuda={online ? "Le enviaremos el comprobante y los avisos sobre su inscripción." : "Opcional: para enviarle el comprobante."} className="sm:col-span-2">
              <Entrada id="ap-mail" type="email" inputMode="email" autoComplete="email" value={ap.email} error={err("apoderado.email")} onChange={(e) => setAp({ ...ap, email: e.target.value })} />
            </Campo>
            <Campo id="ap-dir" etiqueta="Dirección en Coinco" requerido error={err("apoderado.direccion")} className="sm:col-span-2">
              <Entrada id="ap-dir" autoComplete="street-address" value={ap.direccion} error={err("apoderado.direccion")} onChange={(e) => setAp({ ...ap, direccion: e.target.value })} />
            </Campo>
            <Campo id="ap-sector" etiqueta="Sector o Junta de Vecinos" requerido error={err("apoderado.sectorId")} className="sm:col-span-2">
              <Seleccion id="ap-sector" value={ap.sectorId} error={err("apoderado.sectorId")} onChange={(e) => setAp({ ...ap, sectorId: e.target.value })}>
                <option value="">Seleccione…</option>
                {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Seleccion>
            </Campo>
          </div>

          <hr className="my-6 border-slate-200" />
          <h3 className="mb-1 font-bold text-coinco-azul">Residencia y Registro Social de Hogares</h3>
          <p className="mb-3 text-sm text-slate-600">Los beneficiarios deben residir en Coinco y pertenecer al tramo del 40% del Registro Social de Hogares.</p>
          <p className="mb-2 text-sm font-semibold text-coinco-azul">¿Cómo acredita su residencia?</p>
          <GrupoOpciones nombre="residencia" valor={residenciaCon} onChange={setResidenciaCon} columnas
            opciones={[
              { valor: "rsh", texto: "Cartola del Registro Social de Hogares" },
              { valor: "certificado_jv", texto: "Certificado de residencia de la Junta de Vecinos", detalle: "También deberá adjuntar la cartola para verificar el tramo." },
            ]} />
          <p className="mb-2 mt-5 text-sm font-semibold text-coinco-azul">Tramo del Registro Social de Hogares <span className="text-coinco-rojo">*</span></p>
          <GrupoOpciones nombre="tramo" valor={tramo} onChange={setTramo} error={err("tramo")}
            opciones={[
              { valor: "hasta_40", texto: "Mi hogar está en el tramo del 40% o menos" },
              { valor: "no_sabe", texto: "No estoy seguro(a)", detalle: "Un funcionario lo verificará con su cartola." },
              { valor: "superior", texto: "Mi hogar está en un tramo superior al 40%", detalle: "Puede inscribirse igual; un funcionario revisará su caso con la cartola." },
            ]} />
        </Tarjeta>
      )}

      {/* ── Paso 2: beneficiarios ── */}
      {paso === 1 && (
        <div className="space-y-4">
          <Tarjeta>
            <h2 className="mb-1 text-xl font-bold text-coinco-azul">¿Quién recibirá regalo?</h2>
            <p className="text-sm text-slate-600">
              Puede inscribir a madres en proceso de gestación y a niñas y niños de hasta 4 años, 11 meses y 30 días
              (edad medida al {formatearFecha(campana.fechaReferenciaEdad)}).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton type="button" variante="secundario" disabled={benefs.length >= MAX_BENEFICIARIOS_POR_FORMULARIO} onClick={() => setBenefs((l) => [...l, nuevoBenef("nino")])}>
                ＋ Agregar niño o niña
              </Boton>
              <Boton type="button" variante="secundario" disabled={benefs.length >= MAX_BENEFICIARIOS_POR_FORMULARIO} onClick={() => setBenefs((l) => [...l, nuevoBenef("gestante")])}>
                ＋ Agregar madre en gestación
              </Boton>
            </div>
            {err("beneficiarios") && <p role="alert" className="mt-3 text-sm font-medium text-[#b3202f]">{err("beneficiarios")}</p>}
          </Tarjeta>

          {benefs.map((b, i) => {
            const k = `beneficiarios.${i}`;
            const elegible = b.tipo === "nino" && esFechaIso(b.fechaNacimiento) && b.fechaNacimiento <= hoy ? esElegiblePorEdad(b.fechaNacimiento, campana.fechaReferenciaEdad) : null;
            return (
              <Tarjeta key={b.key}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-coinco-azul">{i + 1}. {b.tipo === "nino" ? "Niño o niña" : "Madre en proceso de gestación"}</h3>
                  <button type="button" className="min-h-9 rounded-md px-3 text-sm font-semibold text-[#b3202f] hover:bg-coinco-rojo/10" onClick={() => setBenefs((l) => l.filter((x) => x.key !== b.key))}>
                    Quitar
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo id={`b${i}-nom`} etiqueta="Nombres" requerido error={err(`${k}.nombres`)}>
                    <Entrada id={`b${i}-nom`} value={b.nombres} error={err(`${k}.nombres`)} onChange={(e) => actualizarBenef(b.key, { nombres: e.target.value })} />
                  </Campo>
                  <Campo id={`b${i}-ape`} etiqueta="Apellidos" requerido error={err(`${k}.apellidos`)}>
                    <Entrada id={`b${i}-ape`} value={b.apellidos} error={err(`${k}.apellidos`)} onChange={(e) => actualizarBenef(b.key, { apellidos: e.target.value })} />
                  </Campo>
                  <Campo id={`b${i}-rut`} etiqueta="RUT" requerido error={err(`${k}.rut`)}>
                    <Entrada id={`b${i}-rut`} value={b.rut} autoComplete="off" error={err(`${k}.rut`)}
                      onChange={(e) => actualizarBenef(b.key, { rut: e.target.value })}
                      onBlur={() => validarRut(b.rut) && actualizarBenef(b.key, { rut: formatearRut(b.rut) })} />
                  </Campo>
                  {b.tipo === "nino" ? (
                    <Campo id={`b${i}-nac`} etiqueta="Fecha de nacimiento" requerido error={err(`${k}.fechaNacimiento`)}>
                      <Entrada id={`b${i}-nac`} type="date" max={hoy} value={b.fechaNacimiento} error={err(`${k}.fechaNacimiento`)}
                        onChange={(e) => actualizarBenef(b.key, { fechaNacimiento: e.target.value })} />
                    </Campo>
                  ) : (
                    <Campo id={`b${i}-fpp`} etiqueta="Fecha probable de parto" error={err(`${k}.fechaProbableParto`)} ayuda="Opcional. Aparece en el carnet de control de embarazo.">
                      <Entrada id={`b${i}-fpp`} type="date" value={b.fechaProbableParto} error={err(`${k}.fechaProbableParto`)}
                        onChange={(e) => actualizarBenef(b.key, { fechaProbableParto: e.target.value })} />
                    </Campo>
                  )}
                </div>

                {b.tipo === "nino" && (
                  <>
                    {elegible !== null && (
                      <Alerta tipo={elegible ? "ok" : "error"} className="mt-4">
                        {elegible
                          ? `Edad al ${formatearFecha(campana.fechaReferenciaEdad)}: ${edadTexto(b.fechaNacimiento, campana.fechaReferenciaEdad)}. Cumple el requisito de edad.`
                          : "No cumple el requisito de edad: el regalo se entrega hasta los 4 años, 11 meses y 30 días."}
                      </Alerta>
                    )}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm font-semibold text-coinco-azul">Sexo <span className="text-coinco-rojo">*</span></p>
                        <GrupoOpciones nombre={`sexo-${b.key}`} valor={b.sexo} error={err(`${k}.sexo`)} onChange={(v) => actualizarBenef(b.key, { sexo: v })}
                          opciones={[{ valor: "F", texto: "Niña" }, { valor: "M", texto: "Niño" }]} />
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-coinco-azul">Se identifica con <span className="text-coinco-rojo">*</span></p>
                        <GrupoOpciones nombre={`doc-${b.key}`} valor={b.documentoIdentidad} onChange={(v) => actualizarBenef(b.key, { documentoIdentidad: v })}
                          opciones={[{ valor: "cedula", texto: "Cédula de identidad" }, { valor: "certificado_nacimiento", texto: "Certificado de nacimiento", detalle: "Si aún no tiene cédula." }]} />
                      </div>
                    </div>
                  </>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}

      {/* ── Paso 3: documentos ── */}
      {paso === 2 && (
        <div className="space-y-4">
          <Alerta tipo="info">
            {online
              ? "Adjunte una foto clara (o PDF) de cada documento. Pueden ser fotos tomadas con el celular; deben verse completas y legibles. Máximo 5 MB por archivo."
              : "Registro presencial: adjuntar copias digitalizadas es opcional. Si ya verificó los documentos en persona, puede continuar."}
          </Alerta>
          <Tarjeta>
            <h2 className="mb-3 text-lg font-bold text-coinco-azul">Documentos del hogar</h2>
            <div className="space-y-3">
              {docsRequeridosHogar(residenciaCon).map((t) => (
                <SelectorArchivos key={t} id={`hogar-${t}`} etiqueta={ETIQUETA_DOC[t]} requerido={online}
                  ayuda={t === "cartola_rsh" ? "Descárguela en registrosocial.gob.cl o pídala en la Municipalidad. Con ella se verifica el tramo del 40%." : "Emitido por la Junta de Vecinos de su sector."}
                  archivos={docsHogar[t] ?? []} error={err(`docsHogar.${t}`)} onChange={(a) => setDocsHogar((d) => ({ ...d, [t]: a }))} />
              ))}
            </div>
          </Tarjeta>
          {benefs.map((b, i) => (
            <Tarjeta key={b.key}>
              <h2 className="mb-3 text-lg font-bold text-coinco-azul">
                {b.nombres || (b.tipo === "nino" ? "Niño o niña" : "Madre en gestación")} {b.apellidos}
              </h2>
              <div className="space-y-3">
                {docsRequeridosBeneficiario(b.tipo, b.documentoIdentidad).map((t: TipoDoc) => (
                  <SelectorArchivos key={t} id={`b${i}-${t}`} etiqueta={ETIQUETA_DOC[t]} requerido={online}
                    ayuda={t === "cedula" ? "Por ambos lados. Puede subir dos fotos." : undefined}
                    archivos={b.docs[t] ?? []} error={err(`beneficiarios.${i}.docs.${t}`)}
                    onChange={(a) => actualizarBenef(b.key, { docs: { ...b.docs, [t]: a } })} />
                ))}
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      {/* ── Paso 4: revisión ── */}
      {paso === 3 && (
        <Tarjeta>
          <h2 className="mb-4 text-xl font-bold text-coinco-azul">Revise sus datos</h2>
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            {[
              ["Adulto responsable", `${ap.nombres} ${ap.apellidos}`],
              ["RUT", ap.rut],
              ["Teléfono", ap.telefono],
              ["Correo", ap.email || "—"],
              ["Dirección", ap.direccion],
              ["Sector", sectores.find((s) => s.id === ap.sectorId)?.nombre ?? ""],
            ].map(([t, v]) => (
              <div key={t}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{t}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <h3 className="mb-2 mt-5 font-bold text-coinco-azul">Beneficiarios ({benefs.length})</h3>
          <ul className="space-y-1 text-[15px]">
            {benefs.map((b) => (
              <li key={b.key} className="rounded-lg bg-coinco-fondo px-3 py-2">
                <b>{b.nombres} {b.apellidos}</b> · {b.rut} · {b.tipo === "gestante" ? "Madre en gestación" : `${b.sexo === "F" ? "Niña" : "Niño"}, ${b.fechaNacimiento ? edadTexto(b.fechaNacimiento, campana.fechaReferenciaEdad) : ""}`}
                <span className="text-slate-500"> · {Object.values(b.docs).flat().length} archivo(s)</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-500">Documentos del hogar: {Object.values(docsHogar).flat().length} archivo(s).</p>

          <div className="mt-6 space-y-3">
            {puedeAprobarDirecto && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-coinco-amarillo bg-coinco-amarillo/10 p-3 text-[15px]">
                <input type="checkbox" checked={aprobarDirecto} onChange={(e) => setAprobarDirecto(e.target.checked)} className="mt-1 size-5 accent-[#003169]" />
                <span><b>Aprobar de inmediato.</b> Verifiqué en persona la residencia, el tramo del 40% con la cartola y los documentos de identidad.</span>
              </label>
            )}
            <label className="flex cursor-pointer items-start gap-3 text-[15px]">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 size-5 accent-[#003169]" />
              <span>
                {online ? "Declaro que la información entregada es verdadera y autorizo" : "Se informó al adulto responsable que la información debe ser verdadera y que se usarán sus datos"} a la Ilustre Municipalidad de Coinco a
                usar mis datos y los de los beneficiarios solo para gestionar la entrega de los regalos de Navidad y comunicarse conmigo.
              </span>
            </label>
            {err("aceptaDatos") && <p role="alert" className="text-sm font-medium text-[#b3202f]">{err("aceptaDatos")}</p>}
          </div>
        </Tarjeta>
      )}

      {/* ── Navegación ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Boton type="button" variante="fantasma" disabled={paso === 0 || enviando} onClick={() => { setErrorGeneral(null); irA(paso - 1); }}>
          ← Volver
        </Boton>
        {paso < 3 ? (
          <Boton type="button" onClick={siguiente}>Continuar →</Boton>
        ) : (
          <Boton type="button" variante="acento" disabled={enviando} onClick={enviar} className="min-w-52">
            {enviando ? progreso || "Enviando…" : "Enviar inscripción"}
          </Boton>
        )}
      </div>
    </div>
  );
}

"use client";
import { Boton } from "./ui";

export function BotonImprimir() {
  return <Boton type="button" variante="primario" onClick={() => window.print()}>Imprimir comprobante</Boton>;
}

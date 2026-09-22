/** Utilidades para RUT chileno (módulo 11). */

export function limpiarRut(valor: string): string {
  return valor.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function calcularDv(cuerpo: string): string {
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/** Valida formato (7 a 9 dígitos + DV) y dígito verificador. */
export function validarRut(valor: string): boolean {
  const limpio = limpiarRut(valor);
  if (limpio.length < 8 || limpio.length > 10) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  if (/^(\d)\1+$/.test(cuerpo)) return false; // 11111111, 22222222…
  return calcularDv(cuerpo) === dv;
}

/** Forma canónica para guardar: sin puntos y con guion → 12345678-5. */
export function normalizarRut(valor: string): string {
  const limpio = limpiarRut(valor);
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/** Forma legible: 12.345.678-5 */
export function formatearRut(valor: string): string {
  const limpio = limpiarRut(valor);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
}

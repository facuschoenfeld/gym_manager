/**
 * Estado de la cuota de un socio. ÚNICA fuente de verdad: no se guarda en la base,
 * se deriva del último `vence_el` de sus pagos NO anulados.
 *
 *  - sin_pagos : nunca pagó (o todos sus pagos están anulados)
 *  - vencido   : vence_el + días de gracia < hoy
 *  - por_vencer: vence_el <= hoy + días para "por vencer" (incluye el período de gracia)
 *  - pago      : en otro caso
 */
import { diferenciaDias, sumarDias, type FechaISO } from "./fechas";

export type EstadoSocio = "pago" | "por_vencer" | "vencido" | "sin_pagos";

export interface ParametrosEstado {
  diasPorVencer: number;
  diasGracia: number;
}

export function calcularEstado(
  venceEl: FechaISO | null | undefined,
  hoy: FechaISO,
  { diasPorVencer, diasGracia }: ParametrosEstado,
): EstadoSocio {
  if (!venceEl) return "sin_pagos";
  if (sumarDias(venceEl, diasGracia) < hoy) return "vencido"; // comparar ISO como texto es válido
  if (venceEl <= sumarDias(hoy, diasPorVencer)) return "por_vencer";
  return "pago";
}

/** Días que faltan para el vencimiento (negativo = ya venció). null si no tiene pagos. */
export function diasParaVencer(venceEl: FechaISO | null | undefined, hoy: FechaISO): number | null {
  return venceEl ? diferenciaDias(hoy, venceEl) : null;
}

/** Días de atraso (0 si no está atrasado). */
export function diasDeAtraso(venceEl: FechaISO | null | undefined, hoy: FechaISO): number {
  const d = diasParaVencer(venceEl, hoy);
  return d !== null && d < 0 ? -d : 0;
}

/** Texto corto para mostrar junto al estado: "Vence hoy", "Vence en 3 días", "Venció hace 5 días". */
export function describirVencimiento(venceEl: FechaISO | null | undefined, hoy: FechaISO): string {
  const d = diasParaVencer(venceEl, hoy);
  if (d === null) return "Sin pagos registrados";
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  if (d > 1) return `Vence en ${d} días`;
  if (d === -1) return "Venció ayer";
  return `Venció hace ${-d} días`;
}

/** Orden para listados de deudores: primero los más atrasados. */
export const PRIORIDAD_ESTADO: Record<EstadoSocio, number> = {
  vencido: 0,
  por_vencer: 1,
  sin_pagos: 2,
  pago: 3,
};

/**
 * Cálculo del nuevo vencimiento al registrar un pago (F-PAG-05, configurable).
 *
 * Reglas:
 *  - 'desde_vencimiento_anterior' (por defecto): si el socio está al día o dentro de los
 *    días de gracia a la fecha del pago, el período nuevo empieza donde terminó el anterior
 *    (no pierde ni gana días). Si está vencido (pasada la gracia) o no tiene pagos, el
 *    período empieza el día del pago.
 *  - 'desde_fecha_pago': el período siempre empieza el día del pago.
 */
import { sumarDias, sumarPeriodo, type FechaISO, type Periodo } from "./fechas";

export type ReglaVencimiento = "desde_vencimiento_anterior" | "desde_fecha_pago";

export const REGLAS_VENCIMIENTO: Record<ReglaVencimiento, string> = {
  desde_vencimiento_anterior:
    "Continuar desde el vencimiento anterior si todavía está al día (recomendado)",
  desde_fecha_pago: "Siempre desde la fecha de pago",
};

export interface DatosNuevoVencimiento {
  regla: ReglaVencimiento;
  fechaPago: FechaISO;
  venceElAnterior: FechaISO | null;
  periodo: Periodo;
  cantidad: number;
  diasGracia: number;
}

/** Fecha desde la cual se cuenta el nuevo período. */
export function inicioDelPeriodo(d: Omit<DatosNuevoVencimiento, "periodo" | "cantidad">): FechaISO {
  if (
    d.regla === "desde_vencimiento_anterior" &&
    d.venceElAnterior !== null &&
    sumarDias(d.venceElAnterior, d.diasGracia) >= d.fechaPago
  ) {
    return d.venceElAnterior;
  }
  return d.fechaPago;
}

export function calcularNuevoVencimiento(d: DatosNuevoVencimiento): FechaISO {
  return sumarPeriodo(inicioDelPeriodo(d), d.periodo, d.cantidad);
}

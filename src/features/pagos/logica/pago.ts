/**
 * Pagos: validación del formulario de registro y de la anulación, y elección del plan
 * por defecto. Todo puro (sin base de datos ni React) para poder testearlo.
 */
import { z } from "zod";
import { PRECIO_MAXIMO_CENTAVOS, type Plan } from "@/features/planes/logica/plan";
import { parsearPesos } from "@/lib/dinero";
import { esFechaISOValida, type FechaISO } from "@/lib/fechas";
import { limpiarEspacios } from "@/lib/texto";

export type MedioPago = "efectivo" | "transferencia";

export const MEDIOS_PAGO: { valor: MedioPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
];

/** Lo que escribe el usuario en el formulario (todo texto, salvo el medio). */
export interface FormularioPago {
  planId: string;
  monto: string;
  fechaPago: string;
  medio: MedioPago;
  referencia: string;
}

export const FORMULARIO_PAGO_VACIO: FormularioPago = {
  planId: "",
  monto: "",
  fechaPago: "",
  medio: "efectivo",
  referencia: "",
};

/** Largo máximo de la referencia (n.º de operación o nota). */
export const LARGO_REFERENCIA = 100;

/**
 * Esquema del registro de pago. Depende de "hoy" porque la fecha no puede ser futura.
 * Monto 0 es válido: los planes arrancan con precio 0 y puede haber pagos sin cargo (convenio, cortesía).
 */
export function crearEsquemaPago(hoy: FechaISO) {
  return z.object({
    planId: z
      .string()
      .regex(/^\d+$/, "Elegí un plan")
      .transform(Number),
    monto: z
      .string()
      .transform((texto, ctx) => {
        const centavos = parsearPesos(texto);
        if (centavos === null) {
          ctx.addIssue({ code: "custom", message: "Escribí un monto válido, por ejemplo 15000 o 15.000,50" });
          return z.NEVER;
        }
        return centavos;
      })
      .pipe(
        z.number().int().max(PRECIO_MAXIMO_CENTAVOS, "El monto es demasiado alto (máximo $ 100.000.000)"),
      ),
    fechaPago: z
      .string()
      .refine(esFechaISOValida, "Elegí una fecha válida")
      .refine((f) => f <= hoy, "La fecha de pago no puede ser futura"),
    medio: z.enum(["efectivo", "transferencia"], { message: "Elegí el medio de pago" }),
    referencia: z
      .string()
      .transform(limpiarEspacios)
      .transform((t) => (t === "" ? null : t))
      .pipe(z.string().max(LARGO_REFERENCIA, `Máximo ${LARGO_REFERENCIA} caracteres`).nullable()),
  });
}

export type DatosPagoForm = z.output<ReturnType<typeof crearEsquemaPago>>;

/** Motivo de la anulación (obligatorio: la fila no se borra, queda constancia del motivo). */
export const esquemaAnulacion = z.object({
  motivo: z
    .string()
    .transform(limpiarEspacios)
    .pipe(
      z
        .string()
        .min(1, "Escribí el motivo de la anulación")
        .max(LARGO_REFERENCIA, `Máximo ${LARGO_REFERENCIA} caracteres`),
    ),
});

/**
 * Plan que se propone al registrar un pago: el plan actual del socio si sigue disponible;
 * si no, el mensual de 1 mes; si tampoco, el primero activo.
 */
export function planPorDefectoParaPago(planes: Plan[], planActualId: number | null): Plan | null {
  const activos = planes.filter((p) => p.activo);
  const actual = planes.find((p) => p.id === planActualId);
  // El plan actual del socio se propone aunque esté inactivo (así lo muestra el formulario de socio).
  if (actual) return actual;
  return activos.find((p) => p.periodo === "mes" && p.cantidad === 1) ?? activos[0] ?? null;
}

export interface PagoParaEstado {
  id: number;
  fechaPago: FechaISO;
  venceEl: FechaISO;
  anulado: boolean;
}

/**
 * Vencimiento que quedaría si se anulara el pago `idAnulado`: el mayor de los demás pagos no anulados.
 * null si no le quedaría ningún pago vigente (el socio pasaría a "sin pagos").
 */
export function venceElSinPago(pagos: PagoParaEstado[], idAnulado: number): FechaISO | null {
  const vigentes = pagos.filter((p) => !p.anulado && p.id !== idAnulado).map((p) => p.venceEl);
  return vigentes.length > 0 ? vigentes.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * ¿Hay pagos cargados después del que se quiere anular? Si los hay, sus vencimientos se calcularon
 * a partir de este y NO se recalculan al anularlo: la anulación solo marca la fila (historial).
 */
export function hayPagosPosteriores(pagos: PagoParaEstado[], idAnulado: number): boolean {
  const pago = pagos.find((p) => p.id === idAnulado);
  if (!pago) return false;
  return pagos.some(
    (p) =>
      !p.anulado &&
      p.id !== idAnulado &&
      (p.fechaPago > pago.fechaPago || (p.fechaPago === pago.fechaPago && p.id > pago.id)),
  );
}

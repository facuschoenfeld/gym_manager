/** Avisos enviados por WhatsApp (tabla avisos) e ingresos del mes (tabla pagos). */
import type { FechaISO } from "@/lib/fechas";
import { rangoDelMes } from "@/lib/fechas";
import { consultarUno, ejecutar } from "../client";

export type TipoAviso = "por_vencer" | "vencida";

/** Registra que se abrió un aviso para el socio (para no insistir de más y mostrar "último aviso"). */
export async function registrarAviso(clienteId: number, tipo: TipoAviso): Promise<void> {
  await ejecutar("INSERT INTO avisos (cliente_id, tipo) VALUES ($1, $2)", [clienteId, tipo]);
}

export interface IngresosMes {
  /** Centavos: suma de los pagos no anulados del mes. */
  total: number;
  cantidad: number;
}

/** Ingresos del mes de la fecha dada: suma de pagos no anulados. Usa rango de fechas para aprovechar el índice. */
export async function ingresosDelMes(hoy: FechaISO): Promise<IngresosMes> {
  const { desde, hasta } = rangoDelMes(hoy);
  const fila = await consultarUno<{ total: number; cantidad: number }>(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
       FROM pagos
      WHERE anulado = 0 AND fecha_pago BETWEEN $1 AND $2
        -- Los registros de importación sin cobro (monto 0, solo guardan un vencimiento) no son ingresos.
        AND NOT (origen = 'importacion' AND monto = 0)`,
    [desde, hasta],
  );
  return { total: fila?.total ?? 0, cantidad: fila?.cantidad ?? 0 };
}

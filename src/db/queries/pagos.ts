/** Consultas de pagos. Los pagos no se borran: se anulan con motivo (el historial queda completo). */
import type { MedioPago } from "@/features/pagos/logica/pago";
import type { FechaISO } from "@/lib/fechas";
import { consultar, ejecutar } from "../client";

export interface Pago {
  id: number;
  planNombre: string | null;
  /** Centavos. */
  monto: number;
  fechaPago: FechaISO;
  venceEl: FechaISO;
  medio: MedioPago;
  referencia: string | null;
  origen: "manual" | "importacion";
  anulado: boolean;
  anuladoEl: string | null;
  anuladoMotivo: string | null;
}

interface FilaPago {
  id: number;
  plan_nombre: string | null;
  monto: number;
  fecha_pago: string;
  vence_el: string;
  medio: "efectivo" | "transferencia";
  referencia: string | null;
  origen: "manual" | "importacion";
  anulado: number;
  anulado_el: string | null;
  anulado_motivo: string | null;
}

/** Historial completo de un socio, del más reciente al más antiguo (incluye anulados). */
export async function listarPagosDeSocio(socioId: number): Promise<Pago[]> {
  const filas = await consultar<FilaPago>(
    `SELECT p.id, pl.nombre AS plan_nombre, p.monto, p.fecha_pago, p.vence_el, p.medio, p.referencia,
            p.origen, p.anulado, p.anulado_el, p.anulado_motivo
     FROM pagos p LEFT JOIN planes pl ON pl.id = p.plan_id
     WHERE p.cliente_id = $1
     ORDER BY p.fecha_pago DESC, p.id DESC`,
    [socioId],
  );
  return filas.map((f) => ({
    id: f.id,
    planNombre: f.plan_nombre,
    monto: f.monto,
    fechaPago: f.fecha_pago,
    venceEl: f.vence_el,
    medio: f.medio,
    referencia: f.referencia,
    origen: f.origen,
    anulado: f.anulado === 1,
    anuladoEl: f.anulado_el,
    anuladoMotivo: f.anulado_motivo,
  }));
}

export interface DatosRegistroPago {
  socioId: number;
  planId: number;
  /** Centavos. */
  monto: number;
  /** Fecha en que se cobró (ISO). */
  fechaPago: FechaISO;
  /** Hasta cuándo cubre el pago (ISO). */
  venceEl: FechaISO;
  medio: MedioPago;
  referencia: string | null;
}

/**
 * Registra un pago manual. El monto y el plan se guardan en la fila: cambiar el plan o su precio
 * después no altera este pago. Una sola sentencia, así que no hace falta transacción.
 */
export async function registrarPago(d: DatosRegistroPago): Promise<number | null> {
  const r = await ejecutar(
    `INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, vence_el, medio, referencia, origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
    [d.socioId, d.planId, d.monto, d.fechaPago, d.venceEl, d.medio, d.referencia],
  );
  return r.ultimoId;
}

/**
 * Anula un pago: no se borra, se marca con fecha y motivo. El estado del socio se recalcula solo
 * (se deriva de los pagos no anulados). El WHERE evita anular dos veces el mismo pago.
 */
export async function anularPago(id: number, motivo: string): Promise<void> {
  const r = await ejecutar(
    `UPDATE pagos
     SET anulado = 1, anulado_el = datetime('now', 'localtime'), anulado_motivo = $2
     WHERE id = $1 AND anulado = 0`,
    [id, motivo],
  );
  if (r.filasAfectadas !== 1) {
    throw new Error("El pago ya estaba anulado o ya no existe. Actualizá la pantalla para ver el estado actual.");
  }
}

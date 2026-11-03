/** Consultas de pagos. En la fase 2 solo se lee el historial; registrar y anular llegan en la fase 3. */
import type { FechaISO } from "@/lib/fechas";
import { consultar } from "../client";

export interface Pago {
  id: number;
  planNombre: string | null;
  /** Centavos. */
  monto: number;
  fechaPago: FechaISO;
  venceEl: FechaISO;
  medio: "efectivo" | "transferencia";
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

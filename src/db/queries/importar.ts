/**
 * Escritura de la importación de socios. Todo va en un único lote (ejecutarLote): o se importa todo
 * o no se importa nada. Los pagos importados quedan con origen 'importacion'.
 */
import type { AccionImportacion, SocioImportable } from "@/features/importar/logica/importar";
import { consultar, ejecutarLote, type Sentencia } from "../client";

/** Medio de pago que se asigna a los pagos importados (el Excel no lo trae). */
export const MEDIO_PAGO_IMPORTADO = "efectivo";

/** Clave "clienteId|fecha" de los pagos vigentes, para no duplicar un pago del mismo día. */
export const claveDePago = (clienteId: number, fechaPago: string) => `${clienteId}|${fechaPago}`;

/** Pagos vigentes de todos los socios, como claves (ver claveDePago). */
export async function listarClavesDePagosVigentes(): Promise<Set<string>> {
  const filas = await consultar<{ cliente_id: number; fecha_pago: string }>(
    "SELECT cliente_id, fecha_pago FROM pagos WHERE anulado = 0",
  );
  return new Set(filas.map((f) => claveDePago(f.cliente_id, f.fecha_pago)));
}

function sentenciaPago(clienteId: number | "ultimo", socio: SocioImportable): Sentencia | null {
  if (!socio.pago) return null;
  const { fechaPago, venceEl, monto, referencia } = socio.pago;
  if (clienteId === "ultimo") {
    // Socio nuevo: el id es el último insertado en este mismo lote (la sentencia anterior).
    return {
      sql: `INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, vence_el, medio, referencia, origen)
            VALUES (last_insert_rowid(), $1, $2, $3, $4, $5, $6, 'importacion')`,
      parametros: [socio.planId, monto, fechaPago, venceEl, MEDIO_PAGO_IMPORTADO, referencia],
    };
  }
  return {
    sql: `INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, vence_el, medio, referencia, origen)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'importacion')`,
    parametros: [clienteId, socio.planId, monto, fechaPago, venceEl, MEDIO_PAGO_IMPORTADO, referencia],
  };
}

/** Resultado de la escritura. */
export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
  pagosCreados: number;
  /** Pagos que no se cargaron porque ese socio ya tenía un pago vigente ese día. */
  pagosOmitidos: number;
}

/**
 * Aplica las acciones en una transacción. Actualizar nunca borra datos: un campo vacío del archivo
 * (null) deja el valor que ya tenía el socio (COALESCE).
 */
export async function ejecutarImportacion(
  acciones: AccionImportacion[],
  pagosExistentes: Set<string>,
): Promise<ResultadoImportacion> {
  const sentencias: Sentencia[] = [];
  // Copia de trabajo: cada pago que se agrega al lote cuenta para los siguientes (dos filas del mismo
  // socio no pueden cargar dos pagos el mismo día: el índice ux_pagos_socio_dia rechazaría todo el lote).
  const claves = new Set(pagosExistentes);
  let pagosCreados = 0;
  let pagosOmitidos = 0;
  let creados = 0;
  let actualizados = 0;

  for (const a of acciones) {
    const s = a.socio;
    if (a.tipo === "crear") {
      creados++;
      sentencias.push({
        sql: `INSERT INTO clientes (nombre, apellido, dni, telefono, email, plan_id)
              VALUES ($1, $2, $3, $4, $5, $6)`,
        parametros: [s.nombre, s.apellido, s.dni, s.telefono, s.email, s.planId],
      });
      const pago = sentenciaPago("ultimo", s);
      if (pago) {
        pagosCreados++;
        sentencias.push(pago);
      }
    } else {
      actualizados++;
      sentencias.push({
        sql: `UPDATE clientes
                 SET nombre = $1,
                     apellido = COALESCE($2, apellido),
                     dni = COALESCE($3, dni),
                     telefono = COALESCE($4, telefono),
                     email = COALESCE($5, email),
                     plan_id = COALESCE($6, plan_id),
                     actualizado_el = datetime('now', 'localtime')
               WHERE id = $7`,
        parametros: [s.nombre, s.apellido, s.dni, s.telefono, s.email, s.planId, a.clienteId],
      });
      if (s.pago) {
        const clave = claveDePago(a.clienteId, s.pago.fechaPago);
        if (claves.has(clave)) {
          pagosOmitidos++;
        } else {
          const pago = sentenciaPago(a.clienteId, s);
          if (pago) {
            claves.add(clave);
            pagosCreados++;
            sentencias.push(pago);
          }
        }
      }
    }
  }

  await ejecutarLote(sentencias);
  return { creados, actualizados, pagosCreados, pagosOmitidos };
}

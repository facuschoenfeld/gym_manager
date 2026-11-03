/** Consultas de socios. Los socios no se borran: se desactivan (baja lógica). */
import type { DatosSocio, Socio } from "@/features/socios/logica/socio";
import { consultar, consultarUno, ejecutar } from "../client";

interface FilaSocio {
  id: number;
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  plan_id: number | null;
  plan_nombre: string | null;
  plan_monto: number | null;
  fecha_alta: string;
  activo: number;
  notas: string | null;
  vence_el: string | null;
  ultimo_aviso: string | null;
}

const COLUMNAS = `id, nombre, apellido, dni, email, telefono, plan_id, plan_nombre, plan_monto,
  fecha_alta, activo, notas, vence_el, ultimo_aviso`;

const aSocio = (f: FilaSocio): Socio => ({
  id: f.id,
  nombre: f.nombre,
  apellido: f.apellido,
  dni: f.dni,
  email: f.email,
  telefono: f.telefono,
  planId: f.plan_id,
  planNombre: f.plan_nombre,
  planMonto: f.plan_monto,
  fechaAlta: f.fecha_alta,
  activo: f.activo === 1,
  notas: f.notas,
  venceEl: f.vence_el,
  ultimoAviso: f.ultimo_aviso,
});

/** Todos los socios (activos e inactivos) con su último vencimiento. El filtrado se hace en TS. */
export async function listarSocios(): Promise<Socio[]> {
  const filas = await consultar<FilaSocio>(`SELECT ${COLUMNAS} FROM v_clientes_vencimiento`);
  return filas.map(aSocio);
}

export async function obtenerSocio(id: number): Promise<Socio | null> {
  const fila = await consultarUno<FilaSocio>(`SELECT ${COLUMNAS} FROM v_clientes_vencimiento WHERE id = $1`, [id]);
  return fila ? aSocio(fila) : null;
}

export async function crearSocio(d: DatosSocio): Promise<number | null> {
  const r = await ejecutar(
    `INSERT INTO clientes (nombre, apellido, dni, telefono, email, plan_id, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [d.nombre, d.apellido, d.dni, d.telefono, d.email, d.planId, d.notas],
  );
  return r.ultimoId;
}

/** Cambiar de plan no modifica el historial: aplica desde el próximo pago. */
export async function actualizarSocio(id: number, d: DatosSocio): Promise<void> {
  await ejecutar(
    `UPDATE clientes
     SET nombre = $1, apellido = $2, dni = $3, telefono = $4, email = $5, plan_id = $6, notas = $7,
         actualizado_el = datetime('now', 'localtime')
     WHERE id = $8`,
    [d.nombre, d.apellido, d.dni, d.telefono, d.email, d.planId, d.notas, id],
  );
}

export async function cambiarActivoSocio(id: number, activo: boolean): Promise<void> {
  await ejecutar(
    "UPDATE clientes SET activo = $1, actualizado_el = datetime('now', 'localtime') WHERE id = $2",
    [activo ? 1 : 0, id],
  );
}

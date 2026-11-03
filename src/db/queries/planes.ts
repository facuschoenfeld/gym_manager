/** Consultas de planes. Los planes no se borran: se desactivan (baja lógica). */
import type { DatosPlan, Plan } from "@/features/planes/logica/plan";
import type { Periodo } from "@/lib/fechas";
import { consultar, ejecutar } from "../client";

interface FilaPlan {
  id: number;
  nombre: string;
  periodo: Periodo;
  cantidad: number;
  monto: number;
  activo: number;
}

const aPlan = (f: FilaPlan): Plan => ({
  id: f.id,
  nombre: f.nombre,
  periodo: f.periodo,
  cantidad: f.cantidad,
  monto: f.monto,
  activo: f.activo === 1,
});

/** Todos los planes: primero los activos, después por orden de creación. */
export async function listarPlanes(): Promise<Plan[]> {
  const filas = await consultar<FilaPlan>(
    "SELECT id, nombre, periodo, cantidad, monto, activo FROM planes ORDER BY activo DESC, id",
  );
  return filas.map(aPlan);
}

export async function crearPlan(d: DatosPlan): Promise<number | null> {
  const r = await ejecutar("INSERT INTO planes (nombre, periodo, cantidad, monto) VALUES ($1, $2, $3, $4)", [
    d.nombre,
    d.periodo,
    d.cantidad,
    d.monto,
  ]);
  return r.ultimoId;
}

/** Cambiar el precio no afecta los pagos ya registrados: cada pago guarda su propio monto. */
export async function actualizarPlan(id: number, d: DatosPlan): Promise<void> {
  await ejecutar("UPDATE planes SET nombre = $1, periodo = $2, cantidad = $3, monto = $4 WHERE id = $5", [
    d.nombre,
    d.periodo,
    d.cantidad,
    d.monto,
    id,
  ]);
}

export async function cambiarActivoPlan(id: number, activo: boolean): Promise<void> {
  await ejecutar("UPDATE planes SET activo = $1 WHERE id = $2", [activo ? 1 : 0, id]);
}

/** Cuántos socios activos tienen este plan (para avisar antes de desactivarlo). */
export async function contarSociosConPlan(id: number): Promise<number> {
  const filas = await consultar<{ n: number }>(
    "SELECT COUNT(*) AS n FROM clientes WHERE plan_id = $1 AND activo = 1",
    [id],
  );
  return filas[0]?.n ?? 0;
}

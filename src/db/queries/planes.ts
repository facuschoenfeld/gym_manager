/** Consultas de planes. Un plan en uso no se borra: se desactiva. Solo se eliminan los que nunca se usaron. */
import type { DatosPlan, Plan, UsoDelPlan } from "@/features/planes/logica/plan";
import type { Periodo } from "@/lib/fechas";
import { consultar, consultarUno, ejecutar } from "../client";

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

/** Cuántos socios y pagos usan el plan (para avisar antes de desactivarlo o decidir si se puede eliminar). */
export async function usoDelPlan(id: number): Promise<UsoDelPlan> {
  const fila = await consultarUno<UsoDelPlan>(
    `SELECT
       (SELECT COUNT(*) FROM clientes WHERE plan_id = $1 AND activo = 1) AS sociosActivos,
       (SELECT COUNT(*) FROM clientes WHERE plan_id = $1)                AS sociosTotales,
       (SELECT COUNT(*) FROM pagos    WHERE plan_id = $1)                AS pagos`,
    [id],
  );
  return fila ?? { sociosActivos: 0, sociosTotales: 0, pagos: 0 };
}

/**
 * Borra un plan que nunca se usó. La condición se repite en el SQL para que sea imposible
 * borrar un plan con socios o pagos aunque la interfaz fallara (y las claves foráneas lo impiden igual).
 */
export async function eliminarPlan(id: number): Promise<void> {
  const r = await ejecutar(
    `DELETE FROM planes
     WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM clientes WHERE plan_id = $1)
       AND NOT EXISTS (SELECT 1 FROM pagos    WHERE plan_id = $1)`,
    [id],
  );
  if (r.filasAfectadas === 1) return;
  // No se borró: o ya no existe (ej. se eliminó en otra pantalla) o está en uso.
  const existe = await consultarUno<{ id: number }>("SELECT id FROM planes WHERE id = $1", [id]);
  throw new Error(
    existe
      ? "El plan no se puede eliminar porque tiene socios o pagos asociados. Podés desactivarlo."
      : "El plan ya no existe (puede que se haya eliminado antes).",
  );
}

/**
 * Conexión a SQLite (tauri-plugin-sql).
 *
 * - `Database.load` abre (o crea) %APPDATA%\ar.gym.manager\gym.db y ejecuta las
 *   migraciones pendientes (listadas en src-tauri/src/lib.rs).
 * - Parámetros con `$1, $2, ...`. Nunca concatenar valores en el SQL.
 * - El plugin usa un pool de conexiones: los PRAGMA por conexión (foreign_keys)
 *   ya vienen activados por defecto en sqlx; acá se refuerzan igual.
 */
import Database from "@tauri-apps/plugin-sql";

export const DB_URL = "sqlite:gym.db";

/** Valores aceptados como parámetros de consulta. */
export type ParametroSql = string | number | null;

let conexion: Promise<Database> | null = null;

async function abrir(): Promise<Database> {
  const db = await Database.load(DB_URL);
  // WAL: lecturas y escrituras simultáneas sin bloqueos, y más resistente a cortes de luz.
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute("PRAGMA busy_timeout = 5000");
  return db;
}

/** Devuelve la conexión (la abre la primera vez). */
export function obtenerDb(): Promise<Database> {
  if (!conexion) {
    conexion = abrir().catch((error: unknown) => {
      conexion = null; // permitir reintentar
      throw error;
    });
  }
  return conexion;
}

/** SELECT tipado. El tipo `T` debe reflejar las columnas devueltas. */
export async function consultar<T>(sql: string, parametros: ParametroSql[] = []): Promise<T[]> {
  const db = await obtenerDb();
  return db.select<T[]>(sql, parametros);
}

/** Primera fila o null. */
export async function consultarUno<T>(sql: string, parametros: ParametroSql[] = []): Promise<T | null> {
  const filas = await consultar<T>(sql, parametros);
  return filas[0] ?? null;
}

export interface ResultadoEjecucion {
  filasAfectadas: number;
  ultimoId: number | null;
}

/** INSERT / UPDATE / DELETE. */
export async function ejecutar(sql: string, parametros: ParametroSql[] = []): Promise<ResultadoEjecucion> {
  const db = await obtenerDb();
  const r = await db.execute(sql, parametros);
  return { filasAfectadas: r.rowsAffected, ultimoId: r.lastInsertId ?? null };
}

/** Cierra la conexión (necesario antes de restaurar un respaldo). */
export async function cerrarDb(): Promise<void> {
  if (!conexion) return;
  const db = await conexion;
  conexion = null;
  await db.close();
}

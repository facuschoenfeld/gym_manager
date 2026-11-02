/**
 * Verificación de `ejecutarLote` contra la base real (solo en desarrollo).
 * Comprueba que un lote correcto se confirma y que uno con error se deshace entero.
 */
import { consultarUno, ejecutar, ejecutarLote } from "./client";

export interface ResultadoPrueba {
  nombre: string;
  ok: boolean;
  detalle: string;
}

async function contar(): Promise<number> {
  const fila = await consultarUno<{ n: number }>("SELECT COUNT(*) AS n FROM _prueba_lote");
  return fila?.n ?? -1;
}

export async function probarTransacciones(): Promise<ResultadoPrueba[]> {
  const resultados: ResultadoPrueba[] = [];
  await ejecutar("DROP TABLE IF EXISTS _prueba_lote");
  await ejecutar("CREATE TABLE _prueba_lote (id INTEGER PRIMARY KEY, valor TEXT NOT NULL UNIQUE, monto INTEGER)");
  try {
    // 1. Lote correcto: se confirman las dos filas.
    const r = await ejecutarLote([
      { sql: "INSERT INTO _prueba_lote (valor, monto) VALUES ($1, $2)", parametros: ["a", 1500000] },
      { sql: "INSERT INTO _prueba_lote (valor, monto) VALUES ($1, $2)", parametros: ["b", 250] },
    ]);
    const n1 = await contar();
    resultados.push({
      nombre: "Lote correcto se confirma",
      ok: n1 === 2 && r.length === 2,
      detalle: `filas: ${n1}, ids: ${r.map((x) => x.ultimoId).join(", ")}`,
    });

    // 2. Los enteros se guardan como INTEGER (no como REAL).
    const tipo = await consultarUno<{ t: string }>("SELECT typeof(monto) AS t FROM _prueba_lote WHERE valor = 'a'");
    resultados.push({ nombre: "Enteros como INTEGER", ok: tipo?.t === "integer", detalle: `typeof: ${tipo?.t}` });

    // 3. Lote con error en la 2.ª sentencia: la 1.ª también se deshace.
    let error = "";
    try {
      await ejecutarLote([
        { sql: "INSERT INTO _prueba_lote (valor) VALUES ($1)", parametros: ["c"] },
        { sql: "INSERT INTO _prueba_lote (valor) VALUES ($1)", parametros: ["a"] }, // UNIQUE falla
      ]);
    } catch (e) {
      error = String(e);
    }
    const n2 = await contar();
    resultados.push({
      nombre: "Lote con error se deshace entero",
      ok: error !== "" && n2 === 2,
      detalle: `filas: ${n2} (esperado 2), error: ${error || "ninguno"}`,
    });

    // 4. Después del error la base no queda bloqueada.
    await ejecutar("INSERT INTO _prueba_lote (valor) VALUES ($1)", ["d"]);
    resultados.push({ nombre: "La base sigue disponible", ok: (await contar()) === 3, detalle: "insert posterior OK" });
  } catch (e) {
    resultados.push({ nombre: "Error inesperado", ok: false, detalle: String(e) });
  } finally {
    await ejecutar("DROP TABLE IF EXISTS _prueba_lote");
  }
  return resultados;
}

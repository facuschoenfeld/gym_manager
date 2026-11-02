// =====================================================================
// Comando `ejecutar_lote`: corre varias sentencias SQL en UNA transacción.
//
// ¿Por qué existe? tauri-plugin-sql usa un pool de hasta 10 conexiones y no
// ofrece transacciones desde JS: un BEGIN y su COMMIT pueden ir a conexiones
// distintas. Este comando toma UNA conexión del mismo pool del plugin, abre
// una transacción, ejecuta todo y confirma. Si cualquier sentencia falla, se
// deshace todo (rollback) y no queda nada a medias.
//
// No contiene lógica de negocio: recibe SQL + parámetros armados en TS
// (ver `ejecutarLote` en src/db/client.ts) y solo los ejecuta.
// =====================================================================

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Una sentencia tal como llega desde TypeScript: `{ sql: "...", parametros: [...] }`.
#[derive(Deserialize)]
pub struct Sentencia {
    sql: String,
    #[serde(default)] // si no viene `parametros`, se usa una lista vacía
    parametros: Vec<JsonValue>,
}

/// Lo que se devuelve por cada sentencia. `rename_all` convierte los nombres a
/// camelCase para JS: filas_afectadas -> filasAfectadas, ultimo_id -> ultimoId.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultadoSentencia {
    filas_afectadas: u64,
    ultimo_id: i64,
}

/// `#[tauri::command]` hace que se pueda llamar desde JS con
/// `invoke("ejecutar_lote", { db, sentencias })`.
/// `instancias` es el estado del plugin sql: las bases ya abiertas desde JS.
#[tauri::command]
pub async fn ejecutar_lote(
    instancias: tauri::State<'_, DbInstances>,
    db: String,
    sentencias: Vec<Sentencia>,
) -> Result<Vec<ResultadoSentencia>, String> {
    // Buscar el pool de la base (la clave es la URL usada en Database.load, ej. "sqlite:gym.db").
    let mapa = instancias.0.read().await;
    let pool = match mapa.get(&db) {
        Some(DbPool::Sqlite(pool)) => pool,
        _ => return Err(format!("La base de datos {db} no está abierta")),
    };

    // Toma una conexión del pool y ejecuta BEGIN en ella.
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let mut resultados = Vec::with_capacity(sentencias.len());

    for (i, sentencia) in sentencias.iter().enumerate() {
        let mut consulta = sqlx::query(&sentencia.sql);
        // Enlazar cada parámetro ($1, $2, ...) según su tipo en JSON.
        for valor in &sentencia.parametros {
            consulta = match valor {
                JsonValue::Null => consulta.bind(None::<String>),
                JsonValue::String(texto) => consulta.bind(texto.clone()),
                // Los enteros se guardan como INTEGER (el plugin los manda como decimales).
                JsonValue::Number(n) => match n.as_i64() {
                    Some(entero) => consulta.bind(entero),
                    None => consulta.bind(n.as_f64().unwrap_or_default()),
                },
                JsonValue::Bool(b) => consulta.bind(*b),
                // Listas u objetos se guardan como texto JSON.
                otro => consulta.bind(otro.to_string()),
            };
        }

        // `?` corta acá si hay error: `tx` se descarta sin COMMIT y sqlx hace ROLLBACK solo.
        let r = consulta
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Sentencia {} de {}: {e}", i + 1, sentencias.len()))?;

        resultados.push(ResultadoSentencia {
            filas_afectadas: r.rows_affected(),
            ultimo_id: r.last_insert_rowid(),
        });
    }

    // Todo salió bien: confirmar los cambios.
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(resultados)
}

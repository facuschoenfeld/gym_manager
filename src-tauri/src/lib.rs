// =====================================================================
// Shell de Tauri. REGLA DEL PROYECTO: acá NO va lógica de negocio.
// Este archivo solo registra plugins y la lista de migraciones SQL.
// Toda la lógica vive en TypeScript (src/).
// =====================================================================

use tauri::Manager; // trae `get_webview_window` para enfocar la ventana existente
use tauri_plugin_sql::{Migration, MigrationKind};

/// Nombre del archivo de base de datos. Se guarda en la carpeta de datos de la app:
/// %APPDATA%\ar.gym.manager\gym.db  (el JS se conecta con "sqlite:gym.db").
const DB_URL: &str = "sqlite:gym.db";

/// Lista de migraciones. Para agregar una nueva:
///   1. crear src/db/migrations/00N_descripcion.sql
///   2. agregar un bloque `Migration { version: N, ... }` acá abajo
/// El plugin registra cuáles ya corrió (tabla _sqlx_migrations) y ejecuta
/// solo las nuevas, cada una dentro de una transacción. Nunca editar una
/// migración ya publicada: siempre crear una nueva.
fn migraciones() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "inicial",
        // include_str! copia el contenido del .sql dentro del ejecutable al compilar.
        sql: include_str!("../../src/db/migrations/001_inicial.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Debe ir primero: si ya hay una instancia abierta, la trae al frente y esta se cierra.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(ventana) = app.get_webview_window("main") {
                let _ = ventana.unminimize();
                let _ = ventana.set_focus();
            }
        }))
        // Log a archivo (%LOCALAPPDATA%\ar.gym.manager\logs) y a la consola en desarrollo.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .max_file_size(2_000_000) // ~2 MB por archivo
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                .build(),
        )
        // SQLite con las migraciones de arriba; corren solas al conectar desde JS.
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migraciones())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}

# Gym Manager

App de escritorio (Tauri 2 + React + SQLite) para registrar los socios y los pagos de un gimnasio, y ver quién tiene la cuota al día, por vencer o vencida.

El contexto, las reglas y las convenciones están en [`CLAUDE.md`](CLAUDE.md).

## Requisitos de desarrollo (Windows)
- Node 22+ y pnpm (`npm i -g pnpm`)
- Rust (`winget install Rustlang.Rustup` y después `rustup default stable-msvc`)
- Visual Studio Build Tools 2022 con la carga de trabajo "Desarrollo para el escritorio con C++"
- WebView2: ya viene en Windows 10/11 actualizados

## Uso
```
pnpm install
pnpm tauri dev     # desarrollo
pnpm test          # tests
pnpm tauri build   # instalador
```

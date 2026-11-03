# Gym Manager: contexto para Claude

App de escritorio para un gimnasio que reemplaza un Excel de cuotas: muestra quién está al día, quién está por vencer y quién debe. Los pagos (efectivo o transferencia) se cobran por fuera y se **registran a mano**. La usa un coach sin conocimientos técnicos, en **una sola PC** de recepción, **sin internet**. Interfaz y textos en **español (Argentina)**.

- Especificación completa: `PROMPT_CLAUDE_CODE_GIMNASIO.md`. El plan por fases se acordó en la sesión inicial; el resumen está abajo.
- PC destino: i5-7200U, 8 GB (~2,8 GB libres), **Windows 10 1909**. Objetivo del documento: **< 100 MB de RAM** y arranque rápido. Lo medido está en *Estado actual*.
- El desarrollador maneja TS/React/Node, **no Rust**: Rust al mínimo y cada línea comentada y explicada. No usa rust-analyzer (lo desinstaló): los cambios en Rust los hace Claude y los explica.
- Trabajo en fases: al cerrar cada una, hay que frenar y reportar antes de seguir. Las decisiones importantes o ambiguas se consultan antes de implementarlas.

## Comandos
```
pnpm tauri dev        # app en desarrollo (requiere Rust + MSVC Build Tools)
pnpm test             # Vitest (lógica pura)
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint (sin `any`)
pnpm build            # build del frontend
pnpm tauri build      # instalador NSIS en src-tauri/target/release/bundle/nsis
```
- Todos los comandos se ejecutan desde la raíz del proyecto (`D:\Projects\gym_manager`), no desde `src-tauri`.
- La primera compilación de Rust tarda ~5 min en debug y ~9 min en release; las siguientes son incrementales.
- `pnpm tauri build --no-bundle` compila solo el ejecutable (`src-tauri/target/release/gym-manager.exe`), sin instalador. Sirve para medir RAM.
- Base de datos en desarrollo: `%APPDATA%\ar.gym.manager\gym.db`. Logs: `%LOCALAPPDATA%\ar.gym.manager\logs`.
- Para inspeccionar la base sin abrir la app: `node --experimental-sqlite` con `DatabaseSync(ruta, { readOnly: true })`. No hay `sqlite3` instalado.

## Entorno de desarrollo (verificado el 2026-11-02)
Windows 11 Pro · Node 22.14 · pnpm 12.16 · Rust 1.99 (`stable-x86_64-pc-windows-msvc`) · VS Build Tools 2022 (MSVC 14.44, Windows SDK 10.0.26100) · WebView2 156 · git 2.54.
pnpm 12 bloquea los scripts de instalación: los permitidos se declaran en `allowBuilds` de `pnpm-workspace.yaml` (hoy solo `esbuild`). Para agregar uno: `pnpm approve-builds <paquete> -y`.

## Stack
Tauri 2 · React 19 + TS + Vite · Tailwind v4 + shadcn/ui (radix-nova, `cn` del paquete `cn`) · SQLite con `@tauri-apps/plugin-sql` · React Hook Form + Zod 4 · TanStack Query + **TanStack Table v9** · React Router 8 (`createHashRouter`, router de datos) · date-fns · sonner (toasts) · lucide-react · SheetJS CE 0.20.3 (tarball de cdn.sheetjs.com, **no** la versión de npm; cargarlo con `import()` dinámico) · Vitest.
Plugins de Tauri: sql, dialog, fs, opener (solo `https://wa.me/*`), notification, log, process, single-instance. El updater queda para la fase 7.
Único comando Rust propio: `ejecutar_lote` (`src-tauri/src/lote.rs`), que ejecuta varias sentencias en una transacción.
**No usar:** Electron, servidor Node/Express, servicios externos, nada que necesite internet.

## Estructura
```
src/features/<modulo>/   socios, pagos, planes, deudores, importar, avisos, configuracion
                         (componentes + hooks de TanStack Query + logica/ pura con *.test.ts)
src/db/migrations/       SQL versionado 001_inicial.sql, 002_...
src/db/client.ts         conexión, PRAGMAs, consultar/ejecutar tipados
src/db/queries/          consultas por módulo
src/lib/                 utilidades PURAS con tests: fechas, dinero, telefonos, texto, estado, vencimiento
src/components/          UI compartida (ui/ = shadcn, layout/, tema, notificar)
src-tauri/src/lib.rs     solo registro de plugins, lista de migraciones y comandos
src-tauri/src/lote.rs    comando ejecutar_lote (transacciones)
reports/                 reportes de report-writer (subagentes y cierres de fase)
```

## Reglas de datos (obligatorias)
1. **Fechas en ISO `YYYY-MM-DD`** en la base (fecha + hora: `YYYY-MM-DD HH:MM:SS`). Se muestran `DD/MM/YYYY` con `formatearFecha`. "Hoy" se obtiene con `hoyISO()` (hora local). **Nunca** usar `toISOString()` para fechas. En SQL siempre `date('now','localtime')`.
2. **Dinero en centavos (INTEGER)**. Se formatea solo en la UI con `formatearPesos` (es-AR).
3. **El estado del socio no se guarda**. Se calcula con `calcularEstado()` (`src/lib/estado.ts`, única fuente de verdad) a partir del `MAX(vence_el)` de los pagos no anulados (vista `v_clientes_vencimiento`).
4. Socios: **baja lógica** (`activo = 0`), nunca se borran. Planes: baja lógica; **solo se pueden eliminar si nunca se usaron** (sin socios, ni siquiera dados de baja, y sin pagos; `puedeEliminarPlan` y el `DELETE` con `NOT EXISTS`). Pagos: **no se borran**, se anulan con motivo.
5. Los pagos son historial: una fila por pago. Cada pago guarda su `monto` y su `plan_id`, así que cambiar un plan no altera los pagos anteriores.
6. Teléfonos en formato internacional `549` + 10 dígitos (`normalizarTelefono`). DNI guardado sin puntos; si está vacío, `NULL`. Al cargarlo se aceptan solo `30123456`, `30.123.456`, `30 123 456` o `30123456.0` (Excel): la puntuación mal puesta es un error (`normalizarDni`).
7. Migraciones: **nunca editar una publicada**. Crear `00N_x.sql` y agregarla en `migraciones()` de `lib.rs`.

## Reglas de negocio
- **Estado:**
  - `sin_pagos`: no tiene pagos.
  - `vencido`: `vence_el + días_gracia < hoy`.
  - `por_vencer`: `vence_el <= hoy + días_por_vencer`.
  - `pago`: cualquier otro caso.
- `vence_el` es el día en que tiene que volver a pagar. Ese día todavía figura "por vencer".
- **Planes:** `periodo` (`dia` | `semana` | `mes`) × `cantidad`. El mes es **calendario**: 15/10 → 15/11 y 31/01 → 28/02 (`sumarPeriodo`).
- **Nuevo vencimiento** (`calcularNuevoVencimiento`), según `config.regla_vencimiento`:
  - `desde_vencimiento_anterior` (por defecto): si está al día o dentro de la gracia, el nuevo vencimiento es el anterior + plan; si no, es la fecha de pago + plan.
  - `desde_fecha_pago`: siempre fecha de pago + plan.
- Al anular un pago, el socio vuelve solo al estado anterior.
- Cambiar de plan no modifica el historial.
- Importación: upsert por DNI (si no hay DNI, la clave es nombre + apellido, con aviso de posible duplicado). **Nunca pisar datos existentes con valores vacíos.**

## Convenciones
- TS estricto (`noUncheckedIndexedAccess`), **sin `any`** y sin non-null assertions (`!`). Validar con Zod en los bordes (formularios, importación, config).
- La lógica de negocio va en funciones puras con tests, separada de los componentes.
- Nombres de código y textos en español. Commits chicos y descriptivos, en español.
- Sin claves, tokens ni datos reales en el repo.
- UI:
  - Botones y textos grandes (base de 17px), alto contraste.
  - Cada estado con **color + texto + ícono**.
  - Confirmar antes de anular, dar de baja, restaurar o importar.
  - Errores entendibles con `avisar.error(titulo, e)` (`src/components/notificar.ts`), nunca solo en la consola.
- Notificaciones:
  - Toast (`avisar.*`) para cada acción del usuario. **Sin botón de cerrar ni "Deshacer"**: aparecen y desaparecen solos (pedido del usuario, 2026-11-03).
  - Notificación de Windows (`notificarWindows`) solo para tareas en segundo plano, como el respaldo automático.
- Al terminar cada fase, listar: qué se hizo, cómo probarlo, qué queda pendiente, qué decisiones se tomaron y la RAM medida.

## Automatización de subagentes (pedido explícito del usuario)
Los subagentes son globales (`~/.claude/agents/`). Lanzarlos **sin preguntar** en estos casos:

| Subagente | Cuándo lanzarlo | Qué pedirle |
|---|---|---|
| `ui-ux-reviewer` | Al terminar cada pantalla **o** al modificar cualquier aspecto del frontend (componentes, estilos, textos, layout) | Auditar contra RNF-03 y la sección 9 de la especificación: botones y fuentes grandes, contraste alto, estados con color + texto + ícono, confirmaciones, mensajes de error entendibles, estados vacío/carga/error, modo oscuro y atajos de teclado |
| `code-reviewer` | Después de escribir cada bloque de código y **antes de cada commit** de una funcionalidad | Revisar el `git diff`: bugs, reglas de datos de este archivo (fechas, centavos, baja lógica, transacciones con `ejecutarLote`) y convenciones (sin `any` ni `!`) |
| `test-runner` | Cada vez que se agrega o cambia lógica | Testear la lógica nueva (escribir los tests que falten) y confirmar la integridad del sistema: `pnpm test`, `pnpm typecheck` y `pnpm lint` en verde |
| `researcher` | Cuando el usuario haga una **pregunta** sobre el sistema, el código, las herramientas o cualquier tema relacionado | Responder la pregunta. El agente principal (Opus) queda reservado para **ejecutar fases**. Excepción: si la respuesta requiere ejecutar comandos (medir RAM, ver procesos o versiones), `researcher` no puede porque no tiene Bash; lo resuelve el agente principal y lo aclara |
| `security-auditor` | **No automatizar.** Recomendárselo al usuario cuando haga falta | Ejemplos: antes del instalador (fase 7), al tocar permisos de Tauri (`capabilities/`, alcance de `fs`), la CSP, la importación de archivos, la restauración de respaldos o al agregar dependencias |

**Orden al implementar:** escribir el código → `test-runner` (si hay lógica) → `ui-ux-reviewer` (si hay frontend) → corregir lo que reporten → `code-reviewer` → corregir → commit.

**Reporte después de cada subagente:** cuando termina **cada** subagente, lanzar `report-writer` para documentar todos los cambios realizados: qué revisó o hizo el subagente, qué encontró, qué se corrigió y qué quedó pendiente.
- **Dónde:** carpeta `reports/` en la raíz del proyecto (se versiona en git).
- **Nombre del archivo:** `reports/AAAA-MM-DD_HHMM_<subagente>_<tema-corto>.md`. Ejemplo: `reports/2026-11-03_1015_ui-ux-reviewer_pantalla-socios.md`.
- El reporte de cierre de cada fase también va ahí: `reports/AAAA-MM-DD_HHMM_fase-N_cierre.md`.
- Se commitea junto con los cambios a los que se refiere.

Esto es una instrucción para Claude, no un hook de Claude Code: depende de que el agente principal la cumpla en cada sesión.

## Particularidades técnicas (aprendidas)
- **Transacciones:** plugin-sql usa un pool de 10 conexiones sin API de transacciones, así que **nunca** hay que mandar `BEGIN`/`COMMIT` con `ejecutar()`. Toda operación de varias sentencias (registrar pago, importar, etc.) va con `ejecutarLote([{ sql, parametros }])` de `src/db/client.ts`: se aplica todo o nada. Dentro de un lote, para referirse a filas recién insertadas se usan subconsultas o `last_insert_rowid()`. La verificación está en `src/db/diagnostico.ts` (botón en Inicio, solo en desarrollo).
- plugin-sql **enlaza todos los números como `f64`**. Funciona en columnas INTEGER (SQLite convierte los valores enteros), pero los montos tienen que llegar siempre como enteros.
- En un `execute` con varias sentencias, `$N` se refiere a la posición N de **toda** la lista de parámetros, no de cada sentencia (sqlx-sqlite).
- Los PRAGMA no tienen efecto dentro de una migración (corren dentro de una transacción). Se aplican en `client.ts`.
- **RAM:** WebView2 usa varios procesos y la aceleración por GPU ocupaba ~106 MB. Con `--disable-gpu` (en `additionalBrowserArgs` de `tauri.conf.json`) la app en release baja de ~216 MB a ~118 MB de memoria privada. Esas args reemplazan las que Tauri pone por defecto, así que hay que mantener `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`. Para medir: sumar la memoria privada de `gym-manager.exe` y de los `msedgewebview2.exe` cuya línea de comandos contiene `ar.gym.manager`.
- La CSP no permite scripts inline: usar archivos en `public/` (por ejemplo `public/tema.js`).
- **TanStack Table v9** cambió la API respecto de la v8. Se usa `useTable({ features, columns, data })`, `tableFeatures({})` y `createColumnHelper<typeof features, Fila>()` (features y helper a nivel de módulo), `row.getAllCells()` y `<tabla.FlexRender header|cell />`. La documentación está en `node_modules/@tanstack/react-table/skills/`.
- **Router de datos:** las rutas están en `createHashRouter` (`App.tsx`) para poder usar `useBlocker` (aviso de cambios sin guardar, ver Configuración). Con HashRouter, el hash de la URL **es** la ruta: nunca usar `<a href="#...">` para anclas dentro de la página.
- **Errores:** `mensajeDeError(e)` es pura (traduce el error para mostrarlo). `registrarError(contexto, e)` escribe en el log. El log se escribe una sola vez por error: en `avisar.error`, en `QueryCache.onError` y al abrir la base. Nunca registrar durante un render.
- **Claves de TanStack Query:** usar las constantes (`CLAVE_SOCIOS`, `CLAVE_PAGOS`, `clavePagosDeSocio`, `CLAVE_PLANES`, `CLAVE_CONFIG`). Nunca escribir los strings a mano.
- **Tamaños de UI:** los componentes de `src/components/ui` se agrandaron (botón default `h-11 text-base`, lg `h-12`, input `h-11`, tablas `text-base`). Los bordes de los campos usan `border-foreground/50` y el anillo de foco es azul (`--ring`), para cumplir WCAG AA. Si se agrega un componente con `shadcn add`, hay que ajustarlo igual.
- La regla `react-hooks/incompatible-library` está desactivada en ESLint: es para el React Compiler, que no se usa, y TanStack Table y `watch()` de react-hook-form son incompatibles con él por diseño.

## Fuera de alcance
Pagos online, Mercado Pago o QR · envío automático de email o WhatsApp (solo links `wa.me` manuales) · control de acceso o asistencias · facturación AFIP · multiusuario o login · versión web o móvil · nube. El diseño por capas tiene que permitir sumar cualquiera de estas cosas más adelante sin reescribir.

## Decisiones tomadas con el usuario
- **Planes:** ABM flexible (período × cantidad + precio). Se crean de entrada "Pase diario", "Semanal" y "Mensual", con precio 0.
- **Mes calendario** para los vencimientos, no 30 días fijos.
- **Notificaciones (RNF-08):** toast para cada acción y notificación de Windows solo para tareas en segundo plano. Los toasts no tienen botón de cerrar ni "Deshacer".
- **Eliminar planes:** solo los que nunca se usaron; los usados se desactivan (para no perder historial).
- **Cambios sin guardar:** el aviso ofrece "Guardar y salir", "Salir sin guardar" y "Seguir editando".
- **Etiqueta del estado `pago`:** se muestra "Al día" (el documento dice "Pago"). **Falta que el usuario lo confirme.** Se cambia en `VISUAL_ESTADO` (`EstadoBadge.tsx`).
- **Instalador:** NSIS en español con `embedBootstrapper` de WebView2. La PC del gimnasio tiene internet al instalar.
- **Transacciones:** opción A, un comando Rust propio (`ejecutar_lote`), en lugar de lotes SQL con `INSERT OR ROLLBACK`.
- **RAM:** se acepta `--disable-gpu`. Bajar de 100 MB no es viable con WebView2.
- **Código de área por defecto: 3482** (Reconquista, Santa Fe; 6 dígitos locales). Se cargó con la migración `002_codigo_area.sql` y se puede cambiar desde la configuración.
- Las fechas se guardan en `YYYY-MM-DD`, aunque el .md original dice "ISO (DD-MM-YYYY)", que es contradictorio.

## Estado actual
| Fase | Estado |
|---|---|
| 0. Esqueleto y entorno | ✅ Cerrada (2026-11-02) |
| 1. Base de datos y lógica pura | ✅ Hecha dentro de la fase 0 (migraciones 001 y 002, `src/lib/*` con 144 tests). Faltan los esquemas Zod de formularios, que se hacen en la fase 2. |
| 2. Planes, configuración y socios | 🔶 Implementada y revisada (test-runner, ui-ux-reviewer, code-reviewer). Falta la prueba manual del usuario y medir la RAM en release para cerrarla. |
| 3. Pagos | Pendiente |
| 4. Panel de deudores y avisos por WhatsApp | Pendiente. La pantalla de Inicio hoy es solo de diagnóstico (base, migraciones y prueba de transacciones en desarrollo). |
| 5. Importación desde Excel | Pendiente |
| 6. Respaldos, estado del sistema y log de errores | Pendiente |
| 7. Instalador y updater | Pendiente |

**Verificado en la fase 0:**
- `pnpm tauri dev` compila sin advertencias.
- La migración 001 se aplica sobre una base nueva y se respeta en una base existente (4 aperturas, una sola versión registrada).
- La base queda en modo WAL.
- Las 4 pruebas de `ejecutarLote` pasan: confirma, guarda los enteros como INTEGER, hace rollback completo y la base no queda bloqueada.
- Arranque en release: 0,7 s. Ejecutable: 5,5 MB.

**RAM medida (memoria privada total):**

| Modo | Memoria privada |
|---|---|
| release con GPU | ~216 MB |
| **release con `--disable-gpu`** | **~118 MB** |
| dev con `--disable-gpu` | ~169 MB |

En dev el renderer pesa más (~88 MB contra ~33 MB en release) por React en modo desarrollo y el servidor de Vite.

**Commits:**

| Commit | Contenido |
|---|---|
| `fb1d0c6` | esqueleto |
| `f31a9db` | `ejecutar_lote` |
| `18085d8` | `--disable-gpu` |
| `bb7080a` | quitar `rust-analyzer` de las recomendaciones |
| `d5e055d` | actualización de CLAUDE.md |

## Pendientes
- **Seguridad, según `security-auditor` (2026-11-02):**
  - **Alta:** `fs:scope` con `"**"` en `src-tauri/capabilities/default.json` da acceso a todo el disco con permisos de escritura y borrado. Hay que acotarlo a `$APPDATA/ar.gym.manager/**` y a la carpeta de respaldos. Resolverlo en la fase 6, cuando se defina cómo se elige esa carpeta (puede ser un pendrive).
  - **Media:** acotar `fs:allow-remove` a la carpeta de respaldos o quitarlo si no se usa.
- Barra lateral colapsable (prioridad baja, la ventana mínima es de 1024 px).
- Probar `window.print()` en WebView2 con `--disable-gpu` (fase 4, vista imprimible).
- Probar el instalador en Windows 10 1909 real o en una VM (fase 7). Lo ideal es la PC del gimnasio.
- El Excel real del gimnasio, para ajustar el mapeo por defecto (fase 5). Con ese archivo, revisar si los DNI vienen como `30-123-456` o `30,123,456`: hoy `normalizarDni` los rechaza. Si aparecen, agregar esos formatos.
- Dónde publicar las actualizaciones (fase 7; se sugirió GitHub Releases).

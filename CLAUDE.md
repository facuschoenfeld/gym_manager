# Gym Manager: contexto para Claude

App de escritorio para un gimnasio que reemplaza un Excel de cuotas: muestra quién está al día, quién está por vencer y quién debe. Los pagos (efectivo o transferencia) se cobran por fuera y se **registran a mano**. La usa un coach sin conocimientos técnicos, en **una sola PC** de recepción, **sin internet**. Interfaz y textos en **español (Argentina)**.

- Especificación completa: `PROMPT_CLAUDE_CODE_GIMNASIO.md`. El plan por fases se acordó en la sesión inicial; el resumen está abajo.
- PC destino: i5-7200U, 8 GB (~2,8 GB libres), **Windows 10 1909**. Objetivo: **< 100 MB de RAM** y arranque rápido.
- El desarrollador maneja TS/React/Node, **no Rust**: Rust al mínimo y cada línea comentada y explicada.

## Comandos
```
pnpm tauri dev        # app en desarrollo (requiere Rust + MSVC Build Tools)
pnpm test             # Vitest (lógica pura)
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint (sin `any`)
pnpm build            # build del frontend
pnpm tauri build      # instalador NSIS en src-tauri/target/release/bundle/nsis
```
Base de datos en desarrollo: `%APPDATA%\ar.gym.manager\gym.db`. Logs: `%LOCALAPPDATA%\ar.gym.manager\logs`.

## Stack
Tauri 2 · React 19 + TS + Vite · Tailwind v4 + shadcn/ui (radix-nova, `cn` del paquete `cn`) · SQLite con `@tauri-apps/plugin-sql` · React Hook Form + Zod 4 · TanStack Query + Table · React Router (HashRouter) · date-fns · sonner (toasts) · lucide-react · SheetJS CE 0.20.3 (tarball de cdn.sheetjs.com, **no** la versión de npm; cargarlo con `import()` dinámico) · Vitest.
Plugins de Tauri: sql, dialog, fs, opener (solo `https://wa.me/*`), notification, log, process, single-instance. El updater queda para la fase 7.
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
src-tauri/src/lib.rs     solo registro de plugins y lista de migraciones
```

## Reglas de datos (obligatorias)
1. **Fechas en ISO `YYYY-MM-DD`** en la base (fecha + hora: `YYYY-MM-DD HH:MM:SS`). Se muestran `DD/MM/YYYY` con `formatearFecha`. "Hoy" se obtiene con `hoyISO()` (hora local). **Nunca** usar `toISOString()` para fechas. En SQL siempre `date('now','localtime')`.
2. **Dinero en centavos (INTEGER)**. Se formatea solo en la UI con `formatearPesos` (es-AR).
3. **El estado del socio no se guarda**. Se calcula con `calcularEstado()` (`src/lib/estado.ts`, única fuente de verdad) a partir del `MAX(vence_el)` de los pagos no anulados (vista `v_clientes_vencimiento`).
4. Socios y planes: **baja lógica** (`activo = 0`). Pagos: **no se borran**, se anulan con motivo.
5. Los pagos son historial: una fila por pago. Cada pago guarda su `monto` y su `plan_id`, así que cambiar un plan no altera los pagos anteriores.
6. Teléfonos en formato internacional `549` + 10 dígitos (`normalizarTelefono`). DNI sin puntos; si está vacío, `NULL`.
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
  - Toast (`avisar.*`) para cada acción del usuario.
  - Notificación de Windows (`notificarWindows`) solo para tareas en segundo plano, como el respaldo automático.
- Al terminar cada fase, listar: qué se hizo, cómo probarlo, qué queda pendiente, qué decisiones se tomaron y la RAM medida.

## Particularidades técnicas (aprendidas)
- **plugin-sql usa un pool de 10 conexiones y no tiene API de transacciones.** Un `BEGIN` y su `COMMIT` en llamadas separadas pueden ejecutarse en conexiones distintas. Para operaciones de varias sentencias hay que ver *Transacciones* en "Pendientes".
- plugin-sql **enlaza todos los números como `f64`**. Funciona en columnas INTEGER (SQLite convierte los valores enteros), pero los montos tienen que llegar siempre como enteros.
- En un `execute` con varias sentencias, `$N` se refiere a la posición N de **toda** la lista de parámetros, no de cada sentencia (sqlx-sqlite).
- Los PRAGMA no tienen efecto dentro de una migración (corren dentro de una transacción). Se aplican en `client.ts`.
- La CSP no permite scripts inline: usar archivos en `public/` (por ejemplo `public/tema.js`).

## Fuera de alcance
Pagos online, Mercado Pago o QR · envío automático de email o WhatsApp (solo links `wa.me` manuales) · control de acceso o asistencias · facturación AFIP · multiusuario o login · versión web o móvil · nube. El diseño por capas tiene que permitir sumar cualquiera de estas cosas más adelante sin reescribir.

## Fases
0. Esqueleto y entorno
1. Base de datos y lógica pura
2. Planes, configuración y socios
3. Pagos
4. Panel de deudores y avisos por WhatsApp
5. Importación desde Excel
6. Respaldos, estado del sistema y log de errores
7. Instalador y updater

## Pendientes
- **Transacciones:** definir cómo hacer atómicas la importación y el registro de pagos (ver la nota de la fase 0).
- El Excel real del gimnasio, para ajustar el mapeo por defecto.
- Dónde publicar las actualizaciones (fase 7).
- Código de área por defecto (`config.codigo_area`).

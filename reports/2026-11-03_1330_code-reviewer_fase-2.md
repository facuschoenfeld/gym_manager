# Revisión de código (code-reviewer): Fase 2, planes, configuración y socios

Fecha: 2026-11-03

## Resumen ejecutivo

- `code-reviewer` revisó el diff de la fase 2 y no encontró hallazgos críticos.
- Devolvió 15 hallazgos (1 alto, 4 medios, 10 bajos). Los 15 se corrigieron.
- Los tests pasaron de 228 a 244. `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build` están en verde.
- Falta la prueba manual en la app real, en especial el aviso de "cambios sin guardar" en Configuración y Ctrl+F con un diálogo abierto.

## Lo que está bien

- Sin inyección SQL: el único `${}` dentro de SQL es la constante `COLUMNAS`.
- Sin `toISOString`, sin `any`, sin `!` y sin `dangerouslySetInnerHTML`.
- El estado del socio se calcula siempre con `calcularEstado`.
- Baja lógica en todos los casos.
- Los errores de las acciones llegan al usuario con `avisar.error`.

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alto | `guardarConfig` hacía un `ejecutar` por clave, sin transacción. Si fallaba la 3.ª, las 2 primeras quedaban guardadas y la caché no se invalidaba. | `guardarConfig` usa `ejecutarLote` (todo o nada). El hook invalida en `onSettled`. |
| 2 | Medio | El plan por defecto no se aplicaba si se abría el alta antes de que cargaran los planes (ej. Ctrl+N al arrancar). | Efecto que completa `planId` cuando llegan los planes. |
| 3 | Medio | "Reintentar" en Socios no reintentaba la configuración. | `refetch` reintenta socios y configuración. |
| 4 | Medio | `mensajeDeError` escribía en el log durante el render (líneas duplicadas). | `mensajeDeError` quedó pura. Nuevo `registrarError`, que se llama una vez en `QueryCache.onError`, en `avisar.error` y al fallar la apertura de la base. |
| 5 | Medio | El precio de un plan no tenía tope (más de ~16 dígitos pierde precisión). | Tope de $ 100.000.000 (`PRECIO_MAXIMO_CENTAVOS`). |
| 6 | Bajo | `normalizarDni("000000")` daba DNI "" (fallaba el CHECK de SQLite con mensaje en inglés) y "0000001" se aceptaba como "1". | Se valida el largo después de quitar los ceros. Además se traduce "CHECK constraint failed" a un mensaje entendible. |
| 7 | Bajo | El formulario de edición podía reiniciarse solo (perdiendo lo escrito) por un refetch. | El reset depende del id del socio, no de la identidad del objeto. |
| 8 | Bajo | Los filtros guardados en `sessionStorage` no se validaban. | `leerFiltrosGuardados` con Zod. Lo inválido se descarta. |
| 9 | Bajo | Los atajos o el menú podían sacar al usuario de Configuración con cambios sin guardar. | Se pasó a `createHashRouter` (router de datos). Configuración usa `useBlocker` con confirmación "Salir sin guardar". |
| 10 | Bajo (a verificar) | Ctrl+F dentro de un diálogo podía abrir la búsqueda nativa de WebView2. | Se hace `preventDefault` de las combinaciones con Ctrl registradas aunque haya un diálogo abierto. |
| 11 | Bajo | `idsDescripcion` recibía el literal "ayuda" como si fuera el texto de ayuda. | La firma pasó a un booleano `tieneAyuda`. |
| 12 | Bajo | Claves de TanStack Query escritas a mano. `useSocio` sin uso. | Constantes `CLAVE_SOCIOS`, `CLAVE_PAGOS` y `clavePagosDeSocio`. Se borró `useSocio`. |
| 13 | Bajo | `/socios/abc` consultaba pagos con id `NaN`. | `enabled` solo con id entero positivo. |
| 14 | Bajo | Los contadores de estado contaban socios activos aunque el filtro mostrara los dados de baja. | Nueva función pura `contarParaFiltros` (respeta búsqueda, plan y activos/de baja; ignora el estado). |
| 15 | Bajo | Entidades `&quot;` en atributos JSX. | Strings normales. |

## Tests agregados

Total: 244 (antes 228, 16 más). Cubren:

- DNI con ceros a la izquierda.
- Tope de precio de los planes.
- `contarParaFiltros`.
- `leerFiltrosGuardados`.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm test` | Verde, 244 tests |
| `pnpm typecheck` | Verde |
| `pnpm lint` | Verde |
| `pnpm build` | Verde |

## Pendientes

- Prueba manual en la app real, a cargo del usuario:
  - Aviso "Salir sin guardar" en Configuración al usar el menú o un atajo con cambios sin guardar (hallazgo 9).
  - Ctrl+F con un diálogo abierto: confirmar que no aparece la búsqueda nativa de WebView2 (hallazgo 10, marcado "a verificar").
- Siguiente paso según el flujo del proyecto: corregidos los hallazgos, corresponde el commit de la fase 2 junto con los reportes de `reports/`.

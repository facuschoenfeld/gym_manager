# Auditoría de UI/UX: pantallas de la fase 2 (Socios, Planes y Configuración)

**Fecha:** 2026-11-03
**Subagente:** `ui-ux-reviewer`
**Alcance:** Socios (listado, ficha, alta/edición), Planes y Configuración. Auditoría sobre código, no sobre la app en ejecución.

## Resumen ejecutivo

- El revisor encontró 20 hallazgos: 6 de prioridad alta, 10 media y 4 baja. Los 20 se corrigieron.
- Los problemas más serios eran de accesibilidad: contraste de bordes y foco por debajo de WCAG, un enlace "Saltar al contenido" que rompía la ruta y un botón rojo ilegible en modo oscuro.
- Typecheck, lint, tests (228) y build están en verde después de las correcciones.
- Falta la verificación visual en la app real (1024 px y modo oscuro), a cargo del usuario. Los contrastes son estimaciones a partir de los tokens oklch.

## Hallazgos y correcciones

| # | Prioridad | Hallazgo | Corrección aplicada |
|---|---|---|---|
| 1 | Alta | "Saltar al contenido" con `href="#contenido"` rompía la ruta (HashRouter usa el hash) | `onClick` con `preventDefault` + foco en `<main>` (`Layout.tsx`) |
| 2 | Alta | Borde de inputs/selects ~1.26:1 (WCAG 1.4.11 pide 3:1) | `border-foreground/50` en input, select y textarea; `border-foreground/40` en botón outline |
| 3 | Alta | Anillo de foco débil (~1.6:1) | `--ring` azul `oklch(0.45 0.15 260)` claro / `oklch(0.75 0.12 260)` oscuro; `ring-ring` sin `/50` en todos los componentes `ui` |
| 4 | Alta | Botón rojo de confirmación ~2.8:1 en modo oscuro | `dark:bg-red-700` (`Confirmar.tsx`) |
| 5 | Alta | Advertencia de duplicados podía quedar fuera de la vista | Se movió arriba del formulario + `scrollIntoView`; pie del diálogo fijo (sticky) |
| 6 | Alta | Fila con `role="link"` y `aria-label` ocultaba estado/vencimiento al lector de pantalla | Fila normal; el nombre es un `<Link>` accesible; la fila sigue clicable con mouse |
| 7 | Media | Botón cerrar de diálogos en inglés ("Close") y chico (36 px) | "Cerrar" y tamaño `icon` (44 px) |
| 8 | Media | `text-muted-foreground` sobre `bg-muted` ~4.4:1 | `--muted-foreground` claro a `oklch(0.50 0 0)` |
| 9 | Media | Textos de "próxima etapa" (jerga de desarrollo) | Se quitaron de la ficha y de Configuración |
| 10 | Media | "Deshacer" del toast sin manejo de error | `.catch` con `avisar.error` (ficha y planes) |
| 11 | Media | Doble "x" en el buscador (nativa de Chromium + propia) | Se ocultó la nativa (`::-webkit-search-cancel-button`) |
| 12 | Media | Tabla de socios no entraba en 1024 px | Columnas Plan y Teléfono ocultas por debajo de `xl` (1280 px) |
| 13 | Media | "Obligatorio" solo con asterisco `aria-hidden` | Texto `sr-only` "(obligatorio)" en `Campo.tsx` |
| 14 | Media | Botones Editar/Desactivar repetidos sin nombre propio; ícono de acción igual al de estado | `aria-label` con el nombre del plan; íconos `PowerOff` (desactivar) y `RotateCcw` (reactivar) |
| 15 | Media | Botón deshabilitado sin explicación; selector de plan vacío sin aviso | Mensajes "Cargando configuración…"/error en el pie; aviso "No hay planes activos. Crear un plan" |
| 16 | Media | Enlace al duplicado cerraba el diálogo y se perdía lo cargado | Se reemplazó por texto: nombre, DNI, fecha de alta y si está de baja |
| 17 | Baja | "Guardar cambios" deshabilitado sin motivo | Texto "No hay cambios para guardar" / "Hay cambios sin guardar" con `aria-live` |
| 18 | Baja | Íconos de filtros por estado sin el color del estado | `colorIcono` por estado en `EstadoBadge.tsx` (cuando el filtro no está activo) |
| 19 | Baja | Tarjetas sin encabezados `<h2>` | `CardTitle` renderiza `<h2>` (`card.tsx`) |
| 20 | Baja | Atajos poco visibles; `<kbd>` dentro del nombre accesible | Lista de atajos (Ctrl+F o /, Ctrl+N, Esc) en el menú; `aria-keyshortcuts` y `kbd` con `aria-hidden` |

## Bien resuelto

- Estados con color + texto + ícono, con buen contraste en modo claro y oscuro.
- `Confirmar` enfoca "Cancelar" por defecto.
- Los errores usan `role="alert"` con ícono.
- Controles de ~47 px de alto.
- Estados vacío, cargando y error presentes en todas las pantallas.

## Verificación

Después de las correcciones:

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | En verde |
| `pnpm lint` | En verde |
| `pnpm test` | En verde (228 tests) |
| `pnpm build` | En verde |

Limitación: la auditoría fue sobre código. Los contrastes se estimaron a partir de los tokens oklch, no se midieron sobre la interfaz renderizada.

## Pendientes

| Pendiente | Responsable sugerido |
|---|---|
| Verificación visual en la app real: capturas a 1024 px y en modo oscuro; confirmar contrastes de bordes, foco y botón rojo | Usuario |
| Reportar cualquier desvío visual para corregirlo antes del cierre de la fase 2 | Usuario / agente principal |
| Lanzar `code-reviewer` sobre el diff antes del commit, según el orden de CLAUDE.md | Agente principal |

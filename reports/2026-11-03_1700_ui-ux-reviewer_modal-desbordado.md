# Reporte ui-ux-reviewer: diálogo desbordado en Configuración

Fecha: 2026-11-03

## Resumen ejecutivo

El diálogo "Tenés cambios sin guardar" mostraba el texto y los 3 botones del pie fuera del borde derecho de la caja (captura del usuario, modo oscuro). Eran dos problemas encadenados de CSS, ya corregidos en `alert-dialog.tsx`, `Confirmar.tsx` y `dialog.tsx`. Pendiente: que el usuario confirme visualmente en claro y oscuro.

## Problema reportado

- La caja medía unos 420 px.
- El texto y los botones se salían por la derecha.
- Se vio en modo oscuro, en Configuración.

## Causa

1. **Ancho mal fusionado.** `Confirmar` pasaba `sm:max-w-2xl`, pero el `AlertDialogContent` de shadcn trae `data-[size=default]:sm:max-w-sm`. `cn` solo fusiona clases con los mismos modificadores. Las dos convivían y ganaba la de la base por especificidad (selector de atributo). La caja quedaba en 384 px.
2. **Columna del grid sin tope.** `AlertDialogContent` es un grid de una columna `auto`. Los botones son `whitespace-nowrap`, así que la columna se ensanchaba más que la caja y arrastraba al encabezado.

## Correcciones

| Archivo | Cambio |
|---|---|
| `src/components/ui/alert-dialog.tsx` | `grid-cols-[minmax(0,1fr)]` en el contenido, para que la columna nunca supere la caja. |
| `src/components/ui/alert-dialog.tsx` | `flex-wrap` en el pie: si los botones no entran, bajan de línea. |
| `src/components/ui/alert-dialog.tsx` | Encabezado siempre a la izquierda (`place-items-start text-left`). |
| `src/components/ui/alert-dialog.tsx` | Descripción con `text-pretty` (se quitó `text-balance`). |
| `src/components/Confirmar.tsx` | El ancho usa la misma variante que la base: `data-[size=default]:sm:max-w-2xl` con acción secundaria y `data-[size=default]:sm:max-w-lg` sin ella. Así `cn` reemplaza `max-w-sm`. |
| `src/components/Confirmar.tsx` | Rojo de la acción secundaria en oscuro: `text-red-300` (antes `red-400`, cerca del límite de contraste). |
| `src/components/ui/dialog.tsx` | Prevención en los formularios de socio y plan: `grid-cols-[minmax(0,1fr)]` y `flex-wrap` en el pie. |
| `src/components/ui/dialog.tsx` | Texto base `text-base` (antes `text-sm`). |
| `src/components/ui/dialog.tsx` | Botón "Close" pasa a "Cerrar". |

## Verificación

- El resultado de `cn` en `Confirmar` ya no contiene `max-w-sm`, y el CSS generado incluye la regla nueva.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (291 tests) y `pnpm build`: todos en verde.
- Verificación visual: no disponible todavía.

## Pendientes

- El usuario debe confirmar visualmente el diálogo de Configuración en modo claro y oscuro.
- El usuario debe revisar también los diálogos de Planes y de la ficha del socio.

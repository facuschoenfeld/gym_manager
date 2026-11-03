# Revisión de código: corrección del diálogo desbordado

Fecha: 2026-11-03
Subagente: `code-reviewer`
Referencia: `reports/2026-11-03_1700_ui-ux-reviewer_modal-desbordado.md`

## Resumen ejecutivo

- Se revisó el `git diff` que corrige el diálogo cuyo contenido se salía de la caja.
- Resultado: sin problemas críticos ni altos. Hubo 1 hallazgo medio y 4 bajos.
- Los 5 hallazgos ya están corregidos.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (291) y `pnpm build` pasan en verde.
- Falta la confirmación visual del usuario en modo claro y oscuro.

## Lo comprobado

- `cn` fusiona bien las clases. Con `data-[size=default]:sm:max-w-2xl` desaparece el `max-w-sm` de la base.
- Las clases usadas son válidas en Tailwind v4 y en WebView2 156.
- `text-base` en `DialogContent` no rompe los formularios.
- `flex-col-reverse` con `flex-wrap` no altera el orden de los botones. Con `sm:flex-row` rige el orden del código.

## Hallazgos y resolución

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Medio | En el pie del formulario de socio, el mensaje "No se pudo cargar la configuración…" con `flex-wrap` quedaba solo en una línea y los botones bajaban. | `min-w-0 flex-1` en los mensajes del pie (`FormularioSocio.tsx`). |
| 2 | Bajo | Una palabra larga sin espacios (email, apellido compuesto) podía salirse del encabezado. | `grid-cols-1` y `[overflow-wrap:anywhere]` en `AlertDialogHeader`. |
| 3 | Bajo | Variantes `sm:...` de `place-items-start` y `text-left` redundantes en el encabezado. | Se quitaron. |
| 4 | Bajo | `grid-cols-[minmax(0,1fr)]` equivale a `grid-cols-1`. | Se usa `grid-cols-1` (`alert-dialog.tsx` y `dialog.tsx`). |
| 5 | Bajo | Los ajustes de `ui/` se pierden si se vuelve a correr `shadcn add dialog` o `alert-dialog`. | Anotado en `CLAUDE.md` (sección "Tamaños de UI"), con la regla del ancho por variante `data-[size=default]`. |

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | OK |
| `pnpm lint` | OK |
| `pnpm test` | OK (291 tests) |
| `pnpm build` | OK |

## Pendientes

- Confirmación visual del usuario en modo claro y oscuro (responsable: usuario).
- Si se reinstala un componente con `shadcn add`, reaplicar los ajustes de `ui/` (responsable: agente principal).

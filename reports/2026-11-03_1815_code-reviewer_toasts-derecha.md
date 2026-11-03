# Revisión de código: toasts abajo a la derecha

Fecha: 2026-11-03 · Subagente: `code-reviewer`

## Resumen ejecutivo

- Se revisó el `git diff` del cambio que devuelve los avisos (toasts) abajo a la derecha, con mitigaciones de UI.
- Se confirmó que `offset` y `visibleToasts` existen en sonner 2.0.8 y que el wrapper los reenvía. Las clases son válidas en Tailwind v4.3 (`pb-28` le gana a `p-8`).
- Hubo 2 advertencias y 2 sugerencias. Todas están corregidas. No queda nada pendiente.

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Advertencia | Un clic en un aviso contaba como "clic afuera" del diálogo. Cerraba el formulario de socio o de plan y se perdía lo cargado. Es más probable con los avisos en la misma esquina que el pie del diálogo. | `DialogContent` (`src/components/ui/dialog.tsx`) ignora los clics sobre `[data-sonner-toaster]` en `onPointerDownOutside`, para todos los diálogos. Anotado en `CLAUDE.md`. |
| 2 | Advertencia | `max-h-[calc(100vh-8rem)]` no alcanzaba para alejar los botones del formulario de socio de la zona de avisos en 1024×768. | Se cambió a `max-h-[calc(100vh-14rem)]`. |
| 3 | Sugerencia | `offset` y `visibleToasts` son los valores por defecto de sonner. | Se dejan explícitos y el comentario lo aclara. |
| 4 | Sugerencia | Comentarios que prometían más de lo que garantiza el código ("no interfiere con Guardar"). | Redacción ajustada en `App.tsx` y `Pagina.tsx`. |

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | En verde |
| `pnpm lint` | En verde |
| `pnpm test` | En verde (291 tests) |

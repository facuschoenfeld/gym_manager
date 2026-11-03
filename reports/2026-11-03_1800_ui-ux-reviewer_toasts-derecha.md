# Revisión UI/UX: toasts abajo a la derecha

Fecha: 2026-11-03 · Agente: `ui-ux-reviewer`

## Resumen ejecutivo

Los toasts vuelven a mostrarse abajo a la derecha, por pedido del usuario. La etiqueta "Al día" quedó confirmada. La revisión no cuestionó la posición. Se limitó a evitar que los avisos tapen botones de esa esquina. Se aplicaron las 3 correcciones y no queda nada pendiente de UI.

## Contexto

Desde el ajuste anterior los toasts estaban abajo a la izquierda. El usuario los prefiere abajo a la derecha. Eso puede solaparse con botones de acción ubicados en la misma esquina.

## Hallazgos y correcciones

| # | Hallazgo | Corrección | Archivo |
|---|---|---|---|
| 1 | En Configuración, "Guardar cambios" quedaba pegado a la esquina inferior derecha, donde aparece el toast "Configuración guardada" (6 s). | `pb-28` en el contenedor de todas las páginas: el botón queda por encima de la zona de avisos. | `src/components/layout/Pagina.tsx` |
| 2 | El offset del Toaster era implícito y una ráfaga de errores podía apilar muchos avisos. | `offset={{ bottom: 24, right: 24 }}` explícito y `visibleToasts={3}`. | `src/App.tsx` |
| 3 | En 1024×680, el pie del formulario de socio podía llegar a la esquina inferior derecha. | `max-h-[calc(100vh-8rem)]` en el `DialogContent` del formulario de socio. | `src/features/socios/FormularioSocio.tsx` |

## Decisiones del usuario (registradas en CLAUDE.md)

- Toasts abajo a la derecha.
- Etiqueta "Al día" confirmada para el estado `pago`.

## Verificación

`pnpm typecheck`, `pnpm lint` y `pnpm test` (291 tests) en verde.

## Pendientes

- UI: ninguno.
- Aparte: cierre de la fase 2 (medición de RAM en release y reporte de cierre).

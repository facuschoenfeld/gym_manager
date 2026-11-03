# Revisión de ui-ux-reviewer: ajustes de la fase 2

Fecha: 2026-11-03

## Resumen ejecutivo

- Tras la prueba manual de la fase 2 se agregaron tres cambios: eliminar planes, "Guardar y salir" en el aviso de cambios sin guardar, y toasts sin botón de cerrar ni "Deshacer".
- `ui-ux-reviewer` devolvió 10 hallazgos (1 alta, 5 medios, 4 bajos). Los 10 se corrigieron.
- Queda pendiente la prueba manual del usuario sobre "Guardar y salir", el menú "Más acciones" y la eliminación de planes.

## Hallazgos y correcciones

| # | Prioridad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | "Guardar y salir" probablemente guardaba pero no navegaba: el bloqueo dependía de `isSubmitting` y se desactivaba a mitad del guardado. | El bloqueo ya no depende de `isSubmitting`. Se guarda el destino pedido, se guarda y se navega a ese destino (ref `permitirSalida`). |
| 2 | Media | "Eliminar" pegado a "Desactivar", con el mismo tamaño y estilo (riesgo de tocarlo por error). | "Editar" queda visible. Desactivar/Reactivar y Eliminar pasan a un menú "Más acciones" (⋯), con Eliminar separado y en rojo. |
| 3 | Media | Tres botones por fila podían desbordar a 1024 px. | Resuelto con el mismo menú (2 controles por fila). |
| 4 | Media | El texto rojo de "Eliminar" estaba en el límite de contraste y perdía el rojo con hover. | Ítem del menú con `text-red-700` (claro) y `text-red-400` (oscuro), también en foco. |
| 5 | Media | Diálogo informativo con "Cancelar" (no había nada que cancelar) y sin explicar qué pasa con los socios al desactivar. | Botón "Cerrar". El texto explica que los socios que ya tienen el plan lo conservan. |
| 6 | Media | El toast "Revisá los datos marcados en rojo" dependía solo del color. | Ahora dice "Hay campos con errores. Corregilos para poder guardar." y el cursor va al primer campo con error. |
| 7 | Baja | Toasts sin botón de cerrar con duración corta. | Éxito/info 6 s, advertencia 8 s, error 10 s. El mouse encima los pausa. |
| 8 | Baja | Diálogos de eliminar montados y desmontados (sin animación de cierre). | Un solo diálogo siempre montado que cambia su contenido. |
| 9 | Baja | "Salir sin guardar" (rojo sólido) competía con el botón principal. | La acción secundaria peligrosa pasa a contorno rojo. El botón principal domina. |
| 10 | Baja | El diálogo se podía cerrar con Esc o clic afuera mientras procesaba. | No se cierra mientras procesa. |

Sin cambios necesarios según el revisor: el retiro del botón de cerrar y de "Deshacer" de los toasts quedó limpio, y los textos del diálogo de eliminar son claros.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | En verde |
| `pnpm lint` | En verde |
| `pnpm test` | En verde (288 tests) |
| `pnpm build` | En verde |

## Pendientes

| Pendiente | Responsable sugerido |
|---|---|
| Probar "Guardar y salir" (guarda y navega al destino pedido). | Usuario |
| Probar el menú "Más acciones" (⋯) en Planes, a 1024 px y en modo oscuro. | Usuario |
| Probar eliminar un plan sin uso y uno con uso. | Usuario |
| Lanzar `code-reviewer` sobre el `git diff` antes del commit, según el orden de CLAUDE.md. | Agente principal |

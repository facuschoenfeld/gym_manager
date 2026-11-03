# Revisión de código: ajustes de la fase 2

Fecha: 2026-11-03
Subagente: `code-reviewer`
Alcance: eliminar planes, "Guardar y salir", DNI estricto, toasts sin cerrar.

## Resumen ejecutivo

- Resultado general: nada crítico. El SQL está bien parametrizado, el `DELETE ... NOT EXISTS` es atómico y no hay violaciones de las reglas de datos.
- Se encontraron 9 hallazgos (1 alto, 1 medio, 7 bajos). Se corrigieron 8; el 8 queda para la fase 5.
- Pendiente la prueba manual del usuario (ver abajo).

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alto | "Guardar y salir" navegaba a mano (reset + navigate): perdía el state de la navegación (ej. Ctrl+N no abría el alta), convertía "atrás" en una navegación nueva y dejaba un ref en true. | Se usa `salida.proceed()` después de guardar (el blocker sigue "blocked" durante el guardado). Se quitaron el ref y `useNavigate`. |
| 2 | Medio | Al cerrar un `Confirmar` el foco quedaba en el body (no hay Trigger). | Nueva prop `focoAlCerrar` en `Confirmar`. Planes vuelve al botón "⋯" de la fila (o a "Nuevo plan" si se eliminó) y la ficha al botón "Dar de baja". |
| 3 | Bajo (a verificar) | Un AlertDialog abierto desde un DropdownMenu modal puede dejar `pointer-events` trabado. | `DropdownMenu modal={false}`. |
| 4 | Bajo | El contenido de los diálogos se vaciaba durante la animación de cierre. | El estado guarda `abierto` aparte de los datos. |
| 5 | Bajo | Si el plan ya no existía, el error decía que estaba en uso. | Se distingue "ya no existe" de "está en uso". |
| 6 | Bajo | `textoConfirmar` y `alConfirmar` eran opcionales por separado (podía quedar informativo sin querer). | Se unificaron en `accion?: AccionConfirmar`. |
| 7 | Bajo | "juan ." no encontraba nada (un punto anulaba toda la búsqueda). | Las palabras de solo puntos se ignoran; si todas lo son, no coincide con nadie. |
| 8 | Bajo (a verificar en fase 5) | `normalizarDni` rechaza "30-123-456" y "30,123,456", que podrían venir del Excel. | Sin cambio de código. Anotado en `CLAUDE.md` para revisarlo con el Excel real. |
| 9 | Bajo (a verificar) | Los toasts (abajo a la derecha, sin cerrar) podían tapar "Guardar cambios". | Toasts abajo a la izquierda, sobre el menú lateral. |

Nota adicional: el linter (regla `react-hooks/refs`) marcó que se escribía un ref desde una función armada en el render. Se resolvió guardando "eliminado" en el estado.

## Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` | En verde |
| `pnpm lint` | En verde |
| `pnpm test` | En verde, 291 tests (3 nuevos para la búsqueda con puntos) |
| `pnpm build` | En verde |

## Pendientes

- Prueba manual del usuario:
  - "Guardar y salir" con Ctrl+N (debe abrir el alta).
  - Menú "Más acciones" (comprobar que no queda trabado el puntero).
  - Eliminar un plan sin uso y uno con uso.
  - Foco al cerrar los diálogos.
- Fase 5: decidir si `normalizarDni` debe aceptar guiones y comas al importar (hallazgo 8). Responsable sugerido: desarrollador, con el Excel real.
- Verificar visualmente que los toasts a la izquierda no tapen contenido importante (hallazgos 3 y 9). Responsable sugerido: usuario, durante la prueba manual.

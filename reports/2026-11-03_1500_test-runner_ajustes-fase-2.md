# Reporte test-runner: ajustes de la fase 2

**Fecha:** 2026-11-03

## Resumen

Tras la prueba manual de la fase 2 se ajustó la lógica de DNI, búsqueda y eliminación de planes. Se agregaron 34 tests. Los 288 tests pasan, y `typecheck` y `lint` no dan errores. No se encontraron bugs nuevos. Se corrigió un bug previo: `"30.100.000"` se leía como `"30.100"`.

## Cambios testeados

| Función | Archivo | Cambio |
|---|---|---|
| `normalizarDni` | `src/lib/texto.ts` | Es estricta con la puntuación. Acepta `30123456`, `30.123.456`, `30 123 456` y `30123456.0` (Excel). Rechaza la puntuación mal puesta. |
| `coincideBusqueda` | `src/lib/texto.ts` | Una palabra formada solo por puntos (`...`) ya no coincide con todos los socios. |
| `puedeEliminarPlan` | `src/features/planes/logica/plan.ts` | Un plan se elimina solo si no tiene socios (ni dados de baja) ni pagos. |

## Tests agregados

| Archivo | Tests | Cobertura |
|---|---|---|
| `src/lib/texto.test.ts` | 31 | Acepta 6 y 9 dígitos con puntos, decimales de Excel, espacios alrededor y DNI como número. Rechaza `12.345`, `1.234.567.890`, `30123456.5`, `30123456.0.0`, `--` y `.`. Cubre los motivos de error y la idempotencia (normalizar dos veces da lo mismo). Cubre la búsqueda parcial `30.123` y la combinada `30.123.456 juan`. Verifica que `j.perez` se busque literal. |
| `src/features/planes/logica/plan.test.ts` | 3 | Plural y singular de los mensajes, y la combinación de socios y pagos. |
| **Total** | **34** | |

Los tests de `socio.test.ts` que usan DNI siguen siendo correctos con la regla nueva.

## Resultado de comandos

| Comando | Resultado |
|---|---|
| `pnpm test` | 9 archivos, 288 tests en verde |
| `pnpm typecheck` | Sin errores |
| `pnpm lint` | Sin errores |

## Bugs

Ninguno nuevo. El bug previo de `"30.100.000"` leído como `"30.100"` quedó corregido y cubierto por tests.

## Observaciones (no son bugs)

- La búsqueda trata `j.perez` como texto literal, así que no encuentra a "Juan Perez".
- `123.000` se interpreta como miles (123000) y no como decimal de Excel. Es el orden documentado.

## Pendientes

Ninguno.

---
*Contenido generado por `report-writer`; el archivo lo guardó el agente principal porque el subagente no lo escribió.*

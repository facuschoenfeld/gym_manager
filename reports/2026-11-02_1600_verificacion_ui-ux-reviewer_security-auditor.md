# Verificación de los subagentes ui-ux-reviewer y security-auditor

Fecha: 2026-11-02

## Resumen ejecutivo

- Los dos subagentes no cargaban por un error de YAML en el frontmatter. Ya está corregido y ambos funcionan.
- Se probaron sobre un archivo cada uno. `ui-ux-reviewer` encontró 3 observaciones y `security-auditor` encontró 3 (1 alta, 1 media, 1 baja).
- Todo lo encontrado queda pendiente. La UI se trata en la fase 2 y los permisos de `fs`, en la fase 6 y antes del instalador (fase 7).
- No hubo cambios en el código del proyecto.

## Problema inicial

Los subagentes globales `ui-ux-reviewer` y `security-auditor` (en `C:\Users\facus\.claude\agents\`) no aparecían en la sesión, ni siquiera después de reiniciar.

- **Causa:** el campo `description` del frontmatter YAML tenía `: ` (dos puntos + espacio) sin comillas ("Audita vulnerabilidades: ...", "Audita interfaces: ..."). Eso es YAML inválido, y Claude Code descarta el archivo sin avisar.
- Los 4 agentes que sí cargaban no tenían ese patrón.

## Corrección

- Se encerró el valor de `description` entre comillas dobles en ambos archivos.
- Es el único cambio. Se verificó con diff y se conservaron los finales de línea CRLF.
- Respaldo de los originales: `C:\Users\facus\AppData\Local\Temp\claude\9bed7fd8232bdf26\52f7e255-2a70-4c83-8ada-df2571f9b5de\scratchpad\agents-backup`.
- Tras reiniciar la sesión, ambos aparecen y funcionan.
- **Recomendación:** poner siempre entre comillas las descripciones de agentes que contengan `: `.

## Prueba de ui-ux-reviewer (`src/components/layout/Layout.tsx`): funciona

| # | Ubicación | Hallazgo | Sugerencia |
|---|---|---|---|
| 1 | Línea 68 | `<main>` sin `id` ni enlace "Saltar al contenido". Con teclado hay que pasar por 5 enlaces y el botón de tema en cada pantalla. | Agregar el enlace "Saltar al contenido" y el `id` en `<main>`. |
| 2 | Líneas 43-58 | `NavLink` sin estilo `focus-visible` propio: el foco puede verse poco sobre `bg-sidebar`. El estado activo se marca solo con color. `aria-current="page"` ya lo pone NavLink. | `focus-visible:ring-2 ring-ring` y un indicador no cromático, por ejemplo una barra lateral. |
| 3 | Líneas 36 y 68 | Barra lateral `w-60` fija y `h-screen` sin adaptación: en ventanas angostas ocupa mucho ancho. | Colapsar a solo íconos (con `aria-label`/`title`) por debajo de `md`. |

**Estado:** pendientes, se tratan en la fase 2 (pantallas). La app es de escritorio con ventana mínima de 1024×680 (definida en `tauri.conf.json`), así que el punto 3 tiene prioridad baja.

## Prueba de security-auditor (`src-tauri/capabilities/default.json`): funciona

| # | Severidad | Ubicación | Hallazgo | Sugerencia |
|---|---|---|---|---|
| 1 | Alta | Líneas 24-27 | `fs:scope` con `"**"` da acceso a todo el disco, junto con permisos de escritura y borrado. Ante un eventual XSS (por ejemplo vía un Excel importado) se podría leer o borrar cualquier archivo. | Limitar el alcance a `$APPDATA/ar.gym.manager/**` y a la carpeta de respaldos. |
| 2 | Media | Línea 20 | `fs:allow-remove` sin restricción. | Si solo se usa para rotar respaldos, acotarlo a esa carpeta; si no se usa, quitarlo. |
| 3 | Baja | Línea 13 | `sql:allow-execute` permite SQL arbitrario desde la interfaz. Es inherente al diseño (la lógica está en TS). | Mantener la CSP estricta, sin scripts inline. La regla del opener limitada a `https://wa.me/*` está bien acotada. |

**Estado:** pendientes. Se proponen para la fase 6 (respaldos), cuando se defina cómo se elige la carpeta de respaldos (posiblemente un pendrive u otra unidad), y antes del instalador (fase 7).

## Cambios en el repositorio

Ninguno en el código del proyecto. Solo se agrega este reporte. Los archivos de agentes modificados están fuera del repositorio (configuración global del usuario).

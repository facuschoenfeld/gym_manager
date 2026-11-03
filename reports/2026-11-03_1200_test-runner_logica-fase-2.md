# Reporte de test-runner: lógica de la fase 2

Fecha: 2026-11-03
Alcance: planes, configuración y socios (Gym Manager).

## Resumen

Se escribieron los tests de la lógica pura de la fase 2. Los tests pasaron de 144 a 228 (84 nuevos). `pnpm test`, `pnpm typecheck` y `pnpm lint` están en verde. No se encontraron bugs en la lógica. No se hizo commit: se commitea junto con el resto de la fase.

## Qué cubre cada archivo de test

| Archivo | Funciones | Casos principales |
|---|---|---|
| `src/features/planes/logica/plan.test.ts` | `esquemaPlan`, `nombreDePlanRepetido`, `planesElegibles` | Nombre: se recorta, rechaza vacío y más de 60 caracteres. Período inválido. Cantidad entera entre 1 y 36 (rechaza 0, 37, decimales, negativos y texto). Monto en centavos (`"25.000"` → 2500000, `"$ 25.000,50"` → 2500050) que rechaza vacío, texto y negativos, con resultado siempre entero. Nombre repetido sin distinguir mayúsculas, acentos ni espacios, excluyendo el plan en edición e incluyendo inactivos. Planes elegibles: solo activos, más el plan actual del socio aunque esté inactivo, sin duplicar y con plan inexistente ignorado. |
| `src/features/socios/logica/socio.test.ts` | `crearEsquemaSocio`, `socioAFormulario`, `buscarDuplicados`, `filtrarSocios`, `contarPorEstado`, `agregarEstado`, `nombreCompleto` (usa `FILTROS_INICIALES`) | Esquema: capitaliza nombre y apellido (partículas incluidas). DNI sin puntos, vacío = `null`, inválido da error. Teléfono normalizado con código de área (`"15 123456"` → `5493482123456`), vacío = `null`, inválido con error en el campo `telefono`. Email y notas opcionales. `planId` convertido a número. Ida y vuelta socio → formulario → esquema. Duplicados por DNI y por nombre (sin acentos), excluyendo al socio en edición. Filtros por activo, estado, plan y búsqueda (acentos, DNI con puntos), combinados. Orden por nombre (es-AR) y por vencimiento (sin pagos al final), sin mutar la lista original. Conteo solo de activos. Estado y días para vencer (sin pagos, pago, por vencer, gracia, vencido, vence hoy). |
| `src/features/configuracion/logica/configuracion.test.ts` | `esquemaConfiguracion`, `configAFormulario` | Nombre del gimnasio (vacío y más de 80 caracteres). `dias_por_vencer` y `dias_gracia` entre 0 y 60 (rechaza negativos, decimales, texto y vacío). Regla de vencimiento (valor desconocido y `desde_fecha_pago`). Código de área: `"03482"` → `"3482"`, vacío válido, 3 y 5 dígitos inválidos, ignora caracteres no numéricos. Conversión de `Config` a formulario (números a texto) e ida y vuelta por el esquema. |

## Resultado de los comandos

| Comando | Resultado |
|---|---|
| `pnpm test` | 9 archivos, 228 tests en verde, 0 fallidos, 0 omitidos |
| `pnpm typecheck` | Sin errores |
| `pnpm lint` | Sin errores ni advertencias |

Nota: los `it.each` cuentan por caso.

## Bugs encontrados

Ninguno.

## Pendientes

- Funciones exportadas sin tests: ninguno.
- Constantes exportadas sin test directo: `PERIODOS` (`plan.ts`) y `FORMULARIO_SOCIO_VACIO` (`socio.ts`). Son datos fijos, sin lógica.
- Falta hacer el commit de los tests junto con el resto de la fase 2.

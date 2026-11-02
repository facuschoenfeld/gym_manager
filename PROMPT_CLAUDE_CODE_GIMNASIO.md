## 1. Contexto

Quiero construir una app de escritorio para un gimnasio. Reemplaza un Excel de cuotas donde hoy se controlan socios y pagos. **La app informa quién debe y quién está al día.** Los pagos se cobran por fuera, en **efectivo o transferencia**, y el usuario los **registra a mano** en el sistema.

- Se usa en **un solo equipo** (recepción), sin conexión obligatoria a internet.
- Idioma de la interfaz y de los textos: **español (Argentina)**.
- Mi perfil: manejo JavaScript/TypeScript, React, Node y Express. **No manejo Rust.**
- El usuario final es un coach que trabaja en el gimnasio sin conocimientos técnicos.

### Equipo donde se ejecutará
| Dato | Valor |
|---|---|
| CPU | Intel Core i5-7200U (2 núcleos, 2,5 GHz) |
| RAM | 8 GB (≈ 2,8 GB libres en uso normal) |
| SO | Windows 10 Home 64 bits, versión 1909 (sin soporte de Microsoft) |
| Otros | Edge instalado, antivirus Avast, Excel en uso |

---

## 2. Objetivos y requisitos no funcionales

- **RNF-01** Funciona en Windows 10/11 de 64 bits. Instalador único y fácil de usar.
- **RNF-02** Liviana: objetivo **< 100 MB de RAM** en uso y arranque en pocos segundos.
- **RNF-03** Interfaz agradable e intuitiva: botones  y secciones grandes, buen contraste, flujos cortos.
- **RNF-04** Funciona **100 % sin internet**. Sin servicios externos, sin claves ni tokens.
- **RNF-05** Escalable y de fácil mantenimiento: código por funcionalidades, migraciones de base versionadas, actualizaciones automáticas.
- **RNF-06** Curva de aprendizaje baja: la lógica va en **TypeScript**. Rust solo si es imprescindible, mínimo y explicado.
- **RNF-07** Los datos no se pierden: respaldos automáticos y confirmación antes de acciones destructivas.
- **RNF-08** Notificación push por cada acción cometida

---

## 3. Stack decidido

| Capa | Tecnología |
|---|---|
| Shell de escritorio | **Tauri 2** |
| Frontend | **React + TypeScript + Vite** |
| UI | **Tailwind + shadcn/ui** |
| Base de datos | **SQLite** con `@tauri-apps/plugin-sql` (consultas desde TypeScript) |
| Formularios y validación | React Hook Form + Zod |
| Datos y tablas | TanStack Query + TanStack Table |
| Excel | SheetJS (`xlsx`) o ExcelJS — elegí el más liviano y **justificá la elección** |
| Tests | Vitest (lógica pura) |
| Plugins de Tauri | `dialog`, `fs`, `updater` (y otros solo si hace falta) |
| Gestor de paquetes | pnpm (o npm si hay problemas) |

**No usar:** Electron, servidor Node/Express, servicios externos de pago o mensajería, ni nada que requiera internet para funcionar.

---

## 4. Alcance: características por módulo
### 4.1 Socios
- **F-SOC-01** Listado de socios con búsqueda instantánea por nombre, apellido o DNI.
- **F-SOC-02** Estado visible por socio: **Pago / Por vencer / Vencido / Sin pagos**, con color y texto (no solo color).
- **F-SOC-03** Filtros por estado, plan y activo/inactivo; orden por nombre o por vencimiento.
- **F-SOC-04** Alta y edición de socio (nombre, apellido, DNI, teléfono, email opcional, plan, notas).
- **F-SOC-05** Baja lógica (`activo = 0`): los socios no se borran, se desactivan y se pueden reactivar.
- **F-SOC-06** Ficha del socio con historial completo de pagos.
- **F-SOC-07** Detección de posibles duplicados al crear un socio (mismo DNI o mismo nombre y apellido).

### 4.2 Planes
- **F-PLA-01** Los planes se dividen en por día, semana o mes. El cliente puede elegir el plan que más se adecua y cada plan tiene un valor distinto.
- **F-PLA-02** El cambio de precio de un plan no altera pagos ya registrados.

### 4.3 Pagos (manuales)
- **F-PAG-01** **Registro de pago en dos clics:** buscar socio → "Registrar pago". Monto y nuevo vencimiento vienen precalculados según el plan; solo se elige el medio.
- **F-PAG-02** Medios de pago: **efectivo** y **transferencia**. Campo opcional de referencia (n.º de operación o nota) para transferencias.
- **F-PAG-03** Monto y fecha editables antes de confirmar (descuentos, pagos parciales por convenio, pago atrasado).
- **F-PAG-04** **Anular pago** con motivo y registro (no se borra la fila): el socio vuelve al estado anterior.
- **F-PAG-05** Regla de cálculo del vencimiento configurable.
- **F-PAG-06** El monto del plan (día, semana o mes) se establece en configuración de manera fija y puede ser editable.

### 4.4 Deudores y panel de inicio
- **F-DEU-01** Pantalla principal con **lista de deudores** (vencidos y por vencer), ordenada por días de atraso.
- **F-DEU-02** Contadores: socios pagos, por vencer, vencidos, sin pagos.
- **F-DEU-03** Ingresos del mes (suma de pagos no anulados) y cantidad de pagos.
- **F-DEU-04** Exportar lista de deudores a Excel y vista imprimible.
- **F-DEU-05** Botón de WhatsApp (wa.me) al lado de cada deudor (vencido, no por vencer) para enviarle un mensaje prellenado.

### 4.5 Importación desde Excel (función clave)
- **F-IMP-01** Elegir archivo `.xlsx` y mostrar **vista previa** de ~10 filas (primera fila = encabezados).
- **F-IMP-02** **Mapeo dinámico de columnas:** el usuario asigna cada columna del archivo a un campo (nombre, apellido, DNI, teléfono, email, plan, último pago, vencimiento, monto) o la ignora. **Guardar el mapeo** en `config` para la próxima vez.
- **F-IMP-03** **Normalización tolerante:** fechas como número de serie de Excel o texto `dd/mm/yyyy`; teléfonos a formato internacional argentino (`549...`); DNI sin puntos ni espacios; nombres con espacios sobrantes y capitalización consistente.
- **F-IMP-04** **Validación previa:** filas sin nombre, fechas imposibles, DNI duplicados dentro del archivo. Mostrar problemas antes de importar.
- **F-IMP-05** **Inserción en una transacción** con *upsert* por DNI. Sin DNI: clave de respaldo nombre + apellido, avisando de posibles duplicados.
- **F-IMP-06** Si hay vencimiento o último pago, crear el pago correspondiente (origen: importación).
- **F-IMP-07** **Resumen final** (nuevos / actualizados / con error) y descarga de las filas rechazadas con el motivo.
- **F-IMP-08** Descargar una **plantilla `.xlsx`** de ejemplo.
- **F-IMP-09** Lógica de normalización y validación como **funciones puras con tests de Vitest**, separadas de la UI.
- **F-IMP-10** Generar un **Excel de prueba** con desorden realista (fechas mezcladas, teléfonos sin código de área, DNI con puntos, filas duplicadas y vacías).

>**Todavía no tengo el Excel real.** No asumas columnas fijas; usá el mapeo dinámico. Cuando lo consiga, ajustaremos el mapeo por defecto.

### 4.6 Aviso manual por WhatsApp (sin API)
- **F-AVI-01** Botón por socio que abre `https://wa.me/<telefono>?text=<mensaje>` con mensaje prellenado y editable para enviar a clientes deudores (ya vencido).
- **F-AVI-02** Registrar que se abrió un aviso (fecha) para no insistir de más; mostrar "último aviso" en la ficha.
- **F-AVI-03** Plantillas de mensaje editables desde configuración.
- **F-AVI-04** Teléfonos validados y normalizados a formato internacional antes de armar el link.

### 4.7 Configuración, respaldos y utilidades
- **F-CFG-01** Configuración: nombre del gimnasio, días para marcar "por vencer", días de gracia (cuántos días después del vencimiento son tolerables), plantilla de aviso.
- **F-RES-01** **Respaldo automático** diario de la base (copia del archivo `.db` con fecha) en una carpeta configurable; conservar los últimos N.
- **F-RES-02** Respaldo manual y **restauración** desde la app, con confirmación.
- **F-SIS-01** Pantalla "Estado del sistema": versión instalada, fecha del último respaldo, tamaño de la base.
- **F-SIS-02** Registro de errores local (log de errores) y botón para enviarlo/exportarlo. 
- **F-SIS-03** Actualizaciones automáticas con `tauri-plugin-updater` (cuando haya dónde publicarlas).

---

## 5. Fuera de alcance (no implementar)

- Pagos online, débito automático, Mercado Pago, QR o links de pago.
- Envío automático de email o WhatsApp (API de WhatsApp, Resend, SMTP).
- Control de acceso (molinetes, huella, QR), asistencias, reservas de clases.
- Facturación electrónica / AFIP.
- Multiusuario, roles, login, versión web o móvil.
- Sincronización con la nube.

> Si alguna de estas cosas se necesita más adelante, el diseño por capas debe permitir sumarla sin reescribir el resto.

---

## 6. Modelo de datos (SQLite)

Guardalo como **migraciones SQL numeradas** (`001_inicial.sql`, `002_...`) que se ejecuten automáticamente al iniciar y sean seguras de repetir. Activar `PRAGMA foreign_keys = ON` en cada conexión. **Revisá el esquema y proponeme mejoras antes de aplicarlo.**

```sql
-- 001_inicial.sql
CREATE TABLE planes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  monto INTEGER NOT NULL DEFAULT 0,
  duracion_dias INTEGER NOT NULL DEFAULT 30,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT,
  dni TEXT UNIQUE,
  email TEXT,
  telefono TEXT,                       -- formato internacional: 549351...
  plan_id INTEGER REFERENCES planes(id),
  fecha_alta TEXT NOT NULL DEFAULT (date('now','localtime')),
  activo INTEGER NOT NULL DEFAULT 1,   -- baja lógica
  notas TEXT
);

CREATE TABLE pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  plan_id INTEGER REFERENCES planes(id),
  monto INTEGER NOT NULL,
  fecha_pago TEXT NOT NULL,            -- 'DD-MM-YYYY'
  vence_el TEXT NOT NULL,              -- fin del período cubierto
  medio TEXT NOT NULL CHECK (medio IN ('efectivo','transferencia')),
  referencia TEXT,                     -- n.º de operación o nota
  origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','importacion')),
  anulado INTEGER NOT NULL DEFAULT 0,
  anulado_el TEXT,
  anulado_motivo TEXT,
  creado_el TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('por_vencer','vencida')),
  canal TEXT NOT NULL DEFAULT 'whatsapp_manual',
  creado_el TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE config (clave TEXT PRIMARY KEY, valor TEXT);

INSERT INTO config (clave, valor) VALUES
  ('dias_por_vencer', '5'),
  ('dias_gracia', '0'),
  ('nombre_gimnasio', 'Mi Gimnasio'),
  ('regla_vencimiento', 'desde_vencimiento_anterior');

CREATE INDEX idx_pagos_cliente ON pagos(cliente_id, vence_el);
CREATE INDEX idx_clientes_dni ON clientes(dni);

-- El estado NO se guarda: se deriva del último pago no anulado.
CREATE VIEW v_clientes_estado AS
SELECT c.*,
  MAX(p.vence_el) AS vence_el,
  CAST(julianday(date('now','localtime')) - julianday(MAX(p.vence_el)) AS INTEGER) AS dias_atraso,
  CASE
    WHEN MAX(p.vence_el) IS NULL THEN 'sin_pagos'
    WHEN date(MAX(p.vence_el), '+' || COALESCE((SELECT valor FROM config WHERE clave='dias_gracia'),'0') || ' days')
         < date('now','localtime') THEN 'vencido'
    WHEN MAX(p.vence_el)
         <= date('now','localtime', '+' || COALESCE((SELECT valor FROM config WHERE clave='dias_por_vencer'),'5') || ' days') THEN 'por_vencer'
    ELSE 'pago'
  END AS estado
FROM clientes c
LEFT JOIN pagos p ON p.cliente_id = c.id AND p.anulado = 0
GROUP BY c.id;
```

### Reglas de datos (obligatorias)
1. Fechas siempre en ISO (`DD-MM-YYYY`). **Usar `'localtime'`** en `date('now')` y `datetime('now')`: sin eso SQLite usa UTC y en Argentina (UTC-3) el día cambia a las 21:00.
2. Dinero siempre en **centavos como entero**. Formatear solo en la interfaz (`es-AR`).
3. El **estado del socio no se guarda**; se deriva del último vencimiento de pagos no anulados.
4. Los socios **no se borran** (baja lógica). Los pagos **no se borran** (se anulan con motivo).
5. Los pagos son un historial: una fila por pago.
6. Teléfonos guardados en formato internacional (`549...` para móviles argentinos).

---

## 7. Reglas de negocio 

- **Estado:** `sin_pagos` si no hay pagos; `vencido` si `vence_el + días_gracia < hoy`; `por_vencer` si `vence_el <= hoy + días_por_vencer`; `pago` en otro caso.
- **Nuevo vencimiento al registrar un pago:** según la regla elegida. Valor por defecto propuesto:
  - Si el socio está vigente (`vence_el >= hoy`): `nuevo = vence_el_anterior + duración_del_plan`.
  - Si está vencido o sin pagos: `nuevo = fecha_de_pago + duración_del_plan`.
- **Anular un pago:** el socio vuelve al estado que tendría sin ese pago.
- **Cambiar de plan** no modifica el historial; aplica a partir del siguiente pago.
- **Importación:** nunca pisa datos existentes con valores vacíos.

---

## 8. Estructura del proyecto

```
src/
  features/
    socios/        # listado, ficha, alta/edición, baja
    pagos/         # registro rápido, anulación, historial
    planes/        # ABM de planes
    deudores/      # pantalla principal y panel de inicio
    importar/      # asistente Excel (UI) + lógica pura
    avisos/        # wa.me, plantilla
    configuracion/ # parámetros, respaldos, estado del sistema
  db/
    migrations/    # SQL versionado
    client.ts      # conexión y migraciones al iniciar
    queries/       # consultas por módulo
  components/      # UI compartida
  lib/             # utilidades puras (fechas, dinero, teléfonos, normalización)
src-tauri/         # shell de Tauri (tocar lo mínimo)
```

---

## 9. Diseño y experiencia de uso

- Pantalla de inicio = Dashboard con **deudores y contadores**, no un menú vacío.
- Al abrir la app, el cursor queda en el **buscador de socios**.
- Atajos de teclado para lo frecuente (buscar, registrar pago).
- Estados con **color + texto + icono** (accesible).
- Confirmación clara antes de anular, dar de baja, restaurar un respaldo o importar.
- Mensajes de error comprensibles para el usuario, nunca solo en consola.
- Tema claro por defecto con opción de dark mode, contraste alto, tamaños de fuente cómodos.

---

## 10. Convenciones de código

- TypeScript estricto, **sin `any`**. Validar con Zod en los bordes (formularios e importación).
- Lógica de negocio y normalización en **funciones puras con tests**, separada de los componentes.
- Commits pequeños y descriptivos, en español (consistentes).
- Sin claves, tokens ni datos reales en el repositorio.
- Comentar lo no evidente; si hay que tocar Rust, **comentar cada cambio y explicarme qué hace**.

---

### Criterios de "terminado" por fase
- Compila y corre con `pnpm tauri dev` sin errores ni advertencias relevantes.
- Los tests pasan (`pnpm test`).
- Las migraciones se aplican en una base nueva y sobre una existente.
- Las características de la fase están probadas manualmente y listadas con instrucciones para verificarlas.
- Se midió el consumo de RAM de la app en ejecución y se informó.

---

## 11. Cómo quiero que trabajes

1. **Antes de escribir código**, revisá mi entorno: Node, pnpm, Rust (`rustup`), herramientas de compilación de C++ para Windows y WebView2. Si falta algo, decime qué instalar y cómo, paso a paso.
2. Creá el proyecto con la plantilla React + TypeScript de `create-tauri-app`.
3. Creá un archivo **`CLAUDE.md`** en la raíz con el contexto, el stack, las convenciones, las reglas de datos y el alcance para mantener la coherencia en futuras sesiones.
4. Mantené Rust al mínimo (`src-tauri/`); no escribas lógica de negocio en Rust.
5. Si hay una **decisión importante o ambigua** (librería, estructura, cambio de esquema, regla de negocio), **preguntame antes de seguir** en vez de asumir.
6. Al terminar la fase, listá: qué se hizo, cómo probarlo, qué queda pendiente y qué decisiones tomaste.
7. Explicame cómo generar el instalador con `pnpm tauri build` cuando corresponda.
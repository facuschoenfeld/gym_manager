-- =====================================================================
-- 001_inicial.sql: esquema inicial.
-- Lo ejecuta tauri-plugin-sql una sola vez, dentro de una transacción
-- (registra la versión en _sqlx_migrations). NO editar una vez publicada:
-- los cambios van en una migración nueva (002_..., 003_...).
--
-- Reglas de datos:
--   * Fechas en ISO 'YYYY-MM-DD' (fecha+hora: 'YYYY-MM-DD HH:MM:SS'), hora local.
--   * Dinero en centavos (INTEGER).
--   * El estado del socio NO se guarda: se calcula en TS (src/lib/estado.ts).
--   * Socios, planes y pagos no se borran: baja lógica / anulación.
-- Los PRAGMA (journal_mode=WAL, foreign_keys=ON) se aplican al conectar,
-- en src/db/client.ts: dentro de una transacción no tienen efecto.
-- =====================================================================

CREATE TABLE planes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT    NOT NULL UNIQUE,
  periodo   TEXT    NOT NULL CHECK (periodo IN ('dia', 'semana', 'mes')),
  cantidad  INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),   -- ej. 3 + 'mes' = trimestral
  monto     INTEGER NOT NULL DEFAULT 0 CHECK (monto >= 0),     -- centavos
  activo    INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_el TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE clientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT    NOT NULL CHECK (trim(nombre) <> ''),
  apellido       TEXT,
  dni            TEXT    UNIQUE CHECK (dni IS NULL OR dni <> ''),  -- sin puntos; vacío => NULL
  email          TEXT,
  telefono       TEXT,                                            -- internacional: 549351...
  plan_id        INTEGER REFERENCES planes(id),
  fecha_alta     TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),  -- baja lógica
  notas          TEXT,
  creado_el      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  actualizado_el TEXT
);

CREATE TABLE pagos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id     INTEGER NOT NULL REFERENCES clientes(id),
  plan_id        INTEGER REFERENCES planes(id),       -- plan vigente al momento del pago
  monto          INTEGER NOT NULL CHECK (monto >= 0), -- centavos; copia, no depende del plan
  fecha_pago     TEXT    NOT NULL,                    -- YYYY-MM-DD
  vence_el       TEXT    NOT NULL,                    -- YYYY-MM-DD: día en que debe volver a pagar
  medio          TEXT    NOT NULL CHECK (medio IN ('efectivo', 'transferencia')),
  referencia     TEXT,                                -- n.º de operación o nota
  origen         TEXT    NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'importacion')),
  anulado        INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1)),
  anulado_el     TEXT,
  anulado_motivo TEXT,
  creado_el      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (anulado = 0 OR (anulado_motivo IS NOT NULL AND trim(anulado_motivo) <> ''))
);

CREATE TABLE avisos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo       TEXT    NOT NULL CHECK (tipo IN ('por_vencer', 'vencida')),
  canal      TEXT    NOT NULL DEFAULT 'whatsapp_manual',
  creado_el  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

-- Índices. (clientes.dni ya tiene índice por ser UNIQUE.)
CREATE INDEX idx_pagos_vigentes ON pagos(cliente_id, vence_el) WHERE anulado = 0;
CREATE INDEX idx_pagos_fecha    ON pagos(fecha_pago);
CREATE INDEX idx_avisos_cliente ON avisos(cliente_id, creado_el);

-- Configuración inicial.
INSERT INTO config (clave, valor) VALUES
  ('nombre_gimnasio',       'Mi Gimnasio'),
  ('dias_por_vencer',       '5'),
  ('dias_gracia',           '0'),
  ('regla_vencimiento',     'desde_vencimiento_anterior'),  -- o 'desde_fecha_pago'
  ('plantilla_aviso',       'Hola {nombre}! Te escribimos de {gimnasio}. Tu cuota venció el {vencimiento}. El valor actual es {monto}. Cuando puedas, acercate a regularizarla. ¡Gracias!'),
  ('carpeta_respaldos',     ''),   -- vacío = carpeta por defecto dentro de los datos de la app
  ('respaldos_a_conservar', '14'),
  ('ultimo_respaldo',       ''),
  ('mapeo_importacion',     ''),   -- JSON con el último mapeo de columnas usado
  ('codigo_area',           '');   -- se antepone a teléfonos sin código de área (ej. 351)

-- Planes iniciales (precio 0: lo carga el gimnasio desde la app).
INSERT INTO planes (nombre, periodo, cantidad, monto) VALUES
  ('Pase diario', 'dia',    1, 0),
  ('Semanal',     'semana', 1, 0),
  ('Mensual',     'mes',    1, 0);

-- Datos de vencimiento por socio. El ESTADO se calcula en TS a partir de vence_el.
CREATE VIEW v_clientes_vencimiento AS
SELECT
  c.*,
  pl.nombre AS plan_nombre,
  pl.monto  AS plan_monto,
  (SELECT MAX(p.vence_el)  FROM pagos p  WHERE p.cliente_id = c.id AND p.anulado = 0) AS vence_el,
  (SELECT MAX(a.creado_el) FROM avisos a WHERE a.cliente_id = c.id)                   AS ultimo_aviso
FROM clientes c
LEFT JOIN planes pl ON pl.id = c.plan_id;

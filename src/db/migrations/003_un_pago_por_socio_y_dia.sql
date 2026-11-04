-- =====================================================================
-- 003_un_pago_por_socio_y_dia.sql: un solo pago vigente por socio y por día.
-- Antes de crear el índice único se anulan (con motivo, sin borrar) los pagos
-- repetidos del mismo socio y fecha: se conserva el primero que se cargó.
-- Los pagos anulados no cuentan para la regla.
-- =====================================================================

UPDATE pagos
SET anulado = 1,
    anulado_el = datetime('now', 'localtime'),
    anulado_motivo = 'Duplicado: mismo socio y misma fecha (anulado al actualizar la base)'
WHERE anulado = 0
  AND id IN (
    SELECT p2.id
    FROM pagos p2
    WHERE p2.anulado = 0
      AND EXISTS (
        SELECT 1 FROM pagos p1
        WHERE p1.cliente_id = p2.cliente_id
          AND p1.fecha_pago = p2.fecha_pago
          AND p1.anulado = 0
          AND p1.id < p2.id
      )
  );

CREATE UNIQUE INDEX ux_pagos_socio_dia ON pagos(cliente_id, fecha_pago) WHERE anulado = 0;

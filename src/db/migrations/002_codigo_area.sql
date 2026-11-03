-- =====================================================================
-- 002_codigo_area.sql: código de área por defecto del gimnasio.
-- 3482 = Reconquista (Santa Fe). Se antepone a los teléfonos que se cargan
-- sin código de área (ej. "15 123456" -> 5493482123456).
-- Solo se completa si sigue vacío: no pisa un valor ya configurado en la app.
-- =====================================================================

UPDATE config SET valor = '3482' WHERE clave = 'codigo_area' AND (valor IS NULL OR valor = '');

INSERT INTO config (clave, valor)
SELECT 'codigo_area', '3482'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE clave = 'codigo_area');

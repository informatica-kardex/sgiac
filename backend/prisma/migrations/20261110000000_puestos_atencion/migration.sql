BEGIN;

CREATE TABLE IF NOT EXISTS puesto_atencion (
  id_puesto BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS jornada_puesto (
  id_jornada BIGINT NOT NULL REFERENCES jornada_atencion(id_jornada) ON DELETE CASCADE,
  id_puesto BIGINT NOT NULL REFERENCES puesto_atencion(id_puesto) ON DELETE RESTRICT,
  PRIMARY KEY (id_jornada, id_puesto)
);
CREATE INDEX IF NOT EXISTS jornada_puesto_id_puesto_idx ON jornada_puesto(id_puesto);
ALTER TABLE ficha_atencion ADD COLUMN IF NOT EXISTS id_puesto BIGINT REFERENCES puesto_atencion(id_puesto) ON DELETE RESTRICT;
ALTER TABLE ficha_atencion ADD COLUMN IF NOT EXISTS puesto_llamado VARCHAR(80);
CREATE INDEX IF NOT EXISTS ficha_atencion_id_puesto_estado_actual_idx ON ficha_atencion(id_puesto, estado_actual);

-- Conserva los puestos existentes y los destinos de las fichas históricas.
INSERT INTO puesto_atencion(nombre)
SELECT nombre FROM (VALUES ('Ventanilla 1'), ('Ventanilla 2'), ('Ventanilla 3'), ('Encargada de Kardex')) iniciales(nombre)
WHERE NOT EXISTS (SELECT 1 FROM puesto_atencion) ON CONFLICT DO NOTHING;
INSERT INTO puesto_atencion(nombre) SELECT DISTINCT j.puesto FROM jornada_atencion j
WHERE NOT EXISTS (SELECT 1 FROM jornada_puesto existente WHERE existente.id_jornada = j.id_jornada)
ON CONFLICT DO NOTHING;
INSERT INTO jornada_puesto(id_jornada, id_puesto)
SELECT j.id_jornada, p.id_puesto FROM jornada_atencion j JOIN puesto_atencion p ON p.nombre = j.puesto
WHERE NOT EXISTS (SELECT 1 FROM jornada_puesto existente WHERE existente.id_jornada = j.id_jornada)
ON CONFLICT DO NOTHING;
UPDATE ficha_atencion f SET id_puesto = p.id_puesto, puesto_llamado = j.puesto
FROM jornada_atencion j JOIN puesto_atencion p ON p.nombre = j.puesto
WHERE f.id_jornada = j.id_jornada AND f.id_puesto IS NULL AND f.estado_actual IN ('LLAMADA', 'ATENDIDA', 'NO PRESENTADA');

ALTER TABLE puesto_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_puesto ENABLE ROW LEVEL SECURITY;
COMMIT;

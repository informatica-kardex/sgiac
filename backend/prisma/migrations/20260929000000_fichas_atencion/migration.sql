BEGIN;
CREATE TABLE IF NOT EXISTS tramite_atencion (
  id_tramite BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL UNIQUE,
  descripcion VARCHAR(500) NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE tramite_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_atencion
  ADD COLUMN IF NOT EXISTS id_tramite BIGINT REFERENCES tramite_atencion(id_tramite) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS modo_cupo VARCHAR(10) NOT NULL DEFAULT 'MANUAL' CHECK (modo_cupo IN ('MANUAL', 'TIEMPO')),
  ADD COLUMN IF NOT EXISTS minutos_por_estudiante INTEGER NOT NULL DEFAULT 10 CHECK (minutos_por_estudiante BETWEEN 1 AND 480),
  ADD COLUMN IF NOT EXISTS puesto VARCHAR(80) NOT NULL DEFAULT 'Kardex';
CREATE UNIQUE INDEX IF NOT EXISTS uq_jornada_fecha_tramite ON jornada_atencion(fecha, id_tramite);
CREATE INDEX IF NOT EXISTS idx_ficha_jornada_estado ON ficha_atencion(id_jornada, estado_actual);
INSERT INTO tramite_atencion(nombre, descripcion) VALUES
 ('Historial o récord académico', 'Solicitud de historial, récord académico y notas.'),
 ('Adición o retiro de materias', 'Adiciones y retiros de materias.'),
 ('Choque de horarios', 'Revisión de conflictos de horarios.')
ON CONFLICT (nombre) DO NOTHING;
COMMIT;

BEGIN;
CREATE TABLE auxiliar (
  id_auxiliar BIGSERIAL PRIMARY KEY,
  nombre_completo VARCHAR(150) NOT NULL,
  correo VARCHAR(150), telefono VARCHAR(30),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
CREATE TABLE auxiliar_asignacion (
  id_auxiliar BIGINT NOT NULL REFERENCES auxiliar(id_auxiliar) ON DELETE CASCADE,
  id_paralelo BIGINT NOT NULL REFERENCES paralelo(id_paralelo) ON DELETE CASCADE,
  PRIMARY KEY(id_auxiliar, id_paralelo)
);
ALTER TABLE auxiliar ENABLE ROW LEVEL SECURITY;
ALTER TABLE auxiliar_asignacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE horario ADD COLUMN fecha DATE,
  ADD COLUMN motivo VARCHAR(200),
  ADD COLUMN id_auxiliar BIGINT REFERENCES auxiliar(id_auxiliar) ON DELETE RESTRICT;
ALTER TABLE horario ADD CONSTRAINT horario_fecha_dia CHECK (fecha IS NULL OR
  EXTRACT(ISODOW FROM fecha) = CASE dia_semana
    WHEN 'LUNES' THEN 1 WHEN 'MARTES' THEN 2 WHEN 'MIERCOLES' THEN 3
    WHEN 'JUEVES' THEN 4 WHEN 'VIERNES' THEN 5 WHEN 'SABADO' THEN 6 END);
CREATE INDEX horario_fecha_idx ON horario(fecha);
CREATE INDEX horario_id_auxiliar_idx ON horario(id_auxiliar);
COMMIT;

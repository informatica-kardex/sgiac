CREATE TABLE IF NOT EXISTS solicitud_aula (
  id BIGSERIAL PRIMARY KEY,
  id_solicitante BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  id_auxiliar BIGINT NOT NULL REFERENCES auxiliar(id_auxiliar) ON DELETE RESTRICT,
  id_paralelo BIGINT NOT NULL REFERENCES paralelo(id_paralelo) ON DELETE RESTRICT,
  nombre VARCHAR(150) NOT NULL, ci VARCHAR(30) NOT NULL, ru VARCHAR(30) NOT NULL,
  correo VARCHAR(150) NOT NULL, celular VARCHAR(30) NOT NULL,
  numero_estudiantes INTEGER NOT NULL CHECK (numero_estudiantes BETWEEN 1 AND 1000),
  actividad VARCHAR(40) NOT NULL, detalle VARCHAR(1000) NOT NULL,
  reserva JSONB NOT NULL CHECK (jsonb_typeof(reserva) = 'object'),
  propuesta JSONB,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PROPUESTA','APROBADA','RECHAZADA','CANCELADA')),
  version INTEGER NOT NULL DEFAULT 1,
  historial JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(historial) = 'array'),
  creada_en TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), actualizada_en TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS solicitud_aula_solicitante_idx ON solicitud_aula(id_solicitante, creada_en);
CREATE INDEX IF NOT EXISTS solicitud_aula_estado_idx ON solicitud_aula(estado, creada_en);
ALTER TABLE solicitud_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS id_solicitud_aula BIGINT REFERENCES solicitud_aula(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS horario_id_solicitud_aula_idx ON horario(id_solicitud_aula);

BEGIN;
CREATE TABLE IF NOT EXISTS tipo_documento (
  id BIGSERIAL PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE, descripcion TEXT NOT NULL DEFAULT '',
  habilitado BOOLEAN NOT NULL DEFAULT false, desde TIMESTAMPTZ(6), hasta TIMESTAMPTZ(6),
  plazo_horas INTEGER NOT NULL DEFAULT 48 CHECK (plazo_horas BETWEEN 1 AND 720),
  hojas INTEGER NOT NULL DEFAULT 1 CHECK (hojas BETWEEN 0 AND 100),
  cupo_diario INTEGER NOT NULL DEFAULT 50 CHECK (cupo_diario BETWEEN 1 AND 5000),
  lugar VARCHAR(200) NOT NULL DEFAULT 'Kardex', requisitos TEXT NOT NULL DEFAULT '',
  correo_habilitado BOOLEAN NOT NULL DEFAULT true,
  hora_inicio VARCHAR(5) NOT NULL DEFAULT '08:00', hora_fin VARCHAR(5) NOT NULL DEFAULT '16:00',
  dias_atencion INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], version INTEGER NOT NULL DEFAULT 1,
  CHECK ((desde IS NULL AND hasta IS NULL) OR (desde IS NOT NULL AND hasta IS NOT NULL AND hasta > desde)),
  CHECK (hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin > hora_inicio),
  CHECK (cardinality(dias_atencion) BETWEEN 1 AND 7 AND dias_atencion <@ ARRAY[0,1,2,3,4,5,6])
);
CREATE TABLE IF NOT EXISTS solicitud_documento (
  id BIGSERIAL PRIMARY KEY, codigo VARCHAR(40) UNIQUE,
  id_tipo BIGINT NOT NULL REFERENCES tipo_documento(id),
  id_estudiante BIGINT NOT NULL REFERENCES estudiante(id_estudiante),
  id_responsable BIGINT REFERENCES usuario(id_usuario), documento VARCHAR(120) NOT NULL,
  motivo VARCHAR(500) NOT NULL, detalle TEXT NOT NULL DEFAULT '',
  estado VARCHAR(30) NOT NULL DEFAULT 'SOLICITADA' CHECK (estado IN ('SOLICITADA','EN_PREPARACION','LISTA','ENTREGADA','RECHAZADA','CANCELADA')),
  creada_en TIMESTAMPTZ(6) NOT NULL DEFAULT now(), estimada_en TIMESTAMPTZ(6) NOT NULL, fecha_recojo TIMESTAMPTZ(6),
  hojas INTEGER NOT NULL CHECK (hojas BETWEEN 0 AND 100), lugar VARCHAR(200) NOT NULL,
  requisitos TEXT NOT NULL DEFAULT '', correo_habilitado BOOLEAN NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  CHECK (estado NOT IN ('LISTA','ENTREGADA') OR fecha_recojo IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS solicitud_documento_activa_unica ON solicitud_documento(id_estudiante,id_tipo) WHERE estado IN ('SOLICITADA','EN_PREPARACION','LISTA');
CREATE INDEX IF NOT EXISTS solicitud_documento_estudiante ON solicitud_documento(id_estudiante,creada_en);
CREATE INDEX IF NOT EXISTS solicitud_documento_estado ON solicitud_documento(estado,creada_en);
CREATE INDEX IF NOT EXISTS solicitud_documento_tipo_fecha ON solicitud_documento(id_tipo,creada_en);
CREATE TABLE IF NOT EXISTS evento_documento (
  id BIGSERIAL PRIMARY KEY, id_solicitud BIGINT NOT NULL REFERENCES solicitud_documento(id),
  id_usuario BIGINT NOT NULL REFERENCES usuario(id_usuario), estado VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL, fecha TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evento_documento_solicitud ON evento_documento(id_solicitud,id);
CREATE TABLE IF NOT EXISTS correo_documento (
  id BIGSERIAL PRIMARY KEY, id_solicitud BIGINT NOT NULL REFERENCES solicitud_documento(id), version INTEGER NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','ERROR','OMITIDO')),
  intentos INTEGER NOT NULL DEFAULT 0, proximo_intento TIMESTAMPTZ(6) NOT NULL DEFAULT now(), enviado_en TIMESTAMPTZ(6),
  UNIQUE(id_solicitud,version)
);
CREATE INDEX IF NOT EXISTS correo_documento_pendiente ON correo_documento(estado,proximo_intento);
ALTER TABLE tipo_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE permiso_usuario DROP CONSTRAINT IF EXISTS permiso_modulo_valido;
ALTER TABLE permiso_usuario ADD CONSTRAINT permiso_modulo_valido CHECK (modulo IN ('docentes','materias','aulas','horarios','comunicados','faq','fichas','documentos','reportes'));
INSERT INTO tipo_documento(nombre,descripcion,hojas,requisitos) VALUES
 ('Récord académico','Solicita tu récord académico para Beca Comedor u otros trámites.',1,'Presenta tu cédula de identidad o carnet universitario y tu código de recojo. Trae hojas blancas tamaño carta.'),
 ('Historial académico','Solicita tu historial académico y recoge el documento preparado en Kardex.',2,'Presenta tu cédula de identidad o carnet universitario y tu código de recojo. Trae hojas blancas tamaño carta.')
ON CONFLICT(nombre) DO NOTHING;
COMMIT;

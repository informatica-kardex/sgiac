BEGIN;
ALTER TABLE tipo_documento ADD COLUMN IF NOT EXISTS demora_recojo_minutos INTEGER NOT NULL DEFAULT 60 CHECK (demora_recojo_minutos BETWEEN 0 AND 1440);
ALTER TABLE correo_documento ADD COLUMN IF NOT EXISTS canal VARCHAR(10) NOT NULL DEFAULT 'CORREO' CHECK (canal IN ('CORREO','TELEGRAM'));
ALTER TABLE correo_documento DROP CONSTRAINT IF EXISTS correo_documento_id_solicitud_version_key;
CREATE UNIQUE INDEX IF NOT EXISTS correo_documento_solicitud_version_canal ON correo_documento(id_solicitud,version,canal);
CREATE TABLE IF NOT EXISTS vinculo_telegram (
  id_usuario BIGINT PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  chat_id BIGINT UNIQUE, token_hash VARCHAR(64) UNIQUE,
  expira_en TIMESTAMPTZ(6), vinculado_en TIMESTAMPTZ(6),
  CHECK (chat_id IS NULL OR chat_id > 0)
);
ALTER TABLE vinculo_telegram ENABLE ROW LEVEL SECURITY;
COMMIT;

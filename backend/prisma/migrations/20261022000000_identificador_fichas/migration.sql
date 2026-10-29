BEGIN;
ALTER TABLE jornada_atencion
  ADD COLUMN IF NOT EXISTS identificador VARCHAR(20)
    CHECK (identificador ~ '^[A-Z][A-Z0-9]{0,19}$');
-- Incluye el identificador automático de las jornadas anteriores para evitar
-- que una jornada nueva repita sus códigos el mismo día.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jornada_fecha_identificador
  ON jornada_atencion (fecha, (COALESCE(identificador, 'J' || id_jornada::text)));
COMMIT;

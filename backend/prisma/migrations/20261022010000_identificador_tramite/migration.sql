BEGIN;
ALTER TABLE tramite_atencion
  ADD COLUMN IF NOT EXISTS identificador VARCHAR(20)
    CHECK (identificador ~ '^[A-Z][A-Z0-9]{0,19}$');
-- Los trámites archivados no reservan el identificador para nuevas jornadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tramite_activo_identificador
  ON tramite_atencion (identificador) WHERE activo AND identificador IS NOT NULL;
COMMIT;

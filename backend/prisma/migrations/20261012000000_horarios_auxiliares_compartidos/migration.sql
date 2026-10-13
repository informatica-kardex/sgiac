BEGIN;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS es_auxiliar boolean NOT NULL DEFAULT false;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS sesion_compartida varchar(64);
UPDATE horario SET es_auxiliar = true WHERE id_auxiliar IS NOT NULL AND NOT es_auxiliar;
COMMIT;

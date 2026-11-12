BEGIN;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS id_horario_base BIGINT REFERENCES horario(id_horario) ON DELETE RESTRICT;
ALTER TABLE horario ADD COLUMN IF NOT EXISTS id_reserva_origen BIGINT REFERENCES horario(id_horario) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS horario_id_horario_base_fecha_key ON horario(id_horario_base, fecha);
CREATE INDEX IF NOT EXISTS horario_id_reserva_origen_idx ON horario(id_reserva_origen);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horario_traslado_completo' AND conrelid = 'horario'::regclass) THEN
    ALTER TABLE horario ADD CONSTRAINT horario_traslado_completo CHECK (
      (id_horario_base IS NULL AND id_reserva_origen IS NULL) OR
      (id_horario_base IS NOT NULL AND id_reserva_origen IS NOT NULL AND fecha IS NOT NULL
        AND es_auxiliar AND id_horario_base <> id_horario AND id_reserva_origen <> id_horario)
    );
  END IF;
END $$;
COMMIT;

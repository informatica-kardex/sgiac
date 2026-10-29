-- Los auxiliares anteriores se conservan hasta vincularlos explícitamente a un estudiante.
ALTER TABLE auxiliar ADD COLUMN IF NOT EXISTS id_estudiante BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS auxiliar_id_estudiante_key ON auxiliar(id_estudiante);
ALTER TABLE auxiliar DROP CONSTRAINT IF EXISTS auxiliar_id_estudiante_fkey;
ALTER TABLE auxiliar ADD CONSTRAINT auxiliar_id_estudiante_fkey
  FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE permiso_usuario DROP CONSTRAINT IF EXISTS permiso_modulo_valido;
ALTER TABLE permiso_usuario ADD CONSTRAINT permiso_modulo_valido
  CHECK (modulo IN ('docentes', 'auxiliares', 'materias', 'aulas', 'horarios', 'comunicados', 'faq', 'fichas', 'documentos', 'reportes'));

ALTER TABLE permiso_usuario DROP CONSTRAINT IF EXISTS permiso_modulo_valido;
ALTER TABLE permiso_usuario ADD CONSTRAINT permiso_modulo_valido CHECK (
  modulo IN ('docentes', 'auxiliares', 'materias', 'aulas', 'horarios', 'ver-horarios',
    'solicitudes-aulas', 'comunicados', 'faq', 'fichas', 'documentos', 'estudiantes', 'reportes', 'auditoria')
);

CREATE INDEX IF NOT EXISTS bitacora_fecha_id_idx ON bitacora (fecha_hora DESC, id_bitacora DESC);
CREATE INDEX IF NOT EXISTS bitacora_usuario_fecha_idx ON bitacora (id_usuario, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS bitacora_entidad_registro_idx ON bitacora (entidad_afectada, id_registro_afectado);
CREATE INDEX IF NOT EXISTS bitacora_accion_idx ON bitacora (accion);

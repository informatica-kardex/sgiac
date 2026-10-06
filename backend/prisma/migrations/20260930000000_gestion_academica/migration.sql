BEGIN;
ALTER TABLE docente ADD COLUMN IF NOT EXISTS correo VARCHAR(150), ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE ambiente ADD COLUMN IF NOT EXISTS lugar VARCHAR(40), ADD COLUMN IF NOT EXISTS piso SMALLINT;
ALTER TABLE ambiente ADD CONSTRAINT ambiente_lugar_valido CHECK (lugar IN ('ANTIGUO', 'PABELLONES', 'INFORMATICA'));
ALTER TABLE ambiente ADD CONSTRAINT ambiente_piso_valido CHECK (piso BETWEEN -2 AND 30);
CREATE TABLE materia_sigla (
  sigla VARCHAR(30) PRIMARY KEY,
  codigo_materia VARCHAR(30) NOT NULL REFERENCES materia(codigo_materia) ON DELETE CASCADE
);
CREATE INDEX materia_sigla_codigo_materia_idx ON materia_sigla(codigo_materia);
ALTER TABLE materia_sigla ENABLE ROW LEVEL SECURITY;
INSERT INTO materia_sigla(sigla, codigo_materia) SELECT codigo_materia, codigo_materia FROM materia;
ALTER TABLE permiso_usuario DROP CONSTRAINT permiso_modulo_valido;
ALTER TABLE permiso_usuario ADD CONSTRAINT permiso_modulo_valido CHECK (modulo IN ('docentes', 'materias', 'aulas', 'horarios', 'comunicados', 'faq', 'fichas', 'reportes'));
COMMIT;

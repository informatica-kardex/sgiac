BEGIN;
ALTER TABLE ambiente DROP CONSTRAINT ambiente_lugar_valido;
ALTER TABLE ambiente ADD CONSTRAINT ambiente_lugar_valido CHECK (lugar IN ('ANTIGUO', 'PABELLONES', 'LASIN', 'INFORMATICA'));
-- La identidad de una materia es codigo_materia. El PDF repite INF-244
-- en materias distintas; las menciones se incorporarán posteriormente.
ALTER TABLE materia_sigla DROP CONSTRAINT materia_sigla_pkey;
ALTER TABLE materia_sigla ADD PRIMARY KEY (codigo_materia, sigla);
CREATE INDEX materia_sigla_sigla_idx ON materia_sigla(sigla);
COMMIT;

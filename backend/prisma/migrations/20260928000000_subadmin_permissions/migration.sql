BEGIN;

CREATE TABLE "permiso_usuario" (
  "id_usuario" BIGINT NOT NULL REFERENCES "usuario"("id_usuario") ON DELETE CASCADE,
  "modulo" VARCHAR(40) NOT NULL,
  "desde" TIMESTAMPTZ(6),
  "hasta" TIMESTAMPTZ(6),
  PRIMARY KEY ("id_usuario", "modulo"),
  CONSTRAINT "permiso_modulo_valido" CHECK ("modulo" IN ('aulas', 'horarios', 'comunicados', 'faq', 'fichas', 'reportes')),
  CONSTRAINT "permiso_intervalo_valido" CHECK (("desde" IS NULL AND "hasta" IS NULL) OR ("desde" IS NOT NULL AND "hasta" IS NOT NULL AND "hasta" > "desde"))
);

-- Acceso mediante el backend; sin políticas públicas de lectura o escritura.
ALTER TABLE "permiso_usuario" ENABLE ROW LEVEL SECURITY;

INSERT INTO "rol" ("nombre", "descripcion", "estado")
VALUES ('SUBADMINISTRADOR', 'Funciones asignadas individualmente por el administrador, con vigencia opcional', 'ACTIVO')
ON CONFLICT ("nombre") DO UPDATE SET "descripcion" = EXCLUDED."descripcion", "estado" = 'ACTIVO';

-- Conservar únicamente los accesos que estaban activos antes de la migración.
INSERT INTO "permiso_usuario" ("id_usuario", "modulo")
SELECT DISTINCT ur."id_usuario", m.modulo
FROM "usuario_rol" ur JOIN "rol" r ON r."id_rol" = ur."id_rol"
CROSS JOIN (VALUES ('aulas'), ('horarios'), ('comunicados'), ('faq'), ('fichas')) m(modulo)
WHERE upper(ur."estado") = 'ACTIVO' AND upper(r."estado") = 'ACTIVO'
  AND ((r."nombre" = 'SUBADMINISTRADOR_ACADEMICO' AND m.modulo IN ('aulas', 'horarios', 'comunicados', 'faq'))
    OR (r."nombre" = 'SUBADMINISTRADOR_ATENCION' AND m.modulo = 'fichas'));

INSERT INTO "usuario_rol" ("id_usuario", "id_rol", "estado")
SELECT ur."id_usuario", (SELECT "id_rol" FROM "rol" WHERE "nombre" = 'SUBADMINISTRADOR'),
  CASE WHEN bool_or(upper(ur."estado") = 'ACTIVO' AND upper(r."estado") = 'ACTIVO') THEN 'ACTIVO' ELSE 'INACTIVO' END
FROM "usuario_rol" ur JOIN "rol" r ON r."id_rol" = ur."id_rol"
WHERE r."nombre" IN ('SUBADMINISTRADOR_ACADEMICO', 'SUBADMINISTRADOR_ATENCION')
GROUP BY ur."id_usuario"
ON CONFLICT ("id_usuario", "id_rol") DO NOTHING;

DELETE FROM "usuario_rol" WHERE "id_rol" IN (SELECT "id_rol" FROM "rol" WHERE "nombre" IN ('SUBADMINISTRADOR_ACADEMICO', 'SUBADMINISTRADOR_ATENCION'));
UPDATE "rol" SET "estado" = 'INACTIVO' WHERE "nombre" IN ('SUBADMINISTRADOR_ACADEMICO', 'SUBADMINISTRADOR_ATENCION');

COMMIT;

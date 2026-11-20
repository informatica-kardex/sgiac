// Ejecutar desde backend: node scripts/migrate-auditoria-permisos.cjs --check | --apply
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const mode = process.argv[2];
const rollback = new Error('VALIDATION_ROLLBACK');
let summary;

(async () => {
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261113000000_auditoria_permisos/migration.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      const before = await tx.$queryRaw`SELECT id_usuario::text, modulo, desde, hasta FROM permiso_usuario ORDER BY id_usuario, modulo`;
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const after = await tx.$queryRaw`SELECT id_usuario::text, modulo, desde, hasta FROM permiso_usuario ORDER BY id_usuario, modulo`;
      assert.deepEqual(after, before, 'La migración no debe cambiar permisos existentes');
      const [constraint] = await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definicion FROM pg_constraint WHERE conname = 'permiso_modulo_valido' AND conrelid = 'permiso_usuario'::regclass`;
      for (const modulo of ['ver-horarios', 'solicitudes-aulas', 'estudiantes', 'auditoria']) assert.ok(constraint.definicion.includes(modulo));
      const indexes = await tx.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename = 'bitacora' AND indexname IN ('bitacora_fecha_id_idx', 'bitacora_usuario_fecha_idx', 'bitacora_entidad_registro_idx', 'bitacora_accion_idx')`;
      assert.equal(indexes.length, 4);
      summary = { permisosConservados: after.length, indicesAuditoria: indexes.length };
      if (mode === '--check') throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(JSON.stringify({ estado: mode === '--check' ? 'VALIDADA_Y_REVERTIDA' : 'APLICADA', ...summary }));
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(() => db.$disconnect());

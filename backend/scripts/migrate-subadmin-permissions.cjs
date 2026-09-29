// Ejecutar desde backend: node scripts/migrate-subadmin-permissions.cjs --check | --apply
require('dotenv').config();
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
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260928000000_subadmin_permissions/migration.sql'), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(s => s && !['BEGIN', 'COMMIT'].includes(s));
  try {
    await db.$transaction(async tx => {
      const before = await tx.$queryRaw`SELECT ur.id_usuario::text AS usuario, r.nombre, ur.estado, r.estado AS estado_rol FROM usuario_rol ur JOIN rol r USING (id_rol) ORDER BY ur.id_usuario, r.nombre`;
      const expected = new Set();
      const accounts = new Set();
      for (const row of before) {
        if (!['SUBADMINISTRADOR_ACADEMICO', 'SUBADMINISTRADOR_ATENCION'].includes(row.nombre)) continue;
        accounts.add(row.usuario);
        if (row.estado.toUpperCase() !== 'ACTIVO' || row.estado_rol.toUpperCase() !== 'ACTIVO') continue;
        for (const module of row.nombre === 'SUBADMINISTRADOR_ACADEMICO' ? ['aulas', 'horarios', 'comunicados', 'faq'] : ['fichas']) expected.add(`${row.usuario}:${module}`);
      }
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const after = await tx.$queryRaw`SELECT ur.id_usuario::text AS usuario, r.nombre, ur.estado, r.estado AS estado_rol FROM usuario_rol ur JOIN rol r USING (id_rol) ORDER BY ur.id_usuario, r.nombre`;
      const permissions = await tx.$queryRaw`SELECT id_usuario::text AS usuario, modulo, desde, hasta FROM permiso_usuario`;
      const stable = rows => rows.filter(r => ['ADMINISTRADOR', 'CONSULTA_INTERNA'].includes(r.nombre));
      assert.deepEqual(stable(after), stable(before), 'Cambió una asignación de administrador o estudiante');
      assert.equal(after.some(r => ['SUBADMINISTRADOR_ACADEMICO', 'SUBADMINISTRADOR_ATENCION'].includes(r.nombre)), false);
      assert.deepEqual(new Set(after.filter(r => r.nombre === 'SUBADMINISTRADOR').map(r => r.usuario)), accounts);
      assert.deepEqual(new Set(permissions.map(p => `${p.usuario}:${p.modulo}`)), expected);
      assert.ok(permissions.every(p => p.desde === null && p.hasta === null));
      summary = { cuentasConvertidas: accounts.size, funcionesConservadas: permissions.length };
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(JSON.stringify({ estado: mode === '--check' ? 'VALIDADA_Y_REVERTIDA' : 'APLICADA', ...summary }));
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; }).finally(() => db.$disconnect());

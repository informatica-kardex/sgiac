// Desde backend: node scripts/migrate-puestos-atencion.cjs --check | --apply
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const rollback = new Error('VALIDATION_ROLLBACK');
(async () => {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261110000000_puestos_atencion/migration.sql'), 'utf8');
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      for (const statement of sql.split(';').map(s => s.trim()).filter(s => s && !['BEGIN', 'COMMIT'].includes(s))) {
        await tx.$executeRawUnsafe(statement);
      }
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(mode === '--check' ? 'PUESTOS_VALIDADOS_Y_REVERTIDOS' : 'PUESTOS_ATENCION_APLICADOS');
})().catch(error => { console.error('No se pudo actualizar puestos de atención:', error.code || error.name); process.exitCode = 1; }).finally(() => db.$disconnect());

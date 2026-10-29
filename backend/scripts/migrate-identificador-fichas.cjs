// Desde backend: node scripts/migrate-identificador-fichas.cjs --check | --apply
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const rollback = new Error('VALIDATION_ROLLBACK');
(async () => {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  const migrations = ['20261022000000_identificador_fichas', '20261022010000_identificador_tramite'];
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      for (const migration of migrations) {
        const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
        for (const statement of sql.split(';').map(s => s.trim()).filter(s => s && !['BEGIN', 'COMMIT'].includes(s))) await tx.$executeRawUnsafe(statement);
      }
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (e) { if (e !== rollback) throw e; }
  console.log(mode === '--check' ? 'IDENTIFICADOR_VALIDADO_Y_REVERTIDO' : 'IDENTIFICADOR_FICHAS_APLICADO');
})().catch(e => { console.error('No se pudo migrar el identificador:', e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());

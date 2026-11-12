// Desde backend: node scripts/migrate-comunicado-tipografia.cjs --check | --apply
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const rollback = new Error('VALIDATION_ROLLBACK');
(async () => {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261109000000_comunicado_tipografia/migration.sql'), 'utf8');
      await tx.$executeRawUnsafe(sql);
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(mode === '--check' ? 'TIPOGRAFIA_VALIDADA_Y_REVERTIDA' : 'TIPOGRAFIA_APLICADA');
})().catch(error => { console.error('No se pudo migrar la tipografía:', error.code || error.name); process.exitCode = 1; }).finally(() => db.$disconnect());

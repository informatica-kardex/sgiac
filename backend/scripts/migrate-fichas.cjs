// Ejecutar desde backend: node scripts/migrate-fichas.cjs --check | --apply
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const rollback = new Error('VALIDATION_ROLLBACK');
(async () => {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260929000000_fichas_atencion/migration.sql'), 'utf8');
  try {
    await db.$transaction(async tx => {
      for (const statement of sql.split(';').map(s => s.trim()).filter(s => s && !['BEGIN', 'COMMIT'].includes(s))) await tx.$executeRawUnsafe(statement);
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (e) { if (e !== rollback) throw e; }
  console.log(mode === '--check' ? 'MIGRACION_VALIDADA_Y_REVERTIDA' : 'MIGRACION_FICHAS_APLICADA');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());

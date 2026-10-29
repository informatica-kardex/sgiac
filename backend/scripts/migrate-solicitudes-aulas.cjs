// node scripts/migrate-solicitudes-aulas.cjs --check | --apply
require('dotenv').config();
const fs = require('node:fs'), path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient(), rollback = new Error('VALIDATION_ROLLBACK');
(async () => {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) throw new Error('Usa --check o --apply');
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261028000000_solicitudes_aulas/migration.sql'), 'utf8');
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (e) { if (e !== rollback) throw e; }
  console.log(mode === '--check' ? 'SOLICITUDES_AULAS_VALIDADO_Y_REVERTIDO' : 'SOLICITUDES_AULAS_APLICADO');
})().catch(e => { console.error('No se pudo migrar solicitudes de aulas:', e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());

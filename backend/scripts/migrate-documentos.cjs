// node scripts/migrate-documentos.cjs --check | --apply
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
      for (const migration of ['20261022020000_solicitudes_documentos', '20261022030000_documentos_telegram', '20261023000000_documentos_identificador_hojas']) {
        const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
        for (const statement of sql.split(';').map(s => s.trim()).filter(s => s && !['BEGIN', 'COMMIT'].includes(s))) await tx.$executeRawUnsafe(statement);
      }
      if (mode === '--check') throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(mode === '--check' ? 'DOCUMENTOS_VALIDADO_Y_REVERTIDO' : 'DOCUMENTOS_APLICADO');
})().catch(e => { console.error('No se pudo migrar documentos:', e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());

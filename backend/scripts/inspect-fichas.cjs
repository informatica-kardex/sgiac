require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const constraints = await db.$queryRawUnsafe("SELECT conrelid::regclass::text AS tabla, conname, pg_get_constraintdef(oid) AS definicion FROM pg_constraint WHERE conrelid IN ('jornada_atencion'::regclass, 'ficha_atencion'::regclass, 'historial_ficha'::regclass) ORDER BY 1,2");
  console.log(JSON.stringify(constraints, null, 2));
  console.log(JSON.stringify({ jornadas: await db.jornada_atencion.count(), fichas: await db.ficha_atencion.count() }));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());

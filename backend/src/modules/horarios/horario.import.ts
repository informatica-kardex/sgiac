import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { codigoSchema, idSchema } from '../academico/academico.shared';
import { datosPlan } from '../academico/planes-estudio';
import { compartenFecha } from './horario.fechas';

const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const sessionSchema = z.object({
  dia: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']), aula: codigoSchema,
  horaInicio: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$/),
  horaFin: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$|^22:00$/),
}).strict().refine(s => minutes(s.horaFin) - minutes(s.horaInicio) === 120, 'Cada sesión docente debe durar exactamente dos horas.');
export const importScheduleSchema = z.object({
  idPeriodo: idSchema,
  grupos: z.array(z.object({
    key: z.string().min(1).max(50), pagina: z.number().int().min(1).max(100),
    materia: z.string().trim().min(3).max(150), siglas: z.array(codigoSchema).min(1).max(20),
    docente: z.string().trim().min(3).max(150).refine(s => !/^(?:SINDOCENTE|PORDESIGNAR|ACEFALIA|AUXILIAR|AUX$)/.test(normal(s)), 'Debe identificarse un docente titular.'),
    paralelo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/),
    sesiones: z.array(sessionSchema).length(2).refine(s => s[0].dia !== s[1].dia, 'Las dos sesiones deben ser en días distintos.'),
  }).strict()).min(1).max(500),
}).strict().refine(p => new Set(p.grupos.map(g => g.key)).size === p.grupos.length, 'Hay identificadores de grupo repetidos.');
const applySchema = z.object({ datos: importScheduleSchema, huella: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
type Input = z.infer<typeof importScheduleSchema>;
type Session = Input['grupos'][number]['sesiones'][number];
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/DEEP LERNING/g, 'DEEP LEARNING').replace(/[^A-Z0-9]/g, '');
const teacherName = (s: string) => s.replace(/^(?:LIC\.?|M\.?\s*SC\.?|PH\.?\s*D\.?|ING\.?|DR\.?|DRA\.?)\s+/i, '').trim();
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? String(v) : v)).digest('hex');
const hh = (date: Date) => date.toISOString().slice(11, 16);
const blockDate = (time: string) => new Date(`1970-01-01T${time}:00.000Z`);
const sameSession = (a: Session, b: Session) => a.dia === b.dia && a.horaInicio === b.horaInicio && a.horaFin === b.horaFin && a.aula === b.aula;
const overlaps = (a: Session, b: Session) => a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;

async function catalog(tx: Prisma.TransactionClient, idPeriodo: string) {
  const [periodo, materias, docentes, aulas, asignaciones, horarios] = await Promise.all([
    tx.periodo_academico.findUnique({ where: { id_periodo: BigInt(idPeriodo) } }),
    tx.materia.findMany({ include: { siglas: true } }), tx.docente.findMany(), tx.ambiente.findMany(),
    tx.paralelo.findMany({ where: { id_periodo: BigInt(idPeriodo) } }),
    tx.horario.findMany({ where: { estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } } },
      include: { bloque_horario: true, paralelo: { include: { periodo_academico: true } } } }),
  ]);
  return { periodo, materias, docentes, aulas, asignaciones, horarios };
}
type Catalog = Awaited<ReturnType<typeof catalog>>;
export function planScheduleImport(input: Input, data: Catalog) {
  const { periodo } = data;
  if (!periodo || periodo.estado !== 'ACTIVO') throw ApiError.conflict('Selecciona un periodo académico activo.');
  const rows = input.grupos.map(g => {
    const errores: string[] = [];
    const materias = data.materias.filter(m => normal(m.nombre) === normal(g.materia));
    if (materias.length > 1) errores.push('Hay materias con el mismo nombre. Revisa el catálogo antes de importar.');
    const materia = materias.length === 1 ? materias[0] : null;
    if (materia && materia.estado !== 'ACTIVO') errores.push('La materia está inactiva.');
    // Names distinguish reused codes (INF-244); never resolve a subject by code alone.
    const primary = input.grupos.filter(other => normal(other.materia) === normal(g.materia)).flatMap(other => other.siglas).sort()[0];
    const codigoMateria = materia?.codigo_materia ?? (data.materias.some(m => m.codigo_materia === primary)
      || input.grupos.some(other => other.siglas.includes(primary) && normal(other.materia) !== normal(g.materia))
      ? `MAT-${hash(normal(g.materia)).slice(0, 20).toUpperCase()}` : primary);
    const docentes = data.docentes.filter(d => normal(teacherName(d.nombre_completo)) === normal(teacherName(g.docente)));
    if (docentes.length > 1) errores.push('Hay docentes con el mismo nombre. Revisa el catálogo antes de importar.');
    const docente = docentes.length === 1 ? docentes[0] : null;
    if (docente && docente.estado !== 'ACTIVO') errores.push('El docente está inactivo.');
    const asignaciones = data.asignaciones.filter(a => a.codigo_materia === codigoMateria && a.nombre_paralelo === g.paralelo);
    if (asignaciones.length > 1) errores.push('El paralelo está duplicado en el catálogo.');
    const asignacion = asignaciones[0];
    if (asignacion && (asignacion.estado !== 'ACTIVO' || asignacion.id_docente !== docente?.id_docente)) errores.push('Este paralelo ya está asignado a otro docente o está inactivo.');
    const sesiones = g.sesiones.map(s => ({ ...s }));
    for (const s of sesiones) {
      const aula = data.aulas.find(a => a.codigo_ambiente === s.aula);
      if (!aula || aula.estado !== 'DISPONIBLE') errores.push(`Aula ${s.aula}: no está registrada o disponible.`);
    }
    const existentes = data.horarios.filter(h => h.id_paralelo === asignacion?.id_paralelo && !h.fecha && !h.es_auxiliar && !h.id_auxiliar);
    const sessionOf = (h: Catalog['horarios'][number]): Session => ({ dia: h.dia_semana as Session['dia'], aula: h.codigo_ambiente,
      horaInicio: hh(h.bloque_horario.hora_inicio), horaFin: hh(h.bloque_horario.hora_fin) });
    if (existentes.some(h => !sesiones.some(s => sameSession(s, sessionOf(h))))) errores.push('El paralelo tiene otros horarios docentes. Revisa sus sesiones antes de importar para mantener solo dos días.');
    const nuevas = sesiones.filter(s => !existentes.some(h => sameSession(s, sessionOf(h))));
    for (const s of nuevas) {
      const conflict = data.horarios.find(h => overlaps(s, sessionOf(h)) &&
        (h.codigo_ambiente === s.aula || h.id_paralelo === asignacion?.id_paralelo ||
          (!h.es_auxiliar && !h.id_auxiliar && h.paralelo.codigo_materia !== 'CPU' && h.paralelo.id_docente === docente?.id_docente)) &&
        compartenFecha({ fecha: null, inicio: periodo.fecha_inicio, fin: periodo.fecha_fin, dia: s.dia },
          { fecha: h.fecha, inicio: h.paralelo.periodo_academico.fecha_inicio, fin: h.paralelo.periodo_academico.fecha_fin, dia: h.dia_semana }));
      if (conflict) errores.push(`Cruce con horario existente: ${s.dia} ${s.horaInicio}–${s.horaFin}, aula ${conflict.codigo_ambiente}, paralelo ${conflict.paralelo.nombre_paralelo}.`);
    }
    return { ...g, sesiones, codigoMateria, idDocente: docente ? String(docente.id_docente) : null,
      idAsignacion: asignacion ? String(asignacion.id_paralelo) : null, nuevas, existentes: sesiones.length - nuevas.length,
      nuevaMateria: !materia, nuevoDocente: !docente, nuevaAsignacion: !asignacion,
      planes: datosPlan(materia?.nombre ?? g.materia).planes, errores, estado: 'LISTO' as 'LISTO' | 'EXISTENTE' | 'REVISAR' };
  });
  // Mark both sides of a collision: document ordering must not decide who wins.
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    const sameGroup = a.codigoMateria === b.codigoMateria && a.paralelo === b.paralelo;
    const sameTeacher = a.idDocente && b.idDocente ? a.idDocente === b.idDocente : normal(teacherName(a.docente)) === normal(teacherName(b.docente));
    if (sameGroup || a.sesiones.some(sa => b.sesiones.some(sb => overlaps(sa, sb) && (sameTeacher || sa.aula === sb.aula)))) {
      a.errores.push(`Conflicto dentro del PDF con ${b.siglas.join('/')} ${b.paralelo}, ${b.docente}.`);
      b.errores.push(`Conflicto dentro del PDF con ${a.siglas.join('/')} ${a.paralelo}, ${a.docente}.`);
    }
  }
  for (const row of rows) { row.errores = [...new Set(row.errores)]; row.estado = row.errores.length ? 'REVISAR' : row.nuevas.length ? 'LISTO' : 'EXISTENTE'; }
  const listas = rows.filter(r => r.estado === 'LISTO');
  const resumen = { grupos: listas.length, sesiones: listas.reduce((n, r) => n + r.nuevas.length, 0),
    existentes: rows.filter(r => r.estado === 'EXISTENTE').length, pendientes: rows.filter(r => r.estado === 'REVISAR').length,
    materias: new Set(listas.filter(r => r.nuevaMateria).map(r => r.codigoMateria)).size,
    docentes: new Set(listas.filter(r => r.nuevoDocente).map(r => normal(teacherName(r.docente)))).size,
    asignaciones: listas.filter(r => r.nuevaAsignacion).length };
  return { grupos: rows, resumen, huella: hash({ input, periodo, rows }) };
}

export const horarioImport = {
  async preview(body: unknown) {
    const input = importScheduleSchema.parse(body);
    return prisma.$transaction(async tx => planScheduleImport(input, await catalog(tx, input.idPeriodo)),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  },
  async apply(body: unknown) {
    const { datos: input, huella } = applySchema.parse(body);
    return prisma.$transaction(async tx => {
      // Same lock as manual scheduling; concurrent imports recheck after acquiring it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
      const data = await catalog(tx, input.idPeriodo), plan = planScheduleImport(input, data);
      if (plan.huella !== huella) throw ApiError.conflict('Los datos cambiaron desde la revisión. Vuelve a validar el PDF antes de guardar. No se guardó ningún cambio.');
      const ready = plan.grupos.filter(r => r.estado === 'LISTO');
      if (!ready.length) throw ApiError.conflict('No hay sesiones nuevas listas para importar.');
      const materiaIds = new Set(data.materias.map(m => m.codigo_materia));
      const siglas = new Set(data.materias.flatMap(m => m.siglas.map(s => `${m.codigo_materia}|${s.sigla}`)));
      const docenteIds = new Map(data.docentes.map(d => [normal(teacherName(d.nombre_completo)), d.id_docente]));
      const bloques = await tx.bloque_horario.findMany();
      let nextBlock = Math.max(0, ...bloques.map(b => b.id_bloque));
      const nuevos: Prisma.horarioCreateManyInput[] = [];
      for (const row of ready) {
        if (!materiaIds.has(row.codigoMateria)) {
          await tx.materia.create({ data: { codigo_materia: row.codigoMateria, nombre: row.materia } });
          materiaIds.add(row.codigoMateria);
        }
        const missing = row.siglas.filter(s => !siglas.has(`${row.codigoMateria}|${s}`));
        if (missing.length) {
          await tx.materia_sigla.createMany({ data: [...new Set(missing)].map(sigla => ({ codigo_materia: row.codigoMateria, sigla })) });
          missing.forEach(s => siglas.add(`${row.codigoMateria}|${s}`));
        }
        const teacherKey = normal(teacherName(row.docente));
        let idDocente = docenteIds.get(teacherKey);
        if (!idDocente) {
          const nombre = teacherName(row.docente), grado = row.docente.slice(0, row.docente.length - nombre.length).trim();
          idDocente = (await tx.docente.create({ data: { nombre_completo: nombre, grado_academico: grado || null } })).id_docente;
          docenteIds.set(teacherKey, idDocente);
        }
        const idAsignacion = row.idAsignacion ? BigInt(row.idAsignacion) : (await tx.paralelo.create({ data: {
          codigo_materia: row.codigoMateria, nombre_paralelo: row.paralelo, id_docente: idDocente, id_periodo: BigInt(input.idPeriodo),
        } })).id_paralelo;
        for (const s of row.nuevas) {
          let bloque = bloques.find(b => hh(b.hora_inicio) === s.horaInicio && hh(b.hora_fin) === s.horaFin);
          if (!bloque) {
            bloque = await tx.bloque_horario.create({ data: { id_bloque: ++nextBlock, hora_inicio: blockDate(s.horaInicio), hora_fin: blockDate(s.horaFin) } });
            bloques.push(bloque);
          }
          nuevos.push({ id_paralelo: idAsignacion, codigo_ambiente: s.aula, dia_semana: s.dia, id_bloque: bloque.id_bloque,
            estado: 'ASIGNADO', publicado: true, fecha: null, id_auxiliar: null, es_auxiliar: false });
        }
      }
      await tx.horario.createMany({ data: nuevos });
      return plan.resumen;
    }, { timeout: 60000, maxWait: 15000 });
  },
};

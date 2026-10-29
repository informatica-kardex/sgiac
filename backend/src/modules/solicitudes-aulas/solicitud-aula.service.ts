import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction, idSchema } from '../academico/academico.shared';
import { mapAsignacion } from '../academico/academico.service';
import { ahoraBolivia } from '../fichas/ficha.shared';
import { compartenFecha } from '../horarios/horario.fechas';
import { HorarioRepository } from '../horarios/horario.repository';
import { AgendaAula, ReservaAula, agendaSchema, disponibilidadSchema, reservaSchema, responderAulaSchema, revisarAulaSchema, solicitarAulaSchema, versionSchema } from './solicitud-aula.validation';

const LUGARES = ['INFORMATICA', 'LASIN'];
const asignacionInclude = { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } as const;
const auxiliarInclude = { estudiante: { include: { usuario: { select: { estado: true, correo: true } } } } } as const;
const solicitudInclude = { paralelo: { include: asignacionInclude } } as const;
type Solicitud = Prisma.SolicitudAulaGetPayload<{ include: typeof solicitudInclude }>;
type Auxiliar = Prisma.auxiliarGetPayload<{ include: typeof auxiliarInclude }>;
type Asignacion = Prisma.paraleloGetPayload<{ include: typeof asignacionInclude }>;
type Evento = { fecha: string; autor: string; accion: string; comentario: string; reserva?: ReservaAula };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const hora = (d: Date) => d.toISOString().slice(11, 16);
const eventos = (s: Solicitud): Evento[] => s.historial as unknown as Evento[];
const editable = (s: Solicitud) => ['PENDIENTE', 'PROPUESTA'].includes(s.estado);
function asignacionDTO(p: Asignacion) { return { ...mapAsignacion(p), desde: iso(p.periodo_academico.fecha_inicio), hasta: iso(p.periodo_academico.fecha_fin) }; }
function dto(s: Solicitud) {
  return { id: String(s.id), codigo: `AUL-${String(s.id).padStart(6, '0')}`, estado: s.estado, version: s.version,
    nombre: s.nombre, ci: s.ci, ru: s.ru, correo: s.correo, celular: s.celular,
    numeroEstudiantes: s.numeroEstudiantes, actividad: s.actividad, detalle: s.detalle,
    reserva: s.reserva, propuesta: s.propuesta, asignacion: asignacionDTO(s.paralelo),
    creadaEn: s.creadaEn.toISOString(), actualizadaEn: s.actualizadaEn.toISOString(), historial: eventos(s) };
}
function cuentaDisponible(a: Auxiliar | null): a is Auxiliar {
  const e = a?.estudiante;
  return Boolean(a?.estado === 'ACTIVO' && e?.usuario?.estado === 'ACTIVO' &&
    /@(umsa\.bo|fcpn\.edu\.bo)$/i.test(e.usuario.correo) && e.usuario.correo.toLowerCase() === e.correo_institucional.toLowerCase());
}
async function auxiliarDeUsuario(tx: Prisma.TransactionClient, idUsuario: string) {
  const a = await tx.auxiliar.findFirst({ where: { estudiante: { id_usuario: BigInt(idUsuario) } }, include: auxiliarInclude });
  if (!cuentaDisponible(a)) throw ApiError.forbidden('Esta función requiere una cuenta institucional habilitada como auxiliar.');
  return a;
}
async function contexto(tx: Prisma.TransactionClient, idAuxiliar: bigint, idAsignacion: bigint) {
  const a = await tx.auxiliar.findUnique({ where: { id_auxiliar: idAuxiliar }, include: auxiliarInclude });
  if (!cuentaDisponible(a)) throw ApiError.conflict('La cuenta del auxiliar ya no está habilitada.');
  const p = await tx.paralelo.findUnique({ where: { id_paralelo: idAsignacion }, include: asignacionInclude });
  if (!p || [p.estado, p.materia.estado, p.docente.estado, p.periodo_academico.estado].some(e => e !== 'ACTIVO')) throw ApiError.conflict('La materia, el docente, el paralelo y el periodo deben estar activos.');
  if (!await tx.auxiliar_asignacion.findUnique({ where: { id_auxiliar_id_paralelo: { id_auxiliar: idAuxiliar, id_paralelo: idAsignacion } } })) throw ApiError.forbidden('El auxiliar no está vinculado a esta materia y paralelo.');
  return { a, p };
}
function validarFechas(agenda: AgendaAula, p: Asignacion) {
  const ahora = ahoraBolivia();
  const inicio = iso(p.periodo_academico.fecha_inicio), fin = iso(p.periodo_academico.fecha_fin);
  if (fin < ahora.fecha) throw ApiError.conflict('El semestre ya terminó. Selecciona una asignación de un periodo vigente.');
  for (const s of agenda.sesiones) {
    if (s.fecha) {
      if (s.fecha < inicio || s.fecha > fin) throw ApiError.badRequest('La fecha debe estar dentro del periodo académico.');
      if (s.fecha < ahora.fecha || s.fecha === ahora.fecha && s.horaInicio <= ahora.hora.slice(0, 5)) throw ApiError.conflict('El horario solicitado ya pasó. Elige una fecha y hora futuras.');
    } else {
      const desde = new Date(`${inicio > ahora.fecha ? inicio : ahora.fecha}T00:00:00Z`);
      const objetivo = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].indexOf(s.dia);
      let dias = (objetivo - desde.getUTCDay() + 7) % 7;
      if (!dias && iso(desde) === ahora.fecha && s.horaInicio <= ahora.hora.slice(0, 5)) dias = 7;
      desde.setUTCDate(desde.getUTCDate() + dias);
      if (iso(desde) > fin) throw ApiError.conflict('No quedan fechas para ese día y horario en el semestre.');
    }
  }
}

async function disponibilidad(tx: Prisma.TransactionClient, a: Auxiliar, p: Asignacion, numeroEstudiantes: number, agenda: AgendaAula, actividad: string) {
  validarFechas(agenda, p);
  // Las solicitudes antiguas con otras actividades conservan sus tipos de ambiente permitidos.
  const tipos = actividad === 'PRACTICA_LABORATORIO' ? ['LABORATORIO'] : actividad === 'CLASE_TEORICA' ? ['AULA'] : ['AULA', 'LABORATORIO'];
  const aulas = await tx.ambiente.findMany({ where: { lugar: { in: LUGARES }, tipo: { in: tipos } }, orderBy: [{ lugar: 'asc' }, { piso: 'asc' }, { codigo_ambiente: 'asc' }] });
  const horarios = await tx.horario.findMany({ where: {
    estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } },
    AND: [
      { OR: [{ codigo_ambiente: { in: aulas.map(aula => aula.codigo_ambiente) } }, { id_auxiliar: a.id_auxiliar }, { id_paralelo: p.id_paralelo }] },
      { OR: agenda.sesiones.map(s => ({ dia_semana: s.dia, bloque_horario: { hora_inicio: { lt: new Date(`1970-01-01T${s.horaFin}:00Z`) }, hora_fin: { gt: new Date(`1970-01-01T${s.horaInicio}:00Z`) } } })) },
    ],
  }, include: { bloque_horario: true, paralelo: { include: { periodo_academico: true } } } });
  return aulas.map(aula => {
    let motivo = aula.estado !== 'DISPONIBLE' ? 'Aula no habilitada para reservas.' :
      aula.capacidad > 0 && aula.capacidad < numeroEstudiantes ? `Capacidad insuficiente: ${aula.capacidad} estudiantes.` : '';
    if (!motivo) {
      for (const s of agenda.sesiones) {
        const h = horarios.find(h => (h.codigo_ambiente === aula.codigo_ambiente || h.id_auxiliar === a.id_auxiliar || h.id_paralelo === p.id_paralelo) &&
          s.horaInicio < hora(h.bloque_horario.hora_fin) && s.horaFin > hora(h.bloque_horario.hora_inicio) && compartenFecha(
            { fecha: s.fecha ? new Date(`${s.fecha}T00:00:00Z`) : null, inicio: p.periodo_academico.fecha_inicio, fin: p.periodo_academico.fecha_fin, dia: s.dia },
            { fecha: h.fecha, inicio: h.paralelo.periodo_academico.fecha_inicio, fin: h.paralelo.periodo_academico.fecha_fin, dia: h.dia_semana }));
        if (h) {
          motivo = `${h.codigo_ambiente === aula.codigo_ambiente ? 'Ocupada' : h.id_auxiliar === a.id_auxiliar ? 'El auxiliar tiene otra clase' : 'El paralelo tiene otra clase'}: ${s.dia}${h.fecha ? ` ${iso(h.fecha)}` : ''}, ${hora(h.bloque_horario.hora_inicio)}–${hora(h.bloque_horario.hora_fin)}.`;
          break;
        }
      }
    }
    return { codigo: aula.codigo_ambiente, nombre: aula.nombre, lugar: aula.lugar, piso: aula.piso, tipo: aula.tipo, capacidad: aula.capacidad, disponible: !motivo, motivo };
  });
}
async function validarReserva(tx: Prisma.TransactionClient, s: { idAuxiliar: bigint; idParalelo: bigint; numeroEstudiantes: number; actividad: string }, reserva: ReservaAula) {
  const { a, p } = await contexto(tx, s.idAuxiliar, s.idParalelo);
  const aulas = await disponibilidad(tx, a, p, s.numeroEstudiantes, reserva.agenda, s.actividad);
  const aula = aulas.find(aula => aula.codigo === reserva.aula);
  if (!aula) throw ApiError.badRequest('Selecciona un ambiente de Informática o LASIN que corresponda a la actividad: aula para clase teórica o laboratorio para práctica.');
  if (!aula.disponible) throw ApiError.conflict(`${aula.motivo} Solicita un aula libre o cambia el horario.`);
}
async function cargar(tx: Prisma.TransactionClient, id: string, version: number, propietario?: string) {
  const s = await tx.solicitudAula.findUnique({ where: { id: BigInt(idSchema.parse(id)) }, include: solicitudInclude });
  if (!s || propietario && s.idSolicitante !== BigInt(propietario)) throw ApiError.notFound('Solicitud no encontrada');
  if (s.version !== version) throw ApiError.conflict('La solicitud cambió. Actualiza la lista antes de continuar.');
  return s;
}
async function cambiar(tx: Prisma.TransactionClient, s: Solicitud, actor: string, estado: string, accion: string, comentario: string, propuesta?: ReservaAula | null) {
  const evento: Evento = { fecha: new Date().toISOString(), autor: actor === String(s.idSolicitante) ? 'Auxiliar' : 'Kardex', accion, comentario, ...(propuesta ? { reserva: propuesta } : {}) };
  const actual = await tx.solicitudAula.update({ where: { id: s.id }, data: { estado, version: { increment: 1 }, historial: [...eventos(s), evento] as unknown as Prisma.InputJsonValue,
    ...(propuesta === undefined ? {} : { propuesta: propuesta === null ? Prisma.DbNull : propuesta as unknown as Prisma.InputJsonValue }) }, include: solicitudInclude });
  await tx.bitacora.create({ data: { accion: `AULA_${accion}`, entidadAfectada: 'solicitud_aula', idRegistroAfectado: String(s.id), idUsuario: BigInt(actor), detalle: comentario } });
  return dto(actual);
}
async function reservar(tx: Prisma.TransactionClient, s: Solicitud, reserva: ReservaAula) {
  await validarReserva(tx, s, reserva);
  const repository = new HorarioRepository();
  for (const sesion of reserva.agenda.sesiones) {
    const h = await repository.createInTransaction(tx, { ...sesion, aula: reserva.aula, idAsignacion: String(s.idParalelo), idAuxiliar: String(s.idAuxiliar), esAuxiliar: true, motivo: `Solicitud AUL-${s.id}: ${s.actividad}` });
    await tx.horario.update({ where: { id_horario: BigInt(h.idHorario) }, data: { id_solicitud_aula: s.id } });
  }
}
const agendaIgual = (a: AgendaAula, b: AgendaAula) => a.alcance === b.alcance && JSON.stringify([...a.sesiones].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))) === JSON.stringify([...b.sesiones].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));

export const solicitudAulaService = {
  async perfil(idUsuario: string) {
    const a = await prisma.auxiliar.findFirst({ where: { estudiante: { id_usuario: BigInt(idUsuario) } }, include: auxiliarInclude });
    if (!cuentaDisponible(a)) return { habilitado: false, datos: null, asignaciones: [] };
    const asignaciones = await prisma.paralelo.findMany({ where: { auxiliares: { some: { id_auxiliar: a.id_auxiliar } }, estado: 'ACTIVO', docente: { estado: 'ACTIVO' }, materia: { estado: 'ACTIVO' }, periodo_academico: { estado: 'ACTIVO', fecha_fin: { gte: new Date(`${ahoraBolivia().fecha}T00:00:00Z`) } } }, include: asignacionInclude });
    const e = a.estudiante!;
    return { habilitado: true, datos: { nombre: `${e.nombres} ${e.apellidos}`, ci: e.ci, ru: e.ru, correo: e.correo_institucional, celular: a.telefono ?? '' }, asignaciones: asignaciones.map(asignacionDTO) };
  },
  async listar(propietario?: string) {
    return (await prisma.solicitudAula.findMany({ where: propietario ? { idSolicitante: BigInt(propietario) } : {}, orderBy: { id: 'desc' }, include: solicitudInclude })).map(dto);
  },
  async disponibles(idUsuario: string, body: unknown) {
    const p = disponibilidadSchema.parse(body);
    const a = await auxiliarDeUsuario(prisma, idUsuario);
    const c = await contexto(prisma, a.id_auxiliar, BigInt(p.idAsignacion));
    return disponibilidad(prisma, c.a, c.p, p.numeroEstudiantes, p.agenda, p.actividad);
  },
  async disponiblesAdmin(id: string, body: unknown) {
    const agenda = agendaSchema.parse(body);
    const s = await prisma.solicitudAula.findUnique({ where: { id: BigInt(idSchema.parse(id)) } });
    if (!s) throw ApiError.notFound('Solicitud no encontrada');
    const c = await contexto(prisma, s.idAuxiliar, s.idParalelo);
    return disponibilidad(prisma, c.a, c.p, s.numeroEstudiantes, agenda, s.actividad);
  },
  async crear(idUsuario: string, body: unknown) {
    const p = solicitarAulaSchema.parse(body);
    return academicTransaction(async tx => {
      const a = await auxiliarDeUsuario(tx, idUsuario);
      const base = { idAuxiliar: a.id_auxiliar, idParalelo: BigInt(p.idAsignacion), numeroEstudiantes: p.numeroEstudiantes, actividad: p.actividad };
      await validarReserva(tx, base, p.reserva);
      const pendientes = await tx.solicitudAula.findMany({ where: { idAuxiliar: a.id_auxiliar, idParalelo: base.idParalelo, estado: { in: ['PENDIENTE', 'PROPUESTA'] } } });
      if (pendientes.some(s => agendaIgual(reservaSchema.parse(s.reserva).agenda, p.reserva.agenda))) throw ApiError.conflict('Ya tienes una solicitud pendiente para este horario. Revísala en Mis solicitudes.');
      const e = a.estudiante!;
      const s = await tx.solicitudAula.create({ data: { ...base, idSolicitante: BigInt(idUsuario), nombre: `${e.nombres} ${e.apellidos}`, ci: e.ci, ru: e.ru, correo: e.correo_institucional,
        celular: p.celular, actividad: p.actividad, detalle: p.detalle, reserva: p.reserva as unknown as Prisma.InputJsonValue,
        historial: [{ fecha: new Date().toISOString(), autor: 'Auxiliar', accion: 'SOLICITADA', comentario: 'Solicitud enviada a Kardex.' }] }, include: solicitudInclude });
      await tx.auxiliar.update({ where: { id_auxiliar: a.id_auxiliar }, data: { telefono: p.celular } });
      return dto(s);
    });
  },
  async revisar(actor: string, id: string, body: unknown) {
    const p = revisarAulaSchema.parse(body);
    return academicTransaction(async tx => {
      const s = await cargar(tx, id, p.version);
      if (p.accion === 'CANCELAR') {
        if (s.estado !== 'APROBADA') throw ApiError.conflict('Solo puedes cancelar una reserva aprobada desde esta opción.');
        await tx.horario.deleteMany({ where: { id_solicitud_aula: s.id } });
        return cambiar(tx, s, actor, 'CANCELADA', 'CANCELADA', p.comentario);
      }
      if (!editable(s)) throw ApiError.conflict('Esta solicitud ya fue resuelta.');
      if (p.accion === 'RECHAZAR') return cambiar(tx, s, actor, 'RECHAZADA', 'RECHAZADA', p.comentario);
      if (p.accion === 'PROPONER') {
        await validarReserva(tx, s, p.propuesta!);
        return cambiar(tx, s, actor, 'PROPUESTA', 'ALTERNATIVA_PROPUESTA', p.comentario, p.propuesta!);
      }
      if (s.estado !== 'PENDIENTE') throw ApiError.conflict('La propuesta alternativa requiere la aceptación del auxiliar.');
      await reservar(tx, s, reservaSchema.parse(s.reserva));
      return cambiar(tx, s, actor, 'APROBADA', 'APROBADA', p.comentario || 'Kardex aceptó la solicitud y reservó el aula.', null);
    });
  },
  async responder(idUsuario: string, id: string, body: unknown) {
    const p = responderAulaSchema.parse(body);
    return academicTransaction(async tx => {
      const s = await cargar(tx, id, p.version, idUsuario);
      if (s.estado !== 'PROPUESTA' || !s.propuesta) throw ApiError.conflict('No hay una propuesta pendiente de respuesta.');
      if (!p.aceptar) return cambiar(tx, s, idUsuario, 'PENDIENTE', 'ALTERNATIVA_DECLINADA', p.comentario || 'El auxiliar solicitó otra opción.', null);
      await reservar(tx, s, reservaSchema.parse(s.propuesta));
      return cambiar(tx, s, idUsuario, 'APROBADA', 'ALTERNATIVA_ACEPTADA', 'El auxiliar aceptó la alternativa. Aula reservada.');
    });
  },
  async cancelar(idUsuario: string, id: string, body: unknown) {
    const p = versionSchema.parse(body);
    return academicTransaction(async tx => {
      const s = await cargar(tx, id, p.version, idUsuario);
      if (!editable(s)) throw ApiError.conflict('Solo puedes cancelar solicitudes pendientes. Para una reserva aprobada contacta a Kardex.');
      return cambiar(tx, s, idUsuario, 'CANCELADA', 'CANCELADA', 'Cancelada por el auxiliar.');
    });
  },
};

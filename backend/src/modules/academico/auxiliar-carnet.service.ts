import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { idSchema } from './academico.shared';

const identidad = {
  id_auxiliar: true, id_estudiante: true, estado: true,
  estudiante: { select: {
    nombres: true, apellidos: true, ru: true, correo_institucional: true,
    usuario: { select: { estado: true } },
  } },
} satisfies Prisma.auxiliarSelect;
type Identidad = Prisma.auxiliarGetPayload<{ select: typeof identidad }>;
const noDisponible = () => ApiError.notFound('Este carnet no está disponible. Consulta con Kardex.');

function habilitado(a: Identidad | null): a is Identidad & { estudiante: NonNullable<Identidad['estudiante']> } {
  return Boolean(a?.estado === 'ACTIVO' && a.estudiante?.usuario?.estado === 'ACTIVO');
}

// Referencia de consulta, no un token de sesión. Estable al editar los horarios;
// la firma también vincula la identidad del estudiante sin incluirla en el QR.
function firma(a: Identidad) {
  return createHmac('sha256', env.auxiliarCarnetSecret)
    .update(`sgiac:auxiliar-carnet:v1:${a.id_auxiliar}:${a.id_estudiante}`).digest('base64url');
}

export const auxiliarCarnetService = {
  async emitirParaUsuario(idUsuario: string) {
    // La identidad proviene exclusivamente de la sesión, nunca del id del cliente.
    const a = await prisma.auxiliar.findFirst({
      where: { estudiante: { id_usuario: BigInt(idSchema.parse(idUsuario)) } },
      select: { ...identidad, estudiante: { select: { ...identidad.estudiante.select, usuario: { select: { estado: true, correo: true } } } } },
    });
    const correo = a?.estudiante?.usuario?.correo;
    if (!habilitado(a) || !correo || !/@(umsa\.bo|fcpn\.edu\.bo)$/i.test(correo) ||
        correo.toLowerCase() !== a.estudiante.correo_institucional.toLowerCase()) {
      throw ApiError.forbidden('Tu cuenta no está habilitada como auxiliar. Consulta con Kardex.');
    }
    return this.emitir(String(a.id_auxiliar));
  },

  async emitir(id: string) {
    const a = await prisma.auxiliar.findUnique({ where: { id_auxiliar: BigInt(idSchema.parse(id)) }, select: identidad });
    if (!habilitado(a)) throw noDisponible();
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const asignaciones = await prisma.paralelo.findMany({
      where: { auxiliares: { some: { id_auxiliar: a.id_auxiliar } }, estado: 'ACTIVO',
        materia: { estado: 'ACTIVO' }, docente: { estado: 'ACTIVO' },
        periodo_academico: { estado: 'ACTIVO', fecha_fin: { gte: new Date(`${hoy}T00:00:00Z`) } } },
      select: { codigo_materia: true, materia: { select: { nombre: true } } },
      orderBy: { materia: { nombre: 'asc' } },
    });
    const materias = [...new Map(asignaciones.map(p => [p.codigo_materia, p.materia.nombre])).values()];
    return {
      idAuxiliar: String(a.id_auxiliar), nombreCompleto: `${a.estudiante.nombres} ${a.estudiante.apellidos}`,
      ru: a.estudiante.ru, correo: a.estudiante.correo_institucional, materias,
      token: `${a.id_auxiliar}.${firma(a)}`,
    };
  },

  async consultar(token: string, ahora = new Date()) {
    const partes = /^([1-9]\d{0,17})\.([A-Za-z0-9_-]{43})$/.exec(token);
    if (!partes) throw noDisponible();
    const a = await prisma.auxiliar.findUnique({ where: { id_auxiliar: BigInt(partes[1]) }, select: identidad });
    if (!habilitado(a) || !timingSafeEqual(Buffer.from(partes[2]), Buffer.from(firma(a)))) throw noDisponible();

    // Fechas académicas en Bolivia, independientemente de la zona del servidor.
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
    const desde = new Date(`${hoy}T00:00:00Z`);
    const filas = await prisma.horario.findMany({
      where: {
        id_auxiliar: a.id_auxiliar, estado: 'ASIGNADO', publicado: true,
        OR: [{ fecha: null }, { fecha: { gte: desde } }],
        paralelo: { estado: 'ACTIVO', materia: { estado: 'ACTIVO' }, docente: { estado: 'ACTIVO' },
          periodo_academico: { estado: 'ACTIVO', fecha_fin: { gte: desde } },
          auxiliares: { some: { id_auxiliar: a.id_auxiliar } },
        },
      },
      select: {
        id_horario: true, id_paralelo: true, dia_semana: true, fecha: true, codigo_ambiente: true,
        horario_base: { select: { codigo_ambiente: true } },
        traslados: { where: { estado: 'ASIGNADO', fecha: { gte: desde } }, select: { fecha: true, codigo_ambiente: true } },
        reserva_origen: { select: { paralelo: { select: { docente: { select: { nombre_completo: true } } } } } },
        bloque_horario: { select: { hora_inicio: true, hora_fin: true } },
        ambiente: { select: { lugar: true, piso: true } },
        paralelo: { select: { nombre_paralelo: true, materia: { select: { nombre: true } },
          periodo_academico: { select: { periodo: true, gestion: true, fecha_inicio: true, fecha_fin: true } },
        } },
      },
    });
    const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const horarios = filas.map(h => ({
      id: String(h.id_horario), idAsignacion: String(h.id_paralelo), aula: h.codigo_ambiente, dia: h.dia_semana,
      fecha: h.fecha?.toISOString().slice(0, 10) ?? null,
      aulaOriginal: h.horario_base?.codigo_ambiente ?? null,
      docenteReserva: h.reserva_origen?.paralelo.docente.nombre_completo ?? null,
      traslados: (h.traslados ?? []).map(t => ({ fecha: t.fecha!.toISOString().slice(0, 10), aula: t.codigo_ambiente })),
      horaInicio: h.bloque_horario.hora_inicio.toISOString().slice(11, 16),
      horaFin: h.bloque_horario.hora_fin.toISOString().slice(11, 16),
      lugar: h.ambiente.lugar, piso: h.ambiente.piso,
      materia: h.paralelo.materia.nombre, grupo: h.paralelo.nombre_paralelo,
      periodo: `${h.paralelo.periodo_academico.periodo}/${h.paralelo.periodo_academico.gestion}`,
      desde: h.paralelo.periodo_academico.fecha_inicio.toISOString().slice(0, 10),
      hasta: h.paralelo.periodo_academico.fecha_fin.toISOString().slice(0, 10),
    })).sort((x, y) => (x.fecha ?? '').localeCompare(y.fecha ?? '') || dias.indexOf(x.dia) - dias.indexOf(y.dia) || x.horaInicio.localeCompare(y.horaInicio) || x.aula.localeCompare(y.aula));
    // Lista explícita: nunca serializar la identidad privada o el registro completo.
    return { nombreCompleto: `${a.estudiante.nombres} ${a.estudiante.apellidos}`, horarios, consultadoEn: ahora.toISOString() };
  },
};

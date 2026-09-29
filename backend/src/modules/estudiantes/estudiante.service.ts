import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";

// Fechas de atención en Bolivia, independientes de la zona horaria del servidor.
export function ahoraBolivia(now = new Date()) {
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 19) };
}

type Jornada = Prisma.jornada_atencionGetPayload<{}>;
type Ficha = Prisma.ficha_atencionGetPayload<{ include: { jornada_atencion: true } }>;

function jornadaVigente(jornada: Jornada) {
  const ahora = ahoraBolivia();
  const fecha = jornada.fecha.toISOString().slice(0, 10);
  return jornada.estado === "ACTIVO" && (fecha > ahora.fecha ||
    (fecha === ahora.fecha && jornada.hora_fin.toISOString().slice(11, 19) > ahora.hora));
}

function jornadaDTO(jornada: Jornada, ocupadas: number) {
  return {
    idJornada: jornada.id_jornada.toString(),
    fecha: jornada.fecha.toISOString().slice(0, 10),
    horaInicio: jornada.hora_inicio.toISOString().slice(11, 16),
    horaFin: jornada.hora_fin.toISOString().slice(11, 16),
    disponibles: Math.max(0, jornada.cupo_total - ocupadas),
  };
}

function fichaDTO(ficha: Ficha) {
  return {
    idFicha: ficha.id_ficha.toString(), numero: ficha.numero_ficha,
    motivo: ficha.motivo_atencion, estado: ficha.estado_actual,
    fechaSolicitud: ficha.fecha_generacion.toISOString().slice(0, 10),
    jornada: jornadaDTO(ficha.jornada_atencion, 0),
  };
}

export class EstudianteService {
  private async estudiante(idUsuario: string) {
    const estudiante = await prisma.estudiante.findUnique({
      where: { id_usuario: BigInt(idUsuario) }, include: { usuario: true },
    });
    if (!estudiante || estudiante.usuario?.estado !== "ACTIVO") {
      throw ApiError.forbidden("Tu cuenta no tiene un perfil de estudiante activo. Contacta a Kardex.");
    }
    return estudiante;
  }

  async perfil(idUsuario: string) {
    const e = await this.estudiante(idUsuario);
    return { nombres: e.nombres, apellidos: e.apellidos, ci: e.ci, ru: e.ru,
      correo: e.correo_institucional, mencion: e.carrera };
  }

  async jornadas(idUsuario: string) {
    await this.estudiante(idUsuario);
    const jornadas = await prisma.jornada_atencion.findMany({
      where: { estado: "ACTIVO", fecha: { gte: new Date(`${ahoraBolivia().fecha}T00:00:00Z`) } },
      include: { _count: { select: { ficha_atencion: { where: { estado_actual: { not: "CANCELADA" } } } } } },
      orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
    });
    return jornadas.filter(jornadaVigente).map(j => jornadaDTO(j, j._count.ficha_atencion));
  }

  async fichas(idUsuario: string) {
    const e = await this.estudiante(idUsuario);
    const fichas = await prisma.ficha_atencion.findMany({
      where: { id_estudiante: e.id_estudiante }, include: { jornada_atencion: true },
      orderBy: { id_ficha: "desc" },
    });
    return fichas.map(fichaDTO);
  }

  async solicitar(idUsuario: string, input: { idJornada: string; motivo: string; detalle: string }) {
    const e = await this.estudiante(idUsuario);
    const idJornada = BigInt(input.idJornada);
    try {
      return await prisma.$transaction(async tx => {
        // Serializa las solicitudes de una misma jornada para respetar cupos y numeración.
        await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
        const jornada = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada } });
        if (!jornada || !jornadaVigente(jornada)) throw ApiError.conflict("La jornada ya no está disponible. Elige otra fecha.");
        const existente = await tx.ficha_atencion.findFirst({ where: {
          id_jornada: idJornada, id_estudiante: e.id_estudiante, estado_actual: { not: "CANCELADA" },
        } });
        if (existente) throw ApiError.conflict("Ya tienes una ficha para esta jornada. Revisa Mis fichas.");
        const ocupadas = await tx.ficha_atencion.count({ where: { id_jornada: idJornada, estado_actual: { not: "CANCELADA" } } });
        if (ocupadas >= jornada.cupo_total) throw ApiError.conflict("Se agotaron los cupos de esta jornada. Elige otra fecha.");
        const ultima = await tx.ficha_atencion.aggregate({ where: { id_jornada: idJornada }, _max: { numero_ficha: true } });
        const ahora = ahoraBolivia();
        const ficha = await tx.ficha_atencion.create({
          data: {
            id_estudiante: e.id_estudiante, id_jornada: idJornada,
            numero_ficha: (ultima._max.numero_ficha ?? 0) + 1,
            motivo_atencion: `${input.motivo}\n\n${input.detalle}`, estado_actual: "GENERADA",
            fecha_generacion: new Date(`${ahora.fecha}T00:00:00Z`),
            hora_generacion: new Date(`1970-01-01T${ahora.hora}Z`),
          }, include: { jornada_atencion: true },
        });
        await tx.historial_ficha.create({ data: {
          id_ficha: ficha.id_ficha, id_jornada: idJornada, id_usuario: BigInt(idUsuario),
          estado: "GENERADA", observacion: "Solicitud desde el portal de estudiantes",
        } });
        return fichaDTO(ficha);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        throw ApiError.conflict("La disponibilidad cambió. Actualiza las jornadas e intenta nuevamente.");
      }
      throw error;
    }
  }
}

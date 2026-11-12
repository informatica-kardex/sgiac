import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { JornadaInput, TramiteInput } from "./ficha.validation";
import { ahoraBolivia, codigoFicha, ESPERA, PENDIENTES, fichaDTO, fichaInclude, jornadaDTO, jornadaInclude } from "./ficha.shared";

export class FichaRepository {
  async puestos() {
    return (await prisma.puesto_atencion.findMany({ where: { activo: true }, orderBy: { id_puesto: "asc" } }))
      .map(p => ({ idPuesto: String(p.id_puesto), nombre: p.nombre }));
  }

  async guardarPuesto(nombre: string, id?: string) {
    try {
      const p = id ? await prisma.puesto_atencion.update({ where: { id_puesto: BigInt(id), activo: true }, data: { nombre } })
        : await prisma.puesto_atencion.upsert({ where: { nombre }, create: { nombre }, update: { activo: true } });
      return { idPuesto: String(p.id_puesto), nombre: p.nombre };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw ApiError.conflict("Ya existe un puesto con ese nombre.");
      return this.errorDB(e);
    }
  }

  async borrarPuesto(id: string) {
    return prisma.$transaction(async tx => {
      const idPuesto = BigInt(id);
      await tx.$queryRaw`SELECT id_puesto FROM puesto_atencion WHERE id_puesto = ${idPuesto} FOR UPDATE`;
      const puesto = await tx.puesto_atencion.findUnique({ where: { id_puesto: idPuesto } });
      if (!puesto?.activo) throw ApiError.notFound("Puesto no encontrado");
      const enUso = await tx.jornada_puesto.count({ where: { id_puesto: idPuesto, jornada: { fecha: { gte: new Date(ahoraBolivia().fecha) } } } });
      if (enUso) throw ApiError.conflict("Este puesto está asignado a jornadas de hoy o futuras. Retíralo de esas jornadas antes de eliminarlo; las jornadas con fichas deben finalizar su fecha de atención.");
      await tx.puesto_atencion.update({ where: { id_puesto: idPuesto }, data: { activo: false } });
      return null;
    });
  }

  async tramites() {
    return (await prisma.tramite_atencion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }))
      .map(t => ({ idTramite: String(t.id_tramite), nombre: t.nombre, descripcion: t.descripcion, identificador: t.identificador }));
  }

  async guardarTramite(input: TramiteInput, id?: string) {
    try {
      const t = id ? await prisma.tramite_atencion.update({ where: { id_tramite: BigInt(id), activo: true }, data: input })
        : await prisma.tramite_atencion.create({ data: input });
      return { idTramite: String(t.id_tramite), nombre: t.nombre, descripcion: t.descripcion, identificador: t.identificador };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && /identificador/i.test(String(e.meta?.target ?? ""))) {
        throw ApiError.conflict("Otro trámite activo ya utiliza ese identificador. Elige uno diferente.");
      }
      return this.errorDB(e);
    }
  }

  async borrarTramite(id: string) {
    return prisma.$transaction(async tx => {
      const idTramite = BigInt(id);
      await tx.$queryRaw`SELECT id_tramite FROM tramite_atencion WHERE id_tramite = ${idTramite} FOR UPDATE`;
      const tramite = await tx.tramite_atencion.findUnique({ where: { id_tramite: idTramite } });
      if (!tramite?.activo) throw ApiError.notFound("Trámite no encontrado");
      const pendientes = await tx.ficha_atencion.count({ where: {
        jornada_atencion: { id_tramite: idTramite, fecha: { gte: new Date(ahoraBolivia().fecha) } },
        estado_actual: { in: PENDIENTES },
      } });
      if (pendientes) throw ApiError.conflict("Este trámite tiene fichas pendientes. Completa la atención antes de eliminarlo.");
      // Baja lógica: conserva el nombre del trámite en las jornadas y fichas históricas.
      await tx.tramite_atencion.update({ where: { id_tramite: idTramite }, data: { activo: false } });
      await tx.jornada_atencion.updateMany({ where: { id_tramite: idTramite, fecha: { gte: new Date(ahoraBolivia().fecha) } }, data: { estado: "INACTIVO" } });
      return null;
    });
  }

  async jornadas(fecha: string) {
    return (await prisma.jornada_atencion.findMany({
      where: { fecha: new Date(fecha) }, include: jornadaInclude, orderBy: [{ hora_inicio: "asc" }, { id_jornada: "asc" }],
    })).map(jornadaDTO);
  }

  async guardarJornada(input: JornadaInput, idUsuario: string, id?: string) {
    try {
      return await prisma.$transaction(tx => this.guardarJornadaEnTransaccion(tx, input, idUsuario, id));
    } catch (e) { return this.errorDB(e); }
  }

  async borrarJornada(id: string) {
    try {
      return await prisma.$transaction(async tx => {
        const idJornada = BigInt(id);
        // Serializa la eliminación con las reservas y los cambios de esta jornada.
        await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
        const jornada = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada },
          include: { _count: { select: { ficha_atencion: true, historial_ficha: true } } },
        });
        if (!jornada) throw ApiError.notFound("Jornada no encontrada");
        if (jornada._count.ficha_atencion || jornada._count.historial_ficha) {
          throw ApiError.conflict("No se puede eliminar una jornada que ya emitió fichas, incluso canceladas. Puedes pausarla para conservar su historial.");
        }
        await tx.jornada_atencion.delete({ where: { id_jornada: idJornada } });
        return null;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") throw ApiError.conflict("La jornada tiene registros asociados y no se puede eliminar. Actualiza la información.");
      return this.errorDB(e);
    }
  }

  async programarJornadas(inputs: JornadaInput[], idUsuario: string) {
    try {
      return await prisma.$transaction(async tx => {
        const jornadas = [];
        // El lote toma primero los puestos en un orden común con los llamados.
        await tx.$queryRaw`SELECT id_puesto FROM puesto_atencion WHERE activo = true ORDER BY id_puesto FOR UPDATE`;
        // Un orden estable de bloqueos evita conflictos entre programaciones simultáneas.
        const ordenadas = [...inputs].sort((a, b) => (a.idTramite ?? "").localeCompare(b.idTramite ?? "") || a.fecha.localeCompare(b.fecha));
        for (const input of ordenadas) jornadas.push(await this.guardarJornadaEnTransaccion(tx, input, idUsuario));
        return jornadas;
      }, { timeout: 30000 });
    } catch (e) { return this.errorDB(e); }
  }

  private async guardarJornadaEnTransaccion(tx: Prisma.TransactionClient, input: JornadaInput, idUsuario: string, id?: string) {
    // Compatibilidad con formularios anteriores: el nombre debe existir en el catálogo.
    const seleccionados = await tx.puesto_atencion.findMany({ where: { activo: true,
      ...(input.idPuestos ? { id_puesto: { in: input.idPuestos.map(BigInt) } } : { nombre: input.puesto }),
    }, orderBy: { id_puesto: "asc" } });
    if (!seleccionados.length || input.idPuestos && seleccionados.length !== input.idPuestos.length) throw ApiError.badRequest("Selecciona puestos de atención disponibles.");
    for (const p of seleccionados) await tx.$queryRaw`SELECT id_puesto FROM puesto_atencion WHERE id_puesto = ${p.id_puesto} FOR UPDATE`;
    const puestos = await tx.puesto_atencion.findMany({ where: { activo: true, id_puesto: { in: seleccionados.map(p => p.id_puesto) } }, orderBy: { id_puesto: "asc" } });
    if (puestos.length !== seleccionados.length) throw ApiError.conflict("Un puesto dejó de estar disponible. Actualiza el formulario.");
    const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const cupo = input.modoCupo === "TIEMPO" ? Math.floor((minutos(input.horaFin) - minutos(input.horaInicio)) / input.minutosPorEstudiante) * puestos.length : input.cupoTotal;
    if (cupo < 1) throw ApiError.badRequest("El horario no alcanza para atender a un estudiante con esa duración.");
    if (cupo > 10000) throw ApiError.badRequest("El cupo total no puede superar 10000 estudiantes.");
    const now = ahoraBolivia();
    if (input.fecha < now.fecha) throw ApiError.badRequest("No se pueden configurar jornadas de fechas pasadas.");
    if (!id && input.fecha === now.fecha && `${input.horaFin}:00` <= now.hora) throw ApiError.badRequest("Ese horario ya terminó.");
    // Mantener el orden de bloqueos: trámite y luego jornada.
    let identificador = input.identificador;
    if (input.idTramite) {
      const idTramite = BigInt(input.idTramite);
      await tx.$queryRaw`SELECT id_tramite FROM tramite_atencion WHERE id_tramite = ${idTramite} FOR UPDATE`;
      const tramite = await tx.tramite_atencion.findUnique({ where: { id_tramite: idTramite } });
      if (!tramite || (!tramite.activo && (!id || input.estado === "ACTIVO"))) throw ApiError.conflict("El trámite ya no está disponible.");
      if (!id) identificador ??= tramite.identificador ?? undefined;
    } else if (!id) throw ApiError.badRequest("Selecciona un trámite.");
    if (id) {
      const idJornada = BigInt(id);
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
      const actual = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada }, include: jornadaInclude });
      if (!actual) throw ApiError.notFound("Jornada no encontrada");
      const dto = jornadaDTO(actual);
      identificador ??= dto.identificador;
      if (actual.ficha_atencion.length && dto.identificador !== identificador) {
        throw ApiError.conflict("El identificador no se puede cambiar porque esta jornada ya tiene fichas emitidas, incluso si fueron canceladas.");
      }
      const mismosPuestos = dto.idPuestos.length ? dto.idPuestos.join(',') === puestos.map(p => String(p.id_puesto)).join(',') : puestos.length === 1 && actual.puesto === puestos[0].nombre;
      if (actual.ficha_atencion.length && (dto.fecha !== input.fecha || dto.idTramite !== input.idTramite || dto.horaInicio !== input.horaInicio || dto.horaFin !== input.horaFin || !mismosPuestos)) {
        throw ApiError.conflict("Una jornada con fichas emitidas conserva su trámite, fecha, horario y puesto. Puedes cambiar el cupo, duración o pausar la jornada.");
      }
      if (cupo < dto.ocupadas) throw ApiError.conflict(`El cupo no puede ser menor que las ${dto.ocupadas} fichas vigentes.`);
    }
    if (!identificador) throw ApiError.badRequest("Configura el identificador del trámite o indica uno para esta jornada.");
    const data = {
      id_tramite: input.idTramite ? BigInt(input.idTramite) : null, fecha: new Date(input.fecha),
      hora_inicio: new Date(`1970-01-01T${input.horaInicio}:00Z`), hora_fin: new Date(`1970-01-01T${input.horaFin}:00Z`),
      cupo_total: cupo, modo_cupo: input.modoCupo, minutos_por_estudiante: input.minutosPorEstudiante,
      puesto: puestos[0].nombre, estado: input.estado, identificador,
      puestos: { ...(id ? { deleteMany: {} } : {}), create: puestos.map(p => ({ id_puesto: p.id_puesto })) },
    };
    const j = id ? await tx.jornada_atencion.update({ where: { id_jornada: BigInt(id) }, data, include: jornadaInclude })
      : await tx.jornada_atencion.create({ data: { ...data, id_usuario: BigInt(idUsuario) }, include: jornadaInclude });
    return jornadaDTO(j);
  }

  async findAll(fecha = ahoraBolivia().fecha) {
    return (await prisma.ficha_atencion.findMany({ where: { jornada_atencion: { fecha: new Date(fecha) } },
      include: fichaInclude, orderBy: [{ id_jornada: "asc" }, { numero_ficha: "asc" }],
    })).map(fichaDTO);
  }

  async tablero() {
    const fecha = ahoraBolivia().fecha;
    const jornadas = await prisma.jornada_atencion.findMany({ where: { fecha: new Date(fecha) },
      include: { tramite: true, puestos: jornadaInclude.puestos, ficha_atencion: { orderBy: { numero_ficha: "asc" }, select: {
        numero_ficha: true, estado_actual: true, id_puesto: true, puesto_llamado: true,
        historial_ficha: { where: { estado: "LLAMADA" }, orderBy: { id_historial_ficha: "desc" }, take: 1, select: { id_historial_ficha: true, fecha_hora: true } },
      } } }, orderBy: { id_jornada: "asc" },
    });
    // El historial permanece aunque la ficha ya haya terminado o se recargue la TV.
    // Un rellamado mueve la misma ficha al inicio, sin ocupar dos lugares.
    const ultimosLlamados = jornadas.flatMap(j => j.ficha_atencion.flatMap(f => {
      const evento = f.historial_ficha[0];
      return evento ? [{
        evento: evento.id_historial_ficha.toString(), codigo: codigoFicha(j, f.numero_ficha),
        numero: f.numero_ficha, puesto: f.puesto_llamado ?? j.puesto, tramite: j.tramite?.nombre ?? "Atención general",
        estado: f.estado_actual, llamadaEn: evento.fecha_hora.toISOString(),
      }] : [];
    })).sort((a, b) => BigInt(a.evento) > BigInt(b.evento) ? -1 : BigInt(a.evento) < BigInt(b.evento) ? 1 : 0).slice(0, 5);
    return { fecha, actualizadoEn: new Date().toISOString(), ultimosLlamados, jornadas: jornadas.map(j => {
      const actuales = j.ficha_atencion.filter(f => f.estado_actual === "LLAMADA").map(f => ({
        codigo: codigoFicha(j, f.numero_ficha), numero: f.numero_ficha, puesto: f.puesto_llamado ?? j.puesto,
        evento: f.historial_ficha[0]?.id_historial_ficha.toString() ?? null,
        llamadaEn: f.historial_ficha[0]?.fecha_hora.toISOString() ?? null,
      }));
      return {
        ...jornadaDTO(j),
        actual: actuales[0] ?? null, actuales,
        siguientes: j.ficha_atencion.filter(f => ESPERA.includes(f.estado_actual)).slice(0, 5).map(f => codigoFicha(j, f.numero_ficha)),
      };
    }) };
  }

  async siguiente(id: string, idUsuario: string, idPuesto: string) {
    const idJornada = BigInt(id);
    return prisma.$transaction(async tx => {
      const puestoId = BigInt(idPuesto);
      // Serializa también entre trámites: un puesto no puede atender dos fichas a la vez.
      await tx.$queryRaw`SELECT id_puesto FROM puesto_atencion WHERE id_puesto = ${puestoId} FOR UPDATE`;
      const puesto = await tx.puesto_atencion.findUnique({ where: { id_puesto: puestoId } });
      if (!puesto?.activo) throw ApiError.badRequest("Selecciona un puesto disponible.");
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
      const j = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada }, include: { puestos: true } });
      if (!j) throw ApiError.notFound("Jornada no encontrada");
      if (!j.puestos.some(p => p.id_puesto === puestoId)) throw ApiError.badRequest("Este puesto no está habilitado para el trámite de esta jornada.");
      const now = ahoraBolivia();
      if (j.estado !== "ACTIVO") throw ApiError.conflict("La jornada está pausada. Actívala para llamar turnos.");
      if (j.fecha.toISOString().slice(0, 10) !== now.fecha || j.hora_inicio.toISOString().slice(11, 19) > now.hora) throw ApiError.conflict("Solo puedes llamar turnos del día de hoy desde la hora de inicio.");
      const actual = await tx.ficha_atencion.findFirst({ where: { id_puesto: puestoId, estado_actual: "LLAMADA", jornada_atencion: { fecha: j.fecha } }, include: fichaInclude });
      // Una repetición o dos administradores simultáneos nunca saltan al estudiante actual.
      if (actual) {
        if (actual.id_jornada !== idJornada) throw ApiError.conflict("Este puesto tiene una ficha en atención de otro trámite. Finalízala antes de llamar otra.");
        return fichaDTO(actual);
      }
      const siguiente = await tx.ficha_atencion.findFirst({ where: { id_jornada: idJornada, estado_actual: { in: ESPERA } }, orderBy: { numero_ficha: "asc" } });
      if (!siguiente) throw ApiError.conflict("No hay fichas en espera.");
      return this.cambiarEstado(tx, siguiente.id_ficha, idJornada, idUsuario, "LLAMADA", "Llamado al siguiente turno", puesto);
    });
  }

  async accion(id: string, accion: "RELLAMAR" | "FINALIZAR" | "AUSENTE", idUsuario: string) {
    const idFicha = BigInt(id);
    return prisma.$transaction(async tx => {
      const f = await tx.ficha_atencion.findUnique({ where: { id_ficha: idFicha } });
      if (!f) throw ApiError.notFound("Ficha no encontrada");
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${f.id_jornada} FOR UPDATE`;
      const actual = await tx.ficha_atencion.findUnique({ where: { id_ficha: idFicha } });
      if (actual?.estado_actual !== "LLAMADA") throw ApiError.conflict("La ficha ya no está en atención. Actualiza la cola.");
      const estado = accion === "FINALIZAR" ? "ATENDIDA" : accion === "AUSENTE" ? "NO PRESENTADA" : "LLAMADA";
      return this.cambiarEstado(tx, idFicha, f.id_jornada, idUsuario, estado, accion === "RELLAMAR" ? "Repetición de llamado" : "Atención registrada por Kardex");
    });
  }

  private async cambiarEstado(tx: Prisma.TransactionClient, idFicha: bigint, idJornada: bigint, idUsuario: string, estado: string, observacion: string, puesto?: { id_puesto: bigint; nombre: string }) {
    await tx.ficha_atencion.update({ where: { id_ficha: idFicha }, data: { estado_actual: estado, ...(puesto ? { id_puesto: puesto.id_puesto, puesto_llamado: puesto.nombre } : {}) } });
    await tx.historial_ficha.create({ data: { id_ficha: idFicha, id_jornada: idJornada, id_usuario: BigInt(idUsuario), estado, observacion } });
    return fichaDTO(await tx.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: idFicha }, include: fichaInclude }));
  }

  private errorDB(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (/identificador|coalesce/i.test(target)) throw ApiError.conflict("Ese identificador ya está en uso en otra jornada de la misma fecha. Elige uno diferente.");
        throw ApiError.conflict("Ya existe ese nombre de trámite o una jornada con ese trámite o identificador para la misma fecha.");
      }
      if (e.code === "P2025") throw ApiError.notFound("Registro no encontrado");
    }
    throw e;
  }
}

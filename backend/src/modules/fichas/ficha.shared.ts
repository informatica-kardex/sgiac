import { Prisma } from "@prisma/client";

export const ESPERA = ["GENERADA", "CONFIRMADA", "EN ESPERA", "REPROGRAMADA"];
export const PENDIENTES = [...ESPERA, "LLAMADA"];
export function ahoraBolivia(now = new Date()) {
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 19) };
}
export const jornadaInclude = {
  tramite: true,
  ficha_atencion: { select: { numero_ficha: true, estado_actual: true } },
} satisfies Prisma.jornada_atencionInclude;
export const fichaInclude = {
  estudiante: { include: { usuario: { select: { nombreCompleto: true } } } },
  jornada_atencion: { include: jornadaInclude },
  historial_ficha: { orderBy: { id_historial_ficha: "desc" as const }, take: 1 },
} satisfies Prisma.ficha_atencionInclude;
type Jornada = Prisma.jornada_atencionGetPayload<{ include: typeof jornadaInclude }>;
type Ficha = Prisma.ficha_atencionGetPayload<{ include: typeof fichaInclude }>;
export function jornadaVigente(j: Pick<Jornada, "fecha" | "hora_fin" | "estado">) {
  const now = ahoraBolivia();
  const fecha = j.fecha.toISOString().slice(0, 10);
  return j.estado === "ACTIVO" && (fecha > now.fecha || (fecha === now.fecha && j.hora_fin.toISOString().slice(11, 19) > now.hora));
}
export function jornadaDTO(j: Jornada) {
  const ocupadas = j.ficha_atencion.filter(f => f.estado_actual !== "CANCELADA").length;
  return {
    idJornada: String(j.id_jornada), idTramite: j.id_tramite?.toString() ?? null,
    tramite: j.tramite?.nombre ?? "Atención general", fecha: j.fecha.toISOString().slice(0, 10),
    horaInicio: j.hora_inicio.toISOString().slice(11, 16), horaFin: j.hora_fin.toISOString().slice(11, 16),
    cupoTotal: j.cupo_total, ocupadas, disponibles: Math.max(0, j.cupo_total - ocupadas),
    modoCupo: j.modo_cupo, minutosPorEstudiante: j.minutos_por_estudiante, puesto: j.puesto,
    estado: j.estado, enEspera: j.ficha_atencion.filter(f => ESPERA.includes(f.estado_actual)).length,
    atendidas: j.ficha_atencion.filter(f => f.estado_actual === "ATENDIDA").length,
  };
}
export function codigoFicha(idJornada: bigint, numero: number) { return `J${idJornada}-${String(numero).padStart(3, "0")}`; }
export function fichaDTO(f: Ficha) {
  const jornada = jornadaDTO(f.jornada_atencion);
  const delante = ESPERA.includes(f.estado_actual) ? f.jornada_atencion.ficha_atencion.filter(other =>
    other.estado_actual === "LLAMADA" || (other.numero_ficha < f.numero_ficha && ESPERA.includes(other.estado_actual))).length : 0;
  return {
    idFicha: String(f.id_ficha), numero: f.numero_ficha, codigo: codigoFicha(f.id_jornada, f.numero_ficha),
    solicitante: f.estudiante.usuario?.nombreCompleto ?? `${f.estudiante.nombres} ${f.estudiante.apellidos}`,
    correo: f.estudiante.correo_institucional, ru: f.estudiante.ru,
    motivo: f.motivo_atencion, estado: f.estado_actual,
    fechaSolicitud: f.fecha_generacion.toISOString().slice(0, 10), jornada,
    delante, esperaMinutos: delante * jornada.minutosPorEstudiante,
    ultimoEvento: f.historial_ficha[0]?.fecha_hora.toISOString() ?? null,
  };
}

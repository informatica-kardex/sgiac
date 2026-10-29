import { ApiError } from "../../utils/apiError";

export const ACTIVAS = ["SOLICITADA", "EN_PREPARACION", "LISTA"];
export function disponibleDocumento(tipo: { habilitado: boolean; desde: Date | null; hasta: Date | null }, ahora = new Date()) {
  return tipo.habilitado && (!tipo.desde || tipo.desde <= ahora) && (!tipo.hasta || ahora < tipo.hasta);
}
// El plazo es en horas corridas. Si termina fuera de atención, pasa a la siguiente apertura en Bolivia.
export function estimarRecojo(tipo: { plazoHoras: number; diasAtencion: number[]; horaInicio: string; horaFin: string }, ahora = new Date()) {
  let local = new Date(ahora.getTime() + tipo.plazoHoras * 3600000 - 4 * 3600000);
  for (let i = 0; i < 8; i++) {
    const hora = local.toISOString().slice(11, 16);
    if (tipo.diasAtencion.includes(local.getUTCDay()) && hora < tipo.horaFin) {
      if (hora < tipo.horaInicio) local = new Date(`${local.toISOString().slice(0, 10)}T${tipo.horaInicio}:00Z`);
      return new Date(local.getTime() + 4 * 3600000);
    }
    local.setUTCDate(local.getUTCDate() + 1); local.setUTCHours(0, 0, 0, 0);
  }
  throw ApiError.badRequest("Configura al menos un día de atención");
}
export function comprobarTransicion(estado: string, accion: string) {
  const permitidas: Record<string, string[]> = {
    PREPARAR: ["SOLICITADA"], LISTA: ["SOLICITADA", "EN_PREPARACION", "LISTA"],
    ENTREGAR: ["LISTA"], RECHAZAR: ["SOLICITADA", "EN_PREPARACION"], ASIGNAR: ACTIVAS,
    CANCELAR: ["SOLICITADA"],
  };
  if (!permitidas[accion]?.includes(estado)) throw ApiError.conflict("Esta acción ya no corresponde al estado de la solicitud. Actualiza la bandeja.");
}
export function codigoDocumento(id: bigint, fecha: Date, identificador = "DOC") {
  return `${identificador}-${new Date(fecha.getTime() - 4 * 3600000).getUTCFullYear()}-${String(id).padStart(6, "0")}`;
}

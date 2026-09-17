import { FichaAtencion } from "./ficha.types";

export let fichasMock: FichaAtencion[] = [
  { idFicha: 1, solicitante: "Juan Pérez", correo: "juan.perez@estudiante.edu.bo", motivo: "Solicitud de Kardex", detalle: "Necesito mi kardex actualizado para trámite de beca.", estado: "pendiente", fechaSolicitud: "2026-09-05T10:00:00.000Z", fechaAtencion: null, atendidoPor: null },
  { idFicha: 2, solicitante: "María Rojas", correo: "maria.rojas@estudiante.edu.bo", motivo: "Certificado de notas", detalle: "Requiero certificado de notas de las gestiones 2024-2025.", estado: "en_proceso", fechaSolicitud: "2026-09-04T09:30:00.000Z", fechaAtencion: null, atendidoPor: "Área de Kardex" },
  { idFicha: 3, solicitante: "Luis Fernández", correo: "luis.fernandez@estudiante.edu.bo", motivo: "Cambio de horario", detalle: "Solicito cambio de grupo por conflicto laboral.", estado: "atendida", fechaSolicitud: "2026-08-28T14:00:00.000Z", fechaAtencion: "2026-08-30T11:00:00.000Z", atendidoPor: "Subadministración Académica" },
  { idFicha: 4, solicitante: "Ana Gutiérrez", correo: "ana.gutierrez@estudiante.edu.bo", motivo: "Matrícula extraordinaria", detalle: "Solicito matrícula fuera de fecha por motivos de salud.", estado: "rechazada", fechaSolicitud: "2026-08-20T08:00:00.000Z", fechaAtencion: "2026-08-22T10:00:00.000Z", atendidoPor: "Dirección de Carrera" },
  { idFicha: 5, solicitante: "Diego Vargas", correo: "diego.vargas@estudiante.edu.bo", motivo: "Duplicado de título provisional", detalle: "Extravié mi título provisional y necesito un duplicado.", estado: "pendiente", fechaSolicitud: "2026-09-08T16:20:00.000Z", fechaAtencion: null, atendidoPor: null },
];

export function nextFichaId(): number {
  return fichasMock.length > 0 ? Math.max(...fichasMock.map((f) => f.idFicha)) + 1 : 1;
}

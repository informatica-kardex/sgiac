import type { DiaSemana } from '../../api/types';

export interface RoomAssignmentRequest {
  aulas: string[];
  periodo: string;
  dia?: DiaSemana;
  inicio?: string;
  fin?: string;
  fecha?: string;
}

export function roomAssignmentUrl(request: RoomAssignmentRequest) {
  const params = new URLSearchParams({ periodo: request.periodo, asignar: '1' });
  request.aulas.forEach(aula => params.append('aula', aula));
  for (const key of ['dia', 'inicio', 'fin', 'fecha'] as const) {
    if (request[key]) params.set(key, request[key]);
  }
  return `/admin/horarios?${params}`;
}

export function readRoomAssignment(params: URLSearchParams): RoomAssignmentRequest {
  const request: RoomAssignmentRequest = { aulas: [...new Set(params.getAll('aula'))], periodo: params.get('periodo') ?? '' };
  const dia = params.get('dia'), inicio = params.get('inicio'), fin = params.get('fin');
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const validTime = (value: string | null): value is string => Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  if (dia && days.slice(1).includes(dia) && validTime(inicio) && validTime(fin) && inicio >= '07:00' && fin <= '22:00' && inicio < fin) {
    Object.assign(request, { dia, inicio, fin });
    const fecha = params.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const date = new Date(`${fecha}T12:00:00Z`);
      if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha && days[date.getUTCDay()] === dia) request.fecha = fecha;
    }
  }
  return request;
}

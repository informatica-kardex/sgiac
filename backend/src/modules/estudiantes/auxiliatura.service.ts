import { auxiliarCarnetService } from '../academico/auxiliar-carnet.service';
import { solicitudAulaService } from '../solicitudes-aulas/solicitud-aula.service';

export const auxiliaturaService = {
  async consultar(idUsuario: string) {
    const perfil = await solicitudAulaService.perfil(idUsuario);
    if (!perfil.habilitado) return { perfil, horarios: [] };
    const carnet = await auxiliarCarnetService.emitirParaUsuario(idUsuario);
    const consulta = await auxiliarCarnetService.consultar(carnet.token);
    return { perfil, horarios: consulta.horarios };
  },
};

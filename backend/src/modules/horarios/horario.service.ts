import { ApiError } from "../../utils/apiError";
import { HorarioRepository } from "./horario.repository";
import { ActualizarHorarioInput, CrearHorarioInput } from "./horario.validation";

export class HorarioService {
  private repository = new HorarioRepository();

  async listar() {
    return this.repository.findAll();
  }

  async obtener(idHorario: number) {
    const horario = await this.repository.findById(idHorario);
    if (!horario) {
      throw ApiError.notFound("Horario no encontrado");
    }
    return horario;
  }

  async crear(input: CrearHorarioInput) {
    return this.repository.create(input);
  }

  async actualizar(idHorario: number, input: ActualizarHorarioInput) {
    return this.repository.update(idHorario, input);
  }

  async eliminar(idHorario: number) {
    return this.repository.delete(idHorario);
  }
}

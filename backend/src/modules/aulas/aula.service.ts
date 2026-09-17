import { ApiError } from "../../utils/apiError";
import { AulaRepository } from "./aula.repository";
import { ActualizarAulaInput, CrearAulaInput } from "./aula.validation";

export class AulaService {
  private repository = new AulaRepository();

  async listar() {
    return this.repository.findAll();
  }

  async obtener(idAula: number) {
    const aula = await this.repository.findById(idAula);
    if (!aula) {
      throw ApiError.notFound("Aula no encontrada");
    }
    return aula;
  }

  async crear(input: CrearAulaInput) {
    return this.repository.create(input);
  }

  async actualizar(idAula: number, input: ActualizarAulaInput) {
    return this.repository.update(idAula, input);
  }

  async eliminar(idAula: number) {
    return this.repository.delete(idAula);
  }
}

import { ApiError } from "../../utils/apiError";
import { FichaRepository } from "./ficha.repository";
import { ActualizarFichaInput, CrearFichaInput } from "./ficha.validation";

export class FichaService {
  private repository = new FichaRepository();

  async listar() {
    return this.repository.findAll();
  }

  async obtener(idFicha: number) {
    const ficha = await this.repository.findById(idFicha);
    if (!ficha) {
      throw ApiError.notFound("Ficha de atención no encontrada");
    }
    return ficha;
  }

  async crear(input: CrearFichaInput) {
    return this.repository.create(input);
  }

  async actualizar(idFicha: number, input: ActualizarFichaInput) {
    return this.repository.update(idFicha, input);
  }
}

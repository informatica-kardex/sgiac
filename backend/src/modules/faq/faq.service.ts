import { ApiError } from "../../utils/apiError";
import { FaqRepository } from "./faq.repository";
import { ActualizarFaqInput, CrearFaqInput } from "./faq.validation";

export class FaqService {
  private repository = new FaqRepository();

  async listarPublicadas() {
    return this.repository.findAllPublicadas();
  }

  async listarTodas() {
    return this.repository.findAll();
  }

  async obtener(idFaq: number) {
    const faq = await this.repository.findById(idFaq);
    if (!faq) {
      throw ApiError.notFound("Pregunta frecuente no encontrada");
    }
    return faq;
  }

  async crear(input: CrearFaqInput) {
    return this.repository.create(input);
  }

  async actualizar(idFaq: number, input: ActualizarFaqInput) {
    return this.repository.update(idFaq, input);
  }

  async eliminar(idFaq: number) {
    return this.repository.delete(idFaq);
  }
}

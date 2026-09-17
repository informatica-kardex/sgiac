import { ApiError } from "../../utils/apiError";
import { Faq } from "./faq.types";
import { faqMock, nextFaqId } from "./faq.mock";
import { ActualizarFaqInput, CrearFaqInput } from "./faq.validation";

export class FaqRepository {
  async findAllPublicadas(): Promise<Faq[]> {
    return faqMock.filter((f) => f.estado === "publicada");
  }

  async findAll(): Promise<Faq[]> {
    return [...faqMock];
  }

  async findById(idFaq: number): Promise<Faq | undefined> {
    return faqMock.find((f) => f.idFaq === idFaq);
  }

  async create(input: CrearFaqInput): Promise<Faq> {
    const nueva: Faq = { idFaq: nextFaqId(), ...input };
    faqMock.push(nueva);
    return nueva;
  }

  async update(idFaq: number, input: ActualizarFaqInput): Promise<Faq> {
    const index = faqMock.findIndex((f) => f.idFaq === idFaq);
    if (index === -1) {
      throw ApiError.notFound("Pregunta frecuente no encontrada");
    }
    faqMock[index] = { ...faqMock[index], ...input };
    return faqMock[index];
  }

  async delete(idFaq: number): Promise<void> {
    const index = faqMock.findIndex((f) => f.idFaq === idFaq);
    if (index === -1) {
      throw ApiError.notFound("Pregunta frecuente no encontrada");
    }
    faqMock.splice(index, 1);
  }
}

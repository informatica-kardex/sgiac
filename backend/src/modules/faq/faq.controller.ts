import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { FaqService } from "./faq.service";
import { actualizarFaqSchema, crearFaqSchema } from "./faq.validation";

const faqService = new FaqService();

export const faqController = {
  listar: asyncHandler(async (req: Request, res) => {
    const faqs = req.user
      ? await faqService.listarTodas()
      : await faqService.listarPublicadas();
    return sendSuccess(res, faqs, "Preguntas frecuentes obtenidas");
  }),

  crear: asyncHandler(async (req, res) => {
    const data = crearFaqSchema.parse(req.body);
    const faq = await faqService.crear(data);
    return sendSuccess(res, faq, "Pregunta frecuente creada", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarFaqSchema.parse(req.body);
    const faq = await faqService.actualizar(Number(req.params.id), data);
    return sendSuccess(res, faq, "Pregunta frecuente actualizada");
  }),

  eliminar: asyncHandler(async (req, res) => {
    await faqService.eliminar(Number(req.params.id));
    return sendSuccess(res, null, "Pregunta frecuente eliminada");
  }),
};

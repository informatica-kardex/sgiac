import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Faq } from "./types";

export type CrearFaqPayload = Omit<Faq, "idFaq">;
export type ActualizarFaqPayload = Partial<CrearFaqPayload>;

export const faqApi = {
  listar: () => axiosClient.get<ApiEnvelope<Faq[]>>("/faq"),
  crear: (payload: CrearFaqPayload) =>
    axiosClient.post<ApiEnvelope<Faq>>("/faq", payload),
  actualizar: (id: number, payload: ActualizarFaqPayload) =>
    axiosClient.put<ApiEnvelope<Faq>>(`/faq/${id}`, payload),
  eliminar: (id: number) => axiosClient.delete<ApiEnvelope<null>>(`/faq/${id}`),
};

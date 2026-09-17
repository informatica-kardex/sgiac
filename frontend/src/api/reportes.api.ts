import { axiosClient } from "./axiosClient";
import { ApiEnvelope, ConteoCategoria, ConteoEstado, ResumenDashboard } from "./types";

export const reportesApi = {
  dashboard: () =>
    axiosClient.get<ApiEnvelope<ResumenDashboard>>("/reportes/dashboard"),
  comunicadosPorCategoria: () =>
    axiosClient.get<ApiEnvelope<ConteoCategoria[]>>(
      "/reportes/comunicados-por-categoria"
    ),
  fichasPorEstado: () =>
    axiosClient.get<ApiEnvelope<ConteoEstado[]>>("/reportes/fichas-por-estado"),
  aulasPorEstado: () =>
    axiosClient.get<ApiEnvelope<ConteoEstado[]>>("/reportes/aulas-por-estado"),
};

import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ReporteService } from "./reporte.service";

const reporteService = new ReporteService();

export const reporteController = {
  dashboard: asyncHandler(async (_req, res) => {
    const resumen = await reporteService.resumenDashboard();
    return sendSuccess(res, resumen, "Resumen del dashboard obtenido");
  }),

  comunicadosPorCategoria: asyncHandler(async (_req, res) => {
    const data = await reporteService.comunicadosPorCategoria();
    return sendSuccess(res, data, "Reporte de comunicados por categoría");
  }),

  fichasPorEstado: asyncHandler(async (_req, res) => {
    const data = await reporteService.fichasPorEstado();
    return sendSuccess(res, data, "Reporte de fichas por estado");
  }),

  aulasPorEstado: asyncHandler(async (_req, res) => {
    const data = await reporteService.aulasPorEstado();
    return sendSuccess(res, data, "Reporte de aulas por estado");
  }),
};

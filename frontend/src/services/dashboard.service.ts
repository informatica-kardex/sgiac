import { reportesApi } from "../api/reportes.api";

// Servicio de agregacion para el dashboard administrativo: junta
// varias llamadas a la API de reportes en una sola funcion que
// las paginas pueden consumir directamente.
export async function cargarResumenDashboard() {
  const [resumen, comunicadosPorCategoria, fichasPorEstado, aulasPorEstado] =
    await Promise.all([
      reportesApi.dashboard(),
      reportesApi.comunicadosPorCategoria(),
      reportesApi.fichasPorEstado(),
      reportesApi.aulasPorEstado(),
    ]);

  return {
    resumen: resumen.data.data,
    comunicadosPorCategoria: comunicadosPorCategoria.data.data,
    fichasPorEstado: fichasPorEstado.data.data,
    aulasPorEstado: aulasPorEstado.data.data,
  };
}

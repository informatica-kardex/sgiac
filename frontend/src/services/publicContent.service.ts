import { comunicadosApi } from "../api/comunicados.api";
import { faqApi } from "../api/faq.api";
import { horariosApi } from "../api/horarios.api";

// Servicio usado por la pagina de Inicio del portal publico:
// combina comunicados, horarios y FAQ en una sola carga inicial.
export async function cargarResumenPortal() {
  const [comunicados, horarios, faq] = await Promise.all([
    comunicadosApi.listar(),
    horariosApi.listar(),
    faqApi.listar(),
  ]);

  return {
    comunicados: comunicados.data.data,
    horarios: horarios.data.data,
    faq: faq.data.data,
  };
}

import { comunicadosApi } from "../api/comunicados.api";
import { faqApi } from "../api/faq.api";

// Servicio usado por la pagina de Inicio del portal publico:
// combina comunicados y FAQ en una sola carga inicial.
export async function cargarResumenPortal() {
  const [comunicados, faq] = await Promise.allSettled([
    comunicadosApi.listar(true),
    faqApi.listar(),
  ]);

  return {
    comunicados: comunicados.status === "fulfilled" ? comunicados.value.data.data : [],
    faq: faq.status === "fulfilled" ? faq.value.data.data : [],
    errores: { comunicados: comunicados.status === "rejected", faq: faq.status === "rejected" },
  };
}

import { comunicadosApi } from "../api/comunicados.api";
import { faqApi } from "../api/faq.api";
import { horariosApi } from "../api/horarios.api";

// Servicio usado por la pagina de Inicio del portal publico:
// combina comunicados, horarios y FAQ en una sola carga inicial.
export async function cargarResumenPortal() {
  const [comunicados, horarios, faq] = await Promise.allSettled([
    comunicadosApi.listar(true),
    horariosApi.listar(),
    faqApi.listar(),
  ]);

  return {
    comunicados: comunicados.status === "fulfilled" ? comunicados.value.data.data : [],
    horarios: horarios.status === "fulfilled" ? horarios.value.data.data : [],
    faq: faq.status === "fulfilled" ? faq.value.data.data : [],
    errores: { comunicados: comunicados.status === "rejected", horarios: horarios.status === "rejected", faq: faq.status === "rejected" },
  };
}

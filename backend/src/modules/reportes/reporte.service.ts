import { prisma } from "../../database/prisma";
import { aulasMock } from "../aulas/aula.mock";
import { comunicadosMock } from "../comunicados/comunicado.mock";
import { fichasMock } from "../fichas/ficha.mock";
import { horariosMock } from "../horarios/horario.mock";

// ------------------------------------------------------------
// Servicio de reportes: agrega datos reales (usuarios, vía
// Prisma) y datos mock (aulas, comunicados, fichas, horarios)
// para alimentar las tarjetas y graficos del dashboard admin.
// Cuando los modulos mock se conecten a tablas reales, este
// servicio solo necesita reemplazar el import del mock por el
// repositorio real correspondiente.
// ------------------------------------------------------------
export class ReporteService {
  async resumenDashboard() {
    const totalUsuarios = await prisma.usuario.count();
    const usuariosActivos = await prisma.usuario.count({
      where: { estado: "activo" },
    });

    const aulasDisponibles = aulasMock.filter((a) => a.estado === "disponible").length;
    const comunicadosActivos = comunicadosMock.filter((c) => c.estado === "publicado").length;
    const atencionesPendientes = fichasMock.filter((f) => f.estado === "pendiente").length;

    return {
      totalAulas: aulasMock.length,
      aulasDisponibles,
      comunicadosActivos,
      totalUsuarios,
      usuariosActivos,
      atencionesPendientes,
      totalHorarios: horariosMock.length,
    };
  }

  async comunicadosPorCategoria() {
    const conteo = new Map<string, number>();
    comunicadosMock.forEach((c) => {
      conteo.set(c.categoria, (conteo.get(c.categoria) ?? 0) + 1);
    });
    return Array.from(conteo.entries()).map(([categoria, cantidad]) => ({
      categoria,
      cantidad,
    }));
  }

  async fichasPorEstado() {
    const conteo = new Map<string, number>();
    fichasMock.forEach((f) => {
      conteo.set(f.estado, (conteo.get(f.estado) ?? 0) + 1);
    });
    return Array.from(conteo.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    }));
  }

  async aulasPorEstado() {
    const conteo = new Map<string, number>();
    aulasMock.forEach((a) => {
      conteo.set(a.estado, (conteo.get(a.estado) ?? 0) + 1);
    });
    return Array.from(conteo.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    }));
  }
}

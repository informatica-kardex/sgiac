import { prisma } from "../../database/prisma";
import { AulaRepository } from "../aulas/aula.repository";
import { ComunicadoRepository } from "../comunicados/comunicado.repository";
import { ESPERA } from "../fichas/ficha.shared";
import { HorarioRepository } from "../horarios/horario.repository";

// ------------------------------------------------------------
// Agrega los datos persistidos de los módulos para las tarjetas
// y gráficos del dashboard administrativo.
// ------------------------------------------------------------
export class ReporteService {
  async resumenDashboard() {
    const totalUsuarios = await prisma.usuario.count();
    const usuariosActivos = await prisma.usuario.count({
      where: { estado: "activo" },
    });

    const aulas = await new AulaRepository().findAll();
    const aulasDisponibles = aulas.filter((a) => a.estado === "disponible").length;
    const comunicadosActivos = (await new ComunicadoRepository().findAllPublicados()).length;
    const atencionesPendientes = await prisma.ficha_atencion.count({ where: { estado_actual: { in: ESPERA } } });

    return {
      totalAulas: aulas.length,
      aulasDisponibles,
      comunicadosActivos,
      totalUsuarios,
      usuariosActivos,
      atencionesPendientes,
      totalHorarios: (await new HorarioRepository().findAll()).length,
    };
  }

  async comunicadosPorCategoria() {
    const conteo = new Map<string, number>();
    (await new ComunicadoRepository().findAll()).forEach((c) => {
      conteo.set(c.categoria, (conteo.get(c.categoria) ?? 0) + 1);
    });
    return Array.from(conteo.entries()).map(([categoria, cantidad]) => ({
      categoria,
      cantidad,
    }));
  }

  async fichasPorEstado() {
    return (await prisma.ficha_atencion.groupBy({ by: ["estado_actual"], _count: true }))
      .map(f => ({ estado: f.estado_actual, cantidad: f._count }));
  }

  async aulasPorEstado() {
    const conteo = new Map<string, number>();
    (await new AulaRepository().findAll()).forEach((a) => {
      conteo.set(a.estado, (conteo.get(a.estado) ?? 0) + 1);
    });
    return Array.from(conteo.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    }));
  }
}

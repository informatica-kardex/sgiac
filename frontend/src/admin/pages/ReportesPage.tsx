import { AdminIcon } from "../components/AdminIcon";
import { useEffect, useState } from "react";
import { ConteoCategoria, ConteoEstado, ResumenDashboard } from "../../api/types";
import { cargarResumenDashboard } from "../../services/dashboard.service";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { StatCard } from "../components/StatCard";

export default function ReportesPage() {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [comunicadosPorCategoria, setComunicadosPorCategoria] = useState<ConteoCategoria[]>([]);
  const [fichasPorEstado, setFichasPorEstado] = useState<ConteoEstado[]>([]);
  const [aulasPorEstado, setAulasPorEstado] = useState<ConteoEstado[]>([]);

  useEffect(() => {
    cargarResumenDashboard()
      .then((data) => {
        setResumen(data.resumen);
        setComunicadosPorCategoria(data.comunicadosPorCategoria);
        setFichasPorEstado(data.fichasPorEstado);
        setAulasPorEstado(data.aulasPorEstado);
      })
      .finally(() => setCargando(false));
  }, []);

  if (cargando || !resumen) return <LoadingSpinner label="Cargando reportes..." />;

  const maxCom = Math.max(1, ...comunicadosPorCategoria.map((c) => c.cantidad));
  const maxFichas = Math.max(1, ...fichasPorEstado.map((f) => f.cantidad));
  const maxAulas = Math.max(1, ...aulasPorEstado.map((a) => a.cantidad));

  const ColorBar = ({
    data,
    max,
    color,
  }: {
    data: { label: string; cantidad: number }[];
    max: number;
    color: string;
  }) => (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-xs capitalize text-slate-500">
            <span>{d.label.replace("_", " ")}</span>
            <span>{d.cantidad}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${color}`}
              style={{ width: `${(d.cantidad / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
        <p className="text-sm text-slate-500">Indicadores generales del sistema SGIAC.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aulas disponibles" value={resumen.aulasDisponibles} icon={<AdminIcon name="aulas" size={21} />} accent="primary" />
        <StatCard label="Comunicados activos" value={resumen.comunicadosActivos} icon={<AdminIcon name="comunicados" size={21} />} accent="emerald" />
        <StatCard label="Usuarios activos" value={resumen.usuariosActivos} icon={<AdminIcon name="usuarios" size={21} />} accent="sky" />
        <StatCard label="Horarios registrados" value={resumen.totalHorarios} icon={<AdminIcon name="horarios" size={21} />} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Comunicados por categoría
          </h2>
          <ColorBar
            data={comunicadosPorCategoria.map((c) => ({ label: c.categoria, cantidad: c.cantidad }))}
            max={maxCom}
            color="bg-primary-600"
          />
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Fichas por estado
          </h2>
          <ColorBar
            data={fichasPorEstado.map((f) => ({ label: f.estado, cantidad: f.cantidad }))}
            max={maxFichas}
            color="bg-amber-500"
          />
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Aulas por estado
          </h2>
          <ColorBar
            data={aulasPorEstado.map((a) => ({ label: a.estado, cantidad: a.cantidad }))}
            max={maxAulas}
            color="bg-emerald-600"
          />
        </div>
      </div>
    </div>
  );
}

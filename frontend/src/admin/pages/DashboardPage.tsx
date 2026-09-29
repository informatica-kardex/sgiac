import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConteoCategoria, ConteoEstado, ResumenDashboard } from "../../api/types";
import { cargarResumenDashboard } from "../../services/dashboard.service";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { StatCard } from "../components/StatCard";
import { AdminIcon } from "../components/AdminIcon";
import { AlertMessage } from "../components/AlertMessage";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { MODULOS_ADMIN, puedeAccederModulo } from "../../utils/roles";

export default function DashboardPage() {
  const usuario = useAdminAuthStore(state => state.usuario);
  if (usuario?.roles.includes("ADMINISTRADOR")) return <DashboardAdministrador />;
  return <div className="space-y-6">
    <div><h1 className="text-xl font-bold">Bienvenido, {usuario?.nombreCompleto}</h1><p className="text-sm text-slate-500">Accede a los módulos habilitados por el administrador.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">{Object.entries(MODULOS_ADMIN)
      .filter(([key]) => key !== "dashboard" && puedeAccederModulo(usuario?.roles ?? [], key, usuario?.permisos))
      .map(([key, modulo]) => <Link className="card p-6 font-semibold text-primary-700 hover:bg-primary-50" key={key} to={`/admin/${key}`}>{modulo.label} →</Link>)}</div>
  </div>;
}

function DashboardAdministrador() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [comunicados, setComunicados] = useState<ConteoCategoria[]>([]);
  const [fichas, setFichas] = useState<ConteoEstado[]>([]);
  const [aulas, setAulas] = useState<ConteoEstado[]>([]);
  const usuario = useAdminAuthStore(state => state.usuario);
  const cargar = () => {
    setCargando(true);
    setError(false);
    cargarResumenDashboard().then(data => {
      setResumen(data.resumen);
      setComunicados(data.comunicadosPorCategoria);
      setFichas(data.fichasPorEstado);
      setAulas(data.aulasPorEstado);
    }).catch(() => setError(true)).finally(() => setCargando(false));
  };
  useEffect(cargar, []);
  if (cargando) return <LoadingSpinner label="Cargando panel..." />;
  if (error || !resumen) return <div className="space-y-4"><AlertMessage type="error" message="No se pudo cargar el resumen del panel." /><button className="btn-primary" onClick={cargar}>Reintentar</button></div>;
  const maxAulas = Math.max(1, ...aulas.map(item => item.cantidad));
  const maxComunicados = Math.max(1, ...comunicados.map(item => item.cantidad));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const canManageAttention = puedeAccederModulo(usuario?.roles ?? [], "fichas", usuario?.permisos);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h1 className="font-bold">{greeting}, {usuario?.nombreCompleto.split(" ")[0] ?? "Administrador"}</h1><p className="text-sm text-slate-500">Resumen operativo de la Carrera de Informática.</p></div>
      <p className="flex items-center gap-2 text-xs text-slate-500"><AdminIcon name="horarios" size={15} /><time dateTime={new Date().toLocaleDateString("en-CA")}>{new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</time></p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Aulas registradas" value={resumen.totalAulas} icon={<AdminIcon name="aulas" size={21} />} accent="primary" />
      <StatCard label="Comunicados activos" value={resumen.comunicadosActivos} icon={<AdminIcon name="comunicados" size={21} />} accent="emerald" />
      <StatCard label="Usuarios registrados" value={resumen.totalUsuarios} icon={<AdminIcon name="usuarios" size={21} />} accent="sky" />
      <StatCard label="Atenciones pendientes" value={resumen.atencionesPendientes} icon={<AdminIcon name="clock" size={21} />} accent="amber" />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <section className="card min-w-0">
        <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-sm font-bold">Estado de aulas</h2><p className="mt-1 text-xs text-slate-400">Distribución de los ambientes registrados</p></div>
        <div className="p-6">
          {aulas.length ? <div className="flex h-52 items-end justify-around gap-3 border-b border-l border-slate-200 px-3 pt-4">
            {aulas.map(item => <div key={item.estado} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold text-slate-500">{item.cantidad}</span>
              <div className="w-full max-w-10 bg-[#2459a9]" style={{ height: `${item.cantidad / maxAulas * 135}px` }} />
              <span className="max-w-full break-words pb-2 text-center text-[10px] capitalize text-slate-500">{item.estado.replace(/_/g, " ")}</span>
            </div>)}
          </div> : <p className="py-20 text-center text-sm text-slate-500">No hay aulas registradas.</p>}
          <p className="mt-5 text-xs text-slate-500"><strong className="text-[#13213d]">{resumen.aulasDisponibles}</strong> aulas disponibles <span className="ml-5"><strong className="text-[#13213d]">{resumen.totalHorarios}</strong> horarios registrados</span></p>
        </div>
      </section>
      <section className="card">
        <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-sm font-bold">Atención Kardex</h2><p className="mt-1 text-xs text-slate-400">Resumen de fichas por estado</p></div>
        <div className="divide-y divide-slate-100">
          {fichas.length ? fichas.map(item => <div key={item.estado} className="flex items-center gap-3 px-6 py-4"><span className="grid h-9 w-10 place-items-center bg-slate-100 text-sm font-bold">{String(item.cantidad).padStart(2, "0")}</span><p className="text-xs font-semibold capitalize text-slate-700">{item.estado.replace(/_/g, " ")}</p></div>) : <p className="p-6 text-sm text-slate-500">No hay fichas registradas.</p>}
        </div>
        {canManageAttention && <Link to="/admin/fichas" className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs font-bold text-[#2459a9]">Gestionar atención <AdminIcon name="arrow" size={16} /></Link>}
      </section>
    </div>
    <section className="card">
      <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-sm font-bold">Comunicados por categoría</h2><p className="mt-1 text-xs text-slate-400">Distribución de la información publicada en el sistema</p></div>
      <div className="grid gap-x-10 gap-y-5 p-6 sm:grid-cols-2">
        {comunicados.length ? comunicados.map(item => <div key={item.categoria}><div className="mb-2 flex justify-between gap-4 text-xs text-slate-500"><span>{item.categoria}</span><strong>{item.cantidad}</strong></div><div className="h-2 bg-slate-100"><div className="h-2 bg-[#2459a9]" style={{ width: `${item.cantidad / maxComunicados * 100}%` }} /></div></div>) : <p className="text-sm text-slate-500">No hay comunicados registrados.</p>}
      </div>
    </section>
  </div>;
}

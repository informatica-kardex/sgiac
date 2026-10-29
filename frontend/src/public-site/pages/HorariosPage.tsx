import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { horariosApi } from "../../api/horarios.api";
import { Horario } from "../../api/types";
import { HorarioSemanal } from "../components/HorarioSemanal";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useUserAuthStore } from "../../store/userAuthStore";

export default function HorariosPage() {
  const isAuthenticated = useUserAuthStore(s => s.isAuthenticated);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setCargando(true); setError(false);
    horariosApi.listar().then(({ data }) => setHorarios(data.data)).catch(() => setError(true)).finally(() => setCargando(false));
  }, [attempt]);
  return <div className="container-public py-14">
    <div className="mb-8"><h1 className="text-3xl font-extrabold text-slate-800">Horarios</h1><p className="mt-1 text-slate-500">Calendario semanal de clases, de lunes a sábado.</p></div>
    {isAuthenticated && <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-bold text-slate-800">Tu próxima inscripción empieza aquí</h2><p className="mt-1 text-sm text-slate-500">Elige tus materias y guarda distintas versiones de tu semana.</p></div><Link to="/usuario/arma-tu-horario" className="btn-primary">Arma tu horario →</Link></div>}
    {cargando ? <LoadingSpinner label="Cargando horarios..." /> : error ? <div role="alert"><p>No se pudieron cargar los horarios.</p><button className="btn-secondary mt-4" onClick={() => setAttempt(a => a + 1)}>Reintentar</button></div> : <HorarioSemanal horarios={horarios} />}
  </div>;
}

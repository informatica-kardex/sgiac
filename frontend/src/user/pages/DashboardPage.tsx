import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { estudiantesApi, FichaEstudiante } from "../../api/estudiantes.api";
import { comunicadosApi } from "../../api/comunicados.api";
import { Comunicado } from "../../api/types";
import { ComunicadoCard } from "../../public-site/components/ComunicadoCard";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { CampusCredits, CampusHero } from "../../public-site/components/CampusHero";
import { FichaCard } from "../components/FichaCard";
import { AvisoDocumentos } from "../components/AvisoDocumentos";
import { SemesterSchedule } from "../components/SemesterSchedule";
import "../../styles/portal-home.css";

const accesos = [
  { to: "/usuario/documentos", icon: "list", title: "Mis documentos", text: "Solicita tu récord o historial y recibe una ficha para recogerlo." },
  { to: "/usuario/fichas?solicitar=1", icon: "ticket", title: "Solicitar ficha", text: "Elige una jornada y reserva tu atención en Kardex." },
  { to: "/usuario/arma-tu-horario", icon: "calendar", title: "Arma tu horario", text: "Combina materias y guarda tus opciones para la inscripción." },
  { to: "/usuario/fichas", icon: "list", title: "Mis fichas", text: "Consulta tus turnos y el estado de tus solicitudes." },
  { to: "/usuario/faq", icon: "help", title: "¿Necesitas ayuda?", text: "Encuentra respuestas sobre trámites académicos." },
];
function AccessIcon({ name }: { name: string }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2m-8 3h2" /></> : name === "help" ? <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01" /></> : name === "list" ? <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></> : <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z" /><path d="M15 7v2m0 3v1m0 3v1" /></>}
  </svg>;
}
export default function DashboardPage() {
  const { usuario } = useAuth();
  const [fichas, setFichas] = useState<FichaEstudiante[]>([]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [fichaError, setFichaError] = useState(false);
  const [comunicadoError, setComunicadoError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.allSettled([estudiantesApi.fichas(), comunicadosApi.listar()]).then(([tickets, news]) => {
      if (!active) return;
      if (tickets.status === "fulfilled") setFichas(tickets.value.data.data); else setFichaError(true);
      if (news.status === "fulfilled") setComunicados(news.value.data.data.slice(0, 3)); else setComunicadoError(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const pendiente = fichas.find(f => ["GENERADA", "CONFIRMADA", "EN ESPERA", "LLAMADA", "REPROGRAMADA"].includes(f.estado));
  return <>
    <div className="portal-home student-home"><CampusHero student name={usuario?.nombreCompleto?.trim().split(/\s+/)[0]} /></div>
    <div className="container-public space-y-12 py-10">
      <AvisoDocumentos />
      <section aria-label="Servicios del estudiante" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{accesos.map(a => <Link to={a.to} key={a.to} className="card block p-6"><span className="student-access-icon"><AccessIcon name={a.icon} /></span><h2 className="mt-4 text-lg font-bold text-slate-800">{a.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{a.text}</p><span className="mt-4 inline-block text-sm font-semibold text-emerald-700">Ingresar →</span></Link>)}</section>
      <SemesterSchedule />
      <section><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold text-slate-800">Mi atención Kardex</h2><Link to="/usuario/fichas" className="text-sm font-semibold text-primary-700 hover:underline">Ver mis fichas →</Link></div>
        {loading ? <LoadingSpinner label="Consultando tus fichas..." /> : fichaError ? <div className="card p-6"><p className="text-sm text-slate-600">No se pudieron cargar tus fichas.</p><Link to="/usuario/fichas" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">Volver a consultar →</Link></div> : pendiente ? <FichaCard ficha={pendiente} /> : <div className="card flex flex-wrap items-center justify-between gap-5 p-6"><div><h3 className="font-bold text-slate-800">No tienes fichas pendientes</h3><p className="mt-2 text-sm text-slate-500">Cuando solicites atención, podrás seguir su estado aquí.</p></div><Link to="/usuario/fichas?solicitar=1" className="btn-primary">Solicitar una ficha</Link></div>}
      </section>
      <section><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-800">Comunicados de la carrera</h2><p className="mt-1 text-sm text-slate-500">Información para acompañar tu vida académica.</p></div><Link to="/usuario/comunicados" className="text-sm font-semibold text-primary-700 hover:underline">Ver todos →</Link></div>
        {loading ? <LoadingSpinner /> : comunicadoError ? <p className="text-sm text-slate-600">No se pudieron cargar los comunicados.</p> : comunicados.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{comunicados.map(c => <ComunicadoCard key={c.idComunicado} comunicado={c} />)}</div> : <p className="text-sm text-slate-500">No hay comunicados publicados.</p>}
      </section>
    </div>
    <div className="portal-home"><div className="container-public"><CampusCredits /></div></div>
  </>;
}

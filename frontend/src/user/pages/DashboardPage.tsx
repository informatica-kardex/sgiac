import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { estudiantesApi, FichaEstudiante } from "../../api/estudiantes.api";
import { comunicadosApi } from "../../api/comunicados.api";
import { Comunicado } from "../../api/types";
import { ComunicadoCard } from "../../public-site/components/ComunicadoCard";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { FichaCard } from "../components/FichaCard";

const accesos = [
  { to: "/usuario/fichas?solicitar=1", icon: "ticket", title: "Solicitar ficha", text: "Elige una jornada y reserva tu atención en Kardex." },
  { to: "/usuario/arma-tu-horario", icon: "calendar", title: "Arma tu horario", text: "Combina materias y guarda tus opciones para la inscripción." },
  { to: "/usuario/fichas", icon: "list", title: "Mis fichas", text: "Consulta tus turnos y el estado de tus solicitudes." },
  { to: "/usuario/faq", icon: "help", title: "¿Necesitas ayuda?", text: "Encuentra respuestas sobre trámites académicos." },
];

function AccessIcon({ name }: { name: string }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {name === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h3m3 0h3"/></> :
      name === "help" ? <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 2v1"/></> :
      name === "list" ? <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></> :
      <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M15 6v12" strokeDasharray="2 2"/></>}
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
    Promise.allSettled([estudiantesApi.fichas(), comunicadosApi.listar()]).then(([f, c]) => {
      if (!active) return;
      if (f.status === "fulfilled") setFichas(f.value.data.data); else setFichaError(true);
      if (c.status === "fulfilled") setComunicados(c.value.data.data.slice(0, 3)); else setComunicadoError(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const pendiente = fichas.find(f => ["GENERADA", "CONFIRMADA", "EN ESPERA", "LLAMADA", "REPROGRAMADA"].includes(f.estado));

  return <>
    <section className="portal-hero text-white">
      <div className="container-public student-hero-grid">
        <div className="portal-hero-copy">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-emerald-200">Tu espacio universitario</p>
          <h1 className="student-title">Hola, {usuario?.nombreCompleto?.split(" ")[0] ?? "estudiante"}<span>Bienvenido a tu portal Kardex</span></h1>
          <p className="portal-intro">Gestiona tu atención, consulta tus horarios y mantente al día con los comunicados de la carrera.</p>
          <div className="portal-hero-actions flex flex-wrap gap-3">
            <Link to="/usuario/fichas?solicitar=1" className="btn-primary portal-button-light">Solicitar ficha de atención <span aria-hidden="true">↗</span></Link>
            <Link to="/usuario/arma-tu-horario" className="btn-secondary portal-button-outline">Arma tu horario</Link>
          </div>
        </div>
        <div className="student-hero-aside">
          <img src="/images/kardex.png" alt="Kardex de la Carrera de Informática" width="640" height="640" className="mx-auto w-48" />
          <p className="text-sm text-emerald-100">Tus trámites, más cerca de ti.</p>
        </div>
      </div>
    </section>
    <div className="container-public space-y-12 py-10">
      <section aria-label="Servicios del estudiante" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accesos.map(a => <Link key={a.title} to={a.to} className="card block p-6">
          <span className="student-access-icon"><AccessIcon name={a.icon} /></span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">{a.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{a.text}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-emerald-700">Ingresar <span aria-hidden="true">→</span></span>
        </Link>)}
      </section>
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-slate-800">Mi atención Kardex</h2><Link to="/usuario/fichas" className="text-sm font-semibold text-emerald-700">Ver mis fichas →</Link></div>
        {loading ? <LoadingSpinner label="Consultando tus fichas..." /> : fichaError ? <p role="alert" className="card p-6 text-slate-600">No pudimos consultar tus fichas. <Link to="/usuario/fichas" className="underline">Volver a consultar</Link></p> : pendiente ? <FichaCard ficha={pendiente} /> :
          <div className="card flex flex-wrap items-center justify-between gap-5 p-6"><div><h3 className="font-semibold text-slate-800">No tienes fichas pendientes</h3><p className="mt-1 text-sm text-slate-500">Cuando solicites atención, podrás seguir su estado aquí.</p></div><Link to="/usuario/fichas?solicitar=1" className="btn-primary">Solicitar una ficha</Link></div>}
      </section>
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-800">Comunicados de la carrera</h2><p className="mt-1 text-sm text-slate-500">Información para acompañar tu vida académica.</p></div><Link to="/usuario/comunicados" className="text-sm font-semibold text-emerald-700">Ver todos →</Link></div>
        {loading ? <LoadingSpinner label="Cargando comunicados..." /> : comunicadoError ? <p role="alert">No se pudieron cargar los comunicados. <Link to="/usuario/comunicados" className="underline">Volver a consultar</Link></p> : comunicados.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{comunicados.map(c => <ComunicadoCard key={c.idComunicado} comunicado={c} />)}</div> : <p className="text-slate-500">No hay comunicados publicados.</p>}
      </section>
    </div>
  </>;
}

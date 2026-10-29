import { useEffect, useState } from "react";
import { comunicadosApi } from "../../api/comunicados.api";
import { Comunicado } from "../../api/types";
import { ComunicadoCard } from "../components/ComunicadoCard";
import { LoadingSpinner } from "../components/LoadingSpinner";

const CATEGORIA_TODAS = "Todas";
export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [categoria, setCategoria] = useState(CATEGORIA_TODAS);
  useEffect(() => {
    setCargando(true); setError(false);
    comunicadosApi.listar(true).then(({ data }) => setComunicados(data.data)).catch(() => setError(true)).finally(() => setCargando(false));
  }, [attempt]);
  const categorias = [CATEGORIA_TODAS, ...new Set(comunicados.map(c => c.categoria))];
  const filtrados = categoria === CATEGORIA_TODAS ? comunicados : comunicados.filter(c => c.categoria === categoria);
  return <div className="container-public py-14">
    <div className="mb-8"><h1 className="text-3xl font-extrabold text-slate-800">Comunicados</h1><p className="mt-1 text-slate-500">Información oficial publicada por la Carrera de Informática.</p></div>
    {!cargando && <div className="mb-8 flex flex-wrap gap-2">{categorias.map(c => <button key={c} onClick={() => setCategoria(c)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${categoria === c ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c}</button>)}</div>}
    {cargando ? <LoadingSpinner label="Cargando comunicados..." /> : error ? <div role="alert"><p>No se pudieron cargar los comunicados.</p><button className="btn-secondary mt-4" onClick={() => setAttempt(a => a + 1)}>Reintentar</button></div> : !filtrados.length ? <p className="text-slate-500">No hay comunicados en esta categoría.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtrados.map(c => <ComunicadoCard key={c.idComunicado} comunicado={c} />)}</div>}
  </div>;
}

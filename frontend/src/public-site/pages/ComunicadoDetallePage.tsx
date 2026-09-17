import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { comunicadosApi } from "../../api/comunicados.api";
import { Comunicado } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatFecha } from "../../utils/formatters";

export default function ComunicadoDetallePage() {
  const { id } = useParams();
  const [comunicado, setComunicado] = useState<Comunicado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    comunicadosApi
      .obtener(Number(id))
      .then(({ data }) => setComunicado(data.data))
      .catch(() => setError("No se encontró el comunicado solicitado."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <LoadingSpinner label="Cargando comunicado..." />;

  if (error || !comunicado) {
    return (
      <div className="container-public py-16 text-center">
        <p className="text-slate-500">{error || "Comunicado no encontrado."}</p>
        <Link to="/comunicados" className="mt-4 inline-block text-primary-700 hover:underline">
          ← Volver a comunicados
        </Link>
      </div>
    );
  }

  return (
    <article className="container-public max-w-3xl py-14">
      <Link to="/comunicados" className="text-sm text-primary-700 hover:underline">
        ← Volver a comunicados
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="badge bg-primary-50 text-primary-700">{comunicado.categoria}</span>
        <span className="text-sm text-slate-400">{formatFecha(comunicado.fechaPublicacion)}</span>
      </div>

      <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{comunicado.titulo}</h1>

      <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-slate-600">
        {comunicado.contenido}
      </div>

      {comunicado.adjuntos.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Archivos adjuntos</p>
          <ul className="space-y-1">
            {comunicado.adjuntos.map((adj) => (
              <li key={adj.nombre}>
                <a href={adj.url} className="text-sm text-primary-700 hover:underline">
                  📎 {adj.nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { comunicadosApi, comunicadoArchivoUrl } from "../../api/comunicados.api";
import { ComunicadoArchivo } from "../../components/ComunicadoArchivo";
import { ComunicadoDocumento } from "../../components/ComunicadoDocumento";
import { ComunicadoDescarga } from "../../components/ComunicadoDescarga";
import { ComunicadoGaleria } from "../../components/ComunicadoGaleria";
import { Comunicado } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatFecha } from "../../utils/formatters";
import { useUserAuthStore } from "../../store/userAuthStore";

export default function ComunicadoDetallePage() {
  const authenticated = useUserAuthStore(s => s.isAuthenticated);
  const { id } = useParams();
  const [comunicado, setComunicado] = useState<Comunicado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setCargando(true); setError(""); setComunicado(null);
    comunicadosApi
      .obtener(id, true)
      .then(({ data }) => setComunicado(data.data))
      .catch(() => setError("No se encontró el comunicado solicitado."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <LoadingSpinner label="Cargando comunicado..." />;

  if (error || !comunicado) {
    return (
      <div className="container-public py-16 text-center">
        <p className="text-slate-500">{error || "Comunicado no encontrado."}</p>
        <Link to={authenticated ? "/usuario/comunicados" : "/comunicados"} className="mt-4 inline-block text-primary-700 hover:underline">
          ← Volver a comunicados
        </Link>
      </div>
    );
  }

  return (
    <article className={`container-public ${comunicado.tipo === "texto" ? "max-w-4xl" : "max-w-3xl"} py-8 sm:py-14`}>
      <Link to={authenticated ? "/usuario/comunicados" : "/comunicados"} className="text-sm text-primary-700 hover:underline">← Volver a comunicados</Link>

      {comunicado.tipo === "texto" ? (
        <>
          <ComunicadoDocumento comunicado={comunicado} />
          <div className="mt-4"><ComunicadoDescarga comunicado={comunicado} /></div>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="badge bg-primary-50 text-primary-700">{comunicado.categoria}</span>
            <span className="text-sm text-slate-400">{formatFecha(comunicado.fechaPublicacion)}</span>
          </div>

          <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{comunicado.titulo}</h1>

          <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-slate-600">
            {comunicado.contenido}
          </div>
        </>
      )}

      {comunicado.tipo === "imagen" ? (
        <div className="mt-8">
          <ComunicadoGaleria imagenes={comunicado.adjuntos.filter(adj => adj.tipo.startsWith("image/"))} titulo={comunicado.titulo} descargar />
        </div>
      ) : comunicado.adjuntos.length > 0 && (
        <div className="mt-8 space-y-6">
            {comunicado.adjuntos.map((adj) => (
              <section key={adj.idAdjunto} className="space-y-3">
                <ComunicadoArchivo url={comunicadoArchivoUrl(adj.url, true)} nombre={adj.nombre} tipo={adj.tipo} />
                <ComunicadoDescarga url={comunicadoArchivoUrl(adj.url, true, true)} />
              </section>
            ))}
        </div>
      )}
    </article>
  );
}

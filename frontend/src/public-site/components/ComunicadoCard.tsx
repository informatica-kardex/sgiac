import { Link } from "react-router-dom";
import { Comunicado } from "../../api/types";
import { formatFecha } from "../../utils/formatters";
import { useUserAuthStore } from "../../store/userAuthStore";
import { comunicadoArchivoUrl } from "../../api/comunicados.api";

export function ComunicadoCard({ comunicado }: { comunicado: Comunicado }) {
  const authenticated = useUserAuthStore(s => s.isAuthenticated);
  const fecha = new Date(comunicado.fechaPublicacion);
  const fechaValida = !Number.isNaN(fecha.getTime());
  const dia = fechaValida
    ? fecha.toLocaleDateString("es-BO", { day: "2-digit" })
    : "--";
  const mes = fechaValida
    ? fecha
        .toLocaleDateString("es-BO", { month: "short" })
        .replace(".", "")
        .toUpperCase()
    : "---";
  const anio = fechaValida
    ? fecha.toLocaleDateString("es-BO", { year: "numeric" })
    : "----";

  return (
    <Link
      to={`${authenticated ? "/usuario" : ""}/comunicados/${comunicado.idComunicado}`}
      className="comunicado-card card flex flex-col p-5 transition hover:shadow-md"
    >
      <div className="comunicado-card-top mb-4 flex items-start justify-between gap-3">
        <time
          className="comunicado-card-date"
          dateTime={comunicado.fechaPublicacion}
          aria-label={`Publicado el ${formatFecha(comunicado.fechaPublicacion)}`}
        >
          <span className="comunicado-card-date-day">{dia}</span>
          <span className="comunicado-card-date-details">
            <strong>{mes}</strong>
            <small>{anio}</small>
          </span>
        </time>
        <span className="badge bg-primary-50 text-primary-700">
          {comunicado.categoria}
        </span>
      </div>
      <h3 className="mb-2 line-clamp-2 text-base font-bold text-slate-800">
        {comunicado.titulo}
      </h3>
      {comunicado.tipo === "imagen" && comunicado.adjuntos[0] && <img src={comunicadoArchivoUrl(comunicado.adjuntos[0].url, true)} alt={comunicado.titulo} loading="lazy" className="mb-4 h-48 w-full rounded-lg bg-slate-50 object-contain" />}
      {comunicado.tipo === "pdf" && <span className="mb-3 text-sm font-semibold text-red-700">Documento PDF · Ver documento</span>}
      <p className="mb-4 line-clamp-3 flex-1 text-sm text-slate-500">
        {comunicado.resumen}
      </p>
      <span
        className="comunicado-card-cta"
      >
        Ver detalle →
      </span>
    </Link>
  );
}

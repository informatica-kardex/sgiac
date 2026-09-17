import { Link } from "react-router-dom";
import { Comunicado } from "../../api/types";
import { formatFecha } from "../../utils/formatters";

export function ComunicadoCard({ comunicado }: { comunicado: Comunicado }) {
  return (
    <article className="card flex flex-col p-5 transition hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="badge bg-primary-50 text-primary-700">
          {comunicado.categoria}
        </span>
        <span className="text-xs text-slate-400">
          {formatFecha(comunicado.fechaPublicacion)}
        </span>
      </div>
      <h3 className="mb-2 line-clamp-2 text-base font-bold text-slate-800">
        {comunicado.titulo}
      </h3>
      <p className="mb-4 line-clamp-3 flex-1 text-sm text-slate-500">
        {comunicado.resumen}
      </p>
      <Link
        to={`/comunicados/${comunicado.idComunicado}`}
        className="text-sm font-semibold text-primary-700 hover:underline"
      >
        Ver detalle →
      </Link>
    </article>
  );
}

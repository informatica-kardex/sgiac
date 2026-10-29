import { Link } from "react-router-dom";
import { Comunicado } from "../../api/types";
import { formatFecha } from "../../utils/formatters";
import { useUserAuthStore } from "../../store/userAuthStore";
import { comunicadoArchivoUrl } from "../../api/comunicados.api";
import { ComunicadoDocumento, TextoConNegritas } from "../../components/ComunicadoDocumento";
import { ComunicadoPdfPreview } from "../../components/ComunicadoPdfPreview";
import { ComunicadoGaleria } from "../../components/ComunicadoGaleria";

export function ComunicadoCard({ comunicado }: { comunicado: Comunicado }) {
  const authenticated = useUserAuthStore(s => s.isAuthenticated);
  const adjunto = comunicado.adjuntos.find(archivo => comunicado.tipo === "pdf" ? archivo.tipo === "application/pdf" : archivo.tipo.startsWith("image/"));
  const imagenes = comunicado.adjuntos.filter(archivo => archivo.tipo.startsWith("image/"));
  const carrusel = comunicado.tipo === "imagen" && imagenes.length > 1;
  const destino = `${authenticated ? "/usuario" : ""}/comunicados/${comunicado.idComunicado}`;
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

  const contenido = <>
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
        {carrusel ? <Link to={destino} className="hover:underline">{comunicado.titulo}</Link> : comunicado.titulo}
      </h3>
      <div className="comunicado-card-preview">
        {comunicado.tipo === "texto" && <ComunicadoDocumento comunicado={comunicado} miniatura />}
        {comunicado.tipo === "imagen" && <ComunicadoGaleria imagenes={imagenes} titulo={comunicado.titulo} compact />}
        {comunicado.tipo === "pdf" && <ComunicadoPdfPreview url={adjunto ? comunicadoArchivoUrl(adjunto.url, true) : undefined} titulo={comunicado.titulo} />}
      </div>
      <p className="mb-4 line-clamp-3 flex-1 text-sm text-slate-500">
        <TextoConNegritas texto={comunicado.resumen} />
      </p>
      {carrusel ? <Link to={destino} className="comunicado-card-cta">Ver detalle →</Link> : <span className="comunicado-card-cta">Ver detalle →</span>}
  </>;
  const className = "comunicado-card card flex flex-col p-5 transition hover:shadow-md";
  return carrusel ? <article className={className}>{contenido}</article> : <Link to={destino} className={className}>{contenido}</Link>;
}

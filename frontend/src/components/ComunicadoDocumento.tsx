import { useId } from "react";
import type { Comunicado } from "../api/types";
import { formatFecha } from "../utils/formatters";
import { fragmentosNegrita } from "../utils/comunicadoTexto";
import "../styles/comunicado-documento.css";

type Documento = Pick<Comunicado, "titulo" | "contenido" | "categoria" | "fechaPublicacion">;

// El contenido se mantiene como texto de React: no se interpreta HTML del autor.
export function TextoConNegritas({ texto }: { texto: string }) {
  return <>{fragmentosNegrita(texto).map((fragmento, parte) => (
    fragmento.bold ? <strong key={parte}>{fragmento.text}</strong> : fragmento.text
  ))}</>;
}

function TextoFormateado({ contenido }: { contenido: string }) {
  return contenido.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean).map((parrafo, index) => (
    <p key={index}><TextoConNegritas texto={parrafo} /></p>
  ));
}

export function ComunicadoDocumento({ comunicado, miniatura = false }: { comunicado: Documento; miniatura?: boolean }) {
  const tituloId = useId();
  const Titulo = miniatura ? "p" : "h1";

  return (
    <section className={`comunicado-documento${miniatura ? " comunicado-documento--miniatura" : ""}`} aria-labelledby={miniatura ? undefined : tituloId} aria-hidden={miniatura || undefined}>
      <div className="comunicado-documento-membrete">
        <img className="comunicado-documento-logo" src="/images/kardex.png" alt="Kardex" width={640} height={640} />
        <div className="comunicado-documento-institucion">
          <p className="comunicado-documento-universidad">Universidad Mayor de San Andrés</p>
          <p className="comunicado-documento-facultad">Facultad de Ciencias Puras y Naturales</p>
          <p className="comunicado-documento-carrera">Carrera de Informática</p>
          <p className="comunicado-documento-ciudad">La Paz · Bolivia</p>
        </div>
        <img className="comunicado-documento-logo" src="/images/informatica-umsa.png" alt="Carrera de Informática — UMSA" width={640} height={640} />
      </div>

      <div className="comunicado-documento-cuerpo">
        <img className="comunicado-documento-marca" src="/images/informatica-umsa.png" alt="" aria-hidden="true" width={640} height={640} />
        <span className="comunicado-documento-lateral" aria-hidden="true">Carrera de Informática · UMSA</span>

        <div className="comunicado-documento-meta">
          <span className="comunicado-documento-categoria">{comunicado.categoria}</span>
          <time dateTime={comunicado.fechaPublicacion}>La Paz, {formatFecha(comunicado.fechaPublicacion)}</time>
        </div>

        <div className="comunicado-documento-titular">
          <p className="comunicado-documento-etiqueta">Comunicado</p>
          <Titulo id={tituloId} className="comunicado-documento-titulo">{comunicado.titulo}</Titulo>
          <span className="comunicado-documento-separador" aria-hidden="true" />
        </div>

        <div className="comunicado-documento-texto">
          <TextoFormateado contenido={comunicado.contenido} />
        </div>

        <div className="comunicado-documento-emisor">
          <p>Kardex</p>
          <span>Carrera de Informática</span>
        </div>
      </div>

      <div className="comunicado-documento-pie">
        <span>Carrera de Informática</span>
        <span>UMSA · La Paz, Bolivia</span>
      </div>
    </section>
  );
}

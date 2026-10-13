import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { crearHorariosPdf } from '../../utils/horarioPdf';

export interface HorariosPdfSnapshot {
  horarios: string[];
  titulo: string;
  nombre: string;
}

export function HorariosPdfPreview({ snapshot, onClose }: { snapshot: HorariosPdfSnapshot; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false, objectUrl = '';
    setUrl(''); setError('');
    void crearHorariosPdf(snapshot.horarios, snapshot.titulo).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {
      if (!cancelled) setError('No se pudo generar la vista previa. Inténtalo de nuevo.');
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [snapshot, attempt]);

  return createPortal(<dialog ref={dialog} className="schedule-preview" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="schedule-preview-content">
      <header className="schedule-preview-header">
        <div><h2 id={titleId}>Vista previa · {snapshot.titulo}</h2><p>{snapshot.horarios.length} {snapshot.horarios.length === 1 ? 'aula' : 'aulas'} · Carta vertical · Dos horarios por hoja</p></div>
        <button type="button" className="btn-secondary" onClick={onClose} autoFocus aria-label="Cerrar vista previa">Cerrar</button>
      </header>
      {url ? <>
        <iframe className="schedule-preview-frame" src={`${url}#toolbar=1&view=FitH`} title={`PDF: ${snapshot.titulo}`} />
        <footer className="schedule-preview-footer">
          <p>Revisa el PDF y usa el icono de impresora del visor cuando esté listo.</p>
          <div><a className="btn-secondary" href={url} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña</a><a className="btn-primary" href={url} download={snapshot.nombre}>Descargar PDF</a></div>
        </footer>
      </> : <div className="schedule-preview-status">
        {error ? <><p role="alert">{error}</p><button type="button" className="btn-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></> : <p role="status">Generando vista previa del PDF…</p>}
      </div>}
    </div>
  </dialog>, document.body);
}

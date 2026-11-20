import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LocationPublication as Publication, ubicacionApi } from '../../api/ubicacion.api';
import { usePolling, mensajeError } from '../../hooks/usePolling';
import { horariosPublicacionApi } from '../../api/horarios.api';

export function LocationPublication({ tipo = 'ubicacion' }: { tipo?: 'ubicacion' | 'horarios' }) {
  const api = tipo === 'horarios' ? horariosPublicacionApi : ubicacionApi;
  const label = tipo === 'horarios' ? 'horarios' : 'ubicación';
  const {data:polled,loading,error,refresh} = usePolling(api.configuracion,60000);
  const [saved,setSaved] = useState<Publication | null>(null);
  const data = saved && (!polled || (saved.actualizadoEn ?? '') >= (polled.actualizadoEn ?? '')) ? saved : polled;
  const [busy,setBusy] = useState(false), [saveError,setSaveError] = useState(''), [message,setMessage] = useState('');
  async function toggle(audience: 'publico' | 'estudiantes') {
    if (!data || busy) return;
    const value = !data[audience];
    setBusy(true); setSaveError(''); setMessage('');
    try {
      setSaved(await api.publicar({publico:data.publico,estudiantes:data.estudiantes,[audience]:value}));
      setMessage(`${value ? (tipo === 'horarios' ? 'Horarios publicados' : 'Ubicación publicada') : 'Publicación retirada'} ${audience === 'publico' ? 'en el portal público' : 'en el portal del estudiante'}.`);
      refresh();
    } catch(e) { setSaveError(mensajeError(e)); }
    finally { setBusy(false); }
  }
  return <section className="location-publication" aria-label={`Publicación de ${label}`}>
    <div><h2>Publicar {label}</h2><p>{tipo === 'horarios' ? 'Elige dónde se pueden consultar los horarios de las aulas. En el portal público aparecen en Horarios y ubicación, tanto en el buscador como al pulsar un aula del plano.' : 'Comparte los planos de todos los pisos. En el portal público aparecen en Horarios y ubicación; publica también los horarios desde Horarios para consultarlos al pulsar un aula. En el portal del estudiante, cada aula abre su horario de consulta.'}</p></div>
    {loading ? <p role="status">Consultando publicación…</p> : error ? <p role="alert">{error} <button type="button" className="btn-secondary" onClick={refresh}>Reintentar publicación</button></p> : data && <div className="location-publication-options">
      {(['publico','estudiantes'] as const).map(audience => <div key={audience}><span>{audience === 'publico' ? 'Portal público' : 'Portal del estudiante'}</span><strong>{data[audience] ? 'Publicado' : 'Sin publicar'}</strong>
        <button type="button" className={data[audience] ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={() => void toggle(audience)}>{data[audience] ? 'Retirar' : 'Publicar'} en {audience === 'publico' ? 'portal público' : 'portal del estudiante'}</button>
        {data[audience] && <Link to={audience === 'publico' ? '/horarios' : `/usuario/${tipo}`} target="_blank" rel="noreferrer">Abrir {audience === 'publico' ? 'horarios y ubicación' : label} ↗</Link>}
      </div>)}
    </div>}
    {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}{message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;
}

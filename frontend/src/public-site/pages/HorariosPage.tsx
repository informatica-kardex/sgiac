import { useCallback, useState } from 'react';
import { estudiantesApi } from '../../api/estudiantes.api';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { RoomSchedule } from '../../admin/components/RoomSchedule';
import { selectedRooms } from '../../admin/schedule/room-selection';
import { semesterSessions } from '../../admin/schedule/semester';
import { usePolling } from '../../hooks/usePolling';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HorarioSearch, type SugerenciaHorario } from '../components/HorarioSearch';
import '../../styles/student-schedules.css';
import { SchedulePeopleSearch } from '../../admin/components/SchedulePeopleSearch';

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]/g, '');
const palabras = (s: string) => s.trim().split(/\s+/).map(normalizar).filter(Boolean);

export default function HorariosPage() {
  const load = useCallback(async () => (await estudiantesApi.horariosAulas()).data.data, []);
  const { data, loading, error, refresh, updatedAt } = usePolling(load, 30000);
  const today = useBoliviaDate();
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<SugerenciaHorario | null>(null);
  function buscar(value: string) { setBusqueda(value); setSeleccion(null); }
  const terminos = palabras(busqueda);
  const periodos = data?.periodos ?? [];
  const periodo = periodos.find(p => p.fechaInicio <= today && p.fechaFin >= today)
    ?? [...periodos].filter(p => p.fechaInicio > today).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))[0]
    ?? [...periodos].sort((a, b) => b.fechaFin.localeCompare(a.fechaFin))[0];
  const horarios = data?.horarios ?? [];
  // Comparte el orden del administrador: Informática (subsuelo, PB, pisos), LASIN y los demás lugares.
  const aulas = selectedRooms(data?.aulas ?? [], '', '')
    .sort((a, b) => Number(b.codigo.startsWith('SS-')) - Number(a.codigo.startsWith('SS-')));
  const coincide = (value: string) => terminos.every(t => normalizar(value).includes(t));
  const filas = periodo ? aulas.map(a => ({ aula: a, sesiones: semesterSessions(horarios, a.codigo, periodo, today) })) : [];
  const opciones = new Map<string, Omit<SugerenciaHorario, 'aulas'> & { codigos: Set<string> }>();
  function sugerir(tipo: SugerenciaHorario['tipo'], valor: string, texto: string, categoria: string, detalle: string, aula: string) {
    if (!valor.trim()) return;
    const id = `${tipo}:${valor}`, existente = opciones.get(id);
    if (existente) existente.codigos.add(aula);
    else opciones.set(id, { id, tipo, valor, texto, categoria, detalle, codigos: new Set([aula]) });
  }
  for (const { aula, sesiones } of filas) {
    sugerir('aula', aula.codigo, aula.codigo, 'Aula', `${LUGARES[aula.lugar ?? ''] || 'Ubicación por confirmar'} · ${pisoLabel(aula.piso)}`, aula.codigo);
    for (const h of sesiones) {
      sugerir('materia', h.codigoMateria, h.materia, 'Materia', h.siglas.join(' / ') || h.codigoMateria, aula.codigo);
      const nombre = h.responsable || h.docente;
      sugerir('persona', nombre, nombre, h.esAuxiliar || h.idAuxiliar ? 'Auxiliar' : h.esCoordinacion ? 'Coordinación' : 'Docente', 'Ver sus clases y aulas', aula.codigo);
    }
  }
  const sugerencias = [...opciones.values()].filter(s => coincide([s.texto, s.valor, s.detalle].join(' ')))
    .sort((a, b) => Number(normalizar(b.texto) === normalizar(busqueda)) - Number(normalizar(a.texto) === normalizar(busqueda)))
    .slice(0, 7).map(({ codigos, ...s }) => ({ ...s, aulas: codigos.size }));
  const visibles = filas.map(({ aula: a, sesiones }) => {
    const aulaCoincide = seleccion ? seleccion.tipo === 'aula' && seleccion.valor === a.codigo : coincide(a.codigo);
    const coincidencias = sesiones.filter(h => seleccion ?
      seleccion.tipo === 'materia' ? h.codigoMateria === seleccion.valor : seleccion.tipo === 'persona' ? (h.responsable || h.docente) === seleccion.valor : aulaCoincide :
      coincide([a.codigo, h.materia, h.codigoMateria, ...h.siglas, h.responsable || h.docente].join(' ')));
    return { aula: a, sesiones, mostrar: aulaCoincide || coincidencias.length > 0,
      destacados: terminos.length && !aulaCoincide ? new Set(coincidencias.map(h => h.idHorario)) : undefined };
  }).filter(a => a.mostrar);
  return <div className="container-public student-schedules">
    <div className="student-schedules-intro">
      <h1>HORARIOS</h1>
    </div>
    <HorarioSearch value={busqueda} onChange={buscar} onSelect={s => { setSeleccion(s); setBusqueda(s.texto); }} sugerencias={error || loading ? [] : sugerencias} />
    <SchedulePeopleSearch horarios={horarios} periodo={periodo?.idPeriodo ?? ''} today={today} disabled={loading || Boolean(error)} onRoom={buscar} />
    <div className="student-schedules-status">
      <p aria-live="polite">{loading ? 'Consultando horarios…' : error ? 'Horarios no disponibles' : periodo ? `${visibles.length} ${visibles.length === 1 ? 'aula' : 'aulas'} · Periodo ${periodo.periodo}/${periodo.gestion}` : 'Sin periodo académico activo'}</p>
      <button className="btn-secondary" onClick={refresh}>Actualizar horarios</button>
    </div>
    {!!terminos.length && !error && <p className="student-schedules-hint">Se muestran los horarios completos de las aulas que coinciden. Las clases encontradas se resaltan en la tabla.</p>}
    {loading ? <LoadingSpinner label="Cargando horarios…" /> : error ?
      <div className="student-schedules-empty" role="alert"><h2>No se pudieron actualizar los horarios</h2><p>Vuelve a consultar para ver la información vigente.</p><button className="btn-secondary" onClick={refresh}>Reintentar</button></div> : !periodo ?
      <div className="student-schedules-empty"><h2>No hay un periodo académico activo</h2><p>Los horarios aparecerán aquí cuando Kardex habilite el periodo.</p></div> : !visibles.length ?
      <div className="student-schedules-empty"><h2>{aulas.length ? 'No se encontraron aulas, materias o docentes' : 'Todavía no hay aulas registradas'}</h2>{busqueda && <><p>Prueba el nombre del docente, la materia, su sigla o el código del aula.</p><button className="btn-secondary" onClick={() => buscar('')}>Mostrar todas las aulas</button></>}</div> :
      <div className="student-schedules-rooms">{visibles.map(({ aula, sesiones, destacados }) => {
        const materias = [...new Map(sesiones.map(h => [h.codigoMateria, { nombre: h.materia, siglas: h.siglas.join(' / ') || h.codigoMateria }])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        return <article className="student-schedules-room" key={aula.codigo} aria-label={`Aula ${aula.codigo}`}>
          <div className="student-schedules-room-heading"><div><h2>Aula {aula.codigo}</h2><p>{LUGARES[aula.lugar ?? ''] || 'Ubicación por confirmar'} · {pisoLabel(aula.piso)}</p></div><span>{periodo.periodo}/{periodo.gestion}</span></div>
          {!sesiones.length && <p className="student-schedules-hint">Sin clases ni reservas asignadas para este periodo.</p>}
          <p className="student-schedules-mobile-hint">Desliza la tabla para ver todos los días.</p>
          <div className="student-schedules-table" tabIndex={0} role="region" aria-label={`Tabla semanal del aula ${aula.codigo}`}>
            <RoomSchedule aula={aula} periodo={periodo} horarios={horarios} today={today} highlightIds={destacados} />
          </div>
          {!!materias.length && <ul className="student-schedules-subject-key" aria-label={`Materias del aula ${aula.codigo}`}>{materias.map(m => <li key={m.siglas}><strong>{m.siglas}</strong> {m.nombre}</li>)}</ul>}
        </article>;
      })}</div>}
    <p className="student-schedules-footer">Hora de Bolivia · Actualización automática cada 30 segundos{updatedAt && !error ? ` · Consultado a las ${updatedAt.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' })}` : ''}</p>
  </div>;
}

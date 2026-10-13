import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LUGARES, Periodo, pisoLabel } from '../../api/academico.api';
import { Aula, HorarioAcademico } from '../../api/types';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { puedeAccederModulo } from '../../utils/roles';
import { RoomAssignmentRequest, roomAssignmentUrl } from '../schedule/room-assignment';
import { EMPTY_ROOM_SEARCH, RoomSearchFilters, roomSearchDay, searchRooms } from '../schedule/room-search';
import { scheduleDays } from '../schedule/semester';
import { ErrorNotice, Field } from './AcademicoUI';
import { Modal } from './Modal';
import '../../styles/room-search.css';

export function RoomSearch({ aulas, horarios, periodos, periodo, disabled, error, refresh, onSelect, onAssign, actionLabel = 'Ver horario' }: {
  aulas: Aula[]; horarios: HorarioAcademico[]; periodos: Periodo[]; periodo?: string; disabled: boolean; error: string;
  refresh: () => Promise<void>; onSelect: (aula: Aula, periodo: string) => void; actionLabel?: string;
  onAssign?: (request: RoomAssignmentRequest) => void;
}) {
  const navigate = useNavigate();
  const { usuario } = useAdminAuth();
  const canAssign = puedeAccederModulo(usuario?.roles ?? [], 'horarios', usuario?.permisos);
  const [open, setOpen] = useState(false), [filters, setFilters] = useState<RoomSearchFilters>({ ...EMPTY_ROOM_SEARCH });
  const [searchPeriod, setSearchPeriod] = useState('');
  const today = useBoliviaDate();
  const [showSmaller, setShowSmaller] = useState(false), [showUnknown, setShowUnknown] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null);
  const { adequate, smaller, unknown, combinations, requested, invalidCapacity, availabilityError, checkingAvailability, occupiedCount } = searchRooms(aulas, filters, { horarios, periodos, periodId: searchPeriod, today });
  const availablePeriods = periodos.filter(p => p.estado === 'ACTIVO' && p.fechaFin >= today);
  const selectedPeriod = availablePeriods.find(p => p.idPeriodo === searchPeriod);
  function show() {
    setSearchPeriod(availablePeriods.find(p => p.idPeriodo === (periodo || searchPeriod))?.idPeriodo ?? availablePeriods.find(p => p.fechaInicio <= today)?.idPeriodo ?? availablePeriods[0]?.idPeriodo ?? '');
    setOpen(true); void refresh();
  }
  function update<K extends keyof RoomSearchFilters>(key: K, value: RoomSearchFilters[K]) { setFilters(f => ({ ...f, [key]: value })); }
  function reset() { setFilters({ ...EMPTY_ROOM_SEARCH }); setShowSmaller(false); setShowUnknown(false); }
  function select(a: Aula) { setOpen(false); onSelect(a, searchPeriod); }
  function assign(rooms: Aula[]) {
    if (!canAssign || !selectedPeriod || rooms.some(a => a.estado !== 'disponible')) return;
    const request: RoomAssignmentRequest = { aulas: rooms.map(a => a.codigo), periodo: searchPeriod,
      ...(checkingAvailability && !availabilityError ? { dia: filters.day as RoomAssignmentRequest['dia'], inicio: filters.start, fin: filters.end, fecha: filters.date } : {}) };
    setOpen(false);
    if (onAssign) onAssign(request); else navigate(roomAssignmentUrl(request));
  }
  useEffect(() => {
    if (!open) return;
    const dialog = content.current?.closest('[role="dialog"]');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); trigger.current?.focus({ preventScroll: true }); };
  }, [open]);
  const count = adequate.length + (showSmaller ? smaller.length : 0) + (requested === null || showUnknown ? unknown.length : 0);
  function cards(rooms: Aula[], kind: 'adequate' | 'smaller' | 'unknown') {
    return <div className="room-search-results">{rooms.map(a => {
      const difference = requested === null ? 0 : a.capacidad - requested;
      return <article className={`room-search-result room-search-result--${kind}`} key={a.codigo} data-room-code={a.codigo}>
        <div className="room-search-result-top"><div><span className="room-search-kind">{a.tipo === 'LABORATORIO' ? 'Laboratorio' : a.tipo === 'AULA' ? 'Aula' : a.tipo}</span><h4>{a.codigo}</h4>{a.nombre !== a.codigo && <p className="room-search-name">{a.nombre}</p>}</div>
          <div className="room-search-capacity">{kind === 'unknown' ? <span>Por confirmar</span> : <><strong>{a.capacidad}</strong><span>plazas</span></>}</div>
        </div>
        {requested !== null && <p className={`room-search-fit room-search-fit--${kind}`}>{kind === 'unknown' ? 'Falta confirmar si alcanza para el grupo' : kind === 'smaller' ? `Capacidad insuficiente: faltan ${-difference} plazas` : difference === 0 ? 'Capacidad exacta para tu grupo' : `${difference} plazas adicionales para tu grupo`}</p>}
        <p className="room-search-location">{LUGARES[a.lugar ?? ''] ?? 'Lugar por confirmar'} · {pisoLabel(a.piso)}</p>
        {a.ubicacion && <p className="room-search-location">{a.ubicacion}</p>}
        <div className="room-search-result-footer"><span className={`room-search-state ${a.estado !== 'disponible' ? 'room-search-state--unavailable' : ''}`}>{a.estado === 'disponible' ? checkingAvailability ? 'Libre en el horario consultado' : 'Habilitada' : a.estado === 'mantenimiento' ? 'En mantenimiento' : 'Inhabilitada'}</span>
          <button type="button" className="btn-secondary" aria-label={`${actionLabel} ${a.codigo}`} onClick={() => select(a)}>{actionLabel} <span aria-hidden="true">↗</span></button>
          {canAssign && <button type="button" className="btn-primary" disabled={!selectedPeriod || a.estado !== 'disponible'} aria-label={`Asignar aula ${a.codigo}`} onClick={() => assign([a])}>Asignar aula ↗</button>}
        </div>
      </article>;
    })}</div>;
  }
  return <>
    <button ref={trigger} type="button" className="btn-secondary room-search-trigger" disabled={disabled} onClick={show}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" strokeLinecap="round" /></svg>Buscar aula
    </button>
    <Modal title="Buscar aula según tus necesidades" open={open} onClose={() => setOpen(false)} size="wide">
      <div ref={content} className="room-search">
        <p className="room-search-intro">Busca por capacidad, día y horario. Si tu grupo necesita más espacio, te sugerimos varias aulas cercanas para distribuir el examen.</p>
        <div className="room-search-filters">
          <Field label="Cantidad de estudiantes"><input autoFocus type="number" min={1} max={2000} step={1} inputMode="numeric" className="input-field" placeholder="Ej. 30" value={filters.students} aria-invalid={invalidCapacity} onChange={e => update('students', e.target.value)} /></Field>
          <Field label="Tipo de ambiente"><select className="select-field" value={filters.type} onChange={e => update('type', e.target.value)}><option value="">Aulas y laboratorios</option><option value="AULA">Aula</option><option value="LABORATORIO">Laboratorio</option></select></Field>
          <Field label="Lugar de búsqueda"><select className="select-field" value={filters.place} onChange={e => update('place', e.target.value)}><option value="">Todos los lugares</option>{Object.entries(LUGARES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
          <div className="room-search-query"><Field label="Nombre o código del aula"><input type="search" className="input-field" placeholder="Ej. LASIN, P3-LAB2…" value={filters.query} onChange={e => update('query', e.target.value)} /></Field></div>
          <Field label="Periodo de búsqueda"><select className="select-field" value={searchPeriod} onChange={e => setSearchPeriod(e.target.value)}><option value="">Selecciona un periodo</option>{availablePeriods.map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>
        </div>
        <fieldset className="room-search-time"><legend>Disponibilidad (opcional)</legend><div className="room-search-time-fields">
          <Field label="Día de búsqueda"><select className="select-field" value={filters.day} onChange={e => setFilters(f => ({ ...f, day: e.target.value, date: '' }))}><option value="">Selecciona un día</option>{scheduleDays.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
          <Field label="Hora de inicio"><input type="time" min="07:00" max="22:00" className="input-field" value={filters.start} onChange={e => update('start', e.target.value)} /></Field>
          <Field label="Hora de fin"><input type="time" min="07:00" max="22:00" className="input-field" value={filters.end} onChange={e => update('end', e.target.value)} /></Field>
          <Field label="Fecha del examen (opcional)"><input type="date" min={selectedPeriod && selectedPeriod.fechaInicio > today ? selectedPeriod.fechaInicio : today} max={selectedPeriod?.fechaFin} className="input-field" value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value, day: e.target.value ? roomSearchDay(e.target.value) : f.day }))} /></Field>
          <p className="room-search-time-help">Sin fecha se consideran las clases y todas las reservas vigentes del día elegido durante el periodo. Con fecha se comprueba ese día específico.</p>
        </div></fieldset>
        <div className="room-search-options"><label><input type="checkbox" checked={checkingAvailability || filters.enabledOnly} disabled={checkingAvailability} onChange={e => update('enabledOnly', e.target.checked)} /><span>Solo ambientes habilitados</span></label><button type="button" className="btn-ghost" onClick={reset}>Limpiar búsqueda</button></div>
        {error ? <ErrorNotice message={error} retry={() => void refresh()} /> : disabled ? <p role="status" className="room-search-empty">Actualizando aulas y horarios…</p> : invalidCapacity || availabilityError ? <p role="alert" className="room-search-empty">{invalidCapacity ? 'Indica una cantidad entera entre 1 y 2000 estudiantes.' : availabilityError}</p> : <>
          <div role="status" className="room-search-summary">{requested === null ? `${count} ${count === 1 ? 'ambiente encontrado' : 'ambientes encontrados'}` : `${adequate.length} ${adequate.length === 1 ? 'ambiente' : 'ambientes'} con capacidad suficiente para ${requested} ${requested === 1 ? 'estudiante' : 'estudiantes'}`}{requested !== null && <span>Primero las capacidades iguales o más cercanas que alcanzan para todo el grupo.</span>}
            <span>{checkingAvailability ? `${occupiedCount} ${occupiedCount === 1 ? 'ambiente ocupado excluido' : 'ambientes ocupados excluidos'}. La disponibilidad se comprueba nuevamente al asignar el horario.` : 'Indica día y horas para comprobar cuáles están libres.'}</span>
          </div>
          {adequate.length > 0 && <section aria-label="Resultados de aulas"><h4 className="room-search-section-title">{requested === null ? 'Ambientes con capacidad registrada' : 'Opciones para tu grupo'}</h4>{cards(adequate, 'adequate')}</section>}
          {adequate.length === 0 && <p className="room-search-empty">{requested === null ? 'No hay ambientes con capacidad registrada para estos filtros.' : combinations.length ? 'Ningún aula por sí sola alcanza para tu grupo. Puedes distribuirlo en estas aulas cercanas.' : 'No hay un aula ni una combinación cercana con capacidad suficiente. Prueba otro horario, tipo o lugar.'}</p>}
          {combinations.length > 0 && <section aria-label="Combinaciones de aulas para examen"><h4 className="room-search-section-title">Varias aulas para tu examen</h4><p className="room-search-note">Primero en el mismo piso, luego en pisos contiguos del mismo edificio. Solo se combinan aulas con capacidad y piso confirmados.</p><div className="room-search-results">{combinations.map((option, index) => <article className="room-search-combination" key={option.rooms.map(a => a.codigo).join('|')} data-room-codes={option.rooms.map(a => a.codigo).join('|')}>
            <div className="room-search-result-top"><div><span className="room-search-kind">Opción {index + 1}</span><h4>{option.rooms.length} aulas cercanas</h4></div><div className="room-search-capacity"><strong>{option.capacity}</strong><span>plazas en total</span></div></div>
            <p className="room-search-location">{LUGARES[option.rooms[0].lugar!] ?? option.rooms[0].lugar} · {option.minFloor === option.maxFloor ? `${pisoLabel(option.minFloor)} · mismo piso` : `${pisoLabel(option.minFloor)} y ${pisoLabel(option.maxFloor)} · pisos contiguos`}</p>
            <p className="room-search-fit">{option.capacity - requested!} plazas adicionales para {requested} estudiantes</p>
            <ul>{option.rooms.map(a => <li key={a.codigo}><div><strong>{a.codigo}</strong><span>{pisoLabel(a.piso)} · {a.capacidad} plazas</span></div><button type="button" className="btn-secondary" aria-label={`${actionLabel} ${a.codigo}`} onClick={() => select(a)}>{actionLabel} ↗</button></li>)}</ul>
            <p className="room-search-state">{checkingAvailability ? 'Todas libres en el horario consultado' : 'Indica día y horas para comprobar disponibilidad'}</p>
            {canAssign && <><button type="button" className="btn-primary" disabled={!selectedPeriod} aria-label={`Asignar aulas ${option.rooms.map(a => a.codigo).join(', ')}`} onClick={() => assign(option.rooms)}>Asignar estas {option.rooms.length} aulas ↗</button><p className="room-search-note">Abre cada horario y asigna su materia y responsable. Se conservarán las aulas seleccionadas.</p></>}
          </article>)}</div></section>}
          {requested !== null && (smaller.length > 0 || unknown.length > 0) && <div className="room-search-alternatives">
            {smaller.length > 0 && <label><input type="checkbox" checked={showSmaller} onChange={e => setShowSmaller(e.target.checked)} /><span>Ver capacidades menores ({smaller.length})</span></label>}
            {unknown.length > 0 && <label><input type="checkbox" checked={showUnknown} onChange={e => setShowUnknown(e.target.checked)} /><span>Ver capacidades por confirmar ({unknown.length})</span></label>}
          </div>}
          {showSmaller && smaller.length > 0 && <section aria-label="Aulas con capacidad insuficiente"><h4 className="room-search-section-title">Capacidades menores · de la más cercana a la más pequeña</h4>{cards(smaller, 'smaller')}</section>}
          {(requested === null || showUnknown) && unknown.length > 0 && <section aria-label="Aulas con capacidad por confirmar"><h4 className="room-search-section-title">Capacidad por confirmar</h4><p className="room-search-note">Estos ambientes aún no tienen capacidad registrada. Confírmala antes de elegirlos para el grupo.</p>{cards(unknown, 'unknown')}</section>}
        </>}
      </div>
    </Modal>
  </>;
}

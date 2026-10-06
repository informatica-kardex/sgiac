import { useEffect, useRef, useState } from 'react';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { Aula } from '../../api/types';
import { EMPTY_ROOM_SEARCH, RoomSearchFilters, normalizeRoomText, roomEquipment, searchRooms } from '../schedule/room-search';
import { Field } from './AcademicoUI';
import { Modal } from './Modal';
import '../../styles/room-search.css';

export function RoomSearch({ aulas, disabled, onSelect, actionLabel = 'Ver horario' }: {
  aulas: Aula[]; disabled: boolean; onSelect: (aula: Aula) => void; actionLabel?: string;
}) {
  const [open, setOpen] = useState(false), [filters, setFilters] = useState<RoomSearchFilters>({ ...EMPTY_ROOM_SEARCH });
  const [showSmaller, setShowSmaller] = useState(false), [showUnknown, setShowUnknown] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null);
  const { adequate, smaller, unknown, requested, invalidCapacity } = searchRooms(aulas, filters);
  const equipment = [...new Map(aulas.flatMap(a => roomEquipment(a).map(e => [normalizeRoomText(e.nombre), e.nombre] as const))).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  function update<K extends keyof RoomSearchFilters>(key: K, value: RoomSearchFilters[K]) { setFilters(f => ({ ...f, [key]: value })); }
  function reset() { setFilters({ ...EMPTY_ROOM_SEARCH }); setShowSmaller(false); setShowUnknown(false); }
  function select(a: Aula) { setOpen(false); onSelect(a); }
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
      const inventory = roomEquipment(a), difference = requested === null ? 0 : a.capacidad - requested;
      return <article className={`room-search-result room-search-result--${kind}`} key={a.codigo} data-room-code={a.codigo}>
        <div className="room-search-result-top"><div><span className="room-search-kind">{a.tipo === 'LABORATORIO' ? 'Laboratorio' : a.tipo === 'AULA' ? 'Aula' : a.tipo}</span><h4>{a.codigo}</h4>{a.nombre !== a.codigo && <p className="room-search-name">{a.nombre}</p>}</div>
          <div className="room-search-capacity">{kind === 'unknown' ? <span>Por confirmar</span> : <><strong>{a.capacidad}</strong><span>plazas</span></>}</div>
        </div>
        {requested !== null && <p className={`room-search-fit room-search-fit--${kind}`}>{kind === 'unknown' ? 'Falta confirmar si alcanza para el grupo' : kind === 'smaller' ? `Capacidad insuficiente: faltan ${-difference} plazas` : difference === 0 ? 'Capacidad exacta para tu grupo' : `${difference} plazas adicionales para tu grupo`}</p>}
        <p className="room-search-location">{LUGARES[a.lugar ?? ''] ?? 'Lugar por confirmar'} · {pisoLabel(a.piso)}</p>
        {a.ubicacion && <p className="room-search-location">{a.ubicacion}</p>}
        <div className="room-search-equipment"><span>Equipamiento registrado</span>{inventory.length ? <ul>{inventory.map((e, i) => <li key={`${e.nombre}-${i}`}>{e.nombre} <strong>× {e.cantidad}</strong></li>)}</ul> : <p>Sin equipamiento registrado</p>}</div>
        <div className="room-search-result-footer"><span className={`room-search-state ${a.estado !== 'disponible' ? 'room-search-state--unavailable' : ''}`}>{a.estado === 'disponible' ? 'Habilitada' : a.estado === 'mantenimiento' ? 'En mantenimiento' : 'Inhabilitada'}</span>
          <button type="button" className="btn-secondary" aria-label={`${actionLabel} ${a.codigo}`} onClick={() => select(a)}>{actionLabel} <span aria-hidden="true">↗</span></button>
        </div>
      </article>;
    })}</div>;
  }
  return <>
    <button ref={trigger} type="button" className="btn-secondary room-search-trigger" disabled={disabled} onClick={() => setOpen(true)}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" strokeLinecap="round" /></svg>Buscar aula
    </button>
    <Modal title="Buscar aula según tus necesidades" open={open} onClose={() => setOpen(false)} size="wide">
      <div ref={content} className="room-search">
        <p className="room-search-intro">Encuentra un aula o laboratorio para tu grupo en todos los edificios. Abre su horario para comprobar los espacios libres.</p>
        <div className="room-search-filters">
          <Field label="Cantidad de estudiantes"><input autoFocus type="number" min={1} max={2000} step={1} inputMode="numeric" className="input-field" placeholder="Ej. 30" value={filters.students} aria-invalid={invalidCapacity} onChange={e => update('students', e.target.value)} /></Field>
          <Field label="Tipo de ambiente"><select className="select-field" value={filters.type} onChange={e => update('type', e.target.value)}><option value="">Aulas y laboratorios</option><option value="AULA">Aula</option><option value="LABORATORIO">Laboratorio</option></select></Field>
          <Field label="Equipamiento necesario"><select className="select-field" value={filters.equipment} onChange={e => update('equipment', e.target.value)}><option value="">Cualquier equipamiento</option>{equipment.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
          <Field label="Lugar de búsqueda"><select className="select-field" value={filters.place} onChange={e => update('place', e.target.value)}><option value="">Todos los lugares</option>{Object.entries(LUGARES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
          <div className="room-search-query"><Field label="Nombre, código o equipamiento"><input type="search" className="input-field" placeholder="Ej. LASIN, P3-Lab4, proyector…" value={filters.query} onChange={e => update('query', e.target.value)} /></Field></div>
        </div>
        <div className="room-search-options"><label><input type="checkbox" checked={filters.enabledOnly} onChange={e => update('enabledOnly', e.target.checked)} /><span>Solo ambientes habilitados</span></label><button type="button" className="btn-ghost" onClick={reset}>Limpiar búsqueda</button></div>
        {invalidCapacity ? <p role="alert" className="room-search-empty">Indica una cantidad entera entre 1 y 2000 estudiantes.</p> : <>
          <div role="status" className="room-search-summary">{requested === null ? `${count} ${count === 1 ? 'ambiente encontrado' : 'ambientes encontrados'}` : `${adequate.length} ${adequate.length === 1 ? 'ambiente' : 'ambientes'} con capacidad suficiente para ${requested} ${requested === 1 ? 'estudiante' : 'estudiantes'}`}{requested !== null && <span>Primero las capacidades iguales o más cercanas que alcanzan para todo el grupo.</span>}</div>
          {adequate.length > 0 && <section aria-label="Resultados de aulas"><h4 className="room-search-section-title">{requested === null ? 'Ambientes con capacidad registrada' : 'Opciones para tu grupo'}</h4>{cards(adequate, 'adequate')}</section>}
          {adequate.length === 0 && <p className="room-search-empty">{requested === null ? 'No hay ambientes con capacidad registrada para estos filtros.' : 'No hay aulas con capacidad suficiente para estos filtros. Prueba otro tipo, equipamiento o lugar.'}</p>}
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

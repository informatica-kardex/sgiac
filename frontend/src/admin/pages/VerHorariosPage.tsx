import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { pisoLabel } from '../../api/academico.api';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { puedeAccederModulo } from '../../utils/roles';
import { AcademicHeader, Empty, ErrorNotice, Field, useAcademico } from '../components/AcademicoUI';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { RoomSchedule } from '../components/RoomSchedule';
import { RoomPicker } from '../components/RoomPicker';
import { RoomSearch } from '../components/RoomSearch';

export default function VerHorariosPage() {
  const c = useAcademico();
  const { usuario } = useAdminAuth();
  const canEdit = puedeAccederModulo(usuario?.roles ?? [], 'horarios', usuario?.permisos);
  const [lugar, setLugar] = useState<string | null>(null), [piso, setPiso] = useState<string | null>(''), [aula, setAula] = useState('');
  const [printMode, setPrintMode] = useState<'filtered' | 'selected'>('filtered');
  const [periodo, setPeriodo] = useState('');
  const today = useBoliviaDate();
  const period = c.periodos.find(p => p.idPeriodo === periodo);
  useEffect(() => { if (!periodo && c.periodos.length) setPeriodo((c.periodos.find(p => p.estado === 'ACTIVO') ?? c.periodos[0]).idPeriodo); }, [c.periodos, periodo]);

  useEffect(() => { document.body.classList.add('print-room-schedules'); return () => document.body.classList.remove('print-room-schedules'); }, []);
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [aula]);
  useLayoutEffect(() => {
    // A long teacher name or several reservations can grow a table. Fit each
    // complete table into its half-page without hiding or cutting any session.
    const fit = () => {
      // Printed tables may already be fragmented; measure the unpaginated,
      // hidden print copy while screen media is active, then keep that size.
      if (window.matchMedia('print').matches) return;
      document.querySelectorAll<HTMLElement>('.horarios-print-root .room-schedule').forEach(room => {
        room.style.setProperty('--schedule-print-density', '1');
        const table = room.querySelector('table');
        if (!table || !room.clientHeight) return;
        let density = 1;
        for (let attempt = 0; attempt < 6; attempt++) {
          const height = table.getBoundingClientRect().height;
          if (height <= room.clientHeight - 1) break;
          density *= (room.clientHeight - 1) / height * .98;
          room.style.setProperty('--schedule-print-density', String(density));
        }
      });
    };
    fit();
    window.addEventListener('beforeprint', fit);
    return () => window.removeEventListener('beforeprint', fit);
  }, [c.horarios, c.aulas, c.periodos, c.loading, c.error, periodo, lugar, piso, aula, today, printMode]);
  const placeRooms = c.aulas.filter(a => lugar !== null && (!lugar || a.lugar === lugar));
  const rooms = placeRooms.filter(a => piso !== null && (!piso || String(a.piso) === piso)).sort((a, b) => (a.lugar ?? '').localeCompare(b.lugar ?? '', 'es') || (a.piso ?? -99) - (b.piso ?? -99) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const visible = aula ? rooms.filter(a => aula === a.codigo) : lugar === '' ? rooms : [];
  const printRooms = printMode === 'selected' ? visible : rooms;
  const pages = Array.from({ length: Math.ceil(printRooms.length / 2) }, (_, i) => printRooms.slice(i * 2, i * 2 + 2));
  const ready = Boolean(period && rooms.length && !c.loading && !c.error);
  function print(mode: 'filtered' | 'selected') { flushSync(() => setPrintMode(mode)); window.print(); }
  function selectPlace(place: string) { setLugar(place); setPiso(place === 'INFORMATICA' ? null : ''); setAula(''); setPrintMode('filtered'); }
  function selectRoom(code: string) { setAula(code); setPrintMode('selected'); }
  function backToRooms() { setAula(''); setPrintMode('filtered'); }
  const periodControl = <Field label="Periodo académico"><select className="select-field" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="">Selecciona</option>{c.periodos.map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}{p.estado !== 'ACTIVO' ? ' (inactivo)' : ''}</option>)}</select></Field>;
  return <div className="space-y-6">
    <AcademicHeader title="Ver Horarios" description="Elige un lugar, selecciona un aula y consulta su horario del semestre.">
      <RoomSearch aulas={c.aulas} disabled={c.loading || Boolean(c.error)} onSelect={a => { setLugar(a.lugar ?? ''); setPiso(String(a.piso)); selectRoom(a.codigo); }} />
      <button className="btn-secondary" disabled={!ready} onClick={() => print('filtered')}>Imprimir / PDF{rooms.length > 0 ? ` · ${rooms.length} ${rooms.length === 1 ? 'aula' : 'aulas'}` : ''}</button>
      {aula && visible.length > 0 && <button className="btn-primary" disabled={!ready} onClick={() => print('selected')}>Imprimir aula {aula}</button>}
    </AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />
    {!aula ? <RoomPicker aulas={c.aulas} lugar={lugar} piso={piso} includeAll loading={c.loading} periodControl={periodControl}
      onPlace={selectPlace} onFloor={floor => { setPiso(floor); setPrintMode('filtered'); }} onRoom={selectRoom} />
      : <div className="flex flex-wrap items-end justify-between gap-3"><button className="btn-secondary" onClick={backToRooms}>{lugar === '' ? '← Volver a todos los horarios' : '← Volver a las aulas'}</button>{periodControl}</div>}
    {!c.loading && !c.error && lugar === '' && !rooms.length && <Empty>No hay aulas registradas para mostrar sus horarios.</Empty>}
    {!c.loading && !c.error && visible.length > 0 && !period && <Empty>Selecciona un periodo para ver el horario del aula.</Empty>}
    {!c.loading && !c.error && period && visible.map(a => <article className="card p-5" key={a.codigo}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold text-slate-800">{a.nombre} <span className="font-normal text-slate-500">· {a.codigo}</span></h2>
        <p className="mt-1 text-sm text-slate-600">Capacidad: {a.capacidad > 0 ? `${a.capacidad} personas` : 'Por confirmar'} · {a.tipo === 'LABORATORIO' ? 'Laboratorio' : a.tipo === 'AULA' ? 'Aula' : a.tipo} · {pisoLabel(a.piso)} · {a.estado}</p>
        {a.ubicacion && <p className="mt-1 text-xs text-slate-500">{a.ubicacion}</p>}
        <p className="mt-1 text-xs text-slate-500">Equipamiento: {a.equipamiento?.length ? a.equipamiento.map(e => `${e.nombre} (${e.cantidad})`).join(', ') : 'Sin equipamiento registrado'}</p></div>
        <div className="flex flex-wrap gap-2">{!aula && <button className="btn-secondary" aria-label={`Abrir horario de ${a.codigo}`} onClick={() => selectRoom(a.codigo)}>Abrir aula</button>}
          {canEdit && period.estado === 'ACTIVO' && <Link className="btn-secondary" to={`/admin/horarios?${new URLSearchParams({ aula: a.codigo, periodo })}`}>Modificar horario</Link>}
        </div>
      </div><div className="mt-3 overflow-x-auto"><RoomSchedule aula={a} periodo={period} today={today} horarios={c.horarios} /></div>
    </article>)}
    {lugar !== null && <p className="text-xs text-slate-500">Imprime o guarda como PDF: dos horarios por hoja carta vertical. Las reservas muestran su fecha de uso y desaparecen al finalizar ese día, según la hora de Bolivia.</p>}
    {createPortal(<div className="horarios-print-root">{ready && period && pages.map((page, i) => <div className="schedule-print-page" key={i}>{page.map(a => <RoomSchedule key={a.codigo} aula={a} periodo={period} today={today} horarios={c.horarios} />)}</div>)}</div>, document.body)}
  </div>;
}

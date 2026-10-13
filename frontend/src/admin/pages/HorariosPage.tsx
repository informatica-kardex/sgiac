import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { academicoApi } from '../../api/academico.api';
import { horariosApi } from '../../api/horarios.api';
import { Aula, DiaSemana, HorarioAcademico as Horario } from '../../api/types';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from '../components/AcademicoUI';
import { HorarioForm, ScheduleSeed, dayFromDate, plusDays, minutes } from '../components/HorarioForm';
import { RoomSchedule } from '../components/RoomSchedule';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { semesterSessions } from '../schedule/semester';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RoomPicker } from '../components/RoomPicker';
import { RoomSearch } from '../components/RoomSearch';
import { RoomScheduleHeader } from '../components/RoomScheduleHeader';
import { RoomAssignmentRequest, readRoomAssignment } from '../schedule/room-assignment';
import { scheduleDays } from '../schedule/semester';
export default function HorariosPage() {
  const c = useAcademico();
  const [params] = useSearchParams();
  const initialSelection = useRef(false);
  const assignmentPanel = useRef<HTMLElement>(null);
  const [periodo, setPeriodo] = useState(''), [lugar, setLugar] = useState(''), [piso, setPiso] = useState<string | null>(''), [aula, setAula] = useState('');
  const today = useBoliviaDate();
  const [seed, setSeed] = useState<ScheduleSeed | null>(null), [remove, setRemove] = useState<Horario | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selection, setSelection] = useState<RoomAssignmentRequest | null>(null), [completed, setCompleted] = useState<string[]>([]);
  const [periodOpen, setPeriodOpen] = useState(false), [newPeriod, setNewPeriod] = useState({ gestion: new Date().getFullYear(), periodo:'II', fechaInicio:'', fechaFin:'' });
  const period = c.periodos.find(p => p.idPeriodo === periodo);
  useEffect(() => {
    if (initialSelection.current || c.loading || c.error) return;
    initialSelection.current = true;
    const room = c.aulas.find(a => a.codigo === params.get('aula'));
    if (room) { setLugar(room.lugar ?? ''); setPiso(String(room.piso)); setAula(room.codigo); }
    setPeriodo(c.periodos.find(p => p.idPeriodo === params.get('periodo') && p.estado === 'ACTIVO')?.idPeriodo ?? c.periodos.find(p => p.estado === 'ACTIVO')?.idPeriodo ?? '');
    if (params.get('asignar') === '1') startAssignment(readRoomAssignment(params));
  }, [c.loading, c.error, c.aulas, c.periodos, params]);

  useEffect(() => { setError(''); }, [periodo, lugar, piso, aula]);
  useLayoutEffect(() => {
    if (selection) assignmentPanel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [aula, selection]);
  const selectedRoom = c.aulas.find(a => a.codigo === aula);
  const visible = period ? semesterSessions(c.horarios, aula, period, today) : [];
  const canCreate = Boolean(selectedRoom?.estado === 'disponible' && period?.estado === 'ACTIVO' && !c.loading && !c.error);
  function selectRoom(room: Aula) { setLugar(room.lugar ?? ''); setPiso(String(room.piso)); setAula(room.codigo); }
  function startAssignment(request: RoomAssignmentRequest) {
    const rooms = request.aulas.filter(code => c.aulas.some(a => a.codigo === code));
    if (!rooms.length || !c.periodos.some(p => p.idPeriodo === request.periodo && p.estado === 'ACTIVO')) return;
    setSelection({ ...request, aulas: rooms }); setCompleted([]); setPeriodo(request.periodo);
    selectRoom(c.aulas.find(a => a.codigo === rooms[0])!);
  }
  function suggestedDate(day: DiaSemana) {
    let date = period && today < period.fechaInicio ? period.fechaInicio : today;
    for (let n = 0; n < 7 && dayFromDate(date) !== day; n++) date = plusDays(date, 1);
    return period && date <= period.fechaFin ? date : '';
  }
  function create(day?: DiaSemana, hour?: number) {
    if (!canCreate) return;
    const context = selection?.aulas.includes(aula) ? selection : null;
    const dia = day ?? context?.dia ?? 'LUNES';
    const hora = hour ?? (context?.inicio ? minutes(context.inicio) / 60 : 8);
    const searchedSlot = Boolean(context?.inicio && dia === context.dia && hora === minutes(context.inicio) / 60);
    setError(''); setSeed({ aula, dia, fecha: context?.fecha && dia === context.dia ? context.fecha : suggestedDate(dia), hora,
      horaFin: searchedSlot ? context?.fin : undefined, unaSesion: Boolean(context), temporal: Boolean(context?.fecha) });
  }
  function edit(h: Horario) { setError(''); setSeed({ aula: h.aula, dia: h.dia, fecha: h.fecha ?? suggestedDate(h.dia), hora: Number(h.horaInicio.slice(0,2)), editing: h }); }
  async function saved(rooms: string[]) {
    if (selection && !seed?.editing) {
      const done = [...new Set([...completed, ...rooms.filter(code => selection.aulas.includes(code))])];
      setCompleted(done);
      const next = selection.aulas.find(code => !done.includes(code));
      const nextRoom = c.aulas.find(a => a.codigo === next);
      if (nextRoom) selectRoom(nextRoom);
    }
    setSeed(null); await c.cargar();
  }
  async function destroy() {
    if (!remove) return; setBusy(true); setError('');
    try { await horariosApi.eliminar(remove.idHorario); setRemove(null); setSeed(null); await c.cargar(); }
    catch (e) { setRemove(null); setSeed(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function createPeriod(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const response = await academicoApi.crearPeriodo(newPeriod); setPeriodo(response.data.data.idPeriodo); setSelection(null); setCompleted([]); setPeriodOpen(false); setAula(''); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const periodControl = <Field label="Periodo académico"><select className="select-field" value={periodo} onChange={e => { setPeriodo(e.target.value); setSelection(null); setCompleted([]); }}><option value="">Selecciona</option>{c.periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>;
  return <div className="space-y-6"><AcademicHeader title="Horarios" description="Consulta el horario de cada aula y programa clases, auxiliarías o reservas para fechas específicas."><RoomSearch aulas={c.aulas} horarios={c.horarios} periodos={c.periodos} periodo={periodo} disabled={c.loading || Boolean(c.error)} error={c.error} refresh={c.cargar} onAssign={startAssignment} onSelect={(a, idPeriodo) => { setSelection(null); setCompleted([]); if (idPeriodo) setPeriodo(idPeriodo); selectRoom(a); }} /><button className="btn-secondary" onClick={() => { setError(''); setPeriodOpen(true); }}>+ Periodo</button><button className="btn-primary" disabled={!canCreate} onClick={() => create()}>+ Asignar horario</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!periodOpen && <ErrorNotice message={error} />}
    {!aula ? <RoomPicker aulas={c.aulas} lugar={lugar} piso={piso} loading={c.loading} periodControl={periodControl}
      onPlace={place => { setLugar(place); setPiso(place === 'INFORMATICA' ? null : ''); }} onFloor={setPiso} onRoom={setAula} />
      : <div className="flex flex-wrap items-end justify-between gap-3"><button className="btn-secondary" onClick={() => { setAula(''); setSelection(null); setCompleted([]); }}>← Volver a las aulas</button>{periodControl}</div>}
    {selection && <section ref={assignmentPanel} className="room-assignment-plan" aria-label="Aulas seleccionadas para asignar">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Asignar {selection.aulas.length === 1 ? 'aula' : `${selection.aulas.length} aulas`}</h2><button type="button" className="btn-ghost" onClick={() => { setSelection(null); setCompleted([]); }}>Cerrar selección</button></div>
      {selection.dia && <p>{scheduleDays.find(d => d.key === selection.dia)?.label} · {selection.inicio}–{selection.fin} · {selection.fecha || 'Clase semanal'}</p>}
      <div className="flex flex-wrap gap-2">{selection.aulas.map(code => <button type="button" key={code} className={aula === code ? 'btn-primary' : 'btn-secondary'} aria-pressed={aula === code} onClick={() => { const room = c.aulas.find(a => a.codigo === code); if (room) selectRoom(room); }}>{code} · {completed.includes(code) ? 'Guardada' : 'Pendiente'}</button>)}</div>
      <p role="status">{completed.length === selection.aulas.length ? 'Se guardaron horarios en todas las aulas seleccionadas.' : `${completed.length} de ${selection.aulas.length} aulas guardadas.`}</p>
      <details><summary>Cómo completar la asignación</summary><p>Revisa el horario y pulsa «Asignar en esta aula» para elegir la materia y el docente.</p>{selection.aulas.length > 1 && <p>Cada aula se guarda por separado. Al guardar, pasarás a la siguiente pendiente. Para usarlas a la misma hora, asigna responsables y paralelos distintos; un docente o paralelo no puede ocupar dos aulas simultáneamente.</p>}</details>
    </section>}
    {aula && (c.loading ? <LoadingSpinner /> : !selectedRoom || !period ? <Empty>Selecciona un periodo activo y un aula disponible para consultar el horario.</Empty> : <section className="space-y-4" aria-label={`Horario del aula ${aula}`}>
      <RoomScheduleHeader aula={selectedRoom} periodo={period}><button className="btn-primary" disabled={!canCreate} onClick={() => create()}>Asignar en esta aula</button></RoomScheduleHeader>
      <p className="text-xs text-slate-500">{visible.length} sesiones del semestre y reservas vigentes</p>
      {selectedRoom.estado !== 'disponible' && <p className="text-sm text-amber-700">El aula está {selectedRoom.estado}. Solo puedes consultar o retirar sus sesiones.</p>}
      <div className="card overflow-x-auto"><RoomSchedule aula={selectedRoom} periodo={period} horarios={c.horarios} today={today} onCreate={canCreate ? create : undefined} onEdit={edit} /></div>
      <p className="text-xs text-slate-500">Haz clic en un espacio para asignar o en una sesión para editarla. Las clases se repiten todo el semestre. Las reservas muestran “RESERVADO” y la fecha de uso; desaparecen del horario al terminar ese día. AUX identifica las auxiliarías.</p>
    </section>)}
    {seed && <HorarioForm c={c} periodo={periodo} seed={seed} close={() => setSeed(null)} saved={saved} remove={setRemove} />}
    <Modal open={periodOpen} title="Nuevo periodo académico" onClose={() => !busy && setPeriodOpen(false)}><form className="space-y-4" onSubmit={createPeriod}><ErrorNotice message={error} /><Field label="Gestión"><input type="number" required min={2000} max={2100} className="input-field" value={newPeriod.gestion} onChange={e => setNewPeriod({ ...newPeriod, gestion:Number(e.target.value) })} /></Field><Field label="Periodo"><select className="select-field" value={newPeriod.periodo} onChange={e => setNewPeriod({ ...newPeriod, periodo:e.target.value })}>{['I','II','ANUAL','VERANO'].map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Fecha de inicio"><input type="date" required className="input-field" value={newPeriod.fechaInicio} onChange={e => setNewPeriod({ ...newPeriod, fechaInicio:e.target.value })} /></Field><Field label="Fecha de fin"><input type="date" required min={newPeriod.fechaInicio} className="input-field" value={newPeriod.fechaFin} onChange={e => setNewPeriod({ ...newPeriod, fechaFin:e.target.value })} /></Field><SaveActions busy={busy} close={() => setPeriodOpen(false)} /></form></Modal>
    <ConfirmDialog open={Boolean(remove)} title="Eliminar sesión" message={`¿Retirar ${remove?.materia}${remove?.fecha ? ` del ${remove.fecha}` : ` de los ${remove?.dia}`} de ${remove?.horaInicio} a ${remove?.horaFin}? Solo se eliminará esta sesión.`} onCancel={() => setRemove(null)} onConfirm={destroy} loading={busy} />
  </div>;
}

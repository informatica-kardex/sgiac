import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { academicoApi, LUGARES, pisoLabel } from '../../api/academico.api';
import { horariosApi } from '../../api/horarios.api';
import { DiaSemana, HorarioAcademico as Horario } from '../../api/types';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from '../components/AcademicoUI';
import { HorarioForm, ScheduleSeed, dayFromDate, plusDays } from '../components/HorarioForm';
import { RoomSchedule } from '../components/RoomSchedule';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { semesterSessions } from '../schedule/semester';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RoomPicker } from '../components/RoomPicker';
import { RoomSearch } from '../components/RoomSearch';
export default function HorariosPage() {
  const c = useAcademico();
  const [params] = useSearchParams();
  const initialSelection = useRef(false);
  const [periodo, setPeriodo] = useState(''), [lugar, setLugar] = useState(''), [piso, setPiso] = useState<string | null>(''), [aula, setAula] = useState('');
  const today = useBoliviaDate();
  const [seed, setSeed] = useState<ScheduleSeed | null>(null), [remove, setRemove] = useState<Horario | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false), [newPeriod, setNewPeriod] = useState({ gestion: new Date().getFullYear(), periodo:'II', fechaInicio:'', fechaFin:'' });
  const period = c.periodos.find(p => p.idPeriodo === periodo);
  useEffect(() => {
    if (initialSelection.current || c.loading || c.error) return;
    initialSelection.current = true;
    const room = c.aulas.find(a => a.codigo === params.get('aula'));
    if (room) { setLugar(room.lugar ?? ''); setPiso(String(room.piso)); setAula(room.codigo); }
    setPeriodo(c.periodos.find(p => p.idPeriodo === params.get('periodo') && p.estado === 'ACTIVO')?.idPeriodo ?? c.periodos.find(p => p.estado === 'ACTIVO')?.idPeriodo ?? '');
  }, [c.loading, c.error, c.aulas, c.periodos, params]);

  useEffect(() => { setError(''); }, [periodo, lugar, piso, aula]);
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [aula]);
  const selectedRoom = c.aulas.find(a => a.codigo === aula);
  const visible = period ? semesterSessions(c.horarios, aula, period, today) : [];
  const canCreate = Boolean(selectedRoom?.estado === 'disponible' && period?.estado === 'ACTIVO' && !c.loading && !c.error);
  function suggestedDate(day: DiaSemana) {
    let date = period && today < period.fechaInicio ? period.fechaInicio : today;
    for (let n = 0; n < 7 && dayFromDate(date) !== day; n++) date = plusDays(date, 1);
    return period && date <= period.fechaFin ? date : '';
  }
  function create(day: DiaSemana = 'LUNES', hour = 8) {
    if (!canCreate) return;
    setError(''); setSeed({ aula, dia: day, fecha: suggestedDate(day), hora: hour });
  }
  function edit(h: Horario) { setError(''); setSeed({ aula: h.aula, dia: h.dia, fecha: h.fecha ?? suggestedDate(h.dia), hora: Number(h.horaInicio.slice(0,2)), editing: h }); }
  async function saved() { setSeed(null); await c.cargar(); }
  async function destroy() {
    if (!remove) return; setBusy(true); setError('');
    try { await horariosApi.eliminar(remove.idHorario); setRemove(null); setSeed(null); await c.cargar(); }
    catch (e) { setRemove(null); setSeed(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function createPeriod(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const response = await academicoApi.crearPeriodo(newPeriod); setPeriodo(response.data.data.idPeriodo); setPeriodOpen(false); setAula(''); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const periodControl = <Field label="Periodo académico"><select className="select-field" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="">Selecciona</option>{c.periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>;
  return <div className="space-y-6"><AcademicHeader title="Horarios" description="Consulta el horario de cada aula y programa clases, auxiliarías o reservas para fechas específicas."><RoomSearch aulas={c.aulas} disabled={c.loading || Boolean(c.error)} onSelect={a => { setLugar(a.lugar ?? ''); setPiso(String(a.piso)); setAula(a.codigo); }} /><button className="btn-secondary" onClick={() => { setError(''); setPeriodOpen(true); }}>+ Periodo</button><button className="btn-primary" disabled={!canCreate} onClick={() => create()}>+ Asignar horario</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!periodOpen && <ErrorNotice message={error} />}
    {!aula ? <RoomPicker aulas={c.aulas} lugar={lugar} piso={piso} loading={c.loading} periodControl={periodControl}
      onPlace={place => { setLugar(place); setPiso(place === 'INFORMATICA' ? null : ''); }} onFloor={setPiso} onRoom={setAula} />
      : <div className="flex flex-wrap items-end justify-between gap-3"><button className="btn-secondary" onClick={() => setAula('')}>← Volver a las aulas</button>{periodControl}</div>}
    {aula && (c.loading ? <LoadingSpinner /> : !selectedRoom || !period ? <Empty>Selecciona un periodo activo y un aula disponible para consultar el horario.</Empty> : <section className="space-y-4" aria-label={`Horario del aula ${aula}`}>
      <div><h2 className="text-lg font-bold text-slate-800">{selectedRoom.nombre} <span className="ml-2 text-sm font-normal text-slate-400">{aula}</span></h2><p className="mt-1 text-xs text-slate-500">{LUGARES[lugar] ?? 'Lugar por confirmar'} · {pisoLabel(selectedRoom.piso)} · {visible.length} sesiones del semestre y reservas vigentes</p><p className="mt-2 text-sm text-slate-600">{selectedRoom.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Aula'} · Capacidad: {selectedRoom.capacidad > 0 ? `${selectedRoom.capacidad} personas` : 'Por confirmar'}</p><p className="mt-1 text-xs text-slate-500">Equipamiento: {selectedRoom.equipamiento?.filter(e => e.cantidad > 0).length ? selectedRoom.equipamiento.filter(e => e.cantidad > 0).map(e => `${e.nombre} (${e.cantidad})`).join(', ') : 'Sin equipamiento registrado'}</p></div>
      {selectedRoom.estado !== 'disponible' && <p className="text-sm text-amber-700">El aula está {selectedRoom.estado}. Solo puedes consultar o retirar sus sesiones.</p>}
      <div className="card overflow-x-auto"><RoomSchedule aula={selectedRoom} periodo={period} horarios={c.horarios} today={today} onCreate={canCreate ? create : undefined} onEdit={edit} /></div>
      <p className="text-xs text-slate-500">Haz clic en un espacio para asignar o en una sesión para editarla. Las clases se repiten todo el semestre. Las reservas muestran “RESERVADO” y la fecha de uso; desaparecen del horario al terminar ese día. AUX identifica las auxiliarías.</p>
    </section>)}
    {seed && <HorarioForm c={c} periodo={periodo} seed={seed} close={() => setSeed(null)} saved={saved} remove={setRemove} />}
    <Modal open={periodOpen} title="Nuevo periodo académico" onClose={() => !busy && setPeriodOpen(false)}><form className="space-y-4" onSubmit={createPeriod}><ErrorNotice message={error} /><Field label="Gestión"><input type="number" required min={2000} max={2100} className="input-field" value={newPeriod.gestion} onChange={e => setNewPeriod({ ...newPeriod, gestion:Number(e.target.value) })} /></Field><Field label="Periodo"><select className="select-field" value={newPeriod.periodo} onChange={e => setNewPeriod({ ...newPeriod, periodo:e.target.value })}>{['I','II','ANUAL','VERANO'].map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Fecha de inicio"><input type="date" required className="input-field" value={newPeriod.fechaInicio} onChange={e => setNewPeriod({ ...newPeriod, fechaInicio:e.target.value })} /></Field><Field label="Fecha de fin"><input type="date" required min={newPeriod.fechaInicio} className="input-field" value={newPeriod.fechaFin} onChange={e => setNewPeriod({ ...newPeriod, fechaFin:e.target.value })} /></Field><SaveActions busy={busy} close={() => setPeriodOpen(false)} /></form></Modal>
    <ConfirmDialog open={Boolean(remove)} title="Eliminar sesión" message={`¿Retirar ${remove?.materia}${remove?.fecha ? ` del ${remove.fecha}` : ` de los ${remove?.dia}`} de ${remove?.horaInicio} a ${remove?.horaFin}? Solo se eliminará esta sesión.`} onCancel={() => setRemove(null)} onConfirm={destroy} loading={busy} />
  </div>;
}

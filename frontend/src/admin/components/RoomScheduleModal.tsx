import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { horariosApi } from '../../api/horarios.api';
import { DiaSemana, HorarioAcademico } from '../../api/types';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { useAdminAuthStore } from '../../store/adminAuthStore';
import { puedeAccederModulo } from '../../utils/roles';
import { Empty, ErrorNotice, Field, errorAcademico, useAcademico } from './AcademicoUI';
import { HorarioForm, ScheduleSeed, dayFromDate, minutes, plusDays } from './HorarioForm';
import { Modal } from './Modal';
import { RoomSchedule } from './RoomSchedule';

/** Keep the map mounted while its schedule and the existing assignment form open. */
export function RoomScheduleModal({ c, codigo, close }: {
  c: ReturnType<typeof useAcademico>; codigo: string; close: () => void;
}) {
  const today = useBoliviaDate();
  const usuario = useAdminAuthStore(state => state.usuario);
  const canManage = puedeAccederModulo(usuario?.roles ?? [], 'horarios', usuario?.permisos);
  const [periodo, setPeriodo] = useState(() => c.periodos.find(p => p.estado === 'ACTIVO' && p.fechaInicio <= today && p.fechaFin >= today)?.idPeriodo
    ?? c.periodos.find(p => p.estado === 'ACTIVO')?.idPeriodo ?? '');
  const [seed, setSeed] = useState<ScheduleSeed | null>(null);
  const [remove, setRemove] = useState<HorarioAcademico | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const room = c.aulas.find(a => a.codigo === codigo);
  const period = c.periodos.find(p => p.idPeriodo === periodo && p.estado === 'ACTIVO');
  const canEdit = canManage && Boolean(period) && !c.loading && !c.error;
  const canCreate = canEdit && room?.estado === 'disponible';
  // Even the form's notification refresh must preserve the map and its scroll.
  const refresh = useCallback(() => c.cargar(true), [c.cargar]);
  const context = { ...c, cargar: refresh };

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      const dialog = [...(container.current?.querySelectorAll<HTMLElement>('[role="dialog"]') ?? [])].find(el => el.getClientRects().length);
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        // The existing form decides whether it can close while saving.
        dialog.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.click();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]')]
        .filter(el => !el.matches(':disabled') && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement || previousFocus instanceof SVGElement) previousFocus.focus({ preventScroll:true });
    };
  }, []);
  const mode = remove ? 'remove' : seed && canManage ? 'form' : 'schedule';
  useLayoutEffect(() => {
    const dialog = [...(container.current?.querySelectorAll<HTMLElement>('[role="dialog"]') ?? [])].find(el => el.getClientRects().length);
    dialog?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.focus({preventScroll:true});
  }, [mode]);

  function suggestedDate(day: DiaSemana) {
    let date = period && today < period.fechaInicio ? period.fechaInicio : today;
    for (let n = 0; n < 7 && dayFromDate(date) !== day; n++) date = plusDays(date,1);
    return period && date <= period.fechaFin ? date : '';
  }
  function create(dia: DiaSemana = 'LUNES', hora = 8) {
    if (!canCreate) return;
    setError(''); setMessage(''); setSeed({aula:codigo,dia,hora,fecha:suggestedDate(dia)});
  }
  function edit(h: HorarioAcademico) {
    if (!canEdit) return;
    setError(''); setMessage('');
    setSeed({aula:h.aula,dia:h.dia,fecha:h.fecha ?? suggestedDate(h.dia),hora:minutes(h.horaInicio)/60,horaFin:h.horaFin,context:h,blank:true,temporal:true,unaSesion:true});
  }
  async function saved() {
    await refresh(); setSeed(null); setMessage('Horario guardado. Puedes seguir consultando esta aula o volver al mapa.');
  }
  async function destroy() {
    if (!remove || busy || !canEdit) return;
    setBusy(true); setError('');
    try {
      const result = await horariosApi.eliminar(remove.idHorario);
      await refresh(); setRemove(null); setSeed(null);
      setMessage(['Sesión eliminada.', ...(result.data.data?.avisos ?? [])].join(' '));
    } catch(e) { setError(errorAcademico(e)); }
    finally { setBusy(false); }
  }
  return <div ref={container} data-room-schedule-modal={codigo}>
    <div hidden={Boolean(remove)}>
      {seed && canManage ? <HorarioForm c={context} periodo={periodo} seed={seed} close={() => setSeed(null)} saved={saved}
        remove={h => { setError(''); setRemove(h); }} /> :
      <Modal open size="wide" title={`Horario del aula ${codigo}`} onClose={close}>
        <div className="space-y-4">
          <ErrorNotice message={c.error} retry={() => void refresh()} /><ErrorNotice message={error} />
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {room ? <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm font-medium text-slate-700">{LUGARES[room.lugar ?? ''] ?? 'Lugar por confirmar'} · {pisoLabel(room.piso)}</p>{room.nombre !== codigo && <p className="mt-1 text-sm text-slate-500">{room.nombre}</p>}</div>
              <Field label="Periodo académico"><select className="select-field" value={period?.idPeriodo ?? ''} onChange={e => { setPeriodo(e.target.value); setError(''); setMessage(''); }}><option value="">Selecciona un periodo</option>{c.periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{canManage ? 'Pulsa una casilla para asignar, o una sesión para ver sus opciones.' : 'Consulta del horario del aula.'}</p><button type="button" className="btn-primary" disabled={!canCreate} onClick={() => create()}>Asignar en esta aula</button></div>
            {!canManage && <p className="text-sm text-slate-500">Tu permiso permite consultar las aulas. Para asignar necesitas acceso a Horarios.</p>}
            {room.estado !== 'disponible' && <p className="text-sm text-amber-700">El aula está {room.estado}. No se pueden crear asignaciones en esta aula.</p>}
            {!period ? <Empty>No hay un periodo activo seleccionado para consultar el horario.</Empty> : <>
              <p className="text-xs text-slate-500 sm:hidden">Desliza la tabla para ver todos los días.</p>
              <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={`Tabla semanal del aula ${codigo}`}><RoomSchedule aula={room} periodo={period} horarios={c.horarios} today={today} onCreate={canCreate ? create : undefined} onEdit={canEdit ? edit : undefined} /></div>
            </>}
          </> : <Empty>Esta aula ya no está registrada.</Empty>}
          <div className="flex justify-end border-t border-slate-100 pt-3"><button type="button" className="btn-secondary" onClick={close}>Volver al mapa</button></div>
        </div>
      </Modal>}
    </div>
    <Modal open={Boolean(remove)} title="Eliminar sesión" onClose={() => !busy && setRemove(null)}>
      <div className="space-y-4"><p className="text-sm text-slate-600">¿Retirar {remove?.materia}{remove?.fecha ? ` del ${remove.fecha}` : ` de los ${remove?.dia}`} de {remove?.horaInicio} a {remove?.horaFin}? Solo se eliminará esta sesión.</p><ErrorNotice message={error} />
        <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setRemove(null)}>Cancelar</button><button type="button" className="btn-danger" disabled={busy || !canEdit} onClick={() => void destroy()}>{busy ? 'Eliminando…' : 'Eliminar'}</button></div>
      </div>
    </Modal>
  </div>;
}

import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ubicacionApi } from '../../api/ubicacion.api';
import { horariosPublicacionApi } from '../../api/horarios.api';
import { BuildingLocations } from '../../components/BuildingMap';
import { RoomCapacity } from '../../components/RoomCapacity';
import { hasRoomLocation, INFORMATICA_PLANS } from '../../components/informatica-plans';
import { RoomSchedule } from '../../admin/components/RoomSchedule';
import { Modal } from '../../admin/components/Modal';
import { pisoLabel } from '../../api/academico.api';
import { usePolling } from '../../hooks/usePolling';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ScheduleBrowser, type PublishedScheduleQuery } from './HorariosPage';
import '../../styles/student-schedules.css';

export default function UbicacionPage({ student = false }: { student?: boolean }) {
  return student ? <LocationPortal student /> : <PublicSchedulesLocations />;
}

export function LegacyLocationRedirect() {
  const { search, hash } = useLocation();
  return <Navigate replace to={`/horarios${search}${hash}`} />;
}

const loadPublicSchedules = () => horariosPublicacionApi.consultar(false);
function PublicSchedulesLocations() {
  const schedules = usePolling(loadPublicSchedules,30000);
  return <LocationPortal student={false} schedules={schedules} />;
}

function LocationPortal({ student, schedules }: { student: boolean; schedules?: PublishedScheduleQuery }) {
  const load = useCallback(() => ubicacionApi.consultar(student),[student]);
  const {data,loading,error,refresh} = usePolling(load,30000);
  const [params,setParams] = useSearchParams();
  const [periodId,setPeriodId] = useState('');
  const today = useBoliviaDate();
  const room = data?.aulas.find(a => a.codigo === params.get('aula') && hasRoomLocation(a));
  const requestedFloor = params.get('piso');
  const floor = requestedFloor === '' || INFORMATICA_PLANS.some(p => String(p.floor) === requestedFloor) ? requestedFloor! : student ? String(room?.piso ?? -1) : '';
  const scheduleData = student ? data : schedules?.data;
  const periods = scheduleData?.periodos ?? [];
  const period = periods.find(p => p.idPeriodo === periodId) ?? periods.find(p => p.fechaInicio <= today && p.fechaFin >= today) ?? periods[0];
  return <div className="container-public student-schedules location-portal">
    <div className="student-schedules-intro"><h1>{student ? 'UBICACIÓN DE AULAS' : 'HORARIOS Y UBICACIÓN'}</h1><p>{student ? 'Edificio de Informática · Subsuelo, planta baja y pisos 1 al 6.' : 'Busca por aula, materia o responsable, o pulsa un aula en el plano para consultar su horario.'}</p></div>
    {schedules && <div className="mb-6"><ScheduleBrowser {...schedules} compact /></div>}
    {loading ? <LoadingSpinner label="Cargando planos…" /> : error ? <div role="alert" className="student-schedules-empty"><p>{error}</p><button type="button" className="btn-secondary" onClick={refresh}>Reintentar</button></div> : !data?.publicado ?
      <div className="student-schedules-empty"><h2>Ubicación aún no publicada</h2><p>Kardex habilitará aquí los planos para su consulta.</p></div> : <>
      <BuildingLocations aulas={data.aulas} floor={floor} onFloor={value => setParams({piso:value})} selectedCode={room?.codigo} floorSidebar={!student}
        onRoom={a => setParams({piso:floor,aula:a.codigo})} />
      {room && <LocationScheduleModal key={room.codigo} title={`Horario del aula ${room.codigo}`} close={() => setParams({piso:floor},{replace:true})}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-medium text-slate-700">Edificio de Informática · {pisoLabel(room.piso)}</p><p className="mt-1 text-sm text-slate-500">Consulta de clases y reservas.</p><RoomCapacity value={room.capacidad} /></div>
            {period && !schedules?.error && <label className="flex w-full flex-col gap-2 text-sm sm:w-auto">Periodo académico<select className="select-field" value={period.idPeriodo} onChange={e => setPeriodId(e.target.value)}>{periods.map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></label>}
          </div>
          {schedules?.loading ? <LoadingSpinner label="Cargando horarios…" /> : schedules?.error ? <div role="alert"><p>No se pudieron actualizar los horarios.</p><button type="button" className="btn-secondary mt-3" onClick={schedules.refresh}>Reintentar</button></div> : !student && !scheduleData?.publicado ? <p className="student-schedules-hint">Horarios aún no publicados. Kardex habilitará aquí su consulta.</p> : period ? <><p className="student-schedules-mobile-hint">Desliza la tabla para ver todos los días.</p><div className="student-schedules-table" tabIndex={0} role="region" aria-label={`Tabla semanal del aula ${room.codigo}`}><RoomSchedule aula={room} periodo={period} horarios={scheduleData?.horarios ?? []} today={today} /></div></>
            : <p className="student-schedules-hint">No hay un periodo académico activo para consultar el horario.</p>}
        </div>
      </LocationScheduleModal>}
    </>}
  </div>;
}

function LocationScheduleModal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = container.current?.querySelector<HTMLElement>('[role="dialog"]');
    const closeButton = dialog?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]');
    document.body.style.overflow = 'hidden';
    closeButton?.focus({preventScroll:true});
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeButton?.click(); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, select, [tabindex="0"]')]
        .filter(el => !el.matches(':disabled') && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown',onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown',onKey);
      if (previousFocus?.isConnected && (previousFocus instanceof HTMLElement || previousFocus instanceof SVGElement)) previousFocus.focus({preventScroll:true});
    };
  }, []);
  return <div ref={container} className="location-room-schedule">
    <Modal open size="wide" title={title} onClose={close}>
      {children}
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><button type="button" className="btn-secondary" onClick={close}>Volver al plano</button></div>
    </Modal>
  </div>;
}

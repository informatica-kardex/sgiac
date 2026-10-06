import { ReactNode } from 'react';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { Aula } from '../../api/types';
import { Empty, Field } from './AcademicoUI';
import { LoadingSpinner } from './LoadingSpinner';
import { FloorCards, PlaceCards, RoomCards } from './PlaceCards';

export function RoomPicker({ aulas, lugar, piso, includeAll = false, loading, periodControl, onPlace, onFloor, onRoom }: {
  aulas: Aula[]; lugar: string | null; piso: string | null; includeAll?: boolean; loading: boolean;
  periodControl: ReactNode; onPlace: (place: string) => void; onFloor: (floor: string) => void; onRoom: (room: string) => void;
}) {
  const placeRooms = aulas.filter(a => a.lugar === lugar);
  const floors = [...new Set(placeRooms.map(a => a.piso))].sort((a, b) => (a ?? -99) - (b ?? -99));
  const rooms = placeRooms.filter(a => !piso || String(a.piso) === piso)
    .sort((a, b) => (a.piso ?? -99) - (b.piso ?? -99) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const byFloor = lugar === 'INFORMATICA';
  return <>
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4"><p className="place-step"><span>01</span>Selecciona un lugar</p>{periodControl}</div>
      <PlaceCards aulas={aulas} value={lugar} onChange={onPlace} includeAll={includeAll} loading={loading} />
    </section>
    {loading ? <LoadingSpinner /> : lugar ? <>
      {byFloor && <section className="space-y-3" aria-label="Pisos de Informática">
        <p className="place-step"><span>02</span>Selecciona un piso o todas las aulas</p>
        <FloorCards aulas={placeRooms} value={piso} onChange={onFloor} />
      </section>}
      {(!byFloor || piso !== null) && <section className="space-y-4" aria-label="Aulas del lugar">
        <div className="flex flex-wrap items-end justify-between gap-3"><div>
          <p className="place-step"><span>{byFloor ? '03' : '02'}</span>Selecciona un aula para abrir su horario</p>
          <p className="mt-1 text-xs text-slate-500">{LUGARES[lugar]}{piso ? ` · ${pisoLabel(piso === 'null' ? null : Number(piso))}` : ''} · {rooms.length} ambientes</p>
        </div>
          {!byFloor && floors.some(p => p !== null) && <Field label="Piso"><select className="select-field" value={piso ?? ''} onChange={e => onFloor(e.target.value)}><option value="">Todos los pisos</option>{floors.map(p => <option key={String(p)} value={String(p)}>{pisoLabel(p)}</option>)}</select></Field>}
        </div>
        {rooms.length ? <RoomCards aulas={rooms} value="" onChange={onRoom} /> : <Empty>No hay aulas para este lugar y piso.</Empty>}
      </section>}
    </> : (!includeAll || lugar === null) && <Empty>Selecciona una tarjeta de lugar para ver sus aulas.</Empty>}
  </>;
}

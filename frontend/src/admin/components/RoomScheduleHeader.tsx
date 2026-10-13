import { ReactNode } from 'react';
import { LUGARES, Periodo, pisoLabel } from '../../api/academico.api';
import { Aula } from '../../api/types';
import { roomEquipment } from '../schedule/room-search';

export function RoomScheduleHeader({ aula, periodo, children }: { aula: Aula; periodo: Periodo; children?: ReactNode }) {
  const equipment = roomEquipment(aula);
  return <header className="room-overview">
    <div className="room-overview-top">
      <div className="room-overview-identity"><span className="room-overview-kind">{aula.tipo === 'LABORATORIO' ? 'Laboratorio' : aula.tipo === 'AULA' ? 'Aula' : aula.tipo}</span><h2>{aula.codigo}</h2>{aula.nombre !== aula.codigo && <p>{aula.nombre}</p>}</div>
      <div className="room-overview-actions"><span className={`room-overview-state ${aula.estado !== 'disponible' ? 'unavailable' : ''}`}>{aula.estado === 'disponible' ? 'Habilitada' : aula.estado === 'mantenimiento' ? 'En mantenimiento' : 'Inhabilitada'}</span>{children}</div>
    </div>
    <dl className="room-overview-facts">
      <div><dt>Ubicación</dt><dd>{LUGARES[aula.lugar ?? ''] ?? 'Lugar por confirmar'}<span>{pisoLabel(aula.piso)}</span></dd></div>
      <div><dt>Capacidad</dt><dd>{aula.capacidad > 0 ? `${aula.capacidad} personas` : 'Por confirmar'}</dd></div>
      <div><dt>Periodo académico</dt><dd>{periodo.periodo}/{periodo.gestion}</dd></div>
    </dl>
    {aula.ubicacion && <p className="room-overview-location">{aula.ubicacion}</p>}
    <div className="room-overview-equipment"><strong>Equipamiento</strong>{equipment.length ? <ul>{equipment.map(e => <li key={e.nombre}>{e.nombre} ({e.cantidad})</li>)}</ul> : <span>Sin equipamiento registrado</span>}</div>
  </header>;
}

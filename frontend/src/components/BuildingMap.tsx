import { CSSProperties, useId } from 'react';
import { FloorCards } from '../admin/components/PlaceCards';
import { FloorPlan, INFORMATICA_PLANS, MapRoom, PlanArea, PlanSpace, roomForSpace } from './informatica-plans';
import '../styles/subsuelo-map.css';

function Marker({ area, letter, room = false }: { area: PlanArea; letter: string; room?: boolean }) {
  const y = area.y - (room ? 10 : 0);
  return area.compact ? <text className="subsuelo-small-letter" x={area.x} y={y+4}>{letter}</text>
    : <g className="subsuelo-marker" aria-hidden="true"><circle cx={area.x} cy={y} r="12" /><text x={area.x} y={y+4.5}>{letter}</text></g>;
}

export function BuildingMap<T extends MapRoom>({ aulas, floor, selectedCode, onRoom, canAssign = false }: {
  aulas: T[]; floor: number; selectedCode?: string; onRoom?: (aula: T) => void; canAssign?: boolean;
}) {
  const id = useId();
  const plan = INFORMATICA_PLANS.find(p => p.floor === floor);
  if (!plan) return null;
  const roomFor = (space: PlanSpace) => roomForSpace(aulas,plan,space);
  const selected = onRoom && plan.spaces.map(roomFor).find(a => a && a.codigo === selectedCode);
  const linked = plan.spaces.map(roomFor).filter(a => a !== undefined);
  const roomLabel = (space: PlanSpace, room?: T) => !onRoom ? `${space.name}${room?.codigo || space.code ? ` · ${room?.codigo || space.code}` : ''}` : room
    ? `Abrir horario del aula ${room.codigo}${room.estado && room.estado !== 'disponible' ? ` (${room.estado}, solo consulta)` : ''}`
    : `${space.code || space.name}: sin aula registrada en ${plan.title}`;
  const [entryX,entryY] = plan.entry;
  return <section className="subsuelo-map" aria-label={`Ubicación de aulas · ${plan.title}`} data-floor={floor}>
    <header className="subsuelo-map-header">
      <div><p className="subsuelo-map-eyebrow">EDIFICIO DE INFORMÁTICA</p><h2>Ubicación <span>/ {plan.title}</span></h2><p>{onRoom && linked.length ? `Presiona un aula o laboratorio en el plano para ${canAssign ? 'abrir su horario y asignar clases' : 'consultar su horario'}.` : 'Consulta la distribución de los ambientes y sus referencias.'}</p></div>
      <span className="subsuelo-map-level">{floor === 0 ? 'PB' : `Nivel ${floor === -1 ? '−1' : floor}`}</span>
    </header>
    <div className="subsuelo-map-body">
      <div className="subsuelo-plan">
        <div className="subsuelo-plan-heading"><h3>{floor === -1 ? 'SUB SUELO' : plan.title.toLocaleUpperCase('es')}</h3><span>{onRoom ? 'Plano interactivo' : 'Plano de ubicación'}</span></div>
        <svg viewBox={`0 0 ${plan.width} ${plan.height}`} role="group" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>Plano de {plan.title} del Edificio de Informática</title>
          <desc id={`${id}-description`}>Distribución según el letrero del edificio, con paredes rectas.{onRoom ? ' Las aulas y laboratorios registrados abren sus horarios.' : ''}</desc>
          <g className="subsuelo-plan-lines">
            <polygon fill="#f4f3ed" points={plan.corridor} />
            {plan.atrium && <g fill="#f4f3ed" aria-label="Espacio central"><rect x={plan.atrium[0]} y={plan.atrium[1]} width={plan.atrium[2]} height={plan.atrium[3]} /><path d={`M${plan.atrium[0]} ${plan.atrium[1]}l${plan.atrium[2]} ${plan.atrium[3]}m0 ${-plan.atrium[3]}l${-plan.atrium[2]} ${plan.atrium[3]}`} /></g>}
            <text className="subsuelo-passage" x={plan.passage[0]} y={plan.passage[1]}>PASILLO</text>
            {plan.spaces.map(space => {
              const room = roomFor(space), isRoom = Boolean(space.code || space.roomName), interactive = Boolean(isRoom && onRoom), active = Boolean(room && selected?.codigo === room.codigo);
              return <g key={space.letter} role={interactive ? 'button' : undefined} tabIndex={interactive ? room ? 0 : -1 : undefined}
                aria-disabled={interactive ? !room : undefined} aria-current={active ? 'location' : undefined} aria-label={isRoom ? roomLabel(space,room) : space.name}
                className={interactive ? `subsuelo-room${active ? ' is-selected' : ''}${room ? '' : ' is-missing'}` : undefined}
                onClick={interactive ? () => room && onRoom?.(room) : undefined} onKeyDown={interactive ? event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (room) onRoom?.(room); }
                } : undefined}>
                <title>{isRoom ? roomLabel(space,room) : space.name}</title>
                {space.areas.map((area,index) => <g key={index}>
                  <polygon className={interactive ? 'subsuelo-room-shape' : undefined} points={area.points} fill={space.color} />
                  {area.stairs && <StairLines bounds={area.stairs} />}
                  <Marker letter={space.letter} area={area} room={isRoom} />
                  {isRoom && <text className={`subsuelo-room-code${space.dark ? ' on-dark' : ''}`} x={area.x} y={area.y+18}>{room?.codigo || space.code || space.name}</text>}
                  {active && <path className="subsuelo-selected-tick" d={`M${area.x+21} ${area.y-16}l4 4 8-9`} />}
                </g>)}
              </g>;
            })}
            <g aria-label="Referencia de entrada del letrero" pointerEvents="none">
              <g fill="#343c3d" stroke="none" aria-hidden="true"><circle cx={entryX+17} cy={entryY-11} r="2" /><path d={`M${entryX+14} ${entryY-8}h6v9h-1v7h-2v-7h-1v7h-2v-7h-1v-7Z`} /></g>
              <circle cx={entryX} cy={entryY} r="11" fill="#ca414b" stroke="none" />
              <text className="subsuelo-entry" x={entryX} y={entryY-2}>USTED</text><text className="subsuelo-entry" x={entryX} y={entryY+4}>ESTÁ AQUÍ</text>
            </g>
          </g>
        </svg>
      </div>
      <aside className="subsuelo-legend" aria-label={`Leyenda de ${plan.title}`}>
        <h3>Referencias del plano</h3><p>{onRoom && linked.length ? 'Selecciona un aula para ver su horario.' : 'Ambientes de referencia de este piso.'}</p>
        <ul>{plan.spaces.map(space => {
          const room = roomFor(space), interactive = Boolean(space.code || space.roomName);
          const content = <><span className="subsuelo-legend-letter" style={{ '--space-color': space.color } as CSSProperties}>{space.letter}</span><span className="subsuelo-legend-name">{space.name}{interactive && <small>{room?.codigo || space.code}{!room ? (onRoom ? `${space.code ? ' · ' : ''}Sin aula registrada` : '') : room.estado && room.estado !== 'disponible' ? ` · ${room.estado === 'mantenimiento' ? 'En mantenimiento' : 'Inhabilitada'}` : ''}</small>}</span>{room && onRoom && <span className="subsuelo-legend-arrow" aria-hidden="true">↗</span>}</>;
          return <li key={space.letter}>{interactive && onRoom
            ? <button type="button" disabled={!room} className={`subsuelo-legend-room${room && selected?.codigo === room.codigo ? ' is-selected' : ''}`} aria-label={roomLabel(space,room)} onClick={() => room && onRoom(room)}>{content}</button>
            : <div className="subsuelo-legend-space">{content}</div>}</li>;
        })}</ul>
      </aside>
    </div>
    <footer className="subsuelo-map-footer">{selected ? <p><strong>{selected.codigo}</strong> está resaltada en el plano.</p> : <p>{!onRoom ? 'Distribución de aulas, laboratorios y servicios.' : linked.length ? `${linked.length} aulas y laboratorios vinculados a sus horarios.` : 'Este piso no tiene aulas vinculadas a horarios.'}</p>}<p>Plano de referencia · Carrera de Informática</p></footer>
  </section>;
}

function StairLines({ bounds: [x,y,w,h] }: { bounds: [number,number,number,number] }) {
  return <g fill="none" className="subsuelo-stairs" aria-hidden="true"><path d={`M${x+w/2} ${y}v${h-20}`} />{Array.from({length: Math.floor((h-20)/6)},(_,n) => <path key={n} d={`M${x} ${y+(n+1)*6}h${w}`} />)}</g>;
}

export function BuildingLocations<T extends MapRoom>({ aulas, floor, onFloor, floorSidebar = false, ...props }: {
  aulas: T[]; floor: string; onFloor: (floor: string) => void; selectedCode?: string; onRoom?: (aula: T) => void; canAssign?: boolean; floorSidebar?: boolean;
}) {
  const rooms = aulas.filter(a => a.lugar === 'INFORMATICA' && INFORMATICA_PLANS.some(p => p.floor === a.piso));
  const plans: FloorPlan[] = INFORMATICA_PLANS.filter(p => floor === '' || String(p.floor) === floor);
  return <div className={`building-locations${floorSidebar ? ' has-floor-sidebar' : ' space-y-4'}`}>
    <section className="building-floor-filters space-y-3" aria-label="Pisos de Informática"><p className="place-step">{floorSidebar ? 'Selecciona un piso' : 'Selecciona un piso para ver su ubicación'}</p><FloorCards aulas={rooms} value={floor} onChange={onFloor} availableFloors={INFORMATICA_PLANS.map(p => p.floor)} /></section>
    <div className="building-floor-plans space-y-4">{plans.map(plan => <BuildingMap key={plan.floor} aulas={aulas} floor={plan.floor} {...props} />)}</div>
  </div>;
}

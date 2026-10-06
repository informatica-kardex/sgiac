import { CSSProperties } from 'react';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { Aula } from '../../api/types';
import { AdminIcon, AdminIconName } from './AdminIcon';
import '../../styles/place-cards.css';

const appearances: Record<string, { color: string; surface: string; icon: AdminIconName }> = {
  '': { color: '#355f93', surface: '#e3edf9', icon: 'dashboard' },
  ANTIGUO: { color: '#946125', surface: '#f8ecd5', icon: 'aulas' },
  PABELLONES: { color: '#23758b', surface: '#dcf0f6', icon: 'aulas' },
  LASIN: { color: '#70549d', surface: '#eee4f8', icon: 'book' },
  INFORMATICA: { color: '#217763', surface: '#ddf2e8', icon: 'aulas' },
};
const colors = (place: string) => {
  const appearance = appearances[place] ?? appearances[''];
  return { '--place-accent': appearance.color, '--place-surface': appearance.surface } as CSSProperties;
};

export function PlaceCards({ aulas, value, onChange, includeAll = false, loading = false }: {
  aulas: Aula[]; value: string | null; onChange: (place: string) => void; includeAll?: boolean; loading?: boolean;
}) {
  const places = [...(includeAll ? [['', 'Todos los lugares']] : []), ...Object.entries(LUGARES)];
  return <div className={`place-cards ${includeAll ? 'with-all' : ''}`} role="group" aria-label="Seleccionar lugar">
    {places.map(([key, label]) => {
      const count = aulas.filter(a => !key || a.lugar === key).length;
      return <button type="button" key={key} className={`place-card ${value === key ? 'is-selected' : ''}`} style={colors(key)}
        aria-label={label} aria-pressed={value === key} disabled={loading} onClick={() => onChange(key)}>
        <span className="place-card-top"><span className="place-card-icon"><AdminIcon name={appearances[key].icon} size={22} /></span><span className="place-card-check" aria-hidden="true">{value === key ? '✓' : '↗'}</span></span>
        <span className="place-card-name">{label}</span>
        <span className="place-card-count"><strong>{loading ? '—' : count}</strong> {count === 1 ? 'ambiente' : 'ambientes'}</span>
      </button>;
    })}
  </div>;
}

export function RoomCards({ aulas, value, onChange, showPlace = false }: {
  aulas: Aula[]; value: string; onChange: (room: string) => void; showPlace?: boolean;
}) {
  return <div className="room-cards" role="group" aria-label="Seleccionar aula">
    {aulas.map(a => <button type="button" key={a.codigo} className={`place-card room-choice ${value === a.codigo ? 'is-selected' : ''}`} style={colors(a.lugar ?? '')}
      aria-label={`Seleccionar aula ${a.codigo}`} aria-pressed={value === a.codigo} onClick={() => onChange(a.codigo)}>
      <span className="place-card-top"><span className="room-choice-kind">{a.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Aula'}</span><span className="place-card-check" aria-hidden="true">{value === a.codigo ? '✓' : '↗'}</span></span>
      <strong className="room-choice-code">{a.codigo}</strong>
      {a.nombre !== a.codigo && <span className="room-choice-name">{a.nombre}</span>}
      <span className="room-choice-detail">{showPlace ? `${LUGARES[a.lugar ?? ''] ?? 'Lugar por confirmar'} · ` : ''}{pisoLabel(a.piso)}</span>
      {a.estado !== 'disponible' && <span className="room-choice-status">{a.estado === 'mantenimiento' ? 'En mantenimiento' : 'Inhabilitada'}</span>}
    </button>)}
  </div>;
}

export function FloorCards({ aulas, value, onChange }: {
  aulas: Aula[]; value: string | null; onChange: (floor: string) => void;
}) {
  const floors = [...new Set([1, 2, 3, 4, 5, ...aulas.map(a => a.piso)])]
    .sort((a, b) => (a ?? 999) - (b ?? 999));
  const names: Record<number, string> = { 1: 'Primer piso', 2: 'Segundo piso', 3: 'Tercer piso', 4: 'Cuarto piso', 5: 'Quinto piso' };
  const options = [{ key: '', label: 'Todas las aulas', count: aulas.length }, ...floors.map(floor => ({
    key: String(floor), label: floor === null ? 'Sin piso / por confirmar' : names[floor] ?? pisoLabel(floor),
    count: aulas.filter(a => a.piso === floor).length,
  }))];
  return <div className="room-cards floor-cards" role="group" aria-label="Seleccionar piso">
    {options.map(option => <button type="button" key={option.key} className={`place-card room-choice ${value === option.key ? 'is-selected' : ''}`}
      style={colors('INFORMATICA')} aria-label={option.label} aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
      <span className="place-card-top"><AdminIcon name={option.key ? 'aulas' : 'dashboard'} size={20} /><span className="place-card-check" aria-hidden="true">{value === option.key ? '✓' : '↗'}</span></span>
      <strong className="room-choice-name">{option.label}</strong>
      <span className="room-choice-detail">{option.count} {option.count === 1 ? 'ambiente' : 'ambientes'}</span>
    </button>)}
  </div>;
}

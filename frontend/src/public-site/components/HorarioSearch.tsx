import { useEffect, useId, useRef, useState } from 'react';

export interface SugerenciaHorario {
  id: string;
  tipo: 'aula' | 'materia' | 'persona';
  valor: string;
  texto: string;
  categoria: string;
  detalle: string;
  aulas: number;
}

export function HorarioSearch({ value, onChange, onSelect, sugerencias }: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (sugerencia: SugerenciaHorario) => void;
  sugerencias: SugerenciaHorario[];
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState('');
  const indice = sugerencias.findIndex(s => s.id === activo);
  const mostrar = abierto && sugerencias.length > 0;
  useEffect(() => {
    if (mostrar && indice >= 0) list.current?.children[indice]?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [mostrar, indice]);
  function elegir(s: SugerenciaHorario) {
    onSelect(s); input.current?.focus({ preventScroll: true }); setAbierto(false); setActivo('');
  }
  return <div className="student-schedules-search" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setAbierto(false); setActivo(''); }
  }}>
    <label htmlFor="horarios-busqueda">Buscar por materia, aula o docente</label>
    <div className="student-schedules-search-row">
      <div className="student-schedules-input-wrap">
        <svg className="student-schedules-search-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input ref={input} id="horarios-busqueda" className="input-field" type="search" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={mostrar} aria-controls={listId}
          aria-activedescendant={mostrar && indice >= 0 ? `${listId}-${indice}` : undefined} aria-describedby={`${listId}-ayuda`}
          placeholder="Aula, materia o nombre del docente…" value={value}
          onFocus={() => setAbierto(true)} onClick={() => setAbierto(true)}
          onChange={e => { onChange(e.target.value); setAbierto(true); setActivo(''); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); setActivo(''); }
            else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugerencias.length) {
              e.preventDefault(); setAbierto(true);
              const siguiente = !mostrar || indice < 0 ? (e.key === 'ArrowDown' ? 0 : sugerencias.length - 1) : (indice + (e.key === 'ArrowDown' ? 1 : -1) + sugerencias.length) % sugerencias.length;
              setActivo(sugerencias[siguiente].id);
            } else if (e.key === 'Enter') {
              e.preventDefault(); if (mostrar && indice >= 0) elegir(sugerencias[indice]); else setAbierto(false);
            }
          }} />
        {mostrar && <div ref={list} id={listId} role="listbox" aria-label="Sugerencias de horarios" className="student-schedules-suggestions">
          {sugerencias.map((s, i) => <button type="button" role="option" id={`${listId}-${i}`} aria-selected={indice === i} tabIndex={-1} key={s.id}
            onMouseDown={e => e.preventDefault()} onClick={() => elegir(s)}>
            <span className="student-schedules-suggestion-text"><span className="student-schedules-suggestion-kind">{s.categoria}</span><strong>{s.texto}</strong><small>{s.detalle}</small></span>
            <span className="student-schedules-suggestion-count">{s.aulas} {s.aulas === 1 ? 'aula' : 'aulas'}</span>
          </button>)}
        </div>}
      </div>
      {value && <button className="btn-secondary" onClick={() => { onChange(''); input.current?.focus({ preventScroll: true }); setAbierto(false); setActivo(''); }}>Limpiar</button>}
    </div>
    <p id={`${listId}-ayuda`} className="student-schedules-search-help">Los resultados cambian al escribir. Elige una sugerencia con un clic o con ↑ ↓ y Enter.</p>
  </div>;
}

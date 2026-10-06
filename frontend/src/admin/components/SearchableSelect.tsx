import { useEffect, useId, useRef, useState } from 'react';

type Option = { value: string; label: string; searchText?: string };
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function SearchableSelect({ label, value, options, placeholder, onChange }: {
  label: string; value: string; options: Option[]; placeholder: string; onChange: (value: string) => void;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState<string | null>(null), [active, setActive] = useState(0);
  const selected = options.find(o => o.value === value);
  const terms = normal(query ?? '').split(/\s+/).filter(Boolean);
  const matches = options.filter(o => terms.every(t => normal(`${o.label} ${o.searchText ?? ''}`).includes(t)));
  const visible = [{ value: '', label: placeholder }, ...matches];
  const close = () => { setOpen(false); setQuery(null); setActive(0); };
  const select = (option: Option) => { onChange(option.value); close(); };
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, id]);
  return <div className="relative min-w-0" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    <div className="relative"><input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`}
      aria-activedescendant={open ? `${id}-option-${Math.min(active, visible.length - 1)}` : undefined}
      className="input-field w-full pr-16" placeholder={placeholder} value={query ?? selected?.label ?? ''}
      onFocus={() => { setOpen(true); setQuery(''); setActive(0); }} onChange={e => { setQuery(e.target.value); setOpen(true); setActive(e.target.value.trim() ? 1 : 0); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'Tab') close();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(n => Math.max(0, Math.min(visible.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1)))); }
        if (e.key === 'Enter' && open) { e.preventDefault(); select(visible[Math.min(active, visible.length - 1)]); }
      }} />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
        {(value || query) && <button type="button" className="px-1 text-slate-500 hover:text-emerald-700" aria-label={`Limpiar ${label.toLowerCase()}`} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQuery(''); setActive(0); input.current?.focus(); }}>×</button>}
        <button type="button" tabIndex={-1} className="px-1 text-slate-500" aria-label={`Mostrar opciones: ${label}`} onMouseDown={e => e.preventDefault()} onClick={() => { if (open) close(); else { input.current?.focus(); setOpen(true); setQuery(''); } }}>⌄</button>
      </div>
    </div>
    {open && <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="listbox" id={`${id}-options`} aria-label={label}>
      {visible.map((option, i) => <div key={option.value} id={`${id}-option-${i}`} role="option" aria-selected={value === option.value}
        className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'}`}
        onMouseDown={e => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => select(option)}>{option.label}{value === option.value && <span className="ml-2 text-emerald-700" aria-hidden="true">✓</span>}</div>)}
      {!matches.length && <p role="status" className="px-3 py-3 text-sm text-slate-500">No hay coincidencias. Prueba otro nombre o sigla.</p>}
    </div>}
  </div>;
}

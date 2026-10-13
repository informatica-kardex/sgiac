import { FormEvent, useRef, useState } from 'react';
import { aulasApi, CrearAulaPayload } from '../../api/aulas.api';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { Aula } from '../../api/types';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from '../components/AcademicoUI';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FloorCards, PlaceCards } from '../components/PlaceCards';
import { RoomSearch } from '../components/RoomSearch';
import { roomEquipment } from '../schedule/room-search';
const blank: CrearAulaPayload = { codigo: '', nombre: '', capacidad: 0, ubicacion: '', estado: 'disponible', lugar: 'INFORMATICA', piso: null, tipo: 'AULA', equipamiento: [] };
export default function AulasPage() {
  const c = useAcademico();
  const results = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState(''), [piso, setPiso] = useState(''), [query, setQuery] = useState('');
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Aula | null>(null), [remove, setRemove] = useState<Aula | null>(null);
  const [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function edit(a?: Aula) { setEditing(a ?? null); setForm(a ? { ...a, lugar: a.lugar ?? 'INFORMATICA', equipamiento: (a.equipamiento ?? []).map(e => ({ ...e })) } : { ...blank, lugar: lugar || 'INFORMATICA' }); setError(''); setOpen(true); }
  function updateEquipment(index: number, patch: Partial<{ nombre: string; cantidad: number }>) {
    setForm(previous => ({ ...previous, equipamiento: (previous.equipamiento ?? []).map((e, i) => i === index ? { ...e, ...patch } : e) }));
  }
  const equipmentSuggestions = [...new Set(['Data (proyector)', 'Ecram (pantalla de proyección)', 'Pizarra', 'Computadora', 'Parlante', 'Cámara', 'Ventilador', 'Wi-Fi', ...c.aulas.flatMap(a => (a.equipamiento ?? []).map(e => e.nombre))])].sort((a, b) => a.localeCompare(b, 'es'));
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { if (editing) await aulasApi.actualizar(editing.idAula, form); else await aulasApi.crear(form); setOpen(false); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function destroy() {
    if (!remove) return; setBusy(true); setError('');
    try { await aulasApi.eliminar(remove.idAula); setRemove(null); await c.cargar(); }
    catch (e) { setRemove(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const inPlace = c.aulas.filter(a => !lugar || a.lugar === lugar);
  const floors = [...new Set(inPlace.map(a => a.piso))].sort((a,b) => (a ?? -99) - (b ?? -99));
  const filtered = inPlace.filter(a => (!piso || String(a.piso) === piso) && `${a.codigo} ${a.nombre}`.toLowerCase().includes(query.toLowerCase()));
  function selectSearchResult(a: Aula) {
    setLugar(a.lugar ?? ''); setPiso(String(a.piso)); setQuery(a.codigo);
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  return <div className="space-y-6"><AcademicHeader title="Aulas" description="Elige un lugar o busca aulas por capacidad, tipo y disponibilidad."><RoomSearch aulas={c.aulas} horarios={c.horarios} periodos={c.periodos} disabled={c.loading || Boolean(c.error)} error={c.error} refresh={c.cargar} onSelect={selectSearchResult} actionLabel="Ver aula" /><button className="btn-primary" onClick={() => edit()}>+ Nueva aula</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!open && <ErrorNotice message={error} />}
    <PlaceCards aulas={c.aulas} value={lugar} includeAll loading={c.loading} onChange={place => { setLugar(place); setPiso(''); }} />
    {lugar === 'INFORMATICA' && !c.loading && <section className="space-y-3" aria-label="Pisos de Informática"><p className="place-step">Filtrar aulas por piso</p><FloorCards aulas={inPlace} value={piso} onChange={setPiso} /></section>}
    <div className="flex flex-wrap gap-3"><input aria-label="Buscar aulas" className="input-field max-w-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar código o nombre del aula…" /><select aria-label="Filtrar piso" className="select-field max-w-xs" value={piso} onChange={e => setPiso(e.target.value)}><option value="">Todos los pisos</option>{floors.map(p => <option key={String(p)} value={String(p)}>{pisoLabel(p)}</option>)}</select><button className="btn-ghost" onClick={() => { setLugar(''); setPiso(''); setQuery(''); }}>Ver todas</button></div>
    {c.loading ? <LoadingSpinner /> : !filtered.length ? <Empty>No hay aulas para estos filtros.</Empty> : <div ref={results} className="card overflow-x-auto"><table className="academic-table"><thead><tr><th>AULA Y EQUIPAMIENTO</th><th>LUGAR Y PISO</th><th>CAPACIDAD</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{filtered.map(a => <tr key={a.idAula}><td><p className="font-semibold text-slate-800">{a.codigo}</p><p className="mt-1 text-slate-500">{a.nombre}</p><span className="academic-tag">{a.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Aula'}</span><p className="mt-2 text-xs text-slate-500">{roomEquipment(a).length ? roomEquipment(a).map(e => `${e.nombre} (${e.cantidad})`).join(', ') : 'Sin equipamiento registrado'}</p></td><td><p>{LUGARES[a.lugar ?? ''] ?? 'Lugar por confirmar'}</p><p className="mt-1 text-xs text-slate-500">{pisoLabel(a.piso)}</p>{a.ubicacion && <p className="mt-1 text-xs text-slate-400">{a.ubicacion}</p>}</td><td>{a.capacidad || 'Por confirmar'}</td><td><span className={`badge ${a.estado === 'disponible' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.estado}</span></td><td><button className="btn-ghost" onClick={() => edit(a)}>Editar</button><button className="btn-ghost text-red-600" onClick={() => { setError(''); setRemove(a); }}>Eliminar</button></td></tr>)}</tbody></table></div>}
    <Modal open={open} title={editing ? 'Editar aula' : 'Nueva aula'} onClose={() => !busy && setOpen(false)}><form className="space-y-4" onSubmit={save}><ErrorNotice message={error} />
      <div className="grid grid-cols-2 gap-3"><Field label="Código"><input required disabled={Boolean(editing)} maxLength={30} pattern="[A-Z0-9][A-Z0-9._-]*" className="input-field" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} /></Field><Field label="Tipo"><select className="select-field" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="AULA">Aula</option><option value="LABORATORIO">Laboratorio</option></select></Field></div>
      <Field label="Nombre"><input required minLength={3} maxLength={100} className="input-field" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
      <Field label="Lugar"><select required className="select-field" value={form.lugar ?? ''} onChange={e => setForm({ ...form, lugar: e.target.value, piso: null })}>{Object.entries(LUGARES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Piso (opcional)"><input type="number" min={-2} max={30} className="input-field" placeholder="Sin piso" value={form.piso ?? ''} onChange={e => setForm({ ...form, piso: e.target.value === '' ? null : Number(e.target.value) })} /></Field><Field label="Capacidad (0: por confirmar)"><input required type="number" min={0} max={2000} className="input-field" value={form.capacidad} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} /></Field></div>
      <p className="text-xs text-slate-500">Usa −1 para subsuelo, 0 para planta baja y 1, 2… para los pisos. Déjalo vacío si no corresponde o falta confirmarlo.</p>
      <Field label="Referencia de ubicación"><input maxLength={200} className="input-field" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} /></Field>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" disabled={busy}>
        <legend className="px-1 font-semibold text-slate-800">Equipamiento del aula</legend>
        <p className="text-xs text-slate-500">Registra solo lo que tiene el aula. Puedes agregar equipos, cambiar cantidades o quitarlos cuando dejen de estar disponibles.</p>
        <datalist id="aula-equipos-sugeridos">{equipmentSuggestions.map(nombre => <option key={nombre} value={nombre} />)}</datalist>
        {!(form.equipamiento ?? []).length && <p className="text-sm text-slate-500">Sin equipamiento registrado.</p>}
        {(form.equipamiento ?? []).map((equipo, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <Field label={`Equipo ${index + 1}`}><input required maxLength={120} list="aula-equipos-sugeridos" className="input-field" placeholder="Ej. Data (proyector)" value={equipo.nombre} onChange={e => updateEquipment(index, { nombre: e.target.value })} /></Field>
          <Field label={`Cantidad ${index + 1}`}><input required type="number" min={1} max={10000} step={1} className="input-field" value={equipo.cantidad || ''} onChange={e => updateEquipment(index, { cantidad: Number(e.target.value) })} /></Field>
          <button type="button" className="btn-ghost col-span-2 justify-self-end text-red-600" aria-label={`Quitar equipo ${index + 1}${equipo.nombre ? `: ${equipo.nombre}` : ''}`} onClick={() => setForm(previous => ({ ...previous, equipamiento: previous.equipamiento?.filter((_, i) => i !== index) }))}>Quitar equipo</button>
        </div>)}
        <button type="button" className="btn-secondary" disabled={(form.equipamiento?.length ?? 0) >= 100} onClick={() => setForm(previous => ({ ...previous, equipamiento: [...(previous.equipamiento ?? []), { nombre: '', cantidad: 1 }] }))}>+ Agregar equipo</button>
        <p className="text-xs text-slate-500">Los cambios se aplican al guardar el aula.</p>
      </fieldset>
      <Field label="Estado"><select className="select-field" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as Aula['estado'] })}><option value="disponible">Disponible</option><option value="mantenimiento">Mantenimiento</option><option value="inhabilitada">Inhabilitada</option></select></Field><SaveActions busy={busy} close={() => setOpen(false)} />
    </form></Modal><ConfirmDialog open={Boolean(remove)} title="Eliminar aula" message={`¿Eliminar ${remove?.nombre}? No se puede eliminar un aula que tenga horarios.`} onCancel={() => setRemove(null)} onConfirm={destroy} loading={busy} />
  </div>;
}

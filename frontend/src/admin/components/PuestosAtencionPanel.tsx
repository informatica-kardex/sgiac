import { FormEvent, useState } from 'react';
import { PuestoAtencion } from '../../api/estudiantes.api';
import { fichasApi } from '../../api/fichas.api';
import { mensajeError } from '../../hooks/usePolling';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';

export function PuestosAtencionPanel({ puestos, refresh }: { puestos: PuestoAtencion[]; refresh: () => void }) {
  const [form, setForm] = useState<{ id?: string; nombre: string } | null>(null);
  const [borrar, setBorrar] = useState<PuestoAtencion | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  async function guardar(e: FormEvent) {
    e.preventDefault(); if (!form || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await fichasApi.guardarPuesto(form.nombre, form.id); setForm(null); setSuccess('Puesto guardado. Ya está disponible al programar jornadas.'); refresh(); }
    catch (e) { setError(mensajeError(e)); } finally { setBusy(false); }
  }
  async function eliminar() {
    if (!borrar || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await fichasApi.borrarPuesto(borrar.idPuesto); setSuccess('Puesto retirado. Su historial se conserva.'); refresh(); }
    catch (e) { setError(mensajeError(e)); } finally { setBorrar(null); setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Puestos de atención</h2><p className="mt-1 text-sm text-slate-500">Crea ventanillas, oficinas o responsables con el nombre que necesites. Elige cuáles atienden cada trámite al programar su jornada.</p></div><button className="btn-primary" disabled={busy} onClick={() => { setError(''); setForm({ nombre: '' }); }}>Añadir puesto</button></div>
    {error && !form && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    {!puestos.length && <p className="card p-5 text-slate-500">Añade un puesto para empezar a programar jornadas.</p>}
    {puestos.map(p => <article key={p.idPuesto} className="card flex flex-wrap items-center justify-between gap-3 p-4"><h3 className="font-semibold">{p.nombre}</h3><div className="flex gap-2"><button className="btn-secondary" disabled={busy} onClick={() => { setError(''); setForm({ id: p.idPuesto, nombre: p.nombre }); }}>Editar nombre</button><button className="btn-danger" disabled={busy} onClick={() => { setError(''); setBorrar(p); }}>Eliminar</button></div></article>)}
    <p className="text-xs text-slate-500">Los cambios de nombre se reflejan en las jornadas. Las fichas que ya fueron llamadas conservan su destino original. Para eliminar un puesto, primero retíralo de las jornadas de hoy o futuras que todavía no emitieron fichas.</p>
    <Modal open={Boolean(form)} title={form?.id ? 'Editar puesto de atención' : 'Añadir puesto de atención'} onClose={() => !busy && setForm(null)}>
      {form && <form className="space-y-4" onSubmit={guardar}>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <label className="block text-sm font-semibold">Nombre del puesto<input autoFocus required minLength={2} maxLength={80} disabled={busy} className="input-field mt-2" placeholder="Ej. Ventanilla 1 o Encargada de Kardex" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar puesto'}</button></div>
      </form>}
    </Modal>
    <ConfirmDialog open={Boolean(borrar)} title="Eliminar puesto" message={`Se retirará «${borrar?.nombre}» de las nuevas jornadas. Las fichas históricas se conservarán.`} loading={busy} onCancel={() => setBorrar(null)} onConfirm={eliminar} />
  </section>;
}

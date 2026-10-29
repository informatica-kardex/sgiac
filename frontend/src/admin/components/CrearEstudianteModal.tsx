import { FormEvent, useState } from 'react';
import { CrearEstudianteInput, usersApi } from '../../api/users.api';
import { errorAcademico, ErrorNotice, Field } from './AcademicoUI';
import { Modal } from './Modal';

export function CrearEstudianteModal({ onClose, onSaved }: { onClose: () => void; onSaved: (idEstudiante: string) => void | Promise<void> }) {
  const [form, setForm] = useState<CrearEstudianteInput>({ nombres: '', apellidos: '', ci: '', ru: '', correo: '', mencion: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const r = await usersApi.crearEstudiante(form); await onSaved(r.data.data.idEstudiante); onClose(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  return <Modal title="Crear cuenta de estudiante" open onClose={() => !busy && onClose()}>
    <form className="space-y-4" onSubmit={save}><ErrorNotice message={error} />
      {([{ key: 'nombres', label: 'Nombres', max: 120 }, { key: 'apellidos', label: 'Apellidos', max: 120 },
        { key: 'ci', label: 'CI', max: 30 }, { key: 'ru', label: 'Registro universitario (RU)', max: 30 },
        { key: 'correo', label: 'Correo institucional', max: 150 }, { key: 'mencion', label: 'Mención', max: 150 }] as const).map(({ key, label, max }) =>
        <Field key={key} label={label}><input required type={key === 'correo' ? 'email' : 'text'} autoFocus={key === 'nombres'} maxLength={max} className="input-field" value={form[key]} disabled={busy} onChange={e => setForm({ ...form, [key]: e.target.value })} /></Field>)}
      <p className="text-sm text-slate-500">Usa un correo @fcpn.edu.bo o @umsa.bo. El CI será la contraseña temporal. El estudiante deberá verificar su correo y cambiar la contraseña al ingresar.</p>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear estudiante'}</button></div>
    </form>
  </Modal>;
}

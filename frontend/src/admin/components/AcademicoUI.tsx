import { ButtonHTMLAttributes, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { academicoApi, Asignacion, Auxiliar, Docente, Materia, Mencion, Periodo } from '../../api/academico.api';
import { Aula, HorarioAcademico as Horario } from '../../api/types';
import '../../styles/academico.css';
import { AdminIcon, AdminIconName } from './AdminIcon';

export function AcademicAction({ icon, tone = 'secondary', children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: AdminIconName; tone?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" {...props} className={`academic-action ${tone} ${className}`}><AdminIcon name={icon} size={17} /><span>{children}</span></button>;
}

export function errorAcademico(e: unknown) {
  if (isAxiosError(e)) return e.response?.data?.details?.map?.((d: { mensaje: string }) => d.mensaje).join('. ') || e.response?.data?.message || 'No se pudo conectar con el servidor.';
  return e instanceof Error ? e.message : 'No se pudo completar la operación.';
}
export function useAcademico() {
  const [data, setData] = useState<{ docentes: Docente[]; auxiliares: Auxiliar[]; materias: Materia[]; menciones: Mencion[]; periodos: Periodo[]; asignaciones: Asignacion[]; aulas: Aula[]; horarios: Horario[] }>({ docentes: [], auxiliares: [], materias: [], menciones: [], periodos: [], asignaciones: [], aulas: [], horarios: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const version = useRef(0);
  const cargar = useCallback(async () => {
    const request = ++version.current;
    setError(''); setLoading(true);
    try {
      const [docentes, auxiliares, materias, menciones, periodos, asignaciones, aulas, horarios] = await Promise.all([academicoApi.docentes(), academicoApi.auxiliares(), academicoApi.materias(), academicoApi.menciones(), academicoApi.periodos(), academicoApi.asignaciones(), academicoApi.aulas(), academicoApi.horarios()]);
      if (request === version.current) setData({ docentes, auxiliares, materias, menciones, periodos, asignaciones, aulas, horarios });
    } catch (e) { if (request === version.current) setError(errorAcademico(e)); }
    finally { if (request === version.current) setLoading(false); }
  }, []);
  useEffect(() => { void cargar(); return () => { version.current++; }; }, [cargar]);
  return { ...data, loading, error, cargar };
}
export function AcademicHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="academic-header"><div><p className="academic-eyebrow">GESTIÓN ACADÉMICA</p><h1>{title}</h1><p>{description}</p></div><div className="flex flex-wrap gap-2">{children}</div></div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{children}</div>; }
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) { return message ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}{retry && <button className="ml-3 underline" onClick={retry}>Reintentar</button>}</div> : null; }
export function SaveActions({ busy, close, disabled = false }: { busy: boolean; close: () => void; disabled?: boolean }) { return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="btn-secondary" disabled={busy} onClick={close}>Cancelar</button><button className="btn-primary" type="submit" disabled={busy || disabled}>{busy ? 'Guardando…' : 'Guardar'}</button></div>; }

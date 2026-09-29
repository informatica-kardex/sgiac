import { forwardRef, InputHTMLAttributes, useId, useState } from "react";
import { passwordRequirements } from "../utils/password-policy";

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className = "input-field", id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return <div className="relative">
      <input {...props} id={inputId} ref={ref} type={visible ? "text" : "password"} className={`${className} !pr-11`} />
      <button type="button" disabled={props.disabled} onClick={() => setVisible(value => !value)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>;
  }
);

const passwordLevels = [
  { label: "Muy débil", bar: "bg-red-500", text: "text-red-700" },
  { label: "Débil", bar: "bg-orange-500", text: "text-orange-700" },
  { label: "Moderada", bar: "bg-amber-500", text: "text-amber-800" },
  { label: "Casi completa", bar: "bg-yellow-400", text: "text-yellow-800" },
  { label: "Requisitos completos", bar: "bg-green-500", text: "text-green-700" },
];

export function PasswordStrength({ password }: { password: string }) {
  const requirements = passwordRequirements(password);
  const score = requirements.filter(item => item.met).length;
  // La longitud mínima es un requisito más: no debe ocultar el avance
  // de los otros requisitos. El verde exige cumplirlos todos.
  const strengthLevel = !password ? 0 : password.length > 72 ? 1 : Math.max(1, score);
  const level = !password
    ? { label: "Sin contraseña", bar: "bg-slate-200", text: "text-slate-600" }
    : password.length > 72
      ? { label: "Supera el máximo de 72 caracteres", bar: "bg-red-500", text: "text-red-700" }
      : passwordLevels[strengthLevel - 1];
  const label = password ? `${level.label} · ${score} de 5 requisitos` : level.label;
  return <div className="mt-2 space-y-2">
    <div role="meter" aria-label="Requisitos de la contraseña" aria-valuemin={0} aria-valuemax={5} aria-valuenow={strengthLevel} aria-valuetext={label} className="flex gap-1.5">
      {passwordLevels.map((segment, index) => <span key={segment.label} aria-hidden="true" className={`h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${index < strengthLevel ? level.bar : "bg-slate-200"}`} />)}
    </div>
    <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]" aria-live="polite">
      <span className={`font-semibold transition-colors duration-300 motion-reduce:transition-none ${level.text}`}>{level.label}</span>
      {password && <span className="text-slate-500">{score} de 5 requisitos</span>}
    </p>
    <ul className="grid gap-1 text-[11px] sm:grid-cols-2">{requirements.map(item => <li key={item.label} className={item.met ? "text-emerald-700" : "text-slate-500"}>{item.met ? "✓" : "○"} {item.label}</li>)}</ul>
    <p className="text-[11px] text-slate-500">Usa entre 8 y 72 caracteres. El indicador muestra el cumplimiento de los requisitos.</p>
  </div>;
}

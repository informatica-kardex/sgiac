import { forwardRef, InputHTMLAttributes, useId, useState } from "react";

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

export function PasswordStrength({ password }: { password: string }) {
  const requirements = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password)];
  const meetsRequirements = requirements.every(Boolean);
  const score = !password ? 0 : !meetsRequirements ? 1 : password.length >= 14 && /[^A-Za-z0-9\s]/.test(password) ? 4 : password.length >= 12 ? 3 : 2;
  const labels = ["Sin contraseña", "Débil", "Básica", "Buena", "Fuerte"];
  const colors = ["bg-slate-200", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];
  return <div className="mt-2 space-y-1.5">
    <div role="meter" aria-label="Seguridad estimada de la contraseña" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={labels[score]} className="flex gap-1">
      {[1, 2, 3, 4].map(segment => <span key={segment} className={`h-1.5 flex-1 rounded-full ${segment <= score ? colors[score] : "bg-slate-200"}`} />)}
    </div>
    <p className="text-xs text-slate-600" aria-live="polite">Seguridad estimada: <strong>{labels[score]}</strong></p>
    <p className="text-[11px] leading-4 text-slate-500">Mínimo 8 caracteres, mayúscula, minúscula y número. Para reforzarla, usa 14 o más caracteres y un símbolo.</p>
  </div>;
}

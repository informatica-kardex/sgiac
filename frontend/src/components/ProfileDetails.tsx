import { FormEvent, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import { z } from "zod";
import { authApi } from "../api/auth.api";
import { PerfilEstudiante } from "../api/estudiantes.api";
import { UsuarioSesion } from "../api/types";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";
import { AdminIcon } from "../admin/components/AdminIcon";
import { accountRoleLabel } from "./AccountIdentity";

const nameSchema = z.object({ nombreCompleto: z.string().trim().min(3, "Ingresa tu nombre completo").max(150, "Máximo 150 caracteres") });
const studentSchema = z.object({
  nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120, "Máximo 120 caracteres"),
  apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120, "Máximo 120 caracteres"),
  ci: z.string().trim().min(1, "Ingresa tu CI").max(30, "Máximo 30 caracteres"),
  ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30, "Máximo 30 caracteres"),
  mencion: z.string().trim().min(1, "Ingresa tu mención").max(150, "Máximo 150 caracteres"),
}).refine(p => `${p.nombres} ${p.apellidos}`.length <= 150, { message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"] });

export function ProfileDetails({ usuario, estudiante, onSaved }: {
  usuario: UsuarioSesion; estudiante?: PerfilEstudiante; onSaved?: (perfil: PerfilEstudiante) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) form.current?.querySelector("input")?.focus(); }, [editing]);
  const fields = estudiante ? [
    ["nombres", "Nombres", "given-name", 120], ["apellidos", "Apellidos", "family-name", 120],
    ["ci", "Cédula de identidad (CI)", "off", 30], ["ru", "Registro universitario (RU)", "off", 30],
    ["mencion", "Mención", "off", 150],
  ] as const : [["nombreCompleto", "Nombre completo", "name", 150]] as const;
  const details = estudiante ? [["Nombres", estudiante.nombres], ["Apellidos", estudiante.apellidos],
    ["Cédula de identidad", estudiante.ci], ["Registro universitario (RU)", estudiante.ru],
    ["Mención", estudiante.mencion || "Sin registrar"], ["Correo institucional", estudiante.correo]] :
    [["Nombre completo", usuario.nombreCompleto], ["Correo institucional", usuario.correo],
    ["Rol asignado", accountRoleLabel(usuario.roles)], ["Estado del correo", usuario.correoVerificado ? "Verificado" : "Pendiente de verificación"]];

  function start() {
    setValues(estudiante ? { nombres: estudiante.nombres, apellidos: estudiante.apellidos, ci: estudiante.ci,
      ru: estudiante.ru, mencion: estudiante.mencion ?? "" } : { nombreCompleto: usuario.nombreCompleto });
    setError(""); setMessage(""); setErrors({}); setEditing(true);
  }
  function finish() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = (estudiante ? studentSchema : nameSchema).safeParse(values);
    setErrors({}); setError("");
    if (!parsed.success) {
      const issues = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      setErrors(issues);
      document.getElementById(`profile-${Object.keys(issues)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { data } = await authApi.updateProfile(parsed.data);
      // No restablecer una sesión que haya terminado mientras se guardaba el perfil.
      for (const store of [useAdminAuthStore, useUserAuthStore]) {
        store.setState(current => current.isAuthenticated && current.usuario?.idUsuario === data.data.usuario.idUsuario
          ? { usuario: data.data.usuario } : {});
      }
      if (data.data.estudiante) onSaved?.(data.data.estudiante);
      setMessage("Tus datos se guardaron correctamente."); finish();
    } catch (err) {
      setError(err instanceof AxiosError ? err.response?.data?.message || "No se pudieron guardar los cambios. Intenta nuevamente." : "No se pudieron guardar los cambios. Intenta nuevamente.");
    } finally { setBusy(false); }
  }

  return <div className="account-profile">
    {message && <p className="account-profile__success" role="status"><AdminIcon name="check" size={17} />{message}</p>}
    {editing ? <form ref={form} onSubmit={save} noValidate aria-label="Editar mis datos personales">
      <div className="account-profile__fields">{fields.map(([name, label, autoComplete, maxLength]) => <div key={name} className={name === "mencion" || name === "nombreCompleto" ? "account-profile__wide" : ""}>
        <label htmlFor={`profile-${name}`}>{label}</label>
        <input id={`profile-${name}`} className="input-field" name={name} autoComplete={autoComplete} maxLength={maxLength} required disabled={busy}
          value={values[name] ?? ""} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))}
          aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `profile-${name}-error` : undefined} />
        {errors[name] && <p id={`profile-${name}-error`} className="account-profile__error">{errors[name]}</p>}
      </div>)}</div>
      <p className="account-settings__form-note">El correo institucional de acceso se conserva: {usuario.correo}.</p>
      {error && <p className="account-profile__error" role="alert">{error}</p>}
      <div className="account-profile__actions"><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button><button className="btn-secondary" type="button" disabled={busy} onClick={finish}>Cancelar</button></div>
    </form> : <><dl className="account-settings__details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <button ref={editButton} type="button" className="account-profile__edit" onClick={start}><AdminIcon name="edit" size={17} />Editar mis datos</button></>}
  </div>;
}

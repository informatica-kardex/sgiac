import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { authApi, LoginChallenge, VerifyLoginPayload } from "../api/auth.api";
import { PasswordInput } from "./PasswordInput";
import { LoginVerification } from "./LoginSecurity";

export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    authApi.twoFactorStatus().then(({ data }) => {
      if (active) setEnabled(data.data.enabled);
    }).catch(() => {
      if (active) setError("No se pudo consultar la configuración. Recarga la página para intentarlo nuevamente.");
    });
    return () => { active = false; };
  }, []);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || enabled === null) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await authApi.setupTwoFactor({ contrasena: password, enabled: !enabled });
      setChallenge(data.data);
      setPassword("");
    } catch (err) {
      setError((err instanceof AxiosError && err.response?.data?.message) || "No se pudo enviar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(payload: VerifyLoginPayload) {
    const { data } = await authApi.confirmTwoFactor({ ...payload, enabled: !enabled });
    setEnabled(data.data.enabled);
    setChallenge(null);
    setEditing(false);
    setMessage(data.data.enabled ? "Verificación en dos pasos activada." : "Verificación en dos pasos desactivada.");
  }

  function cancel() {
    setChallenge(null);
    setEditing(false);
    setPassword("");
    setError("");
  }

  return (
    <section className="card space-y-4 p-6" aria-labelledby="two-factor-heading">
      <div className="space-y-1">
        <h2 id="two-factor-heading" className="font-semibold text-slate-800">Verificación en dos pasos (2FA)</h2>
        <p className="text-sm text-slate-600">{enabled === null ? "Consultando estado..." : enabled
          ? "Activada. Al iniciar sesión te pediremos un código enviado a tu correo."
          : "Desactivada. Puedes activarla para proteger tu cuenta con un código por correo."}</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      {challenge ? (
        <LoginVerification challenge={challenge} verify={confirm} onBack={cancel} settings />
      ) : editing ? (
        <form className="space-y-3" onSubmit={requestCode}>
          <label htmlFor="two-factor-password" className="block text-sm font-medium text-slate-700">Confirma tu contraseña actual</label>
          <PasswordInput id="two-factor-password" className="input-field" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <p className="text-xs text-slate-500">Enviaremos un código a tu correo para confirmar que deseas {enabled ? "desactivar" : "activar"} el 2FA.</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={busy || !password}>{busy ? "Enviando..." : "Enviar código"}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={cancel}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-primary" disabled={enabled === null}
          onClick={() => { setEditing(true); setMessage(""); setError(""); }}>
          {enabled ? "Desactivar 2FA" : "Activar 2FA"}
        </button>
      )}
    </section>
  );
}

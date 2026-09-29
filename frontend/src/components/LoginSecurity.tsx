import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import { authApi, LoginChallenge, VerifyLoginPayload } from "../api/auth.api";

export function useLoginCaptcha() {
  const [captcha, setCaptcha] = useState<{ captchaId: string; image: string } | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const request = useRef(0);
  const reloadCaptcha = useCallback(async () => {
    const current = ++request.current;
    setCaptcha(null);
    setCaptchaCode("");
    setCaptchaError("");
    try {
      const { data } = await authApi.captcha();
      if (current === request.current) setCaptcha(data.data);
    } catch {
      if (current === request.current) setCaptchaError("No se pudo cargar el CAPTCHA. Intenta nuevamente.");
    }
  }, []);
  useEffect(() => {
    void reloadCaptcha();
    return () => { request.current += 1; };
  }, [reloadCaptcha]);
  return { captcha, captchaCode, setCaptchaCode, captchaError, reloadCaptcha };
}

export function CaptchaField({ security, disabled }: {
  security: ReturnType<typeof useLoginCaptcha>; disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="login-captcha" className="block text-sm font-medium text-slate-700">
        Código CAPTCHA
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {security.captcha ? (
          <img src={security.captcha.image} width={220} height={70} alt="CAPTCHA: escribe las seis letras y números que aparecen en la imagen" className="rounded border border-slate-200" />
        ) : <span className="text-sm text-slate-500" role="status">{security.captchaError ? "CAPTCHA no disponible" : "Cargando CAPTCHA..."}</span>}
        <button type="button" className="text-sm font-medium text-blue-700 hover:underline" onClick={() => void security.reloadCaptcha()} disabled={disabled}>
          Cambiar imagen
        </button>
      </div>
      <input id="login-captcha" className="input-field" autoCapitalize="characters" spellCheck={false} autoComplete="off" maxLength={6}
        placeholder="Escribe las 6 letras y números" value={security.captchaCode} disabled={disabled || !security.captcha}
        onChange={(event) => security.setCaptchaCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} />
      {security.captchaError && <p className="text-xs text-red-600" role="alert">{security.captchaError}</p>}
    </div>
  );
}

export function LoginVerification({ challenge, verify, onBack, settings = false }: {
  challenge: LoginChallenge;
  verify: (payload: VerifyLoginPayload) => Promise<void>;
  onBack: () => void;
  settings?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await verify({ challengeId: challenge.challengeId, codigo });
    } catch (err) {
      setError((err instanceof AxiosError && err.response?.data?.message) || "No se pudo verificar el código. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1">
        <h3 className="font-semibold text-slate-800">Verificación en dos pasos</h3>
        <p className="text-sm text-slate-600">Enviamos un código a {challenge.maskedEmail}. Vence en {challenge.expiresIn / 60} minutos.</p>
      </div>
      <label htmlFor="login-verification" className="block text-sm font-medium text-slate-700">Código de verificación</label>
      <input id="login-verification" className="input-field" inputMode="numeric" autoComplete="one-time-code"
        autoFocus required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={codigo} disabled={busy}
        onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ""))} />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy || codigo.length !== 6}>
        {busy ? "Verificando..." : settings ? "Confirmar cambio" : "Verificar e ingresar"}
      </button>
      <p className="text-xs text-slate-500">Si no recibiste el código, revisa la carpeta de spam. Puedes volver atrás para solicitar otro después de un minuto.</p>
      <button type="button" className="w-full text-sm font-medium text-blue-700 hover:underline" onClick={onBack} disabled={busy}>
        {settings ? "Cancelar" : "Volver al inicio de sesión"}
      </button>
    </form>
  );
}

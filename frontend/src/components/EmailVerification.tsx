import { FormEvent, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import { authApi } from "../api/auth.api";
import { AlertMessage } from "../admin/components/AlertMessage";

interface Props {
  correo: string;
  autoSend?: boolean;
  initialMessage?: string;
  initialSent?: boolean;
  onVerified: () => Promise<void> | void;
}

export function EmailVerification({ correo, autoSend = false, initialMessage = "", initialSent = false, onVerified }: Props) {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState(initialMessage);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(initialSent ? 60 : 0);
  const [verificado, setVerificado] = useState(false);
  const enviado = useRef(false);
  const errorMessage = (e: unknown) => e instanceof AxiosError ? e.response?.data?.message || "No se pudo completar la solicitud. Intenta nuevamente." : "No se pudo completar la solicitud.";

  const reenviar = async () => {
    setOcupado(true); setError("");
    try {
      const { data } = await authApi.resendVerification(correo);
      setMensaje(data.data.mensaje); setEspera(data.data.reenviarEn); setCodigo("");
    } catch (e) { setError(errorMessage(e)); }
    finally { setOcupado(false); }
  };
  useEffect(() => {
    if (autoSend && !enviado.current) { enviado.current = true; void reenviar(); }
  }, [autoSend]);
  useEffect(() => {
    if (!espera) return;
    const timeout = window.setTimeout(() => setEspera(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [espera]);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setOcupado(true);
    try {
      if (!verificado) {
        await authApi.verifyEmail({ correo, codigo });
        setVerificado(true);
      }
      await onVerified();
    } catch (e) { setError(errorMessage(e)); }
    finally { setOcupado(false); }
  };

  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold text-slate-800">Confirma tu correo electrónico</h1><p className="mt-2 text-sm text-slate-600">Ingresa el código temporal de 6 dígitos enviado a <strong className="break-all">{correo}</strong>. Vence en 15 minutos.</p></div>
    {mensaje && <p className="text-sm text-slate-600" role="status">{mensaje}</p>}
    {error && <AlertMessage type="error" message={error} />}
    {verificado && <AlertMessage type="success" message="Tu correo está confirmado. Ya puedes continuar." />}
    <form className="space-y-4" onSubmit={confirmar}>
      {!verificado && <label className="block text-sm font-medium text-slate-700">Código de verificación<input className="input-field mt-2 text-center text-xl tracking-widest" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={codigo} disabled={ocupado} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} /></label>}
      <button className="btn-primary w-full" disabled={ocupado || (!verificado && codigo.length !== 6)}>{ocupado ? "Procesando..." : verificado ? "Continuar" : "Confirmar correo"}</button>
    </form>
    {!verificado && <><p className="text-xs text-slate-500">Revisa también spam. Si solicitas otro código, el anterior dejará de funcionar. Este código no reemplaza tu contraseña.</p><button type="button" className="btn-ghost w-full" disabled={ocupado || espera > 0} onClick={() => void reenviar()}>{espera > 0 ? `Reenviar código en ${espera} s` : "Reenviar código"}</button></>}
  </div>;
}

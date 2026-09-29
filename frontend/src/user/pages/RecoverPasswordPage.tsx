import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { authApi } from "../../api/auth.api";
import { PasswordInput, PasswordStrength } from "../../components/PasswordInput";
import { AlertMessage } from "../components/AlertMessage";
import { ForgotPasswordFormData, forgotPasswordSchema, ResetPasswordFormData, resetPasswordSchema } from "../../utils/validators";
import { usePasswordUpdated } from "../../hooks/usePasswordUpdated";

export default function RecoverPasswordPage() {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const updated = usePasswordUpdated(false);
  const emailForm = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema) });
  const resetForm = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) });
  useEffect(() => {
    if (!wait) return;
    const timer = window.setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);
  const showError = (e: unknown) => setError(e instanceof AxiosError ? e.response?.data?.message || "No se pudo completar la solicitud. Intenta nuevamente." : "No se pudo completar la solicitud. Intenta nuevamente.");
  const send = async ({ correo: email }: ForgotPasswordFormData) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await authApi.forgotPassword({ correo: email });
      setCorreo(email); setWait(60); setMessage(data.data.mensaje);
      resetForm.reset({ correo: email, codigo: "", nuevaContrasena: "", confirmarContrasena: "" });
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  };
  const reset = async (values: ResetPasswordFormData) => {
    setBusy(true); setError("");
    try { await authApi.resetPassword(values); updated(); }
    catch (e) { showError(e); }
    finally { setBusy(false); }
  };

  return <div className="container-public flex min-h-[70vh] items-center justify-center py-12">
    <div className="card w-full max-w-md space-y-5 p-8">
      <div className="space-y-2 text-center"><p className="text-xs font-semibold uppercase tracking-widest text-blue-800">Acceso estudiantil</p><h1 className="text-2xl font-bold text-slate-800">Recupera tu contraseña</h1><p className="text-sm text-slate-500">{correo ? `Ingresa el código enviado a ${correo} y elige tu nueva contraseña.` : "Ingresa el correo de tu cuenta para recibir un código de recuperación."}</p></div>
      <div aria-live="polite">{error && <AlertMessage type="error" message={error} />}{message && <AlertMessage type="success" message={message} />}</div>
      {!correo ? <form className="space-y-4" onSubmit={emailForm.handleSubmit(send)} noValidate>
        <label className="block text-sm font-medium">Correo institucional<input type="email" autoComplete="email" className="input-field mt-1" {...emailForm.register("correo")} disabled={busy} /></label>
        {emailForm.formState.errors.correo && <p className="text-xs text-red-600">{emailForm.formState.errors.correo.message}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Enviando..." : "Enviar código"}</button>
      </form> : <>
        <form className="space-y-4" onSubmit={resetForm.handleSubmit(reset)} noValidate>
          <input type="hidden" {...resetForm.register("correo")} />
          <label className="block text-sm font-medium">Código de 6 dígitos<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input-field mt-1 text-center text-xl tracking-[0.3em]" {...resetForm.register("codigo")} disabled={busy} /></label>
          {resetForm.formState.errors.codigo && <p className="text-xs text-red-600">{resetForm.formState.errors.codigo.message}</p>}
          <label className="block text-sm font-medium">Nueva contraseña<PasswordInput autoComplete="new-password" className="input-field mt-1" {...resetForm.register("nuevaContrasena")} disabled={busy} /></label>
          <PasswordStrength password={resetForm.watch("nuevaContrasena") ?? ""} />
          {resetForm.formState.errors.nuevaContrasena && <p className="text-xs text-red-600">{resetForm.formState.errors.nuevaContrasena.message}</p>}
          <label className="block text-sm font-medium">Confirmar nueva contraseña<PasswordInput autoComplete="new-password" className="input-field mt-1" {...resetForm.register("confirmarContrasena")} disabled={busy} /></label>
          {resetForm.formState.errors.confirmarContrasena && <p className="text-xs text-red-600">{resetForm.formState.errors.confirmarContrasena.message}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Actualizando..." : "Actualizar contraseña"}</button>
        </form>
        <p className="text-xs text-slate-500">El código vence en 15 minutos. Revisa también spam. Si solicitas otro código, el anterior dejará de funcionar.</p>
        <button type="button" className="btn-ghost w-full" disabled={busy || wait > 0} onClick={() => void send({ correo })}>{wait ? `Reenviar código en ${wait} s` : "Reenviar código"}</button>
        <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => { setCorreo(""); setError(""); setMessage(""); }}>Usar otro correo</button>
      </>}
      <p className="text-xs text-slate-500">Esta opción es exclusiva para estudiantes. Si eres subadministrador, solicita el restablecimiento al administrador.</p>
      <Link to="/login" className="block text-center text-sm font-medium text-blue-800 hover:underline">Volver a iniciar sesión</Link>
    </div>
  </div>;
}

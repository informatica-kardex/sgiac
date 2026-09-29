import { CaptchaField, LoginVerification, useLoginCaptcha } from "../../components/LoginSecurity";
import { LoginChallenge } from "../../api/auth.api";
import { PasswordInput } from "../../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { AlertMessage } from "../components/AlertMessage";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { AdminLoginFormData, adminLoginSchema } from "../../utils/validators";

export default function AdminLoginPage() {
  const { login, verifyLogin } = useAdminAuth();
  const security = useLoginCaptcha();
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>({ resolver: zodResolver(adminLoginSchema) });

  const onSubmit = async (data: AdminLoginFormData) => {
    setServerError("");
    if (!security.captcha || security.captchaCode.length !== 6) {
      setServerError("Completa las 6 letras y numeros del CAPTCHA");
      return;
    }
    setIsSubmitting(true);
    try {
      setChallenge(await login({ ...data, captchaId: security.captcha.captchaId, captchaCode: security.captchaCode }));
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.response?.data?.message : undefined;
      setServerError(message || "No se pudo iniciar sesion. Intenta nuevamente.");
      void security.reloadCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-panel admin-login-card card space-y-6 p-8">
      <div className="login-heading space-y-1 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Acceso administrativo</h1>
        <p className="text-sm text-slate-500">
          Ingresa con tus credenciales de administrador
        </p>
      </div>

      {serverError && <AlertMessage type="error" message={serverError} />}

      {challenge ? (
          <LoginVerification challenge={challenge} verify={verifyLogin} onBack={() => {
            setChallenge(null);
            setServerError("");
            void security.reloadCaptcha();
          }} />
        ) : (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="admin-login-field space-y-1.5">
          <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700">Correo</label>
          <div className="admin-login-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 6.5h16v11H4z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m4.5 7 7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              id="admin-email"
              autoComplete="username"
              type="email"
              className="admin-login-input input-field !pl-11"
              placeholder="admin@sgiac.edu.bo"
              {...register("correo")}
            />
          </div>
          {errors.correo && <p className="text-xs text-red-600">{errors.correo.message}</p>}
        </div>

        <div className="admin-login-field space-y-1.5">
          <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">Contraseña</label>
          <PasswordInput
            id="admin-password"
            autoComplete="current-password"
            type="password"
            className="admin-login-input input-field"
            placeholder="••••••••"
            {...register("contrasena")}
          />
          {errors.contrasena && (
            <p className="text-xs text-red-600">{errors.contrasena.message}</p>
          )}
        </div>

        <CaptchaField security={security} disabled={isSubmitting} />
        <p className="text-xs text-slate-500">Si eres un subadministrador nuevo, ingresa tu correo y usa tu CI como contraseña temporal. Deberás cambiarla antes de acceder al panel.</p>

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting || !security.captcha || security.captchaCode.length !== 6}>
          {isSubmitting ? "Ingresando..." : "Ingresar al panel"}
        </button>
      </form>
        )}

      <p className="text-center text-xs text-slate-500">Si eres subadministrador y olvidaste tu contraseña, solicita al administrador que la restablezca a tu CI.</p>
      <p className="text-center text-xs text-slate-400">
        Acceso exclusivo para administradores y subadministradores de la
        Carrera de Informática.
      </p>

      <Link
        to="/"
        className="block text-center text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        ← Volver al portal público
      </Link>
    </div>
  );
}

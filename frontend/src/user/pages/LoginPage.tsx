import { CaptchaField, LoginVerification, useLoginCaptcha } from "../../components/LoginSecurity";
import { LoginChallenge } from "../../api/auth.api";
import { PasswordInput } from "../../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { AlertMessage } from "../components/AlertMessage";
import { useAuth } from "../../hooks/useAuth";
import { LoginFormData, loginSchema } from "../../utils/validators";
import { LoginBackdrop } from "../../components/LoginBrand";

// Login institucional (/login). Es un flujo completamente
// independiente del login administrativo (/admin/login): usa su
// propio hook (useAuth), su propio store (userAuthStore) y su
// propio endpoint (/api/auth/login, no /api/auth/admin/login).
export default function LoginPage() {
  const { login, verifyLogin } = useAuth();
  const security = useLoginCaptcha();
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
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
    <div className="institutional-login container-public flex min-h-[70vh] items-center justify-center py-12">
      <LoginBackdrop />
      <div className="login-panel card w-full max-w-md space-y-6 p-8">
        <div className="login-heading space-y-1 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Bienvenido a Kardex</h1>
          <p className="text-sm text-slate-500">
            Ingresa con tu cuenta institucional para acceder a los servicios de Kardex.
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
          <div className="space-y-1.5">
            <label htmlFor="institutional-email" className="block text-sm font-medium text-slate-700">Correo institucional</label>
            <input
              id="institutional-email"
              autoComplete="username"
              type="email"
              className="input-field"
              placeholder="usuario@dominio.edu.bo"
              {...register("correo")}
            />
            {errors.correo && <p className="text-xs text-red-600">{errors.correo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="institutional-password" className="block text-sm font-medium text-slate-700">Contraseña</label>
            <PasswordInput
              id="institutional-password"
              autoComplete="current-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              {...register("contrasena")}
            />
            {errors.contrasena && (
              <p className="text-xs text-red-600">{errors.contrasena.message}</p>
            )}
          </div>

          <div className="text-right"><Link to="/recuperar-password" className="text-sm font-medium text-blue-800 hover:underline">¿Olvidaste tu contraseña?</Link></div>
          <CaptchaField security={security} disabled={isSubmitting} />

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting || !security.captcha || security.captchaCode.length !== 6}>
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        )}

        <p className="text-center text-sm text-slate-500">¿No tienes una cuenta? <Link to="/registro" className="font-medium hover:underline">Crear cuenta</Link></p>
        <div className="text-center text-xs text-slate-400">
          <Link to="/" className="block font-medium text-slate-400 hover:text-slate-600">
            ← Volver al portal público
          </Link>
        </div>
      </div>
    </div>
  );
}

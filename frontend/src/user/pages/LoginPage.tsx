import { PasswordInput } from "../../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { AlertMessage } from "../components/AlertMessage";
import { useAuth } from "../../hooks/useAuth";
import { LoginFormData, loginSchema } from "../../utils/validators";

// Login institucional (/login). Es un flujo completamente
// independiente del login administrativo (/admin/login): usa su
// propio hook (useAuth), su propio store (userAuthStore) y su
// propio endpoint (/api/auth/login, no /api/auth/admin/login).
export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");
    setIsSubmitting(true);
    try {
      await login(data);
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.response?.data?.message : undefined;
      setServerError(message || "Credenciales invalidas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-public flex min-h-[70vh] items-center justify-center py-12">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-bold text-slate-800">Ingresar</h2>
          <p className="text-sm text-slate-500">
            Accede con tu cuenta institucional para solicitar tu ficha de
            atención Kardex y ver tus solicitudes.
          </p>
        </div>

        {serverError && <AlertMessage type="error" message={serverError} />}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Correo institucional</label>
            <input
              type="email"
              className="input-field"
              placeholder="usuario@dominio.edu.bo"
              {...register("correo")}
            />
            {errors.correo && <p className="text-xs text-red-600">{errors.correo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Contraseña</label>
            <PasswordInput
              type="password"
              className="input-field"
              placeholder="••••••••"
              {...register("contrasena")}
            />
            {errors.contrasena && (
              <p className="text-xs text-red-600">{errors.contrasena.message}</p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">¿No tienes una cuenta? <Link to="/registro" className="font-medium text-blue-700 hover:underline">Crear cuenta</Link></p>
        <div className="text-center text-xs text-slate-400">
          <Link to="/" className="block font-medium text-slate-400 hover:text-slate-600">
            ← Volver al portal público
          </Link>
        </div>
      </div>
    </div>
  );
}

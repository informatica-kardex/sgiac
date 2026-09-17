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
  const { login } = useAdminAuth();
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>({ resolver: zodResolver(adminLoginSchema) });

  const onSubmit = async (data: AdminLoginFormData) => {
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
    <div className="card space-y-6 p-8">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Acceso administrativo</h2>
        <p className="text-sm text-slate-500">
          Ingresa con tus credenciales de administrador
        </p>
      </div>

      {serverError && <AlertMessage type="error" message={serverError} />}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Correo</label>
          <input
            type="email"
            className="input-field"
            placeholder="admin@sgiac.edu.bo"
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
          {isSubmitting ? "Ingresando..." : "Ingresar al panel"}
        </button>
      </form>

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

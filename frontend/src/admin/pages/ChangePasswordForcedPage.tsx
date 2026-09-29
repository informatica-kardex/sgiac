import { PasswordInput, PasswordStrength } from "../../components/PasswordInput";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { usePasswordUpdated } from "../../hooks/usePasswordUpdated";
import { AlertMessage } from "../components/AlertMessage";
import { authApi } from "../../api/auth.api";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { useUserAuthStore } from "../../store/userAuthStore";
import { ChangePasswordFormData, changePasswordSchema } from "../../utils/validators";

// Pantalla obligatoria tras el primer login con la contraseña
// temporal del administrador (Admin123*) o de cualquier cuenta
// creada con `debeCambiarPassword = true`.
export default function ChangePasswordForcedPage({ admin = true }: { admin?: boolean }) {
  const mostrarConfirmacion = usePasswordUpdated(admin);
  const adminSession = useAdminAuthStore();
  const userSession = useUserAuthStore();
  const { usuario } = admin ? adminSession : userSession;
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setServerError("");
    setIsSubmitting(true);
    try {
      await authApi.changePassword(data);
      mostrarConfirmacion();
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.response?.data?.message : undefined;
      setServerError(message || "No se pudo actualizar la contraseña");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card space-y-6 p-8">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Actualiza tu contraseña</h2>
        <p className="text-sm text-slate-500">
          {usuario
            ? `Hola ${usuario.nombreCompleto.split(" ")[0]}, `
            : ""}
          por seguridad debes establecer una nueva contraseña antes de continuar.
        </p>
      </div>

      {serverError && <AlertMessage type="error" message={serverError} />}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Contraseña temporal actual
          </label>
          <p className="text-xs text-slate-500">Si el administrador restableció tu contraseña, ingresa tu CI como contraseña temporal.</p>
          <PasswordInput
            type="password"
            className="input-field"
            {...register("contrasenaActual")}
          />
          {errors.contrasenaActual && (
            <p className="text-xs text-red-600">{errors.contrasenaActual.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Nueva contraseña</label>
          <PasswordInput
            type="password"
            className="input-field"
            {...register("nuevaContrasena")}
          />
              <PasswordStrength password={watch("nuevaContrasena") ?? ""} />
          {errors.nuevaContrasena && (
            <p className="text-xs text-red-600">{errors.nuevaContrasena.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Confirmar nueva contraseña
          </label>
          <PasswordInput
            type="password"
            className="input-field"
            {...register("confirmarContrasena")}
          />
          {errors.confirmarContrasena && (
            <p className="text-xs text-red-600">{errors.confirmarContrasena.message}</p>
          )}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? "Actualizando..." : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}

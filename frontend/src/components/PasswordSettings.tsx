import { PasswordInput, PasswordStrength } from "./PasswordInput";
import { AdminIcon } from "../admin/components/AdminIcon";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { authApi } from "../api/auth.api";
import { AlertMessage } from "../admin/components/AlertMessage";
import { ChangePasswordFormData, changePasswordSchema } from "../utils/validators";
import { usePasswordUpdated } from "../hooks/usePasswordUpdated";

export function PasswordSettings({ student = false }: { student?: boolean }) {
  const mostrarConfirmacion = usePasswordUpdated(!student);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setError("");
    setEnviando(true);
    try {
      await authApi.changePassword(data);
      mostrarConfirmacion();
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.message : undefined;
      setError(message || "No se pudo actualizar la contraseña.");
    } finally {
      setEnviando(false);
    }
  };

  return (
      <section className="account-settings__card account-settings__password" aria-labelledby="account-password-title">
        <div className="account-settings__card-heading"><span className="account-settings__icon"><AdminIcon name="configuracion" size={21} /></span><div><h2 id="account-password-title">Cambiar contraseña</h2><p>Elige una contraseña que utilices solo en tu cuenta de Kardex.</p></div></div>

        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="account-current-password" className="block text-sm font-medium text-slate-700">Contraseña actual</label>
            <PasswordInput id="account-current-password" autoComplete="current-password" type="password" className="input-field" disabled={enviando} {...register("contrasenaActual")} />
            {errors.contrasenaActual && (
              <p className="text-xs text-red-600">{errors.contrasenaActual.message}</p>
            )}
          </div>
          <div className="account-settings__password-grid">
            <div className="space-y-1.5">
              <label htmlFor="account-new-password" className="block text-sm font-medium text-slate-700">Nueva contraseña</label>
              <PasswordInput id="account-new-password" autoComplete="new-password" type="password" className="input-field" disabled={enviando} {...register("nuevaContrasena")} />
              <PasswordStrength password={watch("nuevaContrasena") ?? ""} />
              {errors.nuevaContrasena && (
                <p className="text-xs text-red-600">{errors.nuevaContrasena.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="account-confirm-password" className="block text-sm font-medium text-slate-700">Confirmar nueva contraseña</label>
              <PasswordInput id="account-confirm-password" autoComplete="new-password" type="password" className="input-field" disabled={enviando} {...register("confirmarContrasena")} />
              {errors.confirmarContrasena && (
                <p className="text-xs text-red-600">{errors.confirmarContrasena.message}</p>
              )}
            </div>
          </div>
          <p className="account-settings__form-note">Al actualizar tu contraseña, volverás a iniciar sesión con la nueva.</p>
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </section>
  );
}

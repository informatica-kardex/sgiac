import { PasswordInput, PasswordStrength } from "../../components/PasswordInput";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { authApi } from "../../api/auth.api";
import { AlertMessage } from "../components/AlertMessage";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { ChangePasswordFormData, changePasswordSchema } from "../../utils/validators";
import { ROL_LABEL } from "../../utils/formatters";

export default function ConfiguracionPage() {
  const { usuario } = useAdminAuthStore();
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setError("");
    setMensaje("");
    setEnviando(true);
    try {
      await authApi.changePassword(data);
      setMensaje("Contraseña actualizada correctamente.");
      reset();
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.message : undefined;
      setError(message || "No se pudo actualizar la contraseña.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
        <p className="text-sm text-slate-500">Datos de tu cuenta y seguridad.</p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mi cuenta
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Nombre</dt>
            <dd className="font-medium text-slate-700">{usuario?.nombreCompleto}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Correo</dt>
            <dd className="font-medium text-slate-700">{usuario?.correo}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Rol</dt>
            <dd className="font-medium text-slate-700">
              {usuario?.roles?.map((r) => ROL_LABEL[r] ?? r).join(", ")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Cambiar contraseña
        </h2>

        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        {mensaje && <div className="mb-4"><AlertMessage type="success" message={mensaje} /></div>}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Contraseña actual</label>
            <PasswordInput type="password" className="input-field" {...register("contrasenaActual")} />
            {errors.contrasenaActual && (
              <p className="text-xs text-red-600">{errors.contrasenaActual.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Nueva contraseña</label>
              <PasswordInput type="password" className="input-field" {...register("nuevaContrasena")} />
              <PasswordStrength password={watch("nuevaContrasena") ?? ""} />
              {errors.nuevaContrasena && (
                <p className="text-xs text-red-600">{errors.nuevaContrasena.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Confirmar</label>
              <PasswordInput type="password" className="input-field" {...register("confirmarContrasena")} />
              {errors.confirmarContrasena && (
                <p className="text-xs text-red-600">{errors.confirmarContrasena.message}</p>
              )}
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

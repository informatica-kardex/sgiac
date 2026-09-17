import { PasswordInput, PasswordStrength } from "../../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { authApi } from "../../api/auth.api";
import { registerSchema, RegisterFormData } from "../../utils/validators";
import { AlertMessage } from "../components/AlertMessage";

export default function RegisterPage() {
  const [serverError, setServerError] = useState("");
  const [created, setCreated] = useState(false);
  const { register, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  async function submit(data: RegisterFormData) {
    setServerError("");
    try {
      await authApi.register(data);
      setCreated(true);
    } catch (error) {
      setServerError(error instanceof AxiosError ? error.response?.data?.message || "No se pudo crear la cuenta. Intenta nuevamente." : "No se pudo crear la cuenta. Intenta nuevamente.");
    }
  }

  function field(name: keyof RegisterFormData, label: string, placeholder: string, type = "text", autoComplete = "off") {
    const Input = type === "password" ? PasswordInput : "input";
    return <div className="space-y-1">
      <label htmlFor={name} className="block text-[13px] font-medium text-slate-800">{label}</label>
      <Input id={name} type={type} placeholder={placeholder} autoComplete={autoComplete}
        className="input-field h-[38px] rounded-md text-xs" disabled={isSubmitting}
        aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...register(name, type === "number" ? { valueAsNumber: true } : {})} />
      {name === "contrasena" && <PasswordStrength password={watch("contrasena") ?? ""} />}
      {errors[name] && <p id={`${name}-error`} className="text-xs text-red-600">{errors[name]?.message}</p>}
    </div>;
  }

  return <div className="container-public flex justify-center py-10">
    <section className="w-full max-w-[605px] rounded-lg border border-slate-200 bg-white px-5 py-7 sm:px-[29px]">
      <h1 className="text-center text-[22px] font-bold leading-7 text-slate-800">Crear cuenta institucional</h1>
      <p className="mt-1 text-center text-xs leading-5 text-slate-500">Completa tus datos personales y académicos para solicitar tu ficha de atención Kardex.</p>
      {created ? <div className="mt-6 space-y-5">
        <AlertMessage type="success" message="Cuenta creada correctamente. Ya puedes ingresar con tu correo y contraseña." />
        <Link to="/login" className="btn-primary w-full">Ir a iniciar sesión</Link>
      </div> : <form onSubmit={handleSubmit(submit)} noValidate className="mt-5">
        {serverError && <div className="mb-5"><AlertMessage type="error" message={serverError} /></div>}
        <fieldset>
          <legend className="mb-3 text-[13px] font-medium text-slate-800">Datos personales</legend>
          <div className="grid grid-cols-1 gap-x-[15px] gap-y-4 sm:grid-cols-2">
            {field("nombres", "Nombres", "Juan Carlos", "text", "given-name")}
            {field("apellidos", "Apellidos", "Pérez Gómez", "text", "family-name")}
            {field("ci", "Cédula de identidad (CI)", "1234567 LP")}
            {field("correo", "Correo institucional", "usuario@estudiante.edu.bo", "email", "email")}
            {field("contrasena", "Contraseña", "••••••••", "password", "new-password")}
            {field("confirmarContrasena", "Confirmar contraseña", "••••••••", "password", "new-password")}
          </div>
        </fieldset>
        <fieldset className="mt-6 border-t border-slate-200 pt-8">
          <legend className="pr-5 text-[13px] font-medium text-slate-800">Datos académicos</legend>
          <div className="grid grid-cols-1 gap-x-[15px] gap-y-4 sm:grid-cols-3">
            {field("ru", "RU (Registro Universitario)", "2023-12345")}
            <div className="sm:col-span-2">{field("carrera", "Carrera", "Ingeniería Informática")}</div>
            {field("semestre", "Semestre", "5", "number")}
            {field("gestion", "Gestión", String(new Date().getFullYear()), "number")}
          </div>
        </fieldset>
        <button type="submit" disabled={isSubmitting} className="btn-primary mt-[22px] w-full bg-blue-700 hover:bg-blue-800">{isSubmitting ? "Creando cuenta..." : "Crear cuenta"}</button>
        <p className="mt-4 text-center text-xs text-slate-500">¿Ya tienes una cuenta? <Link to="/login" className="font-medium text-blue-700 hover:underline">Iniciar sesión</Link></p>
      </form>}
    </section>
  </div>;
}

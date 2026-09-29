import { Link } from "react-router-dom";

export default function PasswordUpdatedPage({ admin = true }: { admin?: boolean }) {
  return <div className="card space-y-5 p-8 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
    </div>
    <div className="space-y-3" role="status">
      <h1 className="text-2xl font-bold text-emerald-700">¡Felicidades!</h1>
      <p className="font-semibold text-slate-800">Tu contraseña ha sido actualizada correctamente.</p>
      <p className="text-sm leading-6 text-slate-600">Ahora debes iniciar sesión con tu correo y tu nueva contraseña para acceder al sistema.</p>
    </div>
    <Link className="btn-primary w-full" to={admin ? "/admin/login" : "/login"} replace>Iniciar sesión con mi nueva contraseña</Link>
  </div>;
}

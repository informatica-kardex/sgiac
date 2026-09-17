import { useAuth } from "../../hooks/useAuth";

// Dashboard del usuario institucional (/usuario/dashboard).
// Las funcionalidades de "solicitar ficha de atencion", "consultar
// solicitudes" e "historial personal" son funciones futuras segun
// el objetivo del sistema; por ahora se deja el espacio preparado.
export default function DashboardPage() {
  const { usuario, logout } = useAuth();

  return (
    <div className="container-public space-y-8 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Hola, {usuario?.nombreCompleto?.split(" ")[0] ?? "usuario"}
          </h1>
          <p className="text-sm text-slate-500">{usuario?.correo}</p>
        </div>
        <button onClick={logout} className="btn-secondary">
          Cerrar sesión
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800">Solicitar ficha de atención Kardex</h3>
          <p className="mt-1 text-sm text-slate-500">Próximamente disponible.</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800">Mis solicitudes</h3>
          <p className="mt-1 text-sm text-slate-500">Próximamente disponible.</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800">Notificaciones</h3>
          <p className="mt-1 text-sm text-slate-500">Próximamente disponible.</p>
        </div>
      </div>
    </div>
  );
}

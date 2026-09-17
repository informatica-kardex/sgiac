import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { LoadingSpinner } from "../admin/components/LoadingSpinner";

// Protege todas las rutas bajo /admin/* (excepto /admin/login).
// Si no hay sesion administrativa activa, redirige al login del
// panel. Si el usuario debe cambiar su contrasena temporal, lo
// fuerza a la pantalla de cambio antes de continuar.
export function AdminProtectedRoute() {
  const { isAuthenticated, isInitializing, usuario } = useAdminAuthStore();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingSpinner label="Verificando sesion administrativa..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (
    usuario?.debeCambiarPassword &&
    location.pathname !== "/admin/cambiar-password"
  ) {
    return <Navigate to="/admin/cambiar-password" replace />;
  }

  return <Outlet />;
}

// Evita que un administrador ya autenticado vuelva a ver la
// pantalla de login.
export function AdminGuestRoute() {
  const { isAuthenticated, isInitializing } = useAdminAuthStore();

  if (isInitializing) {
    return <LoadingSpinner label="Cargando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}

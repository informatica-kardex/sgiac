import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUserAuthStore } from "../store/userAuthStore";
import { LoadingSpinner } from "../public-site/components/LoadingSpinner";

// Protege las rutas bajo /usuario/*. Si no hay sesion
// institucional activa, redirige a /login (NO a /admin/login:
// son dos flujos de autenticacion completamente separados).
export function UserProtectedRoute() {
  const { isAuthenticated, isInitializing, usuario } = useUserAuthStore();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingSpinner label="Verificando sesion..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!usuario?.correoVerificado && location.pathname !== "/usuario/verificar-correo") {
    return <Navigate to="/usuario/verificar-correo" replace />;
  }
  if (usuario?.correoVerificado && usuario.debeCambiarPassword && location.pathname !== "/usuario/cambiar-password") {
    return <Navigate to="/usuario/cambiar-password" replace />;
  }
  if (usuario?.correoVerificado && !usuario.debeCambiarPassword && location.pathname === "/usuario/cambiar-password") {
    return <Navigate to="/usuario/dashboard" replace />;
  }
  if (usuario?.correoVerificado && location.pathname === "/usuario/verificar-correo") {
    return <Navigate to="/usuario/dashboard" replace />;
  }

  return <Outlet />;
}

// Evita que un usuario institucional ya autenticado vuelva a ver
// la pantalla de login.
export function UserGuestRoute() {
  const { isAuthenticated, isInitializing } = useUserAuthStore();

  if (isInitializing) {
    return <LoadingSpinner label="Cargando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/usuario/dashboard" replace />;
  }

  return <Outlet />;
}

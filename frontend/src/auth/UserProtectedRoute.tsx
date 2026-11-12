import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUserAuthStore } from "../store/userAuthStore";
import { LoadingSpinner } from "../public-site/components/LoadingSpinner";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { sessionHome } from "./session";

// El portal estudiantil requiere una sesión; el personal accede a su panel.
export function UserProtectedRoute() {
  const { isAuthenticated, isInitializing, usuario } = useUserAuthStore();
  const admin = useAdminAuthStore();
  const location = useLocation();

  if (isInitializing || admin.isInitializing) {
    return <LoadingSpinner label="Verificando sesion..." />;
  }

  if (admin.isAuthenticated && admin.usuario) return <Navigate to={sessionHome(admin.usuario)} replace />;

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
  const { isAuthenticated, isInitializing, usuario } = useUserAuthStore();
  const admin = useAdminAuthStore();

  if (isInitializing || admin.isInitializing) {
    return <LoadingSpinner label="Cargando..." />;
  }

  if (admin.isAuthenticated && admin.usuario) return <Navigate to={sessionHome(admin.usuario)} replace />;
  if (isAuthenticated && usuario) {
    return <Navigate to={sessionHome(usuario)} replace />;
  }

  return <Outlet />;
}

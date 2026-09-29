import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { authApi } from "../api/auth.api";
import { esRolAdministrativo, puedeAccederModulo } from "../utils/roles";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { LoadingSpinner } from "../admin/components/LoadingSpinner";

// Protege todas las rutas bajo /admin/* (excepto /admin/login).
// Si no hay sesion administrativa activa, redirige al login del
// panel. Si el usuario debe cambiar su contrasena temporal, lo
// fuerza a la pantalla de cambio antes de continuar.
export function AdminProtectedRoute() {
  const { isAuthenticated, isInitializing, usuario } = useAdminAuthStore();
  const location = useLocation();
  const [verificada, setVerificada] = useState("");
  const [error, setError] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick(n => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let vigente = true;
    let pendiente = false;
    const actualizar = async () => {
      if (pendiente) return;
      pendiente = true;
      try {
        const { data } = await authApi.me();
        if (!vigente) return;
        const store = useAdminAuthStore.getState();
        if (!esRolAdministrativo(data.data.roles)) { store.clearSession(); return; }
        if (store.accessToken) store.setSession(data.data, store.accessToken);
        setError(false);
        setVerificada(location.pathname);
      } catch {
        if (vigente) setError(true);
      } finally { pendiente = false; }
    };
    void actualizar();
    const intervalo = window.setInterval(actualizar, 30000);
    window.addEventListener("focus", actualizar);
    return () => { vigente = false; window.clearInterval(intervalo); window.removeEventListener("focus", actualizar); };
  }, [isAuthenticated, location.pathname]);

  if (isInitializing) {
    return <LoadingSpinner label="Verificando sesion administrativa..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (error) return <div className="p-8" role="alert">No se pudieron verificar tus permisos. <button className="btn-primary" onClick={() => window.location.reload()}>Reintentar</button></div>;
  if (verificada !== location.pathname) return <LoadingSpinner label="Verificando permisos..." />;

  if (!usuario?.correoVerificado) {
    return location.pathname === "/admin/verificar-correo" ? <Outlet /> : <Navigate to="/admin/verificar-correo" replace />;
  }
  if (location.pathname === "/admin/verificar-correo") {
    return <Navigate to={usuario.debeCambiarPassword ? "/admin/cambiar-password" : "/admin/dashboard"} replace />;
  }

  if (
    usuario?.debeCambiarPassword &&
    location.pathname !== "/admin/cambiar-password"
  ) {
    return <Navigate to="/admin/cambiar-password" replace />;
  }

  const modulo = location.pathname.split("/")[2];
  if (modulo !== "cambiar-password" && !puedeAccederModulo(usuario?.roles ?? [], modulo, usuario?.permisos)) {
    return <Navigate to="/admin/dashboard" replace />;
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

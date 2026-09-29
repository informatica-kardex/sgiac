import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";

export function usePasswordUpdated(admin = true) {
  const navigate = useNavigate();
  return () => {
    // Primero desmontar las rutas protegidas: cerrar la sesión dentro de ellas
    // puede disparar su redirección al login y ocultar la confirmación.
    flushSync(() => navigate(admin ? "/admin/password-actualizada" : "/usuario/password-actualizada", { replace: true }));
    useAdminAuthStore.getState().clearSession();
    useUserAuthStore.getState().clearSession();
  };
}

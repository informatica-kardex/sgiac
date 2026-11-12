import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserAuthStore } from "../store/userAuthStore";
import { authApi, LoginPayload, VerifyLoginPayload } from "../api/auth.api";
import { clearSession, establishSession, sessionHome } from "../auth/session";
import { AuthResponse } from "../api/types";

// Ingreso único: el destino depende exclusivamente del perfil devuelto por el servidor.
export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.generarFicha === true ? "/usuario/fichas?solicitar=1" : "/usuario/dashboard";
  const { usuario, isAuthenticated } =
    useUserAuthStore();

  const completeLogin = useCallback((data: AuthResponse) => {
    establishSession(data);
    const home = sessionHome(data.usuario);
    navigate(home === "/usuario/dashboard" ? destino : home, { replace: true });
  }, [navigate, destino]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await authApi.login(payload);
      if ("requiresTwoFactor" in data.data) return data.data;
      completeLogin(data.data);
      return null;
    },
    [completeLogin]
  );

  const verifyLogin = useCallback(
    async (payload: VerifyLoginPayload) => {
      const { data } = await authApi.verifyLogin(payload);
      completeLogin(data.data);
    },
    [completeLogin]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate("/login");
    }
  }, [navigate]);

  return { usuario, isAuthenticated, login, verifyLogin, logout };
}

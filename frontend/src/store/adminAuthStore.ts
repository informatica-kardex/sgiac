import { create } from "zustand";
import { UsuarioSesion } from "../api/types";

// Estado global de la sesion del PANEL ADMINISTRATIVO. El portal
// publico no requiere sesion, por lo que este store solo se usa
// dentro de /admin.
interface AdminAuthState {
  usuario: UsuarioSesion | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setSession: (usuario: UsuarioSesion, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setInitializing: (value: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  usuario: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,

  setSession: (usuario, accessToken) =>
    set({ usuario, accessToken, isAuthenticated: true }),

  setAccessToken: (accessToken) => set({ accessToken, isAuthenticated: true }),

  clearSession: () =>
    set({ usuario: null, accessToken: null, isAuthenticated: false }),

  setInitializing: (value) => set({ isInitializing: value }),
}));

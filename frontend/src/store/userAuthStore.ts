import { create } from "zustand";
import { UsuarioSesion } from "../api/types";

// Estado global de la sesion del PORTAL INSTITUCIONAL (/login,
// /usuario/*). Es independiente de adminAuthStore: un visitante
// nunca requiere esta sesion, y un administrador usa el store de
// adminAuthStore. Ambos consumen el mismo backend de auth
// (JWT + cookies httpOnly), pero se mantienen separados en el
// frontend para no mezclar el estado de una sesion con la otra.
interface UserAuthState {
  usuario: UsuarioSesion | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setSession: (usuario: UsuarioSesion, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setInitializing: (value: boolean) => void;
}

export const useUserAuthStore = create<UserAuthState>((set) => ({
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

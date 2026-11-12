import { create } from "zustand";
import { UsuarioSesion } from "../api/types";

// Estado del área estudiantil. auth/session.ts asigna el ingreso único al
// área correspondiente y mantiene una sola sesión activa entre ambos stores.
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

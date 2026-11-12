import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { usePolling } from './usePolling';
import { solicitudesAulasApi } from '../api/solicitudes-aulas.api';

export function useAuxiliarHabilitado() {
  const { usuario, isAuthenticated } = useAuth();
  const id = isAuthenticated && usuario?.correoVerificado && !usuario.debeCambiarPassword ? usuario.idUsuario : null;
  const load = useCallback(async () => ({ id, habilitado: id ? (await solicitudesAulasApi.perfil()).habilitado : false }), [id]);
  const { data, error } = usePolling(load, 60000);
  return Boolean(id && data?.id === id && data.habilitado && !error);
}

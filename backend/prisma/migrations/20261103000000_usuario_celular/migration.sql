-- Se conserva compatibilidad con las cuentas existentes.
-- Las nuevas cuentas requieren celular en la validación de la API.
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS celular VARCHAR(30);

-- Cambia los datos del ejemplo antes de ejecutarlo.
-- Usa el mismo correo en las tres inserciones y un CI y RU que no existan.
-- Contraseña correspondiente al hash: Estudiante2026!Kardex
-- Requiere que ya exista el rol CONSULTA_INTERNA.
BEGIN;

INSERT INTO public.usuario
  (nombre_completo, correo, contrasena_hash, estado)
VALUES
  ('Juan Pérez', 'estudiante.nuevo@example.test',
   '$2b$12$LWzmGcaplId1teRV9mRpVOXF3/U2MdqwKTD/DuQdUIPYPcnEmP7X2', 'ACTIVO');

INSERT INTO public.estudiante
  (nombres, apellidos, ci, ru, correo_institucional, carrera, id_usuario)
VALUES
  ('Juan', 'Pérez', 'NUEVO-001', 'RU-NUEVO-001',
   'estudiante.nuevo@example.test', 'Ingeniería de Sistemas',
   (SELECT id_usuario FROM public.usuario WHERE correo = 'estudiante.nuevo@example.test'));

INSERT INTO public.usuario_rol (id_usuario, id_rol)
VALUES
  ((SELECT id_usuario FROM public.usuario WHERE correo = 'estudiante.nuevo@example.test'),
   (SELECT id_rol FROM public.rol WHERE nombre = 'CONSULTA_INTERNA'));

COMMIT;

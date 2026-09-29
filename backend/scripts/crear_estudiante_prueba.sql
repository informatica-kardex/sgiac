-- PostgreSQL. Ejecutar el bloque completo en la BD configurada en backend/.env.
-- Crea una cuenta de ESTUDIANTE (sin permisos administrativos).
-- Correo: estudiante.prueba@example.test
-- Contraseña de prueba: Estudiante2026!Kardex
-- No modifica contraseñas ni datos de cuentas existentes. Puede ejecutarse de nuevo.
-- No altera tablas: sincroniza secuencias de autenticación y agrega registros.
-- Mención se almacena en estudiante.carrera; semestre y gestion quedan NULL.
DO $script$
DECLARE
  item RECORD;
  sequence_name TEXT;
  maximum_id BIGINT;
  sequence_value BIGINT;
  sequence_called BOOLEAN;
  next_id BIGINT;
  student_user_id BIGINT;
  student_role_id BIGINT;
BEGIN
  LOCK TABLE public.usuario, public.estudiante, public.rol, public.usuario_rol,
    public.email_verification_token, public.password_reset_token,
    public.refresh_token, public.bitacora IN SHARE ROW EXCLUSIVE MODE;

  -- Mantiene la numeración actual si está adelantada; nunca reutiliza IDs.
  FOR item IN SELECT * FROM (VALUES
    ('usuario', 'id_usuario'), ('estudiante', 'id_estudiante'), ('rol', 'id_rol'),
    ('email_verification_token', 'id_token'), ('password_reset_token', 'id_token'),
    ('refresh_token', 'id_refresh_token'), ('bitacora', 'id_bitacora')
  ) AS identifiers(table_name, column_name)
  LOOP
    sequence_name := pg_get_serial_sequence('public.' || item.table_name, item.column_name);
    IF sequence_name IS NULL THEN
      RAISE EXCEPTION 'No existe secuencia para %.%', item.table_name, item.column_name;
    END IF;
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM public.%I', item.column_name, item.table_name) INTO maximum_id;
    EXECUTE format('SELECT last_value, is_called FROM %s', sequence_name::regclass) INTO sequence_value, sequence_called;
    next_id := GREATEST(maximum_id + 1, sequence_value + CASE WHEN sequence_called THEN 1 ELSE 0 END);
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', sequence_name::regclass, next_id);
  END LOOP;

  INSERT INTO public.rol(nombre, descripcion, estado)
  VALUES ('CONSULTA_INTERNA', 'Estudiantes del portal institucional', 'ACTIVO')
  ON CONFLICT (nombre) DO NOTHING;
  SELECT id_rol INTO student_role_id FROM public.rol WHERE nombre = 'CONSULTA_INTERNA' AND estado = 'ACTIVO';
  IF student_role_id IS NULL THEN RAISE EXCEPTION 'El rol CONSULTA_INTERNA está inactivo'; END IF;

  SELECT id_usuario INTO student_user_id FROM public.usuario WHERE correo = 'estudiante.prueba@example.test';
  IF student_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.estudiante WHERE id_usuario = student_user_id AND ru = 'PRUEBA-2026-001' AND ci = 'PRUEBA-240926') THEN
      RAISE EXCEPTION 'El correo de prueba ya pertenece a otra cuenta; no se modificó';
    END IF;
    RAISE NOTICE 'El estudiante de prueba ya existe; se conserva su contraseña';
    RETURN;
  END IF;

  INSERT INTO public.usuario(nombre_completo, correo, estado, contrasena_hash, correo_verificado, debe_cambiar_password, fecha_actualizacion)
  VALUES ('Estudiante Prueba', 'estudiante.prueba@example.test', 'ACTIVO', '$2b$12$LWzmGcaplId1teRV9mRpVOXF3/U2MdqwKTD/DuQdUIPYPcnEmP7X2', false, false, CURRENT_TIMESTAMP)
  RETURNING id_usuario INTO student_user_id;

  INSERT INTO public.estudiante(nombres, apellidos, ci, ru, correo_institucional, id_usuario, carrera)
  VALUES ('Estudiante', 'Prueba', 'PRUEBA-240926', 'PRUEBA-2026-001', 'estudiante.prueba@example.test', student_user_id, 'Ingeniería de Sistemas');

  INSERT INTO public.usuario_rol(id_usuario, id_rol, estado) VALUES (student_user_id, student_role_id, 'ACTIVO');
  INSERT INTO public.bitacora(accion, entidad_afectada, id_registro_afectado, detalle, id_usuario)
  VALUES ('ESTUDIANTE_PRUEBA_CREADO', 'usuario', student_user_id::text, 'Cuenta de prueba creada mediante crear_estudiante_prueba.sql', student_user_id);
  RAISE NOTICE 'Estudiante creado con id_usuario %', student_user_id;
END
$script$;

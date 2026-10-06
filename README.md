# SGIAC — Sistema de Gestión Integral de Aulas y Comunicaciones de Kardex

> **Actualización de fichas (29/09/2026):** el módulo de fichas y atención ya utiliza PostgreSQL en administrador y estudiante, con trámites configurables, cupos por día y tablero público de llamados. La migración, uso y pruebas están documentados en [FICHAS-ATENCION.md](backend/scripts/FICHAS-ATENCION.md). Las menciones a fichas simuladas en la descripción original de V1 ya no aplican.

**Carrera de Informática.** Primera versión (V1) profesional del sistema, con
dos ambientes completamente separados:

1. **Portal público** (`/`) — no requiere sesión, consulta de comunicados,
   horarios, FAQ e información institucional.
2. **Panel administrativo** (`/admin`) — login independiente
   (`/admin/login`), gestión de aulas, horarios, comunicados, FAQ, fichas de
   atención, reportes, usuarios y roles.

La **autenticación es completamente funcional** (JWT, roles, refresh token,
auditoría). Los módulos de contenido (aulas, horarios, comunicados, FAQ,
fichas, reportes) inician con **datos simulados (mock)** en memoria, pero con
arquitectura idéntica a la que tendrían conectados a Supabase — controller →
service → repository — lista para reemplazar el mock por Prisma sin tocar
las demás capas.

---

## 1. Descripción del proyecto

SGIAC centraliza la gestión académica de aulas, horarios, comunicados,
atención y administración de la Carrera de Informática. Un usuario anónimo
puede navegar todo el portal público sin iniciar sesión; el personal
administrativo (Administrador y Subadministrador) accede al panel privado con su propio flujo de login.

---

## 2. Arquitectura

**Backend:** Node.js + Express + TypeScript, Clean Architecture con
Repository Pattern y Service Layer, módulos independientes por dominio.

**Frontend:** React + Vite + TypeScript, React Router DOM, Zustand, React
Hook Form + Zod, Axios con interceptores de refresh automático, TailwindCSS.

**Base de datos:** PostgreSQL vía Supabase (ya existente). Prisma para
`usuario`, `rol`, `usuario_rol`, `bitacora` (autenticación real). Los módulos
de contenido usan datos mock en memoria por ahora.

```
sgiac/
├── backend/
│   └── src/
│       ├── config/            # variables de entorno
│       ├── database/          # cliente Prisma (singleton)
│       ├── modules/
│       │   ├── auth/          # login, login admin, refresh, cambio de password...
│       │   ├── users/         # gestión de usuarios (admin)
│       │   ├── roles/         # roles del sistema
│       │   ├── aulas/         # mock — CRUD completo
│       │   ├── horarios/      # mock — lectura pública + CRUD admin
│       │   ├── comunicados/   # mock — lectura pública + CRUD admin
│       │   ├── faq/           # mock — lectura pública + CRUD admin
│       │   ├── fichas/        # mock — creación pública + gestión admin
│       │   ├── reportes/      # agregaciones para el dashboard
│       │   └── audit/         # registro en tabla bitacora
│       ├── middlewares/       # error, auth (requireAuth/requireAdmin/optionalAuth), rate limit
│       ├── utils/
│       ├── routes/            # registro central /api
│       ├── app.ts / server.ts
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts            # crea roles + usuario administrador inicial
└── frontend/
    └── src/
        ├── public-site/       # pages, components, layouts del portal público
        ├── admin/             # pages, components, layouts del panel privado
        ├── auth/              # guards de rutas (AdminProtectedRoute, AdminGuestRoute)
        ├── routes/            # AppRoutes.tsx (enrutador raíz)
        ├── store/              # adminAuthStore (Zustand)
        ├── hooks/             # useAdminAuth
        ├── services/          # agregaciones sobre la capa api/ (dashboard, portal)
        ├── api/               # axiosClient + un archivo por recurso
        ├── utils/             # validadores zod, formatters
        └── styles/
```

---

## 3. IMPORTANTE — Base de datos existente

Este proyecto **NO crea una base nueva** y **NO modifica** las tablas
existentes (`usuario`, `rol`, `usuario_rol`, `bitacora`). El `schema.prisma`
mapea esas tablas tal como se describieron, y sigue siendo compatible con
`auth.users` de Supabase (columna `usuario.auth_id`).

El módulo de autenticación (contraseña + JWT) necesita algunas columnas y
tablas adicionales. Ejecuta este SQL en el **SQL Editor de Supabase** antes
de generar el cliente de Prisma:

```sql
-- Columnas adicionales en "usuario"
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS contrasena_hash TEXT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP;

-- Tabla nueva: refresh tokens (control de sesiones)
CREATE TABLE IF NOT EXISTS refresh_token (
  id_refresh_token SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  token_hash TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMP NOT NULL,
  revocado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMP NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip TEXT
);

-- Tabla nueva: códigos de verificación de correo
CREATE TABLE IF NOT EXISTS email_verification_token (
  id_token SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  codigo TEXT NOT NULL,
  expira_en TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabla nueva: códigos de recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_token (
  id_token SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  codigo TEXT NOT NULL,
  expira_en TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMP NOT NULL DEFAULT now()
);
```

> Si tu tabla `usuario_rol` tiene nombres de columnas distintos a
> `id_usuario_rol`, `id_usuario`, `id_rol`, `fecha_asignacion`, ajusta los
> `@map(...)` correspondientes en `backend/prisma/schema.prisma`.

> Si prefieres usar **Supabase Auth** en vez de contraseñas propias, el campo
> `usuario.auth_id` ya está mapeado para vincular el usuario de `auth.users`
> con la fila de `usuario`. En ese caso, `auth.service.ts` se adapta para
> llamar a `supabase.auth.signUp` / `signInWithPassword`, sin cambiar el
> resto de la arquitectura.

---

## 4. Requisitos previos

- Node.js 18 o superior · npm 9 o superior
- Cuenta y proyecto de Supabase ya creados
- VSCode (recomendado)

---

## 5. Instalación — Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env` con tus credenciales reales de Supabase (sección 7). Luego:

```bash
npm run prisma:generate   # genera el cliente de Prisma
npm run prisma:seed       # crea roles + usuario administrador inicial
npm run dev                # levanta el servidor en http://localhost:4000
```

---

## 6. Configuración de Supabase

En tu proyecto de Supabase:

1. **Project Settings → Database**:
   - Connection string (Transaction/Pooled, puerto 6543) → `DATABASE_URL`
   - Connection string (Session/Direct, puerto 5432) → `DIRECT_URL`
2. **Project Settings → API**:
   - Project URL → `SUPABASE_URL`
   - anon public key → `SUPABASE_ANON_KEY`
3. Ejecuta el SQL de la sección 3 en **SQL Editor**.

---

## 7. Variables de entorno

**backend/.env**

```
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
JWT_SECRET="cambia_esto_por_un_secreto_largo_y_aleatorio"
JWT_REFRESH_SECRET="cambia_esto_por_otro_secreto_largo_y_aleatorio"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="tu-anon-key"
PORT=4000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
COOKIE_SECURE="false"
```

**frontend/.env**

```
VITE_API_URL=http://localhost:4000/api
```

---

## 8. Prisma

Para el rol único de subadministrador y sus funciones con vigencia, sigue
[la migración de permisos](backend/scripts/SUBADMINISTRADORES.md).


Como la base ya existe, **no se usa `prisma migrate`**. Si agregaste las
columnas/tablas del paso 3 vía SQL Editor, el `schema.prisma` incluido ya las
refleja: solo corre `prisma generate`. Si prefieres partir del estado real de
tu base, usa `npm run prisma:pull` y revisa el diff antes de commitear.

## 9. Seed del administrador inicial

```bash
cd backend
npm run prisma:seed
```

Esto crea (de forma idempotente, seguro de correr varias veces):

1. Los 3 roles del sistema: `ADMINISTRADOR`, `SUBADMINISTRADOR`, `CONSULTA_INTERNA`.
   Las funciones de cada subadministrador se asignan individualmente.
2. El usuario administrador inicial.
3. La asignación del rol `ADMINISTRADOR`.
4. Un registro `SEED_ADMIN_CREADO` en `bitacora`.

**Usuario inicial:**

| Campo | Valor |
|---|---|
| Correo | `admin@sgiac.edu.bo` |
| Contraseña temporal | `Admin123*` |
| Rol | `ADMINISTRADOR` |

Al iniciar sesión por primera vez en `/admin/login`, el sistema **obliga a
cambiar la contraseña** (`debeCambiarPassword = true`) antes de dar acceso al
resto del panel.

---

## 10. Ejecutar el backend

```bash
cd backend
npm run dev        # desarrollo (ts-node + nodemon)
# producción:
npm run build
npm run start
```

## 11. Ejecutar el frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev         # http://localhost:5173
# producción:
npm run build
npm run preview
```

---

## 12. Flujo de uso

1. Visita `http://localhost:5173/` — portal público, sin login.
2. Genera una ficha de atención desde `/atencion` (endpoint público).
3. Ve a `/admin/login` e ingresa con `admin@sgiac.edu.bo` / `Admin123*`.
4. El sistema te pedirá una nueva contraseña (primer ingreso).
5. Tras el cambio, vuelve a iniciar sesión con tu nueva contraseña y accede
   al dashboard en `/admin/dashboard`.
6. Desde el panel puedes gestionar aulas, horarios, comunicados, FAQ,
   fichas, ver reportes y administrar usuarios/roles.

---

## 13. Roles y permisos

| Rol | Acceso |
|---|---|
| `ADMINISTRADOR` | Acceso total: todos los módulos, usuarios, roles, configuración |
| `SUBADMINISTRADOR` | Funciones asignadas por el administrador mediante checklist, con periodo opcional por función |
| `CONSULTA_INTERNA` | Rol por defecto para registros públicos (sin acceso a `/admin`) |

`requireAdmin()` en el backend valida JWT + usuario activo + rol permitido;
`requireAdmin("ADMINISTRADOR")` restringe aún más a un rol específico.
`requirePermission(modulo)` comprueba las funciones y su vigencia en cada petición.

---

## 14. API — resumen de endpoints

```
/api/auth/register            POST  público
/api/auth/login               POST  público
/api/auth/admin/login         POST  público (valida rol administrativo)
/api/auth/refresh             POST  público (usa cookie httpOnly)
/api/auth/logout              POST  requiere sesión
/api/auth/me                  GET   requiere sesión
/api/auth/change-password     POST  requiere sesión
/api/auth/verify-email        POST  público
/api/auth/forgot-password     POST  público
/api/auth/reset-password      POST  público

/api/aulas          GET/POST/PUT/DELETE   admin (ADMINISTRADOR, SUBADMIN_ACADEMICO)
/api/horarios       GET público · POST/PUT/DELETE admin
/api/comunicados    GET público (solo publicados) · POST/PUT/DELETE/publicar/archivar admin
/api/faq            GET público (solo publicadas) · POST/PUT/DELETE admin
/api/fichas         POST público (crear solicitud) · GET/PATCH admin (ADMINISTRADOR, SUBADMIN_ATENCION)
/api/reportes/*     GET admin
/api/users          GET/PATCH admin (ADMINISTRADOR)
/api/roles          GET admin (ADMINISTRADOR)
```

---

## 15. Datos mock incluidos

| Módulo | Registros iniciales |
|---|---|
| Aulas | 10 |
| Comunicados | 5 (4 publicados, 1 borrador) |
| FAQ | 10 |
| Horarios | 12 (lunes a sábado) |
| Fichas de atención | 5 (distintos estados) |

Cada módulo mock vive en `*.mock.ts` dentro de su carpeta en
`backend/src/modules/`. Para conectar la tabla real: crea la tabla en
Supabase, agrega el modelo en `schema.prisma`, y reemplaza el array en
memoria del `*.repository.ts` por llamadas a `prisma.<tabla>`. El
`service`/`controller`/`routes` no necesitan cambios.

---

## 16. Notas sobre envío de correos

Los códigos de verificación de correo, recuperación de contraseña y segundo
paso del acceso usan el mismo servicio de envío, configurado en `backend/.env`.

Para pruebas con Mailtrap:

1. Abre tu bandeja en **Email Sandbox** y consulta la integración por API.
2. Completa `MAILTRAP_API_TOKEN` con un token con permiso de envío a esa bandeja
   y `MAILTRAP_INBOX_ID` con su identificador numérico. No uses las credenciales SMTP.
3. Mantén `MAIL_PROVIDER="mailtrap"` y `MAIL_FROM="SGIAC <acceso@sgiac.test>"`.
4. Reinicia el backend y prueba el registro, la recuperación o el segundo paso
   del acceso. Los mensajes aparecen en Mailtrap; no se entregan al correo real.

Referencia: [API de Mailtrap Email Sandbox](https://docs.mailtrap.io/developers/email-sandbox/send-test-emails).

Para envío real, cambia `MAIL_PROVIDER="resend"`, completa `RESEND_API_KEY`
y cambia `MAIL_FROM` por un remitente de un dominio verificado en Resend.
Reinicia el backend. No hace falta modificar código ni la base de datos.
`LOGIN_MAIL_FROM` sigue admitido como remitente si `MAIL_FROM` no está definido.
Si no se define `MAIL_PROVIDER`, se conserva Resend como proveedor predeterminado.
Las credenciales se guardan únicamente en el backend. Los errores de envío se
reportan sin imprimir códigos ni credenciales, y no se cambia de proveedor
automáticamente cuando falla un envío.

---

## 17. Checklist antes de producción

- [ ] Cambiar `JWT_SECRET` / `JWT_REFRESH_SECRET`
- [ ] `COOKIE_SECURE=true` + HTTPS
- [ ] Cambiar la contraseña temporal del administrador inicial
- [ ] Configurar y comprobar el envío real de correo con Resend
- [ ] Migrar los módulos mock (aulas, horarios, comunicados, FAQ, fichas) a
      tablas reales de Supabase + Prisma
- [ ] Ajustar límites de `rateLimit.middleware.ts` según tráfico esperado
- [ ] Confirmar nombres de columnas reales en `usuario_rol`

---

## 18. Scripts

**Backend**

```bash
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:seed
npm run prisma:pull
npm run prisma:studio
```

**Frontend**

```bash
npm run dev
npm run build
npm run preview
```

---

## 19. Verificación realizada antes de la entrega

- ✓ `tsc -b` y `vite build` del frontend compilan sin errores
- ✓ `tsc --noEmit` del backend compila sin errores de lógica (los únicos
  mensajes pendientes son inferencias de tipos de relaciones de Prisma que
  se resuelven automáticamente al correr `npm run prisma:generate` con
  credenciales reales — no ejecutable en el entorno de generación de este
  proyecto por restricciones de red)
- ✓ Estructura de carpetas completa según lo solicitado (`public-site/`,
  `admin/`, `auth/`, `routes/`, `store/`, `hooks/`, `services/`, `api/`,
  `utils/`, `styles/`)
- ✓ Rutas públicas y administrativas separadas, sin mezclar login
- ✓ Seed de roles + administrador inicial, con obligación de cambio de
  contraseña en el primer ingreso


## Gestión académica (30/09/2026)

Docentes, materias, aulas y horarios están conectados a PostgreSQL. La actualización de BD y la muestra del PDF ya se aplicaron en este entorno. Consulta [los cambios, uso y pruebas](backend/prisma/ACADEMICO.md). El administrador dispone de los módulos en ese orden; los nuevos permisos de subadministrador se asignan individualmente.

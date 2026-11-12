// node -r ts-node/register/transpile-only --test tests/profile.test.cjs
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
process.env.FRONTEND_URL = 'http://localhost:5173';
const { prisma } = require('../src/database/prisma');
const { Prisma } = require('@prisma/client');
const { signAccessToken, credentialVersion } = require('../src/utils/jwt');
const { UserService } = require('../src/modules/users/user.service');
let users, sessions, audit, server, base, writes, failAudit;
const studentInput = { nombres: 'Ana María', apellidos: 'Pérez López', ci: '7654321 LP', ru: '20261234', mencion: 'Ingeniería de Sistemas' };
const copy = value => structuredClone(value);
beforeEach(async () => {
  users = ['ADMINISTRADOR', 'SUBADMINISTRADOR', 'CONSULTA_INTERNA'].map((role, i) => ({
    idUsuario: BigInt(i + 1), nombreCompleto: 'Nombre Original', correo: `cuenta${i + 1}@fcpn.edu.bo`,
    estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false, contrasenaHash: 'secret-hash',
    twoFactorEnabled: true, permisos: [], roles: [{ estado: 'ACTIVO', rol: { nombre: role, estado: 'ACTIVO' } }],
    estudiante: i === 2 ? { id_estudiante: 33n, id_usuario: 3n, nombres: 'Nombre', apellidos: 'Original', ci: '123', ru: '456', correo_institucional: 'cuenta3@fcpn.edu.bo', carrera: 'Informática' } : null,
  }));
  sessions = users.map((u, i) => ({ idRefreshToken: i + 1, idUsuario: u.idUsuario, revocado: false, creadoEn: new Date(), expiraEn: new Date(Date.now() + 180000) }));
  audit = []; writes = []; failAudit = false;
  prisma.usuario.findUnique = async ({ where }) => copy(users.find(u => u.idUsuario === where.idUsuario) ?? null);
  prisma.usuario.update = async ({ where, data }) => {
    writes.push(copy({ where, data }));
    const u = users.find(u => u.idUsuario === where.idUsuario);
    if (data.estudiante?.update.ci === 'duplicado') throw new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: '5', meta: { target: ['ci'] } });
    u.nombreCompleto = data.nombreCompleto;
    if (data.estudiante) Object.assign(u.estudiante, data.estudiante.update);
    return copy(u);
  };
  prisma.refreshToken.findUnique = async ({ where }) => copy(sessions.find(s => s.idRefreshToken === where.idRefreshToken));
  prisma.$queryRaw = async () => [];
  prisma.bitacora.create = async ({ data }) => { if (failAudit) throw Error('Fallo de escritura'); audit.push(copy(data)); return data; };
  prisma.$transaction = async fn => { const previous = copy(users); try { return await fn(prisma); } catch (e) { users = previous; throw e; } };
  const express = require('express'), app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/modules/auth/auth.routes').default);
  app.use(require('../src/middlewares/error.middleware').errorMiddleware);
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}/api/auth/profile`;
});
afterEach(async () => { await new Promise(resolve => server.close(resolve)); });
const token = i => signAccessToken({ idUsuario: String(i + 1), correo: users[i].correo, roles: [], sessionId: i + 1, credentialVersion: credentialVersion(users[i].contrasenaHash) });
const request = (i, body, extra = {}) => fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(i === null ? {} : { Authorization: `Bearer ${token(i)}` }), ...extra }, body: JSON.stringify(body) });

test('administrador y subadministrador editan su nombre y conservan seguridad y permisos', async () => {
  for (const i of [0, 1]) {
    const previous = copy(users[i]);
    const response = await request(i, { nombreCompleto: '  Nuevo Nombre  ' });
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.equal(result.usuario.nombreCompleto, 'Nuevo Nombre');
    assert.deepEqual(users[i], { ...previous, nombreCompleto: 'Nuevo Nombre' });
    assert.deepEqual(writes[i].data, { nombreCompleto: 'Nuevo Nombre' });
    assert.equal(JSON.stringify(result).includes('secret-hash'), false);
    assert.equal(result.estudiante, null);
    assert.equal(audit[i].idUsuario, BigInt(i + 1));
  }
  assert.equal(users[2].nombreCompleto, 'Nombre Original');
});
test('estudiante actualiza ambos registros juntos y devuelve únicamente su perfil', async () => {
  const response = await request(2, studentInput);
  assert.equal(response.status, 200);
  const result = (await response.json()).data;
  assert.equal(users[2].nombreCompleto, 'Ana María Pérez López');
  assert.deepEqual(result.estudiante, { ...studentInput, correo: 'cuenta3@fcpn.edu.bo' });
  assert.equal(users[2].estudiante.carrera, studentInput.mencion);
  assert.equal(users[2].contrasenaHash, 'secret-hash');
  assert.equal(audit[0].idRegistroAfectado, '3');
  assert.equal(audit[0].detalle.includes(studentInput.ci), false);
});
test('rechaza campos de escalamiento y cualquier identificador de otro usuario', async () => {
  for (const i of [0, 1, 2]) for (const [key, value] of Object.entries({
    idUsuario: '1', id_usuario: '1', id_estudiante: '1', roles: ['ADMINISTRADOR'], permisos: [{ modulo: 'roles' }],
    correo: 'otro@fcpn.edu.bo', correoVerificado: true, contrasenaHash: 'hack', estado: 'ACTIVO', twoFactorEnabled: false,
  })) {
    assert.equal((await request(i, { ...(i === 2 ? studentInput : { nombreCompleto: 'Nombre Nuevo' }), [key]: value })).status, 400, key);
  }
  assert.equal(writes.length, 0);
});
test('el perfil real determina los campos; rechaza datos vacíos y nombres demasiado largos', async () => {
  assert.equal((await request(1, studentInput)).status, 400);
  assert.equal((await request(2, { nombreCompleto: 'Nombre Nuevo' })).status, 400);
  assert.equal((await request(0, { nombreCompleto: '   ' })).status, 400);
  assert.equal((await request(2, { ...studentInput, ci: ' ' })).status, 400);
  assert.equal((await request(2, { ...studentInput, nombres: 'a'.repeat(100), apellidos: 'b'.repeat(100) })).status, 400);
  assert.equal(writes.length, 0);
});
test('rechaza visitante, sesión vencida, correo pendiente, contraseña temporal y cuenta inactiva', async () => {
  assert.equal((await request(null, studentInput)).status, 401);
  sessions[2].expiraEn = new Date(0);
  assert.equal((await request(2, studentInput)).status, 401);
  sessions[2].expiraEn = new Date(Date.now() + 180000);
  users[2].correoVerificado = false;
  assert.equal((await request(2, studentInput)).status, 403);
  users[2].correoVerificado = true; users[2].debeCambiarPassword = true;
  assert.equal((await request(2, studentInput)).status, 403);
  users[2].debeCambiarPassword = false; users[2].estado = 'INACTIVO';
  assert.equal((await request(2, studentInput)).status, 401);
  assert.equal(writes.length, 0);
});
test('rechaza origen externo y CI duplicado sin guardar cambios parciales', async () => {
  assert.equal((await request(2, studentInput, { Origin: 'https://externo.example' })).status, 403);
  const previous = copy(users);
  const response = await request(2, { ...studentInput, ci: 'duplicado' });
  assert.equal(response.status, 409);
  assert.deepEqual(users, previous); assert.deepEqual(audit, []);
});
test('un fallo en la transacción revierte el nombre y los datos académicos', async () => {
  failAudit = true;
  const previous = copy(users);
  await assert.rejects(new UserService().actualizarPerfilPropio(3n, studentInput), /Fallo de escritura/);
  assert.deepEqual(users, previous);
});

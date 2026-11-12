const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { streamChanges, notifySuccessfulMutation } = require('../dist/modules/realtime/realtime');

test('only successful writes notify connected sessions; read POSTs and authentication do not loop', () => {
  const client = new EventEmitter();
  const frames = [];
  Object.assign(client, { set() {}, flushHeaders() {}, write(frame) { frames.push(frame); return true; }, end() { this.emit('close'); } });
  streamChanges({}, client);
  try {
    assert.match(frames.pop(), /event: change/);
    function finish(method, path, statusCode, user = { idUsuario: '1' }) {
      const res = new EventEmitter(); res.statusCode = statusCode;
      notifySuccessfulMutation({ method, path, user }, res, () => {});
      res.emit('finish');
    }
    finish('POST', '/solicitudes-aulas', 201);
    finish('POST', '/solicitudes-aulas/admin/1/revisar', 200);
    finish('DELETE', '/horarios/1', 204);
    assert.equal(frames.length, 3);
    for (const args of [['GET', '/academico/horarios', 200], ['POST', '/auth/refresh', 200], ['POST', '/solicitudes-aulas/disponibilidad', 200], ['POST', '/solicitudes-aulas/admin/1/disponibilidad', 200], ['POST', '/horarios', 409], ['POST', '/horarios', 500], ['POST', '/horarios', 200, null]]) finish(...args);
    assert.equal(frames.length, 3);
    assert.ok(frames.every(frame => frame === 'event: change\ndata: {}\n\n'), 'No personal data in notifications');
    client.emit('close');
    finish('POST', '/horarios', 201);
    assert.equal(frames.length, 3, 'Disconnected clients are removed');
  } finally { client.emit('close'); }
});

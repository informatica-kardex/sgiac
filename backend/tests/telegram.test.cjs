// npm run test:telegram (sin conexiones a Telegram ni a la base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { buildFaqReply, TelegramFaqBot } = require('../src/modules/telegram/telegram.bot');
const { TelegramClient, TelegramApiError } = require('../src/modules/telegram/telegram.client');
const { TelegramPolling } = require('../src/modules/telegram/telegram.polling');
const { FaqService } = require('../src/modules/faq/faq.service');

const faqs = [
  { idFaq: 1, categoria: 'Matrícula', pregunta: '¿Cómo me matriculo?', respuesta: 'Consulta el cronograma de inscripción.', estado: 'publicada' },
  { idFaq: 2, categoria: 'Horarios', pregunta: '¿Dónde veo mi horario?', respuesta: 'Visita la sección Horarios del portal.', estado: 'publicada' },
  { idFaq: 3, categoria: 'Reservado', pregunta: 'Información interna', respuesta: 'Respuesta privada', estado: 'borrador' },
];
const message = text => ({ update_id: 1, message: { text, chat: { id: 100, type: 'private' } } });
const callback = data => ({ update_id: 2, callback_query: { id: 'callback-id', data, message: { chat: { id: 100, type: 'private' } } } });
const buttons = reply => reply.buttons.flat();
const captureApi = () => {
  const calls = [];
  return { calls, call: async (method, payload) => { calls.push({ method, payload }); return true; } };
};

test('el enlace /start faq abre categorías y las órdenes vuelven al menú', () => {
  for (const command of ['/start faq', '/start@sgiac_bot faq', '/menu', '/ayuda', 'hola']) {
    const reply = buildFaqReply(faqs, command);
    assert.match(reply.text, /asistente de Kardex/);
    assert.deepEqual(buttons(reply).map(b => b.text), ['Matrícula', 'Horarios']);
    assert.ok(buttons(reply).every(b => Buffer.byteLength(b.callback_data) <= 64));
  }
});

test('categoría → pregunta → respuesta incluye retorno al tema y al menú', () => {
  const category = buildFaqReply(faqs, 'faq:category:1:0', true);
  assert.equal(buttons(category)[0].callback_data, 'faq:answer:1');
  const reply = buildFaqReply(faqs, 'faq:answer:1', true);
  assert.equal(reply.text, `${faqs[0].pregunta}\n\n${faqs[0].respuesta}`);
  assert.deepEqual(buttons(reply).map(b => b.callback_data), ['faq:category:1:0', 'faq:menu:0']);
});

test('no expone borradores ni acepta botones manipulados, eliminados o despublicados', () => {
  for (const data of ['faq:answer:3', 'faq:category:3:0', 'faq:answer:999', 'faq:answer:1junk', 'malformed']) {
    const reply = buildFaqReply(faqs, data, true);
    assert.match(reply.text, /ya no está disponible/);
    assert.ok(!JSON.stringify(reply).includes('privada'));
  }
  assert.match(buildFaqReply(faqs, 'Información interna').text, /No encontré/);
});

test('búsqueda ignora mayúsculas y tildes; pregunta exacta devuelve la respuesta', () => {
  assert.equal(buttons(buildFaqReply(faqs, 'MATRICULA'))[0].callback_data, 'faq:answer:1');
  assert.equal(buttons(buildFaqReply(faqs, 'donde veo mi horario'))[0].callback_data, 'faq:answer:2');
  assert.match(buildFaqReply(faqs, '¿Como me matriculo?').text, /cronograma/);
  assert.match(buildFaqReply(faqs, 'xyz').text, /No encontré/);
  assert.match(buildFaqReply([], '/menu').text, /no hay preguntas/);
});

test('paginación permite acceder a categorías y preguntas fuera de la primera página', () => {
  const many = Array.from({ length: 21 }, (_, i) => ({ ...faqs[0], idFaq: i + 10, categoria: `Tema ${i}`, pregunta: `Pregunta ${i}` }));
  const next = buttons(buildFaqReply(many, '/menu')).find(b => b.text === 'Siguiente →');
  assert.equal(next.callback_data, 'faq:menu:1');
  assert.equal(buttons(buildFaqReply(many, next.callback_data, true))[0].text, 'Tema 8');
  const sameCategory = many.map(f => ({ ...f, categoria: 'Mismo tema' }));
  const secondPage = buildFaqReply(sameCategory, 'faq:category:10:1', true);
  assert.equal(buttons(secondPage)[0].callback_data, 'faq:answer:18');
  const lastPage = buildFaqReply(sameCategory, 'faq:category:10:99999', true);
  assert.equal(buttons(lastPage)[0].callback_data, 'faq:answer:26');
});

test('responde al callback antes de consultar y enviar una respuesta', async () => {
  const api = captureApi();
  const bot = new TelegramFaqBot(api, async () => { assert.equal(api.calls[0].method, 'answerCallbackQuery'); return faqs; });
  await bot.handle(callback('faq:answer:1'));
  assert.equal(api.calls[1].method, 'sendMessage');
  assert.equal(api.calls[1].payload.chat_id, 100);
  assert.match(api.calls[1].payload.text, /cronograma/);
});

test('lee cambios del administrador en cada consulta y excluye una respuesta retirada', async () => {
  const service = new FaqService();
  const faq = await service.crear({ categoria: 'Prueba Telegram', pregunta: '¿Consulta para el bot?', respuesta: 'Respuesta inicial.', estado: 'publicada' });
  const api = captureApi();
  const bot = new TelegramFaqBot(api, () => service.listarPublicadas());
  try {
    await service.actualizar(faq.idFaq, { respuesta: 'Respuesta actualizada.' });
    await bot.handle(callback(`faq:answer:${faq.idFaq}`));
    assert.match(api.calls.at(-1).payload.text, /Respuesta actualizada/);
    await service.actualizar(faq.idFaq, { estado: 'borrador' });
    await bot.handle(callback(`faq:answer:${faq.idFaq}`));
    assert.match(api.calls.at(-1).payload.text, /ya no está disponible/);
  } finally { await service.eliminar(faq.idFaq); }
});

test('respuestas extensas conservan texto, emojis y caracteres especiales sin interpretar HTML', async () => {
  const api = captureApi();
  const long = { ...faqs[0], respuesta: '<b>texto literal</b> ' + '😀'.repeat(5000) };
  await new TelegramFaqBot(api, async () => [long]).handle(callback('faq:answer:1'));
  const sent = api.calls.filter(c => c.method === 'sendMessage');
  assert.equal(sent.map(c => c.payload.text).join(''), `${long.pregunta}\n\n${long.respuesta}`);
  assert.ok(sent.every(c => c.payload.text.length <= 4096 && !c.payload.parse_mode));
  assert.ok(!sent[0].payload.reply_markup);
  assert.ok(sent.at(-1).payload.reply_markup);
});

test('ignora grupos y actualizaciones sin mensajes privados', async () => {
  const api = captureApi();
  const bot = new TelegramFaqBot(api, async () => { throw new Error('No debe consultar'); });
  await bot.handle({ update_id: 1 });
  await bot.handle({ update_id: 2, message: { text: '/start', chat: { id: -1, type: 'group' } } });
  assert.equal(api.calls.length, 0);
});

test('un callback vencido todavía recibe la respuesta de la pregunta', async () => {
  const api = captureApi();
  const original = api.call;
  api.call = async (method, payload) => {
    if (method === 'answerCallbackQuery') throw new TelegramApiError(400);
    return original(method, payload);
  };
  await new TelegramFaqBot(api, async () => faqs).handle(callback('faq:answer:1'));
  assert.match(api.calls[0].payload.text, /cronograma/);
});

test('cliente hace POST y conserva retry_after sin filtrar token ni descripción remota', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return { ok: false, status: 429, json: async () => ({ ok: false, error_code: 429, description: 'token-no-publicar', parameters: { retry_after: 7 } }) };
  });
  await assert.rejects(new TelegramClient('token-no-publicar').call('sendMessage', { chat_id: 100, text: 'Hola' }), error => {
    assert.equal(error.code, 429);
    assert.equal(error.retryAfter, 7);
    assert.ok(!error.message.includes('token-no-publicar'));
    return true;
  });
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(JSON.parse(requests[0].options.body).chat_id, 100);
});

test('cliente cancela peticiones en curso y sanea errores de red', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('https://api.telegram.org/botTOKEN-SECRETO/getUpdates')), { once: true });
  }));
  const controller = new AbortController();
  const pending = new TelegramClient('TOKEN-SECRETO').call('getUpdates', {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error instanceof TelegramApiError && error.code === 0 && !error.message.includes('TOKEN-SECRETO'));
});

async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(10); }
  throw new Error('Tiempo agotado esperando el bot');
}

test('polling registra menú, publica enlace verificado, avanza offset y se detiene', async t => {
  t.mock.method(console, 'log', () => {});
  const calls = [];
  let polls = 0;
  const api = { call: async (method, payload, signal) => {
    calls.push({ method, payload });
    if (method === 'getMe') return { username: 'prueba_sgiac_bot', is_bot: true };
    if (method === 'getWebhookInfo') return { url: '' };
    if (method === 'getUpdates') {
      if (++polls === 1) return [message('/start faq')];
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new TelegramApiError(0)), { once: true }));
    }
    return true;
  } };
  const runtime = new TelegramPolling(api, async () => faqs);
  assert.deepEqual(runtime.getPublicInfo(), { available: false, url: null });
  runtime.start();
  runtime.start();
  try {
    await until(() => polls === 2);
    assert.deepEqual(runtime.getPublicInfo(), { available: true, url: 'https://t.me/prueba_sgiac_bot?start=faq' });
    assert.equal(calls.filter(c => c.method === 'getMe').length, 1);
    assert.equal(calls.filter(c => c.method === 'getUpdates')[1].payload.offset, 2);
    assert.ok(calls.some(c => c.method === 'setMyCommands' && c.payload.commands.some(c => c.command === 'menu')));
  } finally { await runtime.stop(); }
  assert.deepEqual(runtime.getPublicInfo(), { available: false, url: null });
});

test('un chat bloqueado no impide procesar otras consultas', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  let polls = 0, sent = 0, nextOffset;
  const api = { call: async (method, payload, signal) => {
    if (method === 'getMe') return { username: 'prueba_bot', is_bot: true };
    if (method === 'getWebhookInfo') return { url: '' };
    if (method === 'sendMessage' && ++sent === 1) throw new TelegramApiError(403);
    if (method === 'getUpdates') {
      if (++polls === 1) return [message('/start'), { ...message('/menu'), update_id: 2 }];
      nextOffset = payload.offset;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new TelegramApiError(0)), { once: true }));
    }
    return true;
  } };
  const runtime = new TelegramPolling(api, async () => faqs);
  runtime.start();
  try { await until(() => polls === 2); assert.equal(sent, 2); assert.equal(nextOffset, 3); }
  finally { await runtime.stop(); }
});

test('no reemplaza webhooks existentes ni publica enlaces con credenciales inválidas o conflictos', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  for (const failure of ['webhook', 401, 409]) {
    const calls = [];
    const api = { call: async method => {
      calls.push(method);
      if (failure === 401) throw new TelegramApiError(401);
      if (method === 'getMe') return { username: 'prueba_bot', is_bot: true };
      if (method === 'getWebhookInfo') return { url: failure === 'webhook' ? 'https://example.test/webhook' : '' };
      if (method === 'getUpdates') throw new TelegramApiError(409);
      return true;
    } };
    const runtime = new TelegramPolling(api, async () => faqs);
    runtime.start();
    await delay(10);
    assert.deepEqual(runtime.getPublicInfo(), { available: false, url: null });
    assert.ok(!calls.includes('deleteWebhook'));
    await runtime.stop();
  }
});

test('endpoint público no expone token y funciona sin configurar Telegram', async () => {
  process.env.TELEGRAM_BOT_TOKEN = '';
  const express = require('express');
  const routes = require('../src/modules/telegram/telegram.routes').default;
  const app = express();
  app.use('/telegram', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/telegram`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).data, { available: false, url: null });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

import { RequestHandler, Response } from 'express';

// Only an invalidation signal is broadcast. Each subsequent read still checks
// the account's permissions and never receives another user's records here.
const clients = new Set<Response>();
export function notifyDataChanged() {
  for (const client of clients) {
    if (client.destroyed || client.writableEnded) clients.delete(client);
    else if (!client.write('event: change\ndata: {}\n\n')) client.end();
  }
}

export const notifySuccessfulMutation: RequestHandler = (req, res, next) => {
  const path = req.path.replace(/\/$/, '');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !path.startsWith('/auth/') && !path.endsWith('/disponibilidad')) {
    res.once('finish', () => {
      if (req.user && res.statusCode >= 200 && res.statusCode < 300) notifyDataChanged();
    });
  }
  next();
};

export const streamChanges: RequestHandler = (_req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  clients.add(res);
  // Reconnecting also invalidates data, including changes missed offline.
  res.write('event: change\ndata: {}\n\n');
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 20000);
  // Periodically reconnect through requireAuth to recheck the account/session.
  const expiry = setTimeout(() => res.end(), 60000);
  res.once('close', () => {
    clients.delete(res);
    clearInterval(heartbeat);
    clearTimeout(expiry);
  });
};

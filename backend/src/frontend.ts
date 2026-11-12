import express, { RequestHandler } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';

// Solo publica la compilación de React. Los archivos de backend, .env y src
// quedan fuera de la raíz estática. /api siempre continúa por su router original.
export function frontendProduccion(directory: string, https = true): RequestHandler {
  const root = path.resolve(directory);
  const index = path.join(root, 'index.html');
  if (!existsSync(index)) return (_req, _res, next) => next();
  const frontend = express.Router();
  frontend.use(helmet.contentSecurityPolicy({ directives: {
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'", 'blob:'],
    'upgrade-insecure-requests': https ? [] : null,
  } }));
  frontend.use((req, res, next) => {
    if (req.path.startsWith('/auxiliares/carnet/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  });
  frontend.use(express.static(root, {
    index: false, redirect: false, dotfiles: 'deny',
    setHeaders: (res, file) => {
      // Vite cambia el nombre de estos archivos cuando cambia su contenido.
      res.setHeader('Cache-Control', file.startsWith(path.join(root, 'assets') + path.sep)
        ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  frontend.get('*', (req, res, next) => {
    let pathname: string;
    try { pathname = decodeURIComponent(req.path); } catch { return next(); }
    // Un archivo ausente no debe devolver HTML con estado 200.
    if (!req.headers.accept?.includes('text/html') || /^\/(assets|images|fonts)(\/|$)/.test(pathname) ||
        pathname.split('/').some(part => part.startsWith('.'))) return next();
    if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index, error => { if (error) next(error); });
  });
  return (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return frontend(req, res, next);
  };
}

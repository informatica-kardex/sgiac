import { useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';
import { notifyDataChanged } from '../services/liveUpdates';

export function useLiveUpdates(token: string | null | undefined) {
  useEffect(() => {
    if (!token) return;
    let active = true, paused = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let retryDelay = 3000;
    async function connect() {
      controller = new AbortController();
      try {
        const response = await fetch(`${axiosClient.defaults.baseURL}/events`, {
          headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: controller.signal,
        });
        if (response.status === 401) {
          // Reuse Axios's session renewal; a new token restarts this effect.
          await axiosClient.get('/auth/me');
          return;
        }
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return;
        retryDelay = 3000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            if (buffer.slice(0, end).includes('event: change')) notifyDataChanged();
            buffer = buffer.slice(end + 2);
          }
        }
      } catch { /* Polling remains available while the connection recovers. */ }
      finally {
        if (active && !paused) { timer = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); }
      }
    }
    const resume = () => {
      if (document.visibilityState !== 'hidden') notifyDataChanged();
    };
    const hide = () => { paused = true; clearTimeout(timer); controller?.abort(); };
    const show = () => { if (paused) { paused = false; void connect(); } };
    window.addEventListener('online', resume);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    void connect();
    return () => {
      active = false; clearTimeout(timer); controller?.abort();
      window.removeEventListener('online', resume); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show);
    };
  }, [token]);
}

import { useEffect, useRef } from 'react';
import { subscribeToUpdates } from '../services/liveUpdates';

// Refresh existing data without resetting filters, dialogs or form drafts.
export function useAutoRefresh(load: () => Promise<unknown>, interval = 60000) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    let active = true, busy = false, again = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (!active || document.visibilityState === 'hidden') return;
      if (busy) { again = true; return; }
      clearTimeout(timer);
      busy = true;
      try { await latest.current(); }
      catch { /* The loader displays its own error and preserves the last data. */ }
      finally {
        busy = false;
        if (active) timer = setTimeout(refresh, again ? 150 : interval);
        again = false;
      }
    }
    timer = setTimeout(refresh, interval);
    const unsubscribe = subscribeToUpdates(() => { void refresh(); });
    return () => { active = false; clearTimeout(timer); unsubscribe(); };
  }, [interval]);
}

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function notifyDataChanged() {
  // Coalesce the local mutation response and its server notification.
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach(listener => listener()), 150);
}

export function subscribeToUpdates(listener: () => void) {
  const resume = () => { if (document.visibilityState !== 'hidden') listener(); };
  listeners.add(listener);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
  };
}

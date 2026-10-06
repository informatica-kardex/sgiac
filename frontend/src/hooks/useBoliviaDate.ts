import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { localDate } from '../admin/schedule/semester';

export function useBoliviaDate() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const refreshPrint = () => flushSync(refresh);
    const midnight = Date.parse(`${today}T00:00:00-04:00`) + 86400000;
    const timer = window.setTimeout(refresh, Math.max(1, midnight - Date.now() + 50));
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('beforeprint', refreshPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('beforeprint', refreshPrint);
    };
  }, [today]);
  return today;
}

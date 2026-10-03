import { useEffect, useRef } from 'react';

// Calls `reload` when the phone gets its connection back. A page whose
// data failed to load while offline used to keep showing "No connection"
// after the signal returned, until someone thought to reload it. Pages pass
// a function that only reloads what failed, so nothing being typed is lost.
export function useReconnect(reload) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    const onOnline = () => latest.current();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}

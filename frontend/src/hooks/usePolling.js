import { useEffect, useRef, useCallback } from 'react';

export function usePolling(callback, intervalMs = 10000, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    savedCallback.current();

    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

export function useVisibilityRefresh(callback) {
  const handleFocus = useCallback(() => {
    callback();
  }, [callback]);

  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleFocus]);
}

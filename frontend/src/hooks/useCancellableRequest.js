import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage asynchronous requests and guarantee that only the latest request's response
 * updates state, preventing race conditions when users switch filters or dates quickly.
 */
export function useCancellableRequest() {
  const latestRequestId = useRef(0);
  const activeAbortController = useRef(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (requestFn, options = {}) => {
    const { onSuccess, onError, onFinally } = options;

    // Abort prior HTTP request if running
    if (activeAbortController.current) {
      try {
        activeAbortController.current.abort();
      } catch {
        // ignore abort error
      }
    }

    const controller = new AbortController();
    activeAbortController.current = controller;

    const currentId = ++latestRequestId.current;
    setIsPending(true);
    setError(null);

    try {
      const result = await requestFn(controller.signal);

      // Verify that this is still the newest active request
      if (currentId === latestRequestId.current) {
        setIsPending(false);
        if (onSuccess) onSuccess(result);
        return result;
      }
    } catch (err) {
      // Ignore user-aborted requests
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') {
        return;
      }

      if (currentId === latestRequestId.current) {
        setIsPending(false);
        setError(err);
        if (onError) onError(err);
        else throw err;
      }
    } finally {
      if (currentId === latestRequestId.current) {
        setIsPending(false);
        activeAbortController.current = null;
        if (onFinally) onFinally();
      }
    }
  }, []);

  const cancel = useCallback(() => {
    latestRequestId.current++;
    setIsPending(false);
    if (activeAbortController.current) {
      try {
        activeAbortController.current.abort();
      } catch {
        // ignore
      }
      activeAbortController.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    execute,
    cancel,
    isPending,
    error,
    latestRequestId
  };
}

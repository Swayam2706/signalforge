/**
 * useApi — generic hook for API calls with loading, error, fallback, and polling support.
 *
 * Usage:
 *   const { data, loading, error } = useApi(fetchFn, fallbackData, deps)
 *   const { data } = useApi(fetchFn, fallback, deps, 30000) // poll every 30s
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetchFn, fallback = null, deps = [], pollInterval = 0) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const mountedRef = useRef(true);

  const execute = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
        setUsingFallback(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        if (!isPolling) {
          console.warn('[SignalForge API] Falling back to mock data:', err.message);
          setData(fallback);
          setUsingFallback(true);
        }
        setError(err.message);
      }
    } finally {
      if (mountedRef.current && !isPolling) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute(false);

    // Set up polling if interval > 0
    let intervalId;
    if (pollInterval > 0) {
      intervalId = setInterval(() => execute(true), pollInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [execute, pollInterval]);

  return { data, loading, error, usingFallback, refetch: () => execute(false) };
}

import { useState, useEffect, useRef, useCallback } from "react";
import {
  REFRESH_MS,
  refreshDue,
  fetchPrices,
  applyPrices,
  quoteTargets,
} from "../lib/refresh";
export default function useAutoRefresh(state, setState) {
  const latest = useRef(state),
    busyRef = useRef(false),
    controller = useRef(null),
    alive = useRef(true),
    [status, setStatus] = useState({
      busy: false,
      errors: [],
      lastSuccess: null,
    });
  latest.current = state;
  const refresh = useCallback(async () => {
    if (busyRef.current || !quoteTargets(latest.current).length) return;
    busyRef.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setStatus((s) => ({ ...s, busy: true, errors: [] }));
    try {
      const result = await fetchPrices(latest.current, {
        signal: abort.signal,
      });
      if (!alive.current || abort.signal.aborted) return;
      setState((current) => applyPrices(current, result.quotes));
      setStatus({
        busy: false,
        errors: result.errors,
        lastSuccess: Object.keys(result.quotes).length
          ? new Date().toISOString()
          : null,
      });
    } catch (e) {
      if (alive.current && !abort.signal.aborted)
        setStatus((s) => ({ ...s, busy: false, errors: [e.message] }));
    } finally {
      if (controller.current === abort) busyRef.current = false;
    }
  }, [setState]);
  const targetSignature = quoteTargets(state)
    .map((t) => `${t.portfolio}:${t.currency}:${t.exchange}:${t.symbol}`)
    .sort()
    .join(",");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      busyRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (!state.autoRefresh) return;
    const tick = () => {
      if (navigator.onLine && refreshDue(latest.current.lastRefresh)) refresh();
    };
    const remaining = state.lastRefresh
      ? Math.max(0, REFRESH_MS - (Date.now() - Date.parse(state.lastRefresh)))
      : 0;
    const timer = setTimeout(tick, remaining);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [state.autoRefresh, state.lastRefresh, refresh, targetSignature]);
  return { ...status, refresh };
}

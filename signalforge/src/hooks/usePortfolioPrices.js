/**
 * usePortfolioPrices — live price engine for portfolio holdings.
 *
 * Strategy:
 * 1. Immediately fetch batch prices via REST on mount / symbols change
 * 2. Poll every 15s for near-live updates
 * 3. Layer Finnhub WebSocket ticks on top for US stocks (when available)
 *
 * Returns: { prices, lastUpdated, connected }
 * prices shape: { [SYMBOL]: { price, changePercent, prevPrice } }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getFinnhubToken } from '../services/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function usePortfolioPrices(symbols = []) {
  const [prices, setPrices] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const tokenRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Stable string key — only changes when the actual symbol list changes
  const symbolKey = [...symbols].sort().join(',');

  // ── REST batch fetch — uses symbolKey directly, no stale closure ─────────
  const fetchBatch = useCallback(async (syms) => {
    if (!syms || !syms.length) return;
    try {
      const res = await fetch(`${BASE_URL}/api/portfolio/prices?symbols=${syms.join(',')}`);
      if (!res.ok) return;
      const json = await res.json();
      const fresh = json?.data?.prices ?? json?.prices ?? {};
      if (!mountedRef.current || !Object.keys(fresh).length) return;
      setPrices(prev => {
        const next = { ...prev };
        for (const [sym, q] of Object.entries(fresh)) {
          next[sym] = {
            price: q.price,
            changePercent: q.changePercent,
            prevPrice: prev[sym]?.price ?? q.price,
          };
        }
        return next;
      });
      setLastUpdated(new Date());
    } catch { /* keep last known */ }
  }, []); // no deps — uses argument, not closure

  // ── Poll every 15s — pass symbols as argument, no stale closure ─────────
  useEffect(() => {
    mountedRef.current = true;
    if (!symbols.length) return;

    fetchBatch(symbols); // immediate
    intervalRef.current = setInterval(() => fetchBatch(symbols), 15000);

    return () => {
      clearInterval(intervalRef.current);
      // Note: do NOT set mountedRef.current = false here — WebSocket effect owns that
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  // ── Finnhub WebSocket — subscribe to all symbols ────────────────────────
  useEffect(() => {
    if (!symbols.length) return;
    const syms = [...symbols]; // snapshot — no stale closure
    let alive = true;

    const connect = async () => {
      if (!tokenRef.current) {
        try { tokenRef.current = await getFinnhubToken(); } catch { return; }
      }
      if (!tokenRef.current || !alive) return;

      try { wsRef.current?.close(); } catch {}

      const ws = new WebSocket(`wss://ws.finnhub.io?token=${tokenRef.current}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) { ws.close(); return; }
        setWsConnected(true);
        for (const sym of syms) {
          ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'trade' || !msg.data?.length) return;
          const ticks = {};
          for (const t of msg.data) {
            if (t.p > 0) ticks[t.s] = t.p;
          }
          if (!Object.keys(ticks).length) return;
          setPrices(prev => {
            const next = { ...prev };
            for (const [wsSymbol, tickPrice] of Object.entries(ticks)) {
              const match = syms.find(s =>
                wsSymbol === s || wsSymbol === `${s}.NS` || wsSymbol.endsWith(`:${s}`)
              );
              if (match) {
                next[match] = {
                  price: tickPrice,
                  changePercent: prev[match]?.changePercent ?? 0,
                  prevPrice: prev[match]?.price ?? tickPrice,
                };
              }
            }
            return next;
          });
          setLastUpdated(new Date());
        } catch {}
      };

      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => {
        setWsConnected(false);
        if (alive) setTimeout(() => { if (alive) connect(); }, 6000);
      };
    };

    connect();

    return () => {
      alive = false;
      mountedRef.current = false;
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          for (const sym of syms) {
            wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: sym }));
          }
          wsRef.current.close();
        }
      } catch {}
      setWsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  return { prices, lastUpdated, wsConnected };
}

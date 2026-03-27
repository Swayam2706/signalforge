/**
 * useFinnhubWS — Finnhub WebSocket hook for live price updates.
 *
 * Usage:
 *   const { price, change } = useFinnhubWS('AAPL');
 *
 * Automatically subscribes to the symbol and unsubscribes when symbol changes.
 * Falls back gracefully if WebSocket is unavailable.
 */

import { useState, useEffect, useRef } from 'react';
import { getFinnhubToken } from '../services/api';

export function useFinnhubWS(symbol) {
  const [livePrice, setLivePrice] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const tokenRef = useRef(null);
  const prevSymRef = useRef(null);

  useEffect(() => {
    if (!symbol) return;

    let ws;
    let alive = true;

    const connect = async () => {
      // Get token from backend (keeps key off frontend)
      if (!tokenRef.current) {
        try {
          tokenRef.current = await getFinnhubToken();
        } catch {
          return; // No token — skip WS
        }
      }
      if (!tokenRef.current || !alive) return;

      // Close existing connection
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }

      ws = new WebSocket(`wss://ws.finnhub.io?token=${tokenRef.current}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) { ws.close(); return; }
        setConnected(true);
        // Unsubscribe from previous symbol
        if (prevSymRef.current && prevSymRef.current !== symbol) {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol: prevSymRef.current }));
          // Also try .NS suffix
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol: `${prevSymRef.current}.NS` }));
        }
        // Subscribe to new symbol — try both plain and .NS
        ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        ws.send(JSON.stringify({ type: 'subscribe', symbol: `${symbol}.NS` }));
        prevSymRef.current = symbol;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'trade' && msg.data?.length > 0) {
            // Use the latest trade price
            const latest = msg.data[msg.data.length - 1];
            if (latest.p > 0) {
              setLivePrice(prev => ({
                price: latest.p,
                timestamp: latest.t,
                volume: latest.v,
                prevPrice: prev?.price || null,
              }));
            }
          }
        } catch {}
      };

      ws.onerror = () => setConnected(false);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 5s if still mounted
        if (alive) setTimeout(() => { if (alive) connect(); }, 5000);
      };
    };

    connect();

    return () => {
      alive = false;
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol }));
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: `${symbol}.NS` }));
          wsRef.current.close();
        } catch {}
      }
      setConnected(false);
    };
  }, [symbol]);

  return { livePrice, connected };
}

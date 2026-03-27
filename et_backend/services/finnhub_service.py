"""
Finnhub Live Data Service for SignalForge
Provides live quotes and batch quotes for dashboard/signals.
"""

import os
import logging
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
BASE_URL = "https://finnhub.io/api/v1"

if not FINNHUB_KEY:
    logger.warning("FINNHUB_API_KEY not set — live quotes disabled")


def _get(endpoint: str, params: dict = None) -> Optional[dict]:
    """Make a GET request to Finnhub API."""
    if not FINNHUB_KEY:
        return None
    try:
        p = {"token": FINNHUB_KEY, **(params or {})}
        r = requests.get(f"{BASE_URL}/{endpoint}", params=p, timeout=8)
        if r.status_code == 200:
            return r.json()
        logger.warning(f"Finnhub {endpoint} returned {r.status_code}")
        return None
    except Exception as e:
        logger.warning(f"Finnhub {endpoint} failed: {e}")
        return None


def get_quote(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Get live quote for a single symbol.
    Tries Finnhub first, falls back to yfinance.
    """
    # Try Finnhub first
    if FINNHUB_KEY:
        for suffix in ["", ".NS"]:
            data = _get("quote", {"symbol": f"{symbol}{suffix}"})
            if data and data.get("c", 0) > 0:
                return {
                    "symbol": symbol,
                    "price": round(data["c"], 2),
                    "change": round(data.get("d", 0) or 0, 2),
                    "changePercent": round(data.get("dp", 0) or 0, 2),
                    "high": round(data.get("h", 0), 2),
                    "low": round(data.get("l", 0), 2),
                    "open": round(data.get("o", 0), 2),
                    "prevClose": round(data.get("pc", 0), 2),
                    "timestamp": datetime.now().isoformat(),
                    "source": "finnhub",
                }

    # Fallback to yfinance
    try:
        import yfinance as yf
        for suffix in ["", ".NS"]:
            try:
                ticker = yf.Ticker(f"{symbol}{suffix}")
                hist = ticker.history(period="2d")
                if not hist.empty and len(hist) >= 1:
                    current = float(hist["Close"].iloc[-1])
                    prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
                    change = round(current - prev, 2)
                    change_pct = round((change / prev * 100) if prev else 0, 2)
                    return {
                        "symbol": symbol,
                        "price": round(current, 2),
                        "change": change,
                        "changePercent": change_pct,
                        "high": round(float(hist["High"].iloc[-1]), 2),
                        "low": round(float(hist["Low"].iloc[-1]), 2),
                        "open": round(float(hist["Open"].iloc[-1]), 2),
                        "prevClose": round(prev, 2),
                        "timestamp": datetime.now().isoformat(),
                        "source": "yfinance",
                    }
            except Exception:
                continue
    except Exception as e:
        logger.warning(f"yfinance quote fallback failed for {symbol}: {e}")

    return None


def get_batch_quotes(symbols: List[str]) -> Dict[str, Dict]:
    """
    Get live quotes for multiple symbols.
    Returns dict keyed by symbol.
    """
    results = {}
    for sym in symbols:
        quote = get_quote(sym)
        if quote:
            results[sym] = quote
    return results

"""
Unified Stock Provider Service for SignalForge
Routes requests to Finnhub (US) or Yahoo Finance (Indian) automatically.
"""

import os
import time
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ── Quote cache: symbol → (quote_dict, expires_at) ───────────────────────────
_quote_cache: Dict[str, tuple] = {}
_QUOTE_TTL = 30  # seconds — matches 30s frontend poll interval


def _get_cached_quote(symbol: str) -> Optional[Dict]:
    entry = _quote_cache.get(symbol.upper())
    if entry and time.time() < entry[1]:
        return entry[0]
    return None


def _set_cached_quote(symbol: str, quote: Dict) -> None:
    _quote_cache[symbol.upper()] = (quote, time.time() + _QUOTE_TTL)

# Indian exchange suffixes
INDIAN_SUFFIXES = {".NS", ".BO"}
# Known Indian display symbols (no suffix)
INDIAN_SYMBOLS = {
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK",
    "KOTAKBANK", "SBIN", "BAJFINANCE", "BHARTIARTL", "ITC", "LT", "WIPRO",
    "HCLTECH", "AXISBANK", "MARUTI", "SUNPHARMA", "TATAMOTORS", "TATASTEEL",
    "ADANIENT", "ONGC", "NTPC", "POWERGRID", "ULTRACEMCO", "BAJAJFINSV",
    "TECHM", "ASIANPAINT", "NESTLEIND", "DRREDDY", "CIPLA",
}


def is_indian(symbol: str) -> bool:
    """Determine if a symbol is an Indian stock."""
    sym = symbol.upper().strip()
    # Has Indian suffix
    for suffix in INDIAN_SUFFIXES:
        if sym.endswith(suffix.upper()):
            return True
    # Known Indian symbol
    if sym in INDIAN_SYMBOLS:
        return True
    return False


def to_yf_symbol(symbol: str) -> str:
    """Convert display symbol to yfinance format (add .NS if needed)."""
    sym = symbol.upper().strip()
    if any(sym.endswith(s.upper()) for s in INDIAN_SUFFIXES):
        return sym
    return f"{sym}.NS"


def search(query: str) -> List[Dict]:
    """
    Search stocks — Finnhub for US, Yahoo dataset for Indian.
    Returns unified result list.
    """
    from services.yahoo_finance_service import search_indian
    import httpx, asyncio

    results = []
    q = query.strip()

    # Always search Indian dataset (instant, no API call)
    indian = search_indian(q)
    results.extend(indian)

    # Finnhub search for US stocks (if key available)
    finnhub_key = os.getenv("FINNHUB_API_KEY", "")
    if finnhub_key and len(q) >= 1:
        try:
            import requests as req
            r = req.get(
                f"https://finnhub.io/api/v1/search?q={q}&token={finnhub_key}",
                timeout=3,
            )
            if r.status_code == 200:
                for item in r.json().get("result", [])[:8]:
                    sym = item.get("symbol", "")
                    if not sym:
                        continue
                    # Skip Indian symbols (already covered)
                    if any(sym.upper().endswith(s.upper()) for s in INDIAN_SUFFIXES):
                        continue
                    # Skip non-US exchanges
                    if "." in sym:
                        continue
                    results.append({
                        "symbol": sym,
                        "yfinanceSymbol": None,
                        "name": item.get("description", sym),
                        "exchange": "US",
                        "sector": "",
                        "provider": "finnhub",
                    })
        except Exception as e:
            logger.warning(f"Finnhub search failed: {e}")

    # Deduplicate by symbol
    seen = set()
    deduped = []
    for r in results:
        if r["symbol"] not in seen:
            seen.add(r["symbol"])
            deduped.append(r)

    return deduped[:10]


def get_quote(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Get quote — Finnhub for US, Yahoo Finance for Indian.
    Results are cached for 90s to avoid repeated external calls.
    """
    sym = symbol.upper().strip()

    # Return cached if fresh
    cached = _get_cached_quote(sym)
    if cached:
        return cached

    if is_indian(sym):
        from services.yahoo_finance_service import get_quote as yf_quote
        yf_sym = to_yf_symbol(sym)
        result = yf_quote(yf_sym)
    else:
        from services.finnhub_service import get_quote as fh_quote
        result = fh_quote(sym)

    if result:
        _set_cached_quote(sym, result)
    return result


def get_chart(symbol: str, period: str = "1mo", interval: str = "1d") -> Optional[Dict]:
    """
    Get OHLC chart data — Yahoo Finance for both (more reliable for history).
    For US stocks, tries yfinance directly.
    """
    from services.yahoo_finance_service import get_chart as yf_chart
    yf_sym = to_yf_symbol(symbol) if is_indian(symbol) else symbol
    return yf_chart(yf_sym, period, interval)

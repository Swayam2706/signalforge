"""
Yahoo Finance Service for SignalForge
Handles Indian NSE/BSE stocks via yfinance.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Indian stock symbol dataset for search
INDIAN_STOCKS = [
    {"symbol": "RELIANCE.NS", "display": "RELIANCE", "name": "Reliance Industries", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "TCS.NS", "display": "TCS", "name": "Tata Consultancy Services", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HDFCBANK.NS", "display": "HDFCBANK", "name": "HDFC Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "INFY.NS", "display": "INFY", "name": "Infosys", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HINDUNILVR.NS", "display": "HINDUNILVR", "name": "Hindustan Unilever", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "ICICIBANK.NS", "display": "ICICIBANK", "name": "ICICI Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "KOTAKBANK.NS", "display": "KOTAKBANK", "name": "Kotak Mahindra Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "SBIN.NS", "display": "SBIN", "name": "State Bank of India", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "BAJFINANCE.NS", "display": "BAJFINANCE", "name": "Bajaj Finance", "exchange": "NSE", "sector": "Finance"},
    {"symbol": "BHARTIARTL.NS", "display": "BHARTIARTL", "name": "Bharti Airtel", "exchange": "NSE", "sector": "Telecom"},
    {"symbol": "ITC.NS", "display": "ITC", "name": "ITC Limited", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "LT.NS", "display": "LT", "name": "Larsen & Toubro", "exchange": "NSE", "sector": "Infrastructure"},
    {"symbol": "WIPRO.NS", "display": "WIPRO", "name": "Wipro", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HCLTECH.NS", "display": "HCLTECH", "name": "HCL Technologies", "exchange": "NSE", "sector": "IT"},
    {"symbol": "AXISBANK.NS", "display": "AXISBANK", "name": "Axis Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "MARUTI.NS", "display": "MARUTI", "name": "Maruti Suzuki", "exchange": "NSE", "sector": "Auto"},
    {"symbol": "SUNPHARMA.NS", "display": "SUNPHARMA", "name": "Sun Pharmaceutical", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "TATAMOTORS.NS", "display": "TATAMOTORS", "name": "Tata Motors", "exchange": "NSE", "sector": "Auto"},
    {"symbol": "TATASTEEL.NS", "display": "TATASTEEL", "name": "Tata Steel", "exchange": "NSE", "sector": "Metals"},
    {"symbol": "ADANIENT.NS", "display": "ADANIENT", "name": "Adani Enterprises", "exchange": "NSE", "sector": "Conglomerate"},
    {"symbol": "ONGC.NS", "display": "ONGC", "name": "Oil and Natural Gas Corp", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "NTPC.NS", "display": "NTPC", "name": "NTPC Limited", "exchange": "NSE", "sector": "Power"},
    {"symbol": "POWERGRID.NS", "display": "POWERGRID", "name": "Power Grid Corporation", "exchange": "NSE", "sector": "Power"},
    {"symbol": "ULTRACEMCO.NS", "display": "ULTRACEMCO", "name": "UltraTech Cement", "exchange": "NSE", "sector": "Cement"},
    {"symbol": "BAJAJFINSV.NS", "display": "BAJAJFINSV", "name": "Bajaj Finserv", "exchange": "NSE", "sector": "Finance"},
    {"symbol": "TECHM.NS", "display": "TECHM", "name": "Tech Mahindra", "exchange": "NSE", "sector": "IT"},
    {"symbol": "ASIANPAINT.NS", "display": "ASIANPAINT", "name": "Asian Paints", "exchange": "NSE", "sector": "Paints"},
    {"symbol": "NESTLEIND.NS", "display": "NESTLEIND", "name": "Nestle India", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "DRREDDY.NS", "display": "DRREDDY", "name": "Dr Reddy's Laboratories", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "CIPLA.NS", "display": "CIPLA", "name": "Cipla", "exchange": "NSE", "sector": "Pharma"},
]


def search_indian(query: str) -> List[Dict]:
    """Search Indian stocks by name or symbol."""
    q = query.upper().strip()
    matches = []
    for s in INDIAN_STOCKS:
        sym = s["display"].upper()
        name = s["name"].upper()
        if sym == q or sym.startswith(q) or q in sym or q in name:
            matches.append({
                "symbol": s["display"],
                "yfinanceSymbol": s["symbol"],
                "name": s["name"],
                "exchange": s["exchange"],
                "sector": s["sector"],
                "provider": "yahoo",
            })
    # Sort: exact > prefix > contains
    def key(x):
        sym = x["symbol"]
        if sym == q: return 0
        if sym.startswith(q): return 1
        return 2
    matches.sort(key=key)
    return matches[:8]


def get_quote(yf_symbol: str) -> Optional[Dict[str, Any]]:
    """
    Get current quote for an Indian stock using yfinance.
    yf_symbol should include suffix, e.g. RELIANCE.NS
    """
    try:
        import yfinance as yf
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="2d")
        if hist.empty:
            return None
        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
        change = round(current - prev, 2)
        change_pct = round((change / prev * 100) if prev else 0, 2)
        return {
            "symbol": yf_symbol.replace(".NS", "").replace(".BO", ""),
            "yfinanceSymbol": yf_symbol,
            "price": round(current, 2),
            "change": change,
            "changePercent": change_pct,
            "high": round(float(hist["High"].iloc[-1]), 2),
            "low": round(float(hist["Low"].iloc[-1]), 2),
            "open": round(float(hist["Open"].iloc[-1]), 2),
            "prevClose": round(prev, 2),
            "volume": int(hist["Volume"].iloc[-1]),
            "timestamp": datetime.now().isoformat(),
            "source": "yahoo",
        }
    except Exception as e:
        logger.warning(f"Yahoo Finance quote failed for {yf_symbol}: {e}")
        return None


def get_chart(yf_symbol: str, period: str = "1mo", interval: str = "1d") -> Optional[Dict]:
    """
    Get OHLC chart data for an Indian stock.
    period: 1d, 5d, 1mo, 6mo, 1y
    interval: 1m, 5m, 15m, 1h, 1d
    """
    try:
        import yfinance as yf
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            return None
        ohlc = []
        for ts, row in hist.iterrows():
            ohlc.append({
                "timestamp": ts.isoformat(),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        current = ohlc[-1]["close"] if ohlc else 0
        first = ohlc[0]["close"] if ohlc else 0
        return {
            "symbol": yf_symbol.replace(".NS", "").replace(".BO", ""),
            "yfinanceSymbol": yf_symbol,
            "ohlc": ohlc,
            "currentPrice": current,
            "periodChange": round(current - first, 2),
            "periodChangePct": round((current - first) / first * 100 if first else 0, 2),
            "dataPoints": len(ohlc),
            "source": "yahoo",
        }
    except Exception as e:
        logger.warning(f"Yahoo Finance chart failed for {yf_symbol}: {e}")
        return None

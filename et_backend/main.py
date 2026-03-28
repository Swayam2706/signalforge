"""
SignalForge - AI Opportunity Intelligence Engine for Indian Stocks
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import time
import requests
from typing import Optional, Dict
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from config import settings
from db.base import create_tables
from auth import get_current_user
from data.fetcher import fetch_stock_data
from signals.detector import detect_signals_batch
from context.context_engine import generate_full_context
from scoring.scorer import score_batch_signals
from ai.explainer import AIExplainer
from ranking.ranker import get_top_n_opportunities
from insights.insight_generator import generate_batch_insights
from utils.tag_generator import generate_tags, generate_risk_note
from utils.response import StandardResponse
from utils.cache import api_response_cache, cleanup_expired_cache
from exceptions import SignalForgeException, ValidationError

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DEFAULT_STOCKS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'HINDUNILVR.NS',
    'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'BAJFINANCE.NS', 'BHARTIARTL.NS'
]

# Stock universe for instant search — no I/O, pure in-memory
STOCK_UNIVERSE = [
    {"symbol": "RELIANCE", "name": "Reliance Industries", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "INFY", "name": "Infosys", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance", "exchange": "NSE", "sector": "Finance"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel", "exchange": "NSE", "sector": "Telecom"},
    {"symbol": "ITC", "name": "ITC Limited", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "LT", "name": "Larsen & Toubro", "exchange": "NSE", "sector": "Infrastructure"},
    {"symbol": "WIPRO", "name": "Wipro", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HCLTECH", "name": "HCL Technologies", "exchange": "NSE", "sector": "IT"},
    {"symbol": "AXISBANK", "name": "Axis Bank", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki", "exchange": "NSE", "sector": "Auto"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors", "exchange": "NSE", "sector": "Auto"},
    {"symbol": "TATASTEEL", "name": "Tata Steel", "exchange": "NSE", "sector": "Metals"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises", "exchange": "NSE", "sector": "Conglomerate"},
    {"symbol": "ONGC", "name": "Oil and Natural Gas Corp", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "NTPC", "name": "NTPC Limited", "exchange": "NSE", "sector": "Power"},
    {"symbol": "POWERGRID", "name": "Power Grid Corporation", "exchange": "NSE", "sector": "Power"},
    {"symbol": "ULTRACEMCO", "name": "UltraTech Cement", "exchange": "NSE", "sector": "Cement"},
    {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv", "exchange": "NSE", "sector": "Finance"},
    {"symbol": "TECHM", "name": "Tech Mahindra", "exchange": "NSE", "sector": "IT"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints", "exchange": "NSE", "sector": "Paints"},
    {"symbol": "NESTLEIND", "name": "Nestle India", "exchange": "NSE", "sector": "FMCG"},
    {"symbol": "DRREDDY", "name": "Dr Reddy's Laboratories", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "CIPLA", "name": "Cipla", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "sector": "Semiconductors"},
    {"symbol": "TSLA", "name": "Tesla Inc", "exchange": "NASDAQ", "sector": "Auto"},
    {"symbol": "AAPL", "name": "Apple Inc", "exchange": "NASDAQ", "sector": "Technology"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "sector": "Technology"},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "exchange": "NASDAQ", "sector": "Semiconductors"},
    {"symbol": "GOOGL", "name": "Alphabet Inc", "exchange": "NASDAQ", "sector": "Technology"},
    {"symbol": "AMZN", "name": "Amazon.com Inc", "exchange": "NASDAQ", "sector": "E-Commerce"},
    {"symbol": "META", "name": "Meta Platforms Inc", "exchange": "NASDAQ", "sector": "Social Media"},
    {"symbol": "PLTR", "name": "Palantir Technologies", "exchange": "NYSE", "sector": "AI/Data"},
    {"symbol": "CRWD", "name": "CrowdStrike Holdings", "exchange": "NASDAQ", "sector": "Cybersecurity"},
    {"symbol": "XOM", "name": "ExxonMobil Corporation", "exchange": "NYSE", "sector": "Energy"},
    {"symbol": "JPM", "name": "JPMorgan Chase", "exchange": "NYSE", "sector": "Banking"},
    {"symbol": "NFLX", "name": "Netflix Inc", "exchange": "NASDAQ", "sector": "Streaming"},
]

explainer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SignalForge API...")
    try:
        create_tables()
        logger.info("Database tables created")
    except Exception as e:
        logger.warning(f"Database init: {e}")

    global explainer
    try:
        explainer = AIExplainer()
        logger.info(f"AI Explainer ready ({explainer.api_provider})")
    except Exception as e:
        logger.warning(f"AI Explainer unavailable: {e}")
        explainer = None

    logger.info("SignalForge API started")
    yield
    logger.info("SignalForge API shutting down")
    try:
        cleanup_expired_cache()
    except Exception:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    description="AI Opportunity Intelligence Engine for Indian Stocks",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        *settings.CORS_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return StandardResponse.success({
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
    }, "SignalForge API is running")


@app.get("/health")
async def health_check():
    return StandardResponse.success({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.APP_VERSION,
    }, "OK")


@app.get("/stocks")
async def get_default_stocks():
    return StandardResponse.success({
        "default_stocks": [s.replace('.NS', '') for s in DEFAULT_STOCKS],
        "count": len(DEFAULT_STOCKS),
        "market": "Indian (NSE)",
    })


@app.get("/search")
async def search_stocks(q: str = Query(default="", min_length=1)):
    """Hybrid search — Yahoo dataset for Indian, Finnhub for US. Instant."""
    if not q or len(q.strip()) < 1:
        return StandardResponse.success({"results": [], "query": q})
    try:
        from services.stock_provider import search
        results = search(q.strip())
        return StandardResponse.success({"results": results, "query": q})
    except Exception as e:
        logger.error(f"Search error: {e}")
        return StandardResponse.success({"results": [], "query": q})


@app.get("/scan")
async def market_scan(
    stocks: Optional[str] = None,
    max_results: int = Query(default=10, ge=1, le=20),
    use_ai: bool = True,
):
    """Scan market for top opportunities using yfinance + signal pipeline."""
    try:
        start = time.time()

        stock_list = (
            [s.strip().upper() + ".NS" for s in stocks.split(",")]
            if stocks
            else DEFAULT_STOCKS
        )

        # Check cache
        cache_key = f"scan:{':'.join(sorted(stock_list))}:{max_results}"
        cached = api_response_cache.get(cache_key)
        if cached is not None:
            return StandardResponse.success(cached, "Market scan (cached)")

        # 1. Fetch stock data from yfinance (in thread pool — non-blocking)
        import asyncio
        stock_data = await asyncio.get_running_loop().run_in_executor(None, fetch_stock_data, stock_list)

        # 2. Build response directly from fetched data + simple scoring
        top_stocks = []
        for symbol, sd in stock_data.items():
            if "error" in sd or sd.get("current_price", 0) == 0:
                continue

            closes = sd.get("last_5_days_closes", [])
            price = sd.get("current_price", 0)
            vol = sd.get("volume", 0)
            clean_symbol = symbol.replace(".NS", "")

            # Simple signal logic based on price trend
            if len(closes) >= 2:
                change = ((closes[-1] - closes[0]) / closes[0] * 100) if closes[0] else 0
            else:
                change = 0

            vol_spike = vol > 1_000_000
            if change > 2 and vol_spike:
                signal_type, trend, score = "Breakout", "Uptrend", min(90, 60 + int(change * 5))
            elif change > 0.5:
                signal_type, trend, score = "Momentum", "Uptrend", min(80, 50 + int(change * 8))
            elif change < -1:
                signal_type, trend, score = "Risky", "Downtrend", max(20, 50 - int(abs(change) * 5))
            else:
                signal_type, trend, score = "Hold", "Neutral", 45

            tags = generate_tags(vol, vol_spike, trend, signal_type, score)
            risk = generate_risk_note(signal_type, vol_spike, trend, score)

            top_stocks.append({
                "symbol": clean_symbol,
                "price": round(price, 2),
                "signal": signal_type,
                "confidence": score,
                "trend": trend,
                "risk": risk,
                "tags": tags,
                "change": round(change, 2),
                "explanation": f"{signal_type} signal for {clean_symbol} — {trend.lower()} with {score}% confidence",
            })

        # Sort by confidence
        top_stocks.sort(key=lambda x: x["confidence"], reverse=True)
        top_stocks = top_stocks[:max_results]

        response_data = {
            "top_stocks": top_stocks,
            "summary": {
                "total_scanned": len(stock_list),
                "results": len(top_stocks),
                "scan_time": f"{time.time() - start:.2f}s",
            },
        }

        api_response_cache.set(cache_key, response_data, ttl=300)
        return StandardResponse.success(response_data, f"Scan complete — {len(top_stocks)} opportunities")

    except Exception as e:
        logger.error(f"Scan error: {e}")
        return StandardResponse.server_error(f"Scan failed: {str(e)}")


@app.get("/live/quotes")
async def live_quotes(symbols: str = Query(default="RELIANCE,TCS,HDFCBANK,INFY,BAJFINANCE,ICICIBANK,KOTAKBANK,SBIN,HINDUNILVR,BHARTIARTL")):
    """Get live quotes for multiple symbols. Always returns data — never errors."""
    try:
        from services.finnhub_service import get_batch_quotes
        import asyncio
        symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        quotes = await asyncio.get_running_loop().run_in_executor(None, get_batch_quotes, symbol_list)
        return StandardResponse.success({
            "quotes": quotes,
            "count": len(quotes),
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        logger.error(f"Live quotes error: {e}")
        # Return empty quotes instead of error — frontend will use scan data
        return StandardResponse.success({
            "quotes": {},
            "count": 0,
            "timestamp": datetime.now().isoformat(),
        })


@app.get("/finnhub/token")
async def finnhub_token():
    """Return Finnhub API key for frontend WebSocket connection."""
    key = os.getenv("FINNHUB_API_KEY", "")
    if not key:
        return StandardResponse.error("Finnhub not configured", "NO_KEY")
    return StandardResponse.success({"token": key})


@app.get("/stocks/quote/{symbol}")
async def unified_quote(symbol: str):
    """
    Unified quote endpoint — routes to Finnhub (US) or Yahoo Finance (Indian).
    Returns same shape regardless of provider.
    """
    try:
        import asyncio
        from services.stock_provider import get_quote
        result = await asyncio.get_running_loop().run_in_executor(None, get_quote, symbol)
        if result:
            return StandardResponse.success(result)
        return StandardResponse.error(f"No data for {symbol}", "NO_DATA")
    except Exception as e:
        logger.error(f"Unified quote error for {symbol}: {e}")
        return StandardResponse.server_error(str(e))


@app.get("/stocks/chart/{symbol}")
async def unified_chart(
    symbol: str,
    period: str = Query(default="1mo"),
    interval: str = Query(default="1d"),
):
    """
    Unified chart endpoint — Yahoo Finance for both US and Indian stocks.
    period: 1d, 5d, 1mo, 6mo, 1y
    interval: 1m, 5m, 15m, 1h, 1d
    """
    try:
        import asyncio
        from services.stock_provider import get_chart
        result = await asyncio.get_running_loop().run_in_executor(None, get_chart, symbol, period, interval)
        if result:
            return StandardResponse.success(result)
        return StandardResponse.error(f"No chart data for {symbol}", "NO_DATA")
    except Exception as e:
        logger.error(f"Chart error for {symbol}: {e}")
        return StandardResponse.server_error(str(e))


@app.get("/finnhub/quote/{symbol}")
async def finnhub_quote(symbol: str):
    """
    Get full Finnhub quote for a symbol.
    Returns: price, high, low, open, prevClose, change, changePercent.
    Falls back to yfinance if Finnhub returns 0.
    """
    try:
        import httpx
        finnhub_key = os.getenv("FINNHUB_API_KEY", "")
        sym = symbol.upper()

        # Try Finnhub first (async — non-blocking)
        if finnhub_key:
            async with httpx.AsyncClient(timeout=6) as client:
                for try_sym in [sym, f"{sym}.NS"]:
                    try:
                        r = await client.get(
                            f"https://finnhub.io/api/v1/quote?symbol={try_sym}&token={finnhub_key}"
                        )
                        if r.status_code == 200:
                            d = r.json()
                            if d.get("c", 0) > 0:
                                return StandardResponse.success({
                                    "symbol": sym,
                                    "finnhubSymbol": try_sym,
                                    "price": round(d["c"], 2),
                                    "high": round(d.get("h", 0), 2),
                                    "low": round(d.get("l", 0), 2),
                                    "open": round(d.get("o", 0), 2),
                                    "prevClose": round(d.get("pc", 0), 2),
                                    "change": round(d.get("d", 0) or 0, 2),
                                    "changePercent": round(d.get("dp", 0) or 0, 2),
                                    "timestamp": datetime.now().isoformat(),
                                    "source": "finnhub",
                                })
                    except Exception:
                        continue

        # Fallback to yfinance (runs in thread pool to avoid blocking)
        import asyncio
        import yfinance as yf

        def _yf_fetch():
            for suffix in ["", ".NS"]:
                try:
                    ticker = yf.Ticker(f"{sym}{suffix}")
                    hist = ticker.history(period="2d")
                    if not hist.empty:
                        current = float(hist["Close"].iloc[-1])
                        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
                        return {
                            "symbol": sym,
                            "finnhubSymbol": f"{sym}{suffix}",
                            "price": round(current, 2),
                            "high": round(float(hist["High"].iloc[-1]), 2),
                            "low": round(float(hist["Low"].iloc[-1]), 2),
                            "open": round(float(hist["Open"].iloc[-1]), 2),
                            "prevClose": round(prev, 2),
                            "change": round(current - prev, 2),
                            "changePercent": round((current - prev) / prev * 100 if prev else 0, 2),
                            "timestamp": datetime.now().isoformat(),
                            "source": "yfinance",
                        }
                except Exception:
                    continue
            return None

        result = await asyncio.get_running_loop().run_in_executor(None, _yf_fetch)
        if result:
            return StandardResponse.success(result)

        return StandardResponse.error(f"No data available for {symbol}", "NO_DATA")

    except Exception as e:
        logger.error(f"Finnhub quote error for {symbol}: {e}")
        return StandardResponse.server_error(f"Quote failed: {str(e)}")


@app.get("/live/quote/{symbol}")
async def live_quote(symbol: str):
    """Get a single live quote. Tries Finnhub → yfinance → scan cache."""
    try:
        from services.finnhub_service import get_quote
        quote = get_quote(symbol.upper())
        if quote:
            return StandardResponse.success(quote)
        # Last resort: try to find in scan cache
        cache_key = f"scan:{':'.join(sorted(DEFAULT_STOCKS))}:10"
        cached_scan = api_response_cache.get(cache_key)
        if cached_scan:
            for s in cached_scan.get("top_stocks", []):
                if s.get("symbol", "").upper() == symbol.upper():
                    return StandardResponse.success({
                        "symbol": symbol.upper(),
                        "price": s.get("price", 0),
                        "change": 0,
                        "changePercent": s.get("change", 0),
                        "high": 0, "low": 0, "open": 0, "prevClose": 0,
                        "timestamp": datetime.now().isoformat(),
                        "source": "cache",
                    })
        return StandardResponse.success({
            "symbol": symbol.upper(),
            "price": 0, "change": 0, "changePercent": 0,
            "high": 0, "low": 0, "open": 0, "prevClose": 0,
            "timestamp": datetime.now().isoformat(),
            "source": "unavailable",
        })
    except Exception as e:
        logger.error(f"Live quote error for {symbol}: {e}")
        return StandardResponse.success({
            "symbol": symbol.upper(),
            "price": 0, "change": 0, "changePercent": 0,
            "high": 0, "low": 0, "open": 0, "prevClose": 0,
            "timestamp": datetime.now().isoformat(),
            "source": "error",
        })


@app.get("/stock/{symbol}")
async def get_stock_detail(symbol: str, period: int = Query(default=60, ge=7, le=365)):
    """Get detailed stock data with OHLC history."""
    try:
        from data.fetcher import fetch_stock_ohlc_data
        from signals.detector import detect_signal

        full_symbol = symbol.upper()
        if not full_symbol.endswith(".NS"):
            full_symbol += ".NS"

        ohlc_data = fetch_stock_ohlc_data(full_symbol, period)
        if "error" in ohlc_data:
            return StandardResponse.error(ohlc_data["error"], "STOCK_DATA_ERROR")

        # Run signal detection on the data
        closes = [p["close"] for p in ohlc_data.get("historical_data", [])[-5:]]
        all_closes = [p["close"] for p in ohlc_data.get("historical_data", [])]
        all_volumes = [p["volume"] for p in ohlc_data.get("historical_data", [])]
        prev_close = closes[-2] if len(closes) >= 2 else ohlc_data.get("current_price", 0)
        stock_data = {
            full_symbol: {
                "symbol": full_symbol,
                "current_price": ohlc_data.get("current_price", 0),
                "previous_close": prev_close,
                "volume": ohlc_data.get("current_volume", 0),
                "last_5_days_closes": closes,
                "last_5_days_dates": [p["timestamp"] for p in ohlc_data.get("historical_data", [])[-5:]],
            }
        }
        signals = detect_signals_batch(stock_data)
        sig = signals.get(full_symbol, {})

        # Calculate change values
        current_price = ohlc_data.get("current_price", 0)
        if len(closes) >= 2 and closes[0]:
            change_pct = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
            change_amt = round(closes[-1] - closes[0], 2)
        else:
            change_pct = 0
            change_amt = 0

        # Generate context insights from real OHLC data
        context_insights = _generate_context_insights(
            symbol=symbol.upper(),
            current_price=current_price,
            closes=all_closes,
            volumes=all_volumes,
            signal=sig.get("signal_type", "Hold"),
            trend=sig.get("trend", "Neutral"),
            change_pct=change_pct,
        )

        return StandardResponse.success({
            "symbol": symbol.upper().replace(".NS", ""),
            "price": round(current_price, 2),
            "volume": ohlc_data.get("current_volume", 0),
            "ohlc": ohlc_data.get("historical_data", []),
            "signal": sig.get("signal_type", "Hold"),
            "confidence": int(sig.get("total_score", 50)) if "total_score" in sig else 50,
            "trend": sig.get("trend", "Neutral"),
            "change": change_pct,
            "changeAmt": change_amt,
            "risk": "Monitor position" if sig.get("signal_type") == "Risky" else "Normal",
            "tags": [ci["title"] for ci in context_insights],
            "contextInsights": context_insights,
            "explanation": _generate_explanation(symbol.upper(), sig.get("signal_type", "Hold"), change_pct, sig.get("trend", "Neutral")),
            "data_points": ohlc_data.get("data_points", 0),
            "last_updated": datetime.now().isoformat(),
        })

    except Exception as e:
        logger.error(f"Stock detail error for {symbol}: {e}")
        return StandardResponse.success({
            "symbol": symbol.upper().replace(".NS", ""),
            "price": 0, "volume": 0, "ohlc": [],
            "signal": "Hold", "confidence": 50, "trend": "Neutral",
            "change": 0, "changeAmt": 0,
            "risk": "Data unavailable", "tags": [],
            "contextInsights": [],
            "explanation": f"Unable to fetch data for {symbol}",
            "data_points": 0, "last_updated": datetime.now().isoformat(),
        })


def _generate_context_insights(symbol, current_price, closes, volumes, signal, trend, change_pct):
    """Generate stock-specific context insights from OHLC data."""
    insights = []
    if not closes or len(closes) < 5:
        return [{"title": "Insufficient data", "strength": "Low", "color": "amber", "text": "Not enough historical data to generate context insights."}]

    # 1. Price trend context
    ma5 = sum(closes[-5:]) / 5
    ma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else ma5
    if current_price > ma5 > ma20:
        insights.append({"title": "Above Moving Averages", "strength": "Strong", "color": "emerald",
            "text": f"{symbol} is trading above both its 5-day (₹{ma5:.0f}) and 20-day (₹{ma20:.0f}) moving averages, indicating positive momentum."})
    elif current_price < ma5 < ma20:
        insights.append({"title": "Below Moving Averages", "strength": "Strong", "color": "red",
            "text": f"{symbol} is trading below both its 5-day (₹{ma5:.0f}) and 20-day (₹{ma20:.0f}) moving averages, indicating downward pressure."})
    else:
        insights.append({"title": "Mixed Moving Average Signal", "strength": "Medium", "color": "amber",
            "text": f"Price is between short-term (₹{ma5:.0f}) and medium-term (₹{ma20:.0f}) averages — consolidation phase."})

    # 2. Volume context
    if volumes and len(volumes) >= 5:
        avg_vol = sum(volumes[-20:]) / max(len(volumes[-20:]), 1)
        recent_vol = volumes[-1]
        vol_ratio = recent_vol / avg_vol if avg_vol > 0 else 1
        if vol_ratio > 1.5:
            insights.append({"title": "High Volume Activity", "strength": "Strong", "color": "emerald",
                "text": f"Current volume is {vol_ratio:.1f}x above the 20-day average, indicating strong institutional participation."})
        elif vol_ratio < 0.6:
            insights.append({"title": "Low Volume Warning", "strength": "Medium", "color": "amber",
                "text": f"Volume is {vol_ratio:.1f}x below average. Low conviction — price moves may not be sustained."})
        else:
            insights.append({"title": "Normal Volume", "strength": "Medium", "color": "blue",
                "text": f"Volume is in line with the 20-day average, suggesting steady market participation."})

    # 3. Recent price behavior
    period_change = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2) if closes[0] else 0
    if abs(period_change) > 10:
        color = "emerald" if period_change > 0 else "red"
        insights.append({"title": f"{'Strong Uptrend' if period_change > 0 else 'Sharp Decline'}", "strength": "Strong", "color": color,
            "text": f"{symbol} has moved {period_change:+.1f}% over the analysis period — {'significant bullish momentum' if period_change > 0 else 'significant selling pressure'}."})
    elif abs(period_change) > 3:
        color = "emerald" if period_change > 0 else "amber"
        insights.append({"title": "Moderate Price Movement", "strength": "Medium", "color": color,
            "text": f"Price has moved {period_change:+.1f}% over the period — moderate {'upward' if period_change > 0 else 'downward'} trend."})
    else:
        insights.append({"title": "Sideways Consolidation", "strength": "Low", "color": "blue",
            "text": f"Price has moved only {period_change:+.1f}% — stock is in a consolidation phase. Watch for breakout."})

    # 4. Signal-based insight
    if signal in ["Breakout", "Momentum"]:
        insights.append({"title": "Positive Signal Detected", "strength": "Strong", "color": "emerald",
            "text": f"Technical analysis shows a {signal.lower()} pattern. Price action and volume support a bullish bias."})
    elif signal == "Risky":
        insights.append({"title": "Risk Signal Active", "strength": "Strong", "color": "red",
            "text": "Multiple risk indicators are elevated. Consider reducing exposure or hedging existing positions."})
    else:
        insights.append({"title": "Neutral Stance", "strength": "Medium", "color": "amber",
            "text": "No strong directional signal. Wait for a clearer setup before taking a position."})

    return insights[:4]  # max 4 insights


def _generate_explanation(symbol, signal, change_pct, trend):
    """Generate a human-readable explanation for the signal."""
    direction = "positive" if change_pct > 0 else "negative" if change_pct < 0 else "flat"
    if signal in ["Breakout", "Momentum"]:
        return f"{symbol} shows {signal.lower()} characteristics with {change_pct:+.2f}% price movement and {trend.lower()} trend. Technical indicators support a bullish bias with elevated volume confirming the move."
    elif signal == "Risky":
        return f"{symbol} is showing weakness with {change_pct:+.2f}% movement. Distribution patterns and declining momentum suggest caution. Risk management is critical at current levels."
    else:
        return f"{symbol} is in a {direction} phase with {change_pct:+.2f}% change. No strong directional signal — monitor for a breakout above resistance or breakdown below support."


# ─── Trade Alerts ─────────────────────────────────────────────────────────────

# In-memory store (replace with DB in production)
_trade_alerts: list = []


@app.post("/alerts")
async def create_trade_alert(payload: dict):
    """Create a trade alert for the authenticated user."""
    try:
        symbol = payload.get("symbol", "").strip().upper()
        user_id = payload.get("userId", "anonymous")

        if not symbol:
            return StandardResponse.bad_request("Symbol is required")

        # Validate required fields
        entry_min = payload.get("entryMin")
        stop_loss = payload.get("stopLoss")
        if entry_min is None or stop_loss is None:
            return StandardResponse.bad_request("entryMin and stopLoss are required")

        # Prevent duplicate active alerts for same user+symbol
        existing = [a for a in _trade_alerts if a["symbol"] == symbol and a["userId"] == user_id and a["status"] == "active"]
        if existing:
            # Update existing instead of duplicating
            existing[0].update({**payload, "updatedAt": datetime.now().isoformat()})
            return StandardResponse.success(existing[0], "Trade alert updated")

        alert = {
            "id": f"{user_id}_{symbol}_{int(datetime.now().timestamp())}",
            "symbol": symbol,
            "companyName": payload.get("companyName", symbol),
            "action": payload.get("action", "Monitor"),
            "entryMin": entry_min,
            "entryMax": payload.get("entryMax", entry_min),
            "stopLoss": stop_loss,
            "targetPrice": payload.get("targetPrice"),
            "signalConfidence": payload.get("signalConfidence", 50),
            "userId": user_id,
            "status": "active",
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
        }
        _trade_alerts.append(alert)
        logger.info(f"Trade alert created: {alert['id']}")
        return StandardResponse.success(alert, "Trade alert created successfully")

    except Exception as e:
        logger.error(f"Create alert error: {e}")
        return StandardResponse.server_error(f"Failed to create alert: {str(e)}")


@app.get("/alerts")
async def get_trade_alerts(user_id: str = Query(default="anonymous")):
    """Get all active trade alerts for a user."""
    try:
        user_alerts = [a for a in _trade_alerts if a["userId"] == user_id]
        return StandardResponse.success({"alerts": user_alerts, "count": len(user_alerts)})
    except Exception as e:
        logger.error(f"Get alerts error: {e}")
        return StandardResponse.server_error(str(e))


@app.delete("/alerts/{alert_id}")
async def delete_trade_alert(alert_id: str):
    """Delete a trade alert."""
    global _trade_alerts
    before = len(_trade_alerts)
    _trade_alerts = [a for a in _trade_alerts if a["id"] != alert_id]
    if len(_trade_alerts) < before:
        return StandardResponse.success(None, "Alert deleted")
    return StandardResponse.error("Alert not found", "NOT_FOUND")


@app.get("/assistant/status")
async def assistant_status():
    has_ai = bool(os.getenv("OPENROUTER_API_KEY"))
    has_finnhub = bool(os.getenv("FINNHUB_API_KEY"))
    return StandardResponse.success({
        "assistant_available": has_ai,
        "provider": "openrouter/mistral-7b" if has_ai else "fallback",
        "live_prices": has_finnhub,
    })


@app.post("/assistant/chat")
async def assistant_chat(request: dict):
    """AI assistant — uses OpenRouter + Finnhub + yfinance + Tavily."""
    try:
        from services.ai_assistant import analyze_query

        message = request.get("message", "")
        user_id = request.get("user_id", "anonymous")

        if not message:
            return StandardResponse.bad_request("Message is required")

        result = analyze_query(message, user_id)

        # Map to the response shape the frontend expects
        return StandardResponse.success({
            "response": result.get("summary", ""),
            "signal": result.get("signal", "Hold"),
            "confidence": result.get("confidence", 50),
            "riskLevel": result.get("riskLevel", "Medium"),
            "riskFactors": result.get("riskFactors", []),
            "actionPlan": result.get("actionPlan", {}),
            "ticker": result.get("ticker"),
            "liveQuote": result.get("liveQuote"),
            "related_stocks": [],
            "user_id": user_id,
            "timestamp": result.get("timestamp", datetime.now().isoformat()),
            "provider_used": result.get("provider_used", "fallback"),
            "processing_time": result.get("processing_time", 0),
        })

    except Exception as e:
        logger.error(f"Assistant error: {e}")
        return StandardResponse.success({
            "response": "I encountered an issue processing your request. Please try again with a specific stock name like RELIANCE, TCS, or NVIDIA.",
            "signal": "Hold", "confidence": 50, "riskLevel": "Medium",
            "riskFactors": ["Service temporarily unavailable"],
            "actionPlan": {"label": "Try again", "timeframe": "Short-term"},
            "ticker": None, "liveQuote": None, "related_stocks": [],
            "user_id": request.get("user_id", "anonymous"),
            "timestamp": datetime.now().isoformat(),
            "provider_used": "error-fallback", "processing_time": 0,
        })


@app.get("/dashboard/overview")
async def dashboard_overview():
    """
    Full dashboard overview — returns everything the right panel needs.
    Computes sentiment, signal analytics, top movers from live scan data.
    """
    try:
        # Get scan data (uses cache if available)
        cache_key = f"scan:{':'.join(sorted(DEFAULT_STOCKS))}:10"
        cached = api_response_cache.get(cache_key)

        if not cached:
            # Fetch fresh
            stock_data = fetch_stock_data(DEFAULT_STOCKS)
            top_stocks = []
            for symbol, sd in stock_data.items():
                if "error" in sd or sd.get("current_price", 0) == 0:
                    continue
                closes = sd.get("last_5_days_closes", [])
                price = sd.get("current_price", 0)
                vol = sd.get("volume", 0)
                clean = symbol.replace(".NS", "")
                change = ((closes[-1] - closes[0]) / closes[0] * 100) if len(closes) >= 2 and closes[0] else 0
                vol_spike = vol > 1_000_000
                if change > 2 and vol_spike:
                    sig = "Breakout"
                elif change > 0.5:
                    sig = "Momentum"
                elif change < -1:
                    sig = "Risky"
                else:
                    sig = "Hold"
                top_stocks.append({"symbol": clean, "price": round(price, 2), "signal": sig, "change": round(change, 2), "confidence": min(90, max(20, 50 + int(change * 8)))})
        else:
            top_stocks = cached.get("top_stocks", [])

        # Compute sentiment from aggregate changes
        changes = [s.get("change", 0) for s in top_stocks]
        avg_change = sum(changes) / max(len(changes), 1)
        sentiment_score = max(10, min(95, int(50 + avg_change * 8)))
        positive_count = sum(1 for c in changes if c > 0)
        negative_count = sum(1 for c in changes if c < 0)
        neutral_count = len(changes) - positive_count - negative_count
        total = max(len(changes), 1)

        # Sentiment label
        if sentiment_score > 65:
            sentiment_label = "Positive Momentum"
        elif sentiment_score < 35:
            sentiment_label = "Negative Pressure"
        else:
            sentiment_label = "Mixed Signals"

        # Buy/Sell/Hold distribution
        buy_count = sum(1 for s in top_stocks if s.get("signal") in ["Breakout", "Momentum"])
        sell_count = sum(1 for s in top_stocks if s.get("signal") == "Risky")
        hold_count = total - buy_count - sell_count
        buy_pct = round(buy_count / total * 100) if total else 33
        sell_pct = round(sell_count / total * 100) if total else 33
        hold_pct = 100 - buy_pct - sell_pct

        # Top movers — sorted by absolute change
        movers = sorted(top_stocks, key=lambda x: abs(x.get("change", 0)), reverse=True)[:4]
        top_movers = [{"symbol": m["symbol"], "change": f"{m['change']:+.1f}%", "up": m["change"] >= 0} for m in movers]

        # Sentiment chart data — use closes from first stock as proxy
        chart_points = []
        if top_stocks:
            first_sym = top_stocks[0]["symbol"] + ".NS"
            first_data = None
            try:
                import yfinance as yf
                t = yf.Ticker(first_sym)
                h = t.history(period="5d")
                if not h.empty:
                    closes = [round(float(c), 2) for c in h["Close"]]
                    min_c, max_c = min(closes), max(closes)
                    rng = max_c - min_c or 1
                    for i, c in enumerate(closes):
                        chart_points.append(round(70 - ((c - min_c) / rng) * 55))
            except Exception:
                pass
        if not chart_points:
            chart_points = [50, 45, 42, 38, 32, 28, 22, 18, 15]

        # Build SVG path from chart points
        step = 300 / max(len(chart_points) - 1, 1)
        line_path = " ".join([f"{'M' if i == 0 else 'L'}{round(i * step)},{p}" for i, p in enumerate(chart_points)])
        area_path = line_path + f" L300,70 L0,70 Z"

        return StandardResponse.success({
            "marketSentiment": {
                "score": sentiment_score,
                "label": sentiment_label,
                "changeText": f"{avg_change:+.1f}% avg movement",
                "chartLine": line_path,
                "chartArea": area_path,
            },
            "signalAnalytics": {
                "buyVsSell": {"bull": buy_pct, "bear": sell_pct, "mixed": hold_pct},
                "sectors": {"Tech": 35, "Finance": 25, "Energy": 20, "Healthcare": 20},
            },
            "topMovers": top_movers,
            "dataPoints": f"{len(top_stocks) * 240}K",
            "timestamp": datetime.now().isoformat(),
        })

    except Exception as e:
        logger.error(f"Dashboard overview error: {e}")
        return StandardResponse.success({
            "marketSentiment": {"score": 50, "label": "Loading...", "changeText": "", "chartLine": "M0,35 L300,35", "chartArea": "M0,35 L300,35 L300,70 L0,70 Z"},
            "signalAnalytics": {"buyVsSell": {"bull": 33, "bear": 33, "mixed": 34}, "sectors": {"Tech": 25, "Finance": 25, "Energy": 25, "Healthcare": 25}},
            "topMovers": [],
            "dataPoints": "0",
            "timestamp": datetime.now().isoformat(),
        })


# ─── Database-backed Portfolio APIs ──────────────────────────────────────────

@app.get("/api/portfolio")
async def api_get_portfolio(user_id: str = Query(..., description="Clerk user ID")):
    """Get user's portfolio with live prices and analytics — parallel price fetching."""
    try:
        import asyncio
        from services.database import get_holdings
        from services.stock_provider import get_quote

        holdings = get_holdings(user_id)
        if not holdings:
            return StandardResponse.success({
                "holdings": [], "totalValue": 0, "totalCost": 0,
                "totalPnl": 0, "totalPnlPct": 0, "isEmpty": True,
            })

        loop = asyncio.get_running_loop()

        # Fetch ALL quotes in parallel
        symbols = [h["symbol"] for h in holdings]
        quotes = await asyncio.gather(
            *[loop.run_in_executor(None, get_quote, sym) for sym in symbols],
            return_exceptions=True,
        )

        enriched = []
        total_value = 0
        total_cost = 0

        for h, quote in zip(holdings, quotes):
            qty = float(h["quantity"])
            avg = float(h["average_price"])
            cost = qty * avg

            if isinstance(quote, Exception) or not quote:
                price, change_pct = avg, 0.0
            else:
                raw_price = quote.get("price")
                price = raw_price if (raw_price is not None and raw_price > 0) else avg
                change_pct = quote.get("changePercent", 0) or 0

            current_value = qty * price
            pnl = current_value - cost
            pnl_pct = (pnl / cost * 100) if cost > 0 else 0

            total_value += current_value
            total_cost += cost

            enriched.append({
                **h,
                "id": str(h["id"]),
                "portfolio_id": str(h["portfolio_id"]),
                "currentPrice": round(price, 2),
                "currentValue": round(current_value, 2),
                "investedValue": round(cost, 2),
                "pnl": round(pnl, 2),
                "pnlPct": round(pnl_pct, 2),
                "changePercent": round(change_pct, 2),
                "quantity": float(h["quantity"]),
                "averagePrice": float(h["average_price"]),
            })

        total_pnl = total_value - total_cost
        total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0

        return StandardResponse.success({
            "holdings": enriched,
            "totalValue": round(total_value, 2),
            "totalCost": round(total_cost, 2),
            "totalPnl": round(total_pnl, 2),
            "totalPnlPct": round(total_pnl_pct, 2),
            "isEmpty": False,
        })
    except Exception as e:
        logger.error(f"Portfolio fetch error: {e}")
        return StandardResponse.server_error(str(e))


@app.get("/api/portfolio/prices")
async def api_portfolio_prices(symbols: str = Query(..., description="Comma-separated symbols")):
    """
    Batch live price fetch for portfolio holdings.
    Returns { symbol: { price, changePercent } } — no DB round-trip.
    Used by frontend for fast P&L refresh without full portfolio reload.
    """
    try:
        import asyncio
        from services.stock_provider import get_quote

        sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if not sym_list:
            return StandardResponse.success({"prices": {}})

        loop = asyncio.get_running_loop()
        quotes = await asyncio.gather(
            *[loop.run_in_executor(None, get_quote, sym) for sym in sym_list],
            return_exceptions=True,
        )

        prices = {}
        for sym, quote in zip(sym_list, quotes):
            if isinstance(quote, Exception) or not quote:
                continue
            raw_price = quote.get("price")
            if raw_price is not None and raw_price > 0:
                prices[sym] = {
                    "price": round(raw_price, 2),
                    "changePercent": round(quote.get("changePercent", 0) or 0, 2),
                }

        return StandardResponse.success({"prices": prices, "count": len(prices)})
    except Exception as e:
        logger.error(f"Portfolio prices error: {e}")
        return StandardResponse.server_error(str(e))


@app.post("/api/portfolio/holdings")
async def api_add_holding(payload: dict):
    """Add a stock to user's portfolio."""
    try:
        from services.database import add_holding
        user_id = payload.get("userId", "")
        if not user_id:
            return StandardResponse.bad_request("userId required")
        result = add_holding(
            clerk_user_id=user_id,
            symbol=payload.get("symbol", "").upper(),
            company_name=payload.get("companyName", payload.get("symbol", "")),
            exchange=payload.get("exchange", "NSE"),
            quantity=float(payload.get("quantity", 0)),
            average_price=float(payload.get("averagePrice", 0)),
        )
        result["id"] = str(result["id"])
        result["portfolio_id"] = str(result["portfolio_id"])
        return StandardResponse.success(result, "Holding added")
    except Exception as e:
        logger.error(f"Add holding error: {e}")
        return StandardResponse.server_error(str(e))


@app.put("/api/portfolio/holdings/{holding_id}")
async def api_update_holding(holding_id: str, payload: dict):
    """Update a holding's quantity and average price."""
    try:
        from services.database import update_holding
        user_id = payload.get("userId", "")
        result = update_holding(
            holding_id=holding_id,
            clerk_user_id=user_id,
            quantity=float(payload.get("quantity", 0)),
            average_price=float(payload.get("averagePrice", 0)),
        )
        if not result:
            return StandardResponse.error("Holding not found", "NOT_FOUND")
        result["id"] = str(result["id"])
        return StandardResponse.success(result, "Holding updated")
    except Exception as e:
        logger.error(f"Update holding error: {e}")
        return StandardResponse.server_error(str(e))


@app.delete("/api/portfolio/holdings/{holding_id}")
async def api_delete_holding(holding_id: str, user_id: str = Query(...)):
    """Delete a holding from portfolio."""
    try:
        from services.database import delete_holding
        deleted = delete_holding(holding_id, user_id)
        if not deleted:
            return StandardResponse.error("Holding not found", "NOT_FOUND")
        return StandardResponse.success(None, "Holding deleted")
    except Exception as e:
        logger.error(f"Delete holding error: {e}")
        return StandardResponse.server_error(str(e))


# ─── Watchlist APIs ───────────────────────────────────────────────────────────

@app.get("/api/watchlist")
async def api_get_watchlist(user_id: str = Query(...)):
    try:
        from services.database import get_watchlist
        items = get_watchlist(user_id)
        return StandardResponse.success({"items": [{**i, "id": str(i["id"])} for i in items]})
    except Exception as e:
        return StandardResponse.server_error(str(e))


@app.post("/api/watchlist")
async def api_add_watchlist(payload: dict):
    try:
        from services.database import add_to_watchlist
        result = add_to_watchlist(
            payload.get("userId", ""),
            payload.get("symbol", "").upper(),
            payload.get("companyName", ""),
            payload.get("exchange", "NSE"),
        )
        result["id"] = str(result["id"])
        return StandardResponse.success(result, "Added to watchlist")
    except Exception as e:
        return StandardResponse.server_error(str(e))


@app.delete("/api/watchlist/{symbol}")
async def api_remove_watchlist(symbol: str, user_id: str = Query(...)):
    try:
        from services.database import remove_from_watchlist
        remove_from_watchlist(user_id, symbol)
        return StandardResponse.success(None, "Removed from watchlist")
    except Exception as e:
        return StandardResponse.server_error(str(e))


# ─── Trade Alerts (DB-backed) ─────────────────────────────────────────────────

@app.post("/api/alerts")
async def api_create_alert(payload: dict):
    try:
        from services.database import create_alert
        user_id = payload.get("userId", "")
        if not user_id or not payload.get("symbol"):
            return StandardResponse.bad_request("userId and symbol required")
        result = create_alert(user_id, payload)
        result["id"] = str(result["id"])
        return StandardResponse.success(result, "Trade alert created")
    except Exception as e:
        logger.error(f"Create alert error: {e}")
        return StandardResponse.server_error(str(e))


@app.get("/api/alerts")
async def api_get_alerts(user_id: str = Query(...)):
    try:
        from services.database import get_alerts
        alerts = get_alerts(user_id)
        return StandardResponse.success({"alerts": [{**a, "id": str(a["id"])} for a in alerts]})
    except Exception as e:
        return StandardResponse.server_error(str(e))


@app.delete("/api/alerts/{alert_id}")
async def api_delete_alert(alert_id: str, user_id: str = Query(...)):
    try:
        from services.database import delete_alert
        delete_alert(alert_id, user_id)
        return StandardResponse.success(None, "Alert deleted")
    except Exception as e:
        return StandardResponse.server_error(str(e))


@app.get("/portfolio/analysis")
async def portfolio_analysis():
    """
    Full portfolio analysis endpoint.
    Returns everything the frontend PortfolioPage needs in one call.
    Uses yfinance for live prices on a demo portfolio.
    """
    try:
        start = time.time()

        # Demo portfolio holdings — these would come from DB in production
        demo_holdings = [
            {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "shares": 120, "avg_price": 1350},
            {"symbol": "TCS.NS", "name": "TCS", "shares": 200, "avg_price": 3800},
            {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "shares": 150, "avg_price": 1600},
            {"symbol": "INFY.NS", "name": "Infosys", "shares": 300, "avg_price": 1200},
            {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "shares": 250, "avg_price": 1100},
        ]

        symbols = [h["symbol"] for h in demo_holdings]
        stock_data = fetch_stock_data(symbols, period="1mo")

        holdings_out = []
        total_value = 0
        total_cost = 0

        for h in demo_holdings:
            sd = stock_data.get(h["symbol"], {})
            price = sd.get("current_price", h["avg_price"])
            closes = sd.get("last_5_days_closes", [])
            vol = sd.get("volume", 0)
            clean = h["symbol"].replace(".NS", "")

            holding_value = price * h["shares"]
            holding_cost = h["avg_price"] * h["shares"]
            total_value += holding_value
            total_cost += holding_cost
            change_pct = ((price - h["avg_price"]) / h["avg_price"] * 100) if h["avg_price"] else 0

            # Simple signal logic
            if len(closes) >= 2:
                recent_change = ((closes[-1] - closes[0]) / closes[0] * 100) if closes[0] else 0
            else:
                recent_change = 0

            if recent_change > 2:
                signal, confidence, risk = "Strong Buy", 88, "Medium"
            elif recent_change > 0.5:
                signal, confidence, risk = "Buy", 75, "Low"
            elif recent_change < -1.5:
                signal, confidence, risk = "Sell", 72, "High"
            else:
                signal, confidence, risk = "Hold", 60, "Low"

            # Build trend from closes
            trend = []
            for i, c in enumerate(closes):
                trend.append({"time": f"Day {i+1}", "value": round(c, 2)})

            holdings_out.append({
                "symbol": clean,
                "name": h["name"],
                "price": round(price, 2),
                "shares": h["shares"],
                "signal": signal,
                "confidence": confidence,
                "risk": risk,
                "change": round(change_pct, 2),
                "trend": trend,
            })

        daily_change_pct = ((total_value - total_cost) / total_cost * 100) if total_cost else 0
        daily_change_amt = total_value - total_cost

        # Health score based on portfolio diversity and risk
        high_risk_count = sum(1 for h in holdings_out if h["risk"] == "High")
        health_score = max(40, 95 - high_risk_count * 15)

        # Risk distribution
        low_count = sum(1 for h in holdings_out if h["risk"] == "Low")
        med_count = sum(1 for h in holdings_out if h["risk"] == "Medium")
        hi_count = sum(1 for h in holdings_out if h["risk"] == "High")
        total_h = len(holdings_out) or 1
        risk_dist = {
            "low": round(low_count / total_h * 100),
            "medium": round(med_count / total_h * 100),
            "high": round(hi_count / total_h * 100),
        }

        # Performance trend from first holding's closes (proxy)
        first_closes = stock_data.get(symbols[0], {}).get("last_5_days_closes", [])
        trend_data = []
        base_val = total_value * 0.95
        for i, c in enumerate(first_closes):
            ratio = c / first_closes[0] if first_closes[0] else 1
            trend_data.append({
                "month": f"Day {i+1}",
                "value": round(base_val * ratio),
                "benchmark": round(base_val * (1 + i * 0.005)),
            })

        # Insights
        insights = [
            {"type": "warning", "icon": "alert", "title": "Sector Concentration", "confidence": "High", "text": f"Portfolio has {len(holdings_out)} holdings. Consider diversifying across more sectors."},
            {"type": "positive", "icon": "trend", "title": "Strong Performers", "confidence": f"{sum(1 for h in holdings_out if h['signal'] in ['Buy','Strong Buy'])}", "text": f"{sum(1 for h in holdings_out if h['signal'] in ['Buy','Strong Buy'])} of {len(holdings_out)} holdings show positive momentum."},
            {"type": "neutral", "icon": "dollar", "title": "Portfolio Return", "confidence": "Data", "text": f"Total return: {daily_change_pct:.1f}%. {'Outperforming' if daily_change_pct > 0 else 'Underperforming'} cost basis."},
        ]

        # Actions
        sell_candidates = [h["symbol"] for h in holdings_out if h["signal"] == "Sell"]
        buy_candidates = [h["symbol"] for h in holdings_out if h["signal"] in ["Buy", "Strong Buy"]]
        actions = []
        if sell_candidates:
            actions.append({"title": f"Review {', '.join(sell_candidates)}", "impact": "High", "text": f"These holdings show sell signals. Consider reducing exposure.", "outcome": "Lower Risk", "color": "orange"})
        if buy_candidates:
            actions.append({"title": f"Add to {buy_candidates[0]}", "impact": "Medium", "text": f"{buy_candidates[0]} shows strong momentum. Consider increasing position.", "outcome": "Higher Returns", "color": "teal"})
        actions.append({"title": "Rebalance Portfolio", "impact": "Medium", "text": "Review sector weights and rebalance to target allocation.", "outcome": "Better Diversification", "color": "blue"})

        response = {
            "totalValue": round(total_value),
            "dailyChange": round(daily_change_pct, 2),
            "dailyChangeAmt": round(daily_change_amt),
            "healthScore": health_score,
            "riskLevel": "Low" if health_score > 80 else "Medium" if health_score > 60 else "High",
            "beta": 1.05,
            "volatility": 12,
            "holdings": holdings_out,
            "trendData": trend_data,
            "riskDistribution": risk_dist,
            "insights": insights,
            "actions": actions,
            "sectorDistribution": {"Tech": 35, "Finance": 25, "Energy": 20, "Telecom": 20},
            "scanTime": f"{time.time() - start:.2f}s",
        }

        return StandardResponse.success(response, "Portfolio analysis complete")

    except Exception as e:
        logger.error(f"Portfolio analysis error: {e}")
        # Return empty but valid structure
        return StandardResponse.success({
            "totalValue": 0, "dailyChange": 0, "dailyChangeAmt": 0,
            "healthScore": 50, "riskLevel": "Medium", "beta": 1.0, "volatility": 10,
            "holdings": [], "trendData": [], "riskDistribution": {"low": 33, "medium": 34, "high": 33},
            "insights": [{"type": "warning", "icon": "alert", "title": "Data Unavailable", "confidence": "N/A", "text": "Unable to fetch portfolio data. Please try again."}],
            "actions": [], "sectorDistribution": {},
            "scanTime": "0s",
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

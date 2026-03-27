"""
AI Assistant Service for SignalForge
Uses OpenRouter (Mistral 7B) + yfinance (prices/history) + Tavily (news)
"""

import os
import re
import json
import logging
import requests
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY not set — AI assistant will use fallback")


# ─── Company name → ticker resolution ─────────────────────────────────────────

COMPANY_MAP = {
    # Indian
    "RELIANCE": "RELIANCE", "RELIANCE INDUSTRIES": "RELIANCE", "RIL": "RELIANCE",
    "TCS": "TCS", "TATA CONSULTANCY": "TCS",
    "INFOSYS": "INFY", "INFY": "INFY",
    "HDFC BANK": "HDFCBANK", "HDFCBANK": "HDFCBANK", "HDFC": "HDFCBANK",
    "ICICI BANK": "ICICIBANK", "ICICIBANK": "ICICIBANK", "ICICI": "ICICIBANK",
    "SBI": "SBIN", "SBIN": "SBIN", "STATE BANK": "SBIN",
    "BAJAJ FINANCE": "BAJFINANCE", "BAJFINANCE": "BAJFINANCE", "BAJAJ FINSERV": "BAJFINANCE",
    "HINDUSTAN UNILEVER": "HINDUNILVR", "HINDUNILVR": "HINDUNILVR", "HUL": "HINDUNILVR",
    "KOTAK": "KOTAKBANK", "KOTAKBANK": "KOTAKBANK", "KOTAK MAHINDRA": "KOTAKBANK",
    "BHARTI AIRTEL": "BHARTIARTL", "BHARTIARTL": "BHARTIARTL", "AIRTEL": "BHARTIARTL",
    "ITC": "ITC", "LT": "LT", "LARSEN": "LT", "WIPRO": "WIPRO", "HCLTECH": "HCLTECH",
    # US
    "NVIDIA": "NVDA", "NVDA": "NVDA",
    "TESLA": "TSLA", "TSLA": "TSLA",
    "APPLE": "AAPL", "AAPL": "AAPL",
    "MICROSOFT": "MSFT", "MSFT": "MSFT",
    "AMD": "AMD", "ADVANCED MICRO": "AMD",
    "GOOGLE": "GOOGL", "GOOGL": "GOOGL", "ALPHABET": "GOOGL",
    "AMAZON": "AMZN", "AMZN": "AMZN",
    "META": "META", "FACEBOOK": "META",
    "PALANTIR": "PLTR", "PLTR": "PLTR",
    "CROWDSTRIKE": "CRWD", "CRWD": "CRWD",
    "EXXON": "XOM", "XOM": "XOM", "EXXONMOBIL": "XOM",
    "NETFLIX": "NFLX", "NFLX": "NFLX",
    "DISNEY": "DIS", "DIS": "DIS",
    "JPMORGAN": "JPM", "JPM": "JPM",
}

STOP_WORDS = {"THE", "AND", "FOR", "ARE", "NOT", "BUY", "SELL", "HOLD", "WHY", "HOW",
              "WHAT", "SHOW", "GET", "GIVE", "SHOULD", "NOW", "TODAY", "THIS", "WEEK",
              "STOCK", "STOCKS", "ANALYSIS", "ANALYZE", "COMPARE", "VIEW", "SHORT",
              "LONG", "TERM", "OUTLOOK", "RISKY", "RISK", "PORTFOLIO", "MY", "WHICH"}


def extract_tickers(message: str) -> List[str]:
    """Extract one or more stock tickers from a user message. Resolves company names."""
    upper = message.upper()
    found = []

    # Check company name map (longest match first)
    for name in sorted(COMPANY_MAP.keys(), key=len, reverse=True):
        if name in upper and COMPANY_MAP[name] not in found:
            found.append(COMPANY_MAP[name])
            upper = upper.replace(name, "")  # prevent double-match

    if found:
        return found[:3]  # max 3 tickers

    # Fallback: find all-caps words that look like tickers
    matches = re.findall(r'\b([A-Z]{2,6})\b', message.upper())
    for m in matches:
        if m not in STOP_WORDS and m not in found:
            found.append(m)

    return found[:3]


# ─── yfinance data fetching ───────────────────────────────────────────────────

def fetch_stock_data(symbol: str) -> Optional[Dict]:
    """Fetch current price + 5-day history from yfinance."""
    try:
        import yfinance as yf
        for suffix in ["", ".NS"]:
            ticker = yf.Ticker(f"{symbol}{suffix}")
            hist = ticker.history(period="5d")
            if not hist.empty and len(hist) >= 1:
                closes = [round(float(c), 2) for c in hist["Close"]]
                volumes = [int(v) for v in hist["Volume"]]
                current = closes[-1]
                prev = closes[-2] if len(closes) >= 2 else current
                change = round(current - prev, 2)
                change_pct = round((change / prev * 100) if prev else 0, 2)
                trend = "Uptrend" if len(closes) >= 2 and closes[-1] > closes[0] else "Downtrend" if len(closes) >= 2 and closes[-1] < closes[0] else "Sideways"
                avg_vol = sum(volumes) // max(len(volumes), 1)

                return {
                    "symbol": symbol,
                    "price": current,
                    "change": change,
                    "changePercent": change_pct,
                    "high": round(float(hist["High"].iloc[-1]), 2),
                    "low": round(float(hist["Low"].iloc[-1]), 2),
                    "open": round(float(hist["Open"].iloc[-1]), 2),
                    "prevClose": round(prev, 2),
                    "closes": closes,
                    "volumes": volumes,
                    "trend": trend,
                    "avgVolume": avg_vol,
                    "volumeTrend": "Above average" if volumes[-1] > avg_vol * 1.2 else "Below average" if volumes[-1] < avg_vol * 0.8 else "Normal",
                }
        return None
    except Exception as e:
        logger.warning(f"yfinance fetch failed for {symbol}: {e}")
        return None


# ─── Tavily news ──────────────────────────────────────────────────────────────

def fetch_news(query: str) -> Optional[str]:
    """Fetch recent news from Tavily."""
    if not TAVILY_API_KEY:
        return None
    try:
        r = requests.post(
            "https://api.tavily.com/search",
            json={"api_key": TAVILY_API_KEY, "query": f"{query} stock market news", "max_results": 3, "search_depth": "basic"},
            timeout=10,
        )
        results = r.json().get("results", [])
        if results:
            return " | ".join([f"{x.get('title', '')}: {x.get('content', '')[:80]}" for x in results[:3]])
    except Exception as e:
        logger.warning(f"Tavily failed: {e}")
    return None


# ─── OpenRouter AI call ───────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are SignalForge AI, a professional stock market analyst.
You analyze stocks using real market data provided in the context.
You MUST respond with ONLY a valid JSON object — no markdown, no explanation outside JSON.

Required JSON format:
{
  "summary": "2-4 sentence analysis based on the provided data",
  "signal": "Strong Buy" or "Buy" or "Hold" or "Sell",
  "confidence": number between 0 and 100,
  "riskLevel": "Low" or "Medium" or "High",
  "riskFactors": ["specific factor 1", "specific factor 2", "specific factor 3"],
  "actionPlan": {
    "label": "specific action recommendation",
    "timeframe": "Short-term" or "Medium-term" or "Long-term"
  },
  "reasoning": "1-2 sentence explanation of why this signal was chosen"
}

Rules:
- Base your analysis on the actual market data provided, not generic advice
- Reference specific numbers (price, change%, trend) in your summary
- Risk factors must be specific to the stock, not generic
- If data shows positive momentum, lean bullish. If negative, lean bearish.
- Respond with ONLY the JSON object."""


def call_openrouter(user_message: str, context: str) -> Optional[Dict]:
    """Call OpenRouter with structured prompt and parse JSON response."""
    if not OPENROUTER_API_KEY:
        return None

    prompt = f"""User query: {user_message}

Real-time market data:
{context}

Analyze based on the data above. Return ONLY valid JSON."""

    payload = {
        "model": "mistralai/mistral-small-2603",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.25,
        "max_tokens": 600,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://signalforge.ai",
        "X-Title": "SignalForge AI Assistant",
    }

    for attempt in range(2):
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload, headers=headers, timeout=30,
            )
            if r.status_code != 200:
                logger.warning(f"OpenRouter HTTP {r.status_code} (attempt {attempt+1})")
                continue

            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            # Strip markdown fences
            if "```" in content:
                content = re.sub(r'```(?:json)?\s*', '', content)
                content = re.sub(r'\s*```', '', content)

            # Try to find JSON object in the response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                content = json_match.group()

            parsed = json.loads(content)

            # Validate required fields
            required = ["summary", "signal", "confidence", "riskLevel", "riskFactors", "actionPlan"]
            if all(k in parsed for k in required):
                signal_map = {"strong buy": "Strong Buy", "buy": "Buy", "hold": "Hold", "sell": "Sell", "strong sell": "Sell"}
                parsed["signal"] = signal_map.get(str(parsed["signal"]).lower(), str(parsed["signal"]))
                parsed["confidence"] = max(0, min(100, int(parsed["confidence"])))
                if not isinstance(parsed["riskFactors"], list):
                    parsed["riskFactors"] = [str(parsed["riskFactors"])]
                return parsed

            logger.warning(f"OpenRouter missing fields (attempt {attempt+1}): {list(parsed.keys())}")

        except json.JSONDecodeError as e:
            logger.warning(f"OpenRouter invalid JSON (attempt {attempt+1}): {e}")
        except Exception as e:
            logger.warning(f"OpenRouter failed (attempt {attempt+1}): {e}")
            break

    return None


# ─── Fallback response builder ────────────────────────────────────────────────

def build_fallback(message: str, tickers: List[str], stock_data: Dict[str, Dict]) -> Dict:
    """Build structured fallback when AI is unavailable."""
    if tickers and tickers[0] in stock_data:
        sd = stock_data[tickers[0]]
        cp = sd.get("changePercent", 0)
        signal = "Strong Buy" if cp > 3 else "Buy" if cp > 0.5 else "Sell" if cp < -1.5 else "Hold"
        conf = min(88, max(35, 50 + int(abs(cp) * 8)))
        return {
            "summary": f"{tickers[0]} is at ₹{sd['price']} ({cp:+.2f}% today). {sd['trend']} trend with {sd['volumeTrend'].lower()} volume. {'Momentum is positive.' if cp > 0 else 'Showing weakness.' if cp < 0 else 'Trading flat.'}",
            "signal": signal,
            "confidence": conf,
            "riskLevel": "High" if abs(cp) > 3 else "Medium" if abs(cp) > 1 else "Low",
            "riskFactors": [
                f"Daily change: {cp:+.2f}%",
                f"Day range: ₹{sd.get('low', 0)} – ₹{sd.get('high', 0)}",
                f"Trend: {sd['trend']}",
            ],
            "actionPlan": {
                "label": "Consider entry on dips" if signal in ["Buy", "Strong Buy"] else "Monitor closely" if signal == "Sell" else "Wait for clearer signal",
                "timeframe": "Short-term",
            },
            "reasoning": f"Based on price action: {cp:+.2f}% change, {sd['trend'].lower()} trend, {sd['volumeTrend'].lower()} volume.",
        }

    return {
        "summary": f"I couldn't find specific stock data for your query: '{message}'. Try asking about a specific stock like RELIANCE, TCS, NVIDIA, or AAPL.",
        "signal": "Hold",
        "confidence": 40,
        "riskLevel": "Medium",
        "riskFactors": ["No specific stock identified", "Try mentioning a ticker or company name", "Check the dashboard for active signals"],
        "actionPlan": {"label": "Check dashboard for signals", "timeframe": "Short-term"},
        "reasoning": "Unable to resolve a specific stock from the query.",
    }


# ─── Main entry point ─────────────────────────────────────────────────────────

def analyze_query(message: str, user_id: str = "anonymous") -> Dict[str, Any]:
    """
    Full AI assistant pipeline:
    1. Extract ticker(s) from message (resolves company names)
    2. Fetch live price + history from yfinance
    3. Fetch news from Tavily (optional)
    4. Call OpenRouter with rich context
    5. Validate and return structured response
    """
    start = datetime.now()

    # 1. Resolve tickers
    tickers = extract_tickers(message)
    logger.info(f"Assistant query: '{message}' → tickers: {tickers}")

    # 2. Fetch stock data for each ticker
    stock_data = {}
    for t in tickers:
        sd = fetch_stock_data(t)
        if sd:
            stock_data[t] = sd

    # 3. Fetch news
    news_query = tickers[0] if tickers else message
    news = fetch_news(news_query)

    # 4. Build context
    context_parts = []
    for t, sd in stock_data.items():
        context_parts.append(
            f"Stock: {t}\n"
            f"  Price: ₹{sd['price']} | Change: {sd['change']:+.2f} ({sd['changePercent']:+.2f}%)\n"
            f"  Day range: ₹{sd['low']} – ₹{sd['high']} | Open: ₹{sd['open']}\n"
            f"  5-day closes: {sd['closes']}\n"
            f"  Trend: {sd['trend']} | Volume: {sd['volumeTrend']}"
        )
    if news:
        context_parts.append(f"\nRecent news: {news[:400]}")
    if not context_parts:
        context_parts.append("No specific stock data found. Provide general market guidance based on the user's question.")

    context = "\n\n".join(context_parts)

    # 5. Call AI
    ai_response = call_openrouter(message, context)

    # 6. Use AI or fallback
    result = ai_response or build_fallback(message, tickers, stock_data)

    processing_time = (datetime.now() - start).total_seconds()

    # 7. Attach supporting data
    primary_ticker = tickers[0] if tickers else None
    primary_data = stock_data.get(primary_ticker, {}) if primary_ticker else {}

    return {
        **result,
        "query": message,
        "resolvedSymbol": primary_ticker,
        "companyName": primary_ticker or "Unknown",
        "ticker": primary_ticker,
        "liveQuote": {
            "price": primary_data.get("price", 0),
            "change": primary_data.get("change", 0),
            "changePercent": primary_data.get("changePercent", 0),
            "high": primary_data.get("high", 0),
            "low": primary_data.get("low", 0),
        } if primary_data else None,
        "supportingData": {
            "price": primary_data.get("price", 0),
            "changePercent": primary_data.get("changePercent", 0),
            "trend": primary_data.get("trend", "Unknown"),
            "volumeTrend": primary_data.get("volumeTrend", "Unknown"),
        } if primary_data else None,
        "user_id": user_id,
        "timestamp": datetime.now().isoformat(),
        "provider_used": "openrouter/mistral-7b" if ai_response else "fallback",
        "processing_time": round(processing_time, 2),
    }

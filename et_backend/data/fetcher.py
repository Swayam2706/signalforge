"""
Data Fetcher Module for SignalForge

This module handles fetching stock market data using yfinance.
"""

import yfinance as yf
import pandas as pd
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, timedelta
import time

from utils.cache import stock_data_cache
from utils.logger import get_logger

logger = get_logger(__name__)


def fetch_stock_data(symbols: List[str], period: str = "1mo") -> Dict[str, Dict]:
    """
    Fetch stock data for multiple symbols with caching.
    
    Args:
        symbols: List of stock symbols (e.g., ['RELIANCE.NS', 'TCS.NS'])
        period: Time period for data ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max')
        
    Returns:
        Dictionary of stock data for each symbol
    """
    result = {}
    uncached_symbols = []
    
    # Check cache first
    for symbol in symbols:
        cached_data = stock_data_cache.get(symbol, period=period)
        if cached_data is not None:
            result[symbol] = cached_data
            logger.logger.debug(f"Cache hit for {symbol}")
        else:
            uncached_symbols.append(symbol)
    
    # Fetch uncached data — use individual ticker.history() for reliability
    if uncached_symbols:
        logger.logger.info(f"Fetching data for {len(uncached_symbols)} uncached symbols: {uncached_symbols}")
        
        for symbol in uncached_symbols:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=period)
                
                if hist.empty:
                    logger.logger.warning(f"No data for {symbol}")
                    result[symbol] = {'error': 'No data', 'current_price': 0, 'volume': 0, 'last_5_days_closes': [], 'last_5_days_dates': [], 'period': period, 'data_points': 0, 'last_updated': datetime.now().isoformat(), 'symbol': symbol}
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                volume = int(hist['Volume'].iloc[-1])
                recent = hist.tail(5)
                closes = [float(p) for p in recent['Close']]
                dates = [d.isoformat() for d in recent.index]
                
                symbol_data = {
                    'symbol': symbol,
                    'current_price': current_price,
                    'volume': volume,
                    'last_5_days_closes': closes,
                    'last_5_days_dates': dates,
                    'period': period,
                    'data_points': len(hist),
                    'last_updated': datetime.now().isoformat(),
                }
                result[symbol] = symbol_data
                stock_data_cache.set(symbol, symbol_data, ttl=600, period=period)
                
            except Exception as e:
                logger.logger.error(f"Error fetching {symbol}: {str(e)}")
                result[symbol] = {'error': str(e), 'current_price': 0, 'volume': 0, 'last_5_days_closes': [], 'last_5_days_dates': [], 'period': period, 'data_points': 0, 'last_updated': datetime.now().isoformat(), 'symbol': symbol}
    
    logger.logger.info(f"Stock data fetch completed: {len(result)} symbols, {len(uncached_symbols)} API calls")
    return result


def get_single_stock_data(symbol: str, period: str = "1mo") -> Optional[Dict[str, Any]]:
    """
    Get data for a single stock with caching.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE.NS')
        period: Time period for data
        
    Returns:
        Stock data dictionary or None if error
    """
    # Check cache first
    cached_data = stock_data_cache.get(symbol, period=period)
    if cached_data is not None:
        logger.logger.debug(f"Cache hit for single stock {symbol}")
        return cached_data
    
    # Fetch from API
    logger.logger.info(f"Fetching single stock data for {symbol}")
    
    try:
        ticker = yf.Ticker(symbol)
        
        # Download historical data
        hist_data = ticker.history(period=period)
        
        if hist_data.empty:
            logger.logger.warning(f"No historical data found for {symbol}")
            return None
        
        # Get current info
        info = ticker.info
        
        # Process data
        stock_data = _process_ticker_data(ticker, hist_data, symbol, period)
        
        # Cache the result for 5-10 minutes
        stock_data_cache.set(symbol, stock_data, ttl=600, period=period)
        logger.logger.debug(f"Cached single stock data for {symbol}")
        
        return stock_data
        
    except Exception as e:
        logger.logger.error(f"Error fetching single stock data for {symbol}: {str(e)}")
        return None


def fetch_stock_ohlc_data(symbol: str, period_days: int = 60) -> Dict[str, Any]:
    """
    Fetch OHLC data for a stock with caching.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE.NS')
        period_days: Number of days of historical data
        
    Returns:
        Dictionary with OHLC data and current price
    """
    # Generate cache key
    cache_key = f"ohlc_{symbol}_{period_days}"
    
    # Check cache first
    cached_data = stock_data_cache.get(cache_key)
    if cached_data is not None:
        logger.logger.debug(f"Cache hit for OHLC data {symbol}")
        return cached_data
    
    # Fetch from API
    logger.logger.info(f"Fetching OHLC data for {symbol} ({period_days} days)")
    
    try:
        ticker = yf.Ticker(symbol)
        
        # Calculate period string
        if period_days <= 5:
            period_str = "5d"
        elif period_days <= 30:
            period_str = "1mo"
        elif period_days <= 90:
            period_str = "3mo"
        elif period_days <= 180:
            period_str = "6mo"
        else:
            period_str = "1y"
        
        # Download historical data
        hist_data = ticker.history(period=period_str)
        
        if hist_data.empty:
            logger.logger.warning(f"No historical data found for {symbol}")
            return {'error': f"No data available for {symbol}"}
        
        # Get current price from the last row
        current_price = float(hist_data['Close'].iloc[-1])
        current_volume = int(hist_data['Volume'].iloc[-1])
        
        # Convert to list of OHLC data points
        historical_data = []
        for date, row in hist_data.iterrows():
            historical_data.append({
                'timestamp': date,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            })
        
        # Limit to requested number of days
        if len(historical_data) > period_days:
            historical_data = historical_data[-period_days:]
        
        result = {
            'symbol': symbol.replace('.NS', ''),
            'current_price': current_price,
            'current_volume': current_volume,
            'historical_data': historical_data,
            'data_points': len(historical_data)
        }
        
        # Cache the result for 5-10 minutes
        stock_data_cache.set(cache_key, result, ttl=600)
        logger.logger.debug(f"Cached OHLC data for {symbol}")
        
        return result
        
    except Exception as e:
        logger.logger.error(f"Error fetching OHLC data for {symbol}: {str(e)}")
        return {'error': f"Failed to fetch data for {symbol}: {str(e)}"}


def _process_ticker_data(ticker: yf.Ticker, data: pd.DataFrame, symbol: str, period: str) -> Dict[str, Any]:
    """
    Process ticker data into standardized format.
    
    Args:
        ticker: YFinance ticker object
        data: Downloaded data
        symbol: Stock symbol
        period: Data period
        
    Returns:
        Processed stock data dictionary
    """
    try:
        # Get current price
        current_price = float(ticker.info.get('currentPrice', 0) or 
                          ticker.info.get('regularMarketPrice', 0) or
                          data['Close'].iloc[-1] if not data.empty else 0)
        
        # Get volume
        volume = int(ticker.info.get('volume', 0) or 
                  data['Volume'].iloc[-1] if not data.empty else 0)
        
        # Get last 5 days of closing prices
        last_5_days_closes = []
        last_5_days_dates = []
        
        if not data.empty and len(data) >= 5:
            # Take last 5 days
            recent_data = data.tail(5)
            last_5_days_closes = [float(price) for price in recent_data['Close']]
            last_5_days_dates = [date.isoformat() for date in recent_data.index]
        else:
            # Fallback: use available data
            last_5_days_closes = [float(price) for price in data['Close']]
            last_5_days_dates = [date.isoformat() for date in data.index]
        
        return {
            'symbol': symbol,
            'current_price': current_price,
            'volume': volume,
            'last_5_days_closes': last_5_days_closes,
            'last_5_days_dates': last_5_days_dates,
            'period': period,
            'data_points': len(data),
            'last_updated': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.logger.error(f"Error processing ticker data for {symbol}: {str(e)}")
        return {
            'symbol': symbol,
            'error': str(e),
            'current_price': 0,
            'volume': 0,
            'last_5_days_closes': [],
            'last_5_days_dates': [],
            'period': period,
            'data_points': 0,
            'last_updated': datetime.now().isoformat()
        }


def get_stock_info(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed stock information with caching.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Stock information dictionary or None if error
    """
    # Check cache first
    cache_key = f"info_{symbol}"
    cached_data = stock_data_cache.get(cache_key)
    if cached_data is not None:
        logger.logger.debug(f"Cache hit for stock info {symbol}")
        return cached_data
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        # Cache for longer period (30 minutes)
        stock_data_cache.set(cache_key, info, ttl=1800)
        logger.logger.debug(f"Cached stock info for {symbol}")
        
        return info
        
    except Exception as e:
        logger.logger.error(f"Error fetching stock info for {symbol}: {str(e)}")
        return None


# Cache statistics
def get_stock_cache_stats() -> Dict[str, Any]:
    """Get stock data cache statistics."""
    return stock_data_cache.get_stats()


def clear_stock_cache() -> None:
    """Clear stock data cache."""
    stock_data_cache.clear()
    logger.logger.info("Stock data cache cleared")


def cleanup_stock_cache() -> int:
    """Clean up expired stock cache items."""
    return stock_data_cache.cleanup_expired()


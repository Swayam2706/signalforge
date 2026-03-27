"""
Stock Router for SignalForge

This module contains API endpoints for stock data and analysis.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
import logging

from services.stock_service import get_stock_service
from schemas.stock import StockDetailResponse, StockListResponse, StockSummaryResponse, OHLCDataPoint
from utils.logger import get_logger
from utils.response import StandardResponse
from utils.cache import api_response_cache

# Create router
router = APIRouter(prefix="/stock", tags=["stock"])
logger = get_logger(__name__)


@router.get("/{symbol}")
async def get_stock_detail(
    symbol: str,
    period: Optional[int] = Query(60, ge=30, le=90, description="Number of days of historical data")
):
    """
    Get detailed stock information with OHLC historical data and signal analysis.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE' or 'RELIANCE.NS')
        period: Number of days of historical data (30-90 days)
        
    Returns:
        Detailed stock information with historical OHLC data and signal analysis
    """
    try:
        # Check cache first
        cache_key = f"stock_detail:{symbol}:{period}"
        cached_result = api_response_cache.get(cache_key)
        
        if cached_result is not None:
            logger.logger.debug(f"Cache hit for stock detail {symbol}")
            return StandardResponse.success(cached_result, f"Stock detail retrieved for {symbol} (from cache)")
        
        # Use service layer
        stock_service = get_stock_service()
        stock_detail = stock_service.get_stock_detail(symbol, period)
        
        # Convert to response format
        stock_response = StockDetailResponse(
            symbol=stock_detail['symbol'],
            price=stock_detail['price'],
            volume=stock_detail['volume'],
            ohlc=[OHLCDataPoint(**ohlc_point) for ohlc_point in stock_detail['ohlc']],
            signal=stock_detail['signal'],
            confidence=stock_detail['confidence'],
            trend=stock_detail['trend'],
            risk=stock_detail['risk'],
            tags=stock_detail['tags'],
            explanation=stock_detail['explanation'],
            data_points=stock_detail['data_points'],
            last_updated=stock_detail['last_updated']
        )
        
        # Cache the result for 5 minutes
        api_response_cache.set(cache_key, stock_response.dict(), ttl=300)
        
        return StandardResponse.success(stock_response, f"Stock detail retrieved for {symbol}")
        
    except ValueError as e:
        if "not available" in str(e) or "No data available" in str(e):
            return StandardResponse.not_found("Stock data")
        else:
            return StandardResponse.bad_request(str(e))
    except Exception as e:
        logger.logger.error(f"Error fetching stock detail for {symbol}: {str(e)}")
        return StandardResponse.server_error("Failed to fetch stock data")


@router.get("/")
async def get_multiple_stocks(
    symbols: str = Query(..., description="Comma-separated stock symbols"),
    period: Optional[int] = Query(60, ge=30, le=90, description="Number of days of historical data")
):
    """
    Get multiple stocks with basic data (no signal analysis for performance).
    
    Args:
        symbols: Comma-separated stock symbols (e.g., 'RELIANCE,TCS,INFY')
        period: Number of days of historical data (30-90 days)
        
    Returns:
        List of stock information with OHLC data
    """
    try:
        # Parse symbols
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        # Check cache first
        cache_key = f"multiple_stocks:{':'.join(sorted(symbol_list))}:{period}"
        cached_result = api_response_cache.get(cache_key)
        
        if cached_result is not None:
            logger.logger.debug(f"Cache hit for multiple stocks: {len(symbol_list)} symbols")
            return StandardResponse.success(cached_result, f"Retrieved data for {len(cached_result.get('stocks', []))} stocks (from cache)")
        
        # Use service layer
        stock_service = get_stock_service()
        stocks_data = stock_service.get_multiple_stocks(symbol_list, period)
        
        if not stocks_data['stocks']:
            return StandardResponse.not_found("Valid stock data")
        
        # Convert to response format
        formatted_stocks = []
        for stock in stocks_data['stocks']:
            formatted_stock = StockDetailResponse(
                symbol=stock['symbol'],
                price=stock['price'],
                volume=stock['volume'],
                ohlc=[OHLCDataPoint(**ohlc_point) for ohlc_point in stock['ohlc']],
                signal="Not analyzed",  # Default for multiple stocks
                confidence=0,
                trend="Unknown",
                risk="Not assessed",
                tags=["No analysis"],
                explanation="Signal analysis not performed for multiple stocks request",
                data_points=stock['data_points'],
                last_updated=stock['last_updated']
            )
            formatted_stocks.append(formatted_stock)
        
        response_data = {
            "stocks": formatted_stocks,
            "total_stocks": len(formatted_stocks)
        }
        
        # Cache the result for 5 minutes
        api_response_cache.set(cache_key, response_data, ttl=300)
        
        return StandardResponse.success(response_data, f"Retrieved data for {len(formatted_stocks)} stocks")
        
    except Exception as e:
        logger.logger.error(f"Error fetching multiple stocks: {str(e)}")
        return StandardResponse.server_error("Failed to fetch stock data")


@router.get("/{symbol}/ohlc")
async def get_stock_ohlc_only(
    symbol: str,
    period: Optional[int] = Query(60, ge=30, le=90, description="Number of days of historical data")
):
    """
    Get OHLC historical data for a stock (no signal analysis).
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE' or 'RELIANCE.NS')
        period: Number of days of historical data (30-90 days)
        
    Returns:
        OHLC historical data only
    """
    try:
        # Use service layer
        stock_service = get_stock_service()
        stock_detail = stock_service.get_stock_detail(symbol, period)
        
        return StandardResponse.success({
            "symbol": stock_detail['symbol'],
            "current_price": stock_detail['price'],
            "current_volume": stock_detail['volume'],
            "data_points": stock_detail['data_points'],
            "ohlc": stock_detail['ohlc'],
            "last_updated": stock_detail['last_updated']
        }, f"OHLC data retrieved for {symbol}")
        
    except ValueError as e:
        if "not available" in str(e) or "No data available" in str(e):
            return StandardResponse.not_found("Stock data")
        else:
            return StandardResponse.bad_request(str(e))
    except Exception as e:
        logger.logger.error(f"Error fetching OHLC data for {symbol}: {str(e)}")
        return StandardResponse.server_error("Failed to fetch OHLC data")


@router.get("/{symbol}/summary")
async def get_stock_summary(symbol: str):
    """
    Get stock summary without detailed OHLC data.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE' or 'RELIANCE.NS')
        
    Returns:
        Stock summary with signal analysis
    """
    try:
        # Use service layer
        stock_service = get_stock_service()
        stock_summary = stock_service.get_stock_summary(symbol)
        
        summary_response = StockSummaryResponse(
            symbol=stock_summary['symbol'],
            price=stock_summary['price'],
            volume=stock_summary['volume'],
            signal=stock_summary['signal'],
            confidence=stock_summary['confidence'],
            trend=stock_summary['trend'],
            risk=stock_summary['risk'],
            tags=stock_summary['tags'],
            explanation=stock_summary['explanation'],
            last_updated=stock_summary['last_updated']
        )
        
        return StandardResponse.success(summary_response, f"Stock summary retrieved for {symbol}")
        
    except ValueError as e:
        if "not available" in str(e) or "No data available" in str(e):
            return StandardResponse.not_found("Stock data")
        else:
            return StandardResponse.bad_request(str(e))
    except Exception as e:
        logger.logger.error(f"Error fetching stock summary for {symbol}: {str(e)}")
        return StandardResponse.server_error("Failed to fetch stock summary")


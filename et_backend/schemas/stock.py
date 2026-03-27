"""
Stock Schemas for SignalForge

This module contains Pydantic schemas for stock data APIs.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class OHLCDataPoint(BaseModel):
    """Schema for OHLC data point."""
    
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    timestamp: str = Field(..., description="Date timestamp (ISO format)")
    volume: int = Field(..., description="Trading volume")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "open": 2450.0,
                "high": 2480.0,
                "low": 2440.0,
                "close": 2475.0,
                "timestamp": "2025-03-25T00:00:00Z",
                "volume": 1500000
            }
        }


class StockDetailResponse(BaseModel):
    """Schema for stock detail response - frontend ready."""
    
    symbol: str = Field(..., description="Stock symbol")
    price: float = Field(..., description="Current price")
    volume: int = Field(..., description="Current volume")
    ohlc: List[OHLCDataPoint] = Field(..., description="Historical OHLC data")
    signal: str = Field(..., description="Current signal type")
    confidence: int = Field(..., description="Signal confidence score (0-100)")
    trend: str = Field(..., description="Price trend direction")
    risk: str = Field(..., description="Risk assessment note")
    tags: List[str] = Field(..., description="Analysis tags")
    explanation: str = Field(..., description="Signal explanation")
    data_points: int = Field(..., description="Number of historical data points")
    last_updated: str = Field(..., description="Last update timestamp (ISO format)")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "symbol": "RELIANCE",
                "price": 2475.0,
                "volume": 1500000,
                "ohlc": [
                    {
                        "open": 2450.0,
                        "high": 2480.0,
                        "low": 2440.0,
                        "close": 2475.0,
                        "timestamp": "2025-03-25T00:00:00Z",
                        "volume": 1500000
                    }
                ],
                "signal": "Momentum",
                "confidence": 78,
                "trend": "Bullish",
                "risk": "Medium risk with strong momentum indicators",
                "tags": ["Momentum", "High Volume", "Bullish"],
                "explanation": "RELIANCE shows strong momentum with consistent buying pressure and increasing volume.",
                "data_points": 30,
                "last_updated": "2025-03-25T15:30:00Z"
            }
        }


class StockListResponse(BaseModel):
    """Schema for multiple stocks response."""
    
    success: bool = Field(True, description="Operation success status")
    stocks: List[StockDetailResponse] = Field(..., description="List of stock details")
    total_stocks: int = Field(..., description="Total number of stocks")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "success": True,
                "stocks": [
                    {
                        "symbol": "RELIANCE",
                        "price": 2475.0,
                        "volume": 1500000,
                        "ohlc": [...],
                        "signal": "Momentum",
                        "confidence": 78,
                        "trend": "Bullish",
                        "risk": "Medium risk with strong momentum indicators",
                        "tags": ["Momentum", "High Volume", "Bullish"],
                        "explanation": "RELIANCE shows strong momentum with consistent buying pressure.",
                        "data_points": 30,
                        "last_updated": "2025-03-25T15:30:00Z"
                    }
                ],
                "total_stocks": 1
            }
        }


class StockSummaryResponse(BaseModel):
    """Schema for stock summary without OHLC data."""
    
    symbol: str = Field(..., description="Stock symbol")
    price: float = Field(..., description="Current price")
    volume: int = Field(..., description="Current volume")
    signal: str = Field(..., description="Current signal type")
    confidence: int = Field(..., description="Signal confidence score (0-100)")
    trend: str = Field(..., description="Price trend direction")
    risk: str = Field(..., description="Risk assessment note")
    tags: List[str] = Field(..., description="Analysis tags")
    explanation: str = Field(..., description="Signal explanation")
    last_updated: str = Field(..., description="Last update timestamp (ISO format)")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "symbol": "RELIANCE",
                "price": 2475.0,
                "volume": 1500000,
                "signal": "Momentum",
                "confidence": 78,
                "trend": "Bullish",
                "risk": "Medium risk with strong momentum indicators",
                "tags": ["Momentum", "High Volume", "Bullish"],
                "explanation": "RELIANCE shows strong momentum with consistent buying pressure.",
                "last_updated": "2025-03-25T15:30:00Z"
            }
        }

"""
Assistant Schemas for SignalForge

This module contains Pydantic schemas for AI assistant APIs.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class ChatRequest(BaseModel):
    """Schema for chat request."""
    
    user_id: str = Field(..., description="User ID from authentication provider")
    message: str = Field(..., min_length=1, max_length=1000, description="User message")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "user_id": "user_123",
                "message": "What do you think about RELIANCE stock right now?"
            }
        }


class RelatedStock(BaseModel):
    """Schema for related stock information."""
    
    symbol: str = Field(..., description="Stock symbol")
    price: float = Field(..., description="Current stock price")
    signal: str = Field(..., description="Signal type")
    confidence: int = Field(..., description="Signal confidence score (0-100)")
    trend: str = Field(..., description="Price trend direction")
    explanation: str = Field(..., description="Signal explanation")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "symbol": "RELIANCE",
                "price": 2475.0,
                "signal": "Momentum",
                "confidence": 85,
                "trend": "Bullish",
                "explanation": "RELIANCE shows strong momentum with consistent buying pressure and increasing volume."
            }
        }


class ChatResponse(BaseModel):
    """Schema for chat response."""
    
    response: str = Field(..., description="AI assistant response")
    related_stocks: List[RelatedStock] = Field(default=[], description="Related stocks analyzed")
    user_id: str = Field(..., description="User ID")
    timestamp: str = Field(..., description="Response timestamp (ISO format)")
    provider_used: str = Field(..., description="AI provider used")
    processing_time: float = Field(..., description="Processing time in seconds")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "response": "Based on my analysis, RELIANCE is currently showing strong momentum signals...",
                "related_stocks": [
                    {
                        "symbol": "RELIANCE",
                        "price": 2475.0,
                        "signal": "Momentum",
                        "confidence": 85,
                        "trend": "Bullish",
                        "explanation": "RELIANCE shows strong momentum with consistent buying pressure."
                    }
                ],
                "user_id": "user_123",
                "timestamp": "2025-03-25T15:30:00Z",
                "provider_used": "openrouter",
                "processing_time": 2.3
            }
        }


class AssistantStatusResponse(BaseModel):
    """Schema for assistant status response."""
    
    assistant_available: bool = Field(..., description="Whether AI assistant is available")
    provider: str = Field(..., description="Current AI provider")
    capabilities: List[str] = Field(..., description="List of assistant capabilities")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "assistant_available": True,
                "provider": "openrouter",
                "capabilities": [
                    "Stock market education",
                    "Technical analysis explanation",
                    "Portfolio management guidance",
                    "Risk management advice",
                    "Market trend analysis",
                    "Real-time stock analysis"
                ]
            }
        }

"""
Portfolio Schemas for SignalForge

This module contains Pydantic schemas for portfolio management APIs.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PortfolioItemCreate(BaseModel):
    """Schema for creating a portfolio item."""
    
    user_id: str = Field(..., description="User ID from authentication provider")
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol (e.g., RELIANCE)")
    quantity: int = Field(..., gt=0, description="Number of shares to add")
    avg_price: float = Field(..., gt=0, description="Average purchase price per share")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "user_id": "user_123",
                "symbol": "RELIANCE",
                "quantity": 10,
                "avg_price": 2500.50
            }
        }


class PortfolioItemResponse(BaseModel):
    """Schema for portfolio item response."""
    
    id: str = Field(..., description="Portfolio item ID")
    user_id: str = Field(..., description="User ID")
    symbol: str = Field(..., description="Stock symbol")
    quantity: int = Field(..., description="Number of shares owned")
    avg_price: float = Field(..., description="Average purchase price per share")
    total_value: float = Field(..., description="Total value of holdings")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "id": "portfolio_123",
                "user_id": "user_123",
                "symbol": "RELIANCE",
                "quantity": 10,
                "avg_price": 2500.50,
                "total_value": 25050.0,
                "created_at": "2025-03-25T15:30:00Z",
                "updated_at": "2025-03-25T15:30:00Z"
            }
        }


class PortfolioItemRemove(BaseModel):
    """Schema for removing a portfolio item."""
    
    user_id: str = Field(..., description="User ID from authentication provider")
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol to remove")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "user_id": "user_123",
                "symbol": "RELIANCE"
            }
        }


class PortfolioListResponse(BaseModel):
    """Schema for portfolio list response."""
    
    success: bool = Field(True, description="Operation success status")
    portfolio_items: List[PortfolioItemResponse] = Field(..., description="List of portfolio items")
    total_value: float = Field(..., description="Total portfolio value")
    total_items: int = Field(..., description="Total number of portfolio items")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "success": True,
                "portfolio_items": [
                    {
                        "id": "portfolio_123",
                        "user_id": "user_123",
                        "symbol": "RELIANCE",
                        "quantity": 10,
                        "avg_price": 2500.50,
                        "total_value": 25050.0,
                        "created_at": "2025-03-25T15:30:00Z",
                        "updated_at": "2025-03-25T15:30:00Z"
                    }
                ],
                "total_value": 25050.0,
                "total_items": 1
            }
        }

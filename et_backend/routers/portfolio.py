"""
Portfolio Router for SignalForge

This module contains API endpoints for portfolio management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
import logging

from db.session import get_db_session
from services.portfolio_service import PortfolioService
from schemas.portfolio import (
    PortfolioItemCreate, 
    PortfolioItemResponse, 
    PortfolioItemRemove,
    PortfolioListResponse
)
from utils.logger import get_logger
from utils.response import StandardResponse

# Create router
router = APIRouter(prefix="/portfolio", tags=["portfolio"])
logger = get_logger(__name__)


@router.get("/")
async def get_portfolio(
    user_id: str = Query(..., description="User ID from authentication provider"),
    db: Session = Depends(get_db_session)
):
    """
    Get user's enhanced portfolio with live prices and signal analysis.
    
    Args:
        user_id: User ID from authentication provider
        db: Database session
        
    Returns:
        Enhanced portfolio with live data, signals, and P&L
    """
    try:
        # Use enhanced portfolio service
        portfolio_service = PortfolioService()
        enhanced_portfolio = portfolio_service.get_enhanced_portfolio(db, user_id)
        
        # Calculate portfolio totals
        total_value = sum(item['total_value'] for item in enhanced_portfolio)
        total_cost = sum(item['total_cost'] for item in enhanced_portfolio)
        total_pnl = total_value - total_cost
        total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
        
        portfolio_data = {
            'user_id': user_id,
            'total_value': total_value,
            'total_cost': total_cost,
            'total_pnl': total_pnl,
            'total_pnl_percent': round(total_pnl_percent, 2),
            'total_items': len(enhanced_portfolio),
            'items': enhanced_portfolio
        }
        
        return StandardResponse.success(portfolio_data, f"Retrieved enhanced portfolio with {len(enhanced_portfolio)} items")
        
    except ValueError as e:
        return StandardResponse.not_found("User")
    except Exception as e:
        logger.logger.error(f"Error fetching enhanced portfolio: {str(e)}")
        return StandardResponse.server_error("Failed to fetch portfolio")


@router.post("/add")
async def add_portfolio_item(
    item: PortfolioItemCreate,
    db: Session = Depends(get_db_session)
):
    """
    Add a stock to user's portfolio.
    
    Args:
        item: Portfolio item creation data
        db: Database session
        
    Returns:
        Created portfolio item
    """
    try:
        # Use service layer
        portfolio_item = PortfolioService.add_portfolio_item(db, item)
        
        item_response = PortfolioItemResponse(
            id=portfolio_item.id,
            user_id=portfolio_item.user_id,
            symbol=portfolio_item.symbol,
            quantity=portfolio_item.quantity,
            avg_price=portfolio_item.avg_price,
            total_value=portfolio_item.total_value,
            created_at=portfolio_item.created_at,
            updated_at=portfolio_item.updated_at
        )
        
        return StandardResponse.created(item_response, f"Added {item.symbol} to portfolio")
        
    except ValueError as e:
        if "already exists" in str(e):
            return StandardResponse.bad_request(str(e), "ALREADY_EXISTS")
        elif "not found" in str(e):
            return StandardResponse.not_found("User")
        else:
            return StandardResponse.bad_request(str(e))
    except Exception as e:
        logger.logger.error(f"Error adding portfolio item: {str(e)}")
        return StandardResponse.server_error("Failed to add portfolio item")


@router.delete("/remove")
async def remove_portfolio_item(
    item: PortfolioItemRemove,
    db: Session = Depends(get_db_session)
):
    """
    Remove a stock from user's portfolio.
    
    Args:
        item: Portfolio item removal data
        db: Database session
        
    Returns:
        Success message
    """
    try:
        # Use service layer
        removed = PortfolioService.remove_portfolio_item(db, item.user_id, item.symbol)
        
        if not removed:
            return StandardResponse.not_found(f"Stock {item.symbol} in portfolio")
        
        return StandardResponse.deleted(f"Successfully removed {item.symbol} from portfolio")
        
    except ValueError as e:
        if "not found" in str(e):
            return StandardResponse.not_found("User")
        else:
            return StandardResponse.bad_request(str(e))
    except Exception as e:
        logger.logger.error(f"Error removing portfolio item: {str(e)}")
        return StandardResponse.server_error("Failed to remove portfolio item")


@router.get("/value")
async def get_portfolio_value(
    user_id: str = Query(..., description="User ID from authentication provider"),
    db: Session = Depends(get_db_session)
):
    """
    Get total portfolio value for a user.
    
    Args:
        user_id: User ID from authentication provider
        db: Database session
        
    Returns:
        Total portfolio value
    """
    try:
        # Use service layer
        value_data = PortfolioService.calculate_portfolio_value(db, user_id)
        
        return StandardResponse.success({
            "user_id": value_data['user_id'],
            "total_value": value_data['total_value'],
            "total_items": value_data['total_items']
        }, f"Portfolio value calculated for {value_data['total_items']} items")
        
    except ValueError as e:
        return StandardResponse.not_found("User")
    except Exception as e:
        logger.logger.error(f"Error calculating portfolio value: {str(e)}")
        return StandardResponse.server_error("Failed to calculate portfolio value")


@router.get("/summary")
async def get_portfolio_summary(
    user_id: str = Query(..., description="User ID from authentication provider"),
    db: Session = Depends(get_db_session)
):
    """
    Get comprehensive portfolio summary for a user.
    
    Args:
        user_id: User ID from authentication provider
        db: Database session
        
    Returns:
        Portfolio summary with detailed analytics
    """
    try:
        # Use service layer
        summary = PortfolioService.get_portfolio_summary(db, user_id)
        
        return StandardResponse.success(summary, f"Portfolio summary generated for user {user_id}")
        
    except ValueError as e:
        return StandardResponse.not_found("User")
    except Exception as e:
        logger.logger.error(f"Error generating portfolio summary: {str(e)}")
        return StandardResponse.server_error("Failed to generate portfolio summary")


"""
Portfolio Service for SignalForge

This module contains business logic for portfolio management.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
import uuid
import logging

from models.user import User
from models.portfolio import PortfolioItem
from schemas.portfolio import PortfolioItemCreate, PortfolioItemResponse

logger = logging.getLogger(__name__)


class PortfolioService:
    """Service class for portfolio management operations."""
    
    @staticmethod
    def get_user_portfolio(db: Session, user_id: str) -> List[PortfolioItem]:
        """
        Get all portfolio items for a user.
        
        Args:
            db: Database session
            user_id: User ID from authentication provider
            
        Returns:
            List of portfolio items
        """
        return db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id
        ).all()
    
    @staticmethod
    def add_portfolio_item(db: Session, item_data: PortfolioItemCreate) -> PortfolioItem:
        """
        Add a new portfolio item for a user.
        
        Args:
            db: Database session
            item_data: Portfolio item creation data
            
        Returns:
            Created portfolio item
            
        Raises:
            ValueError: If item already exists for user and symbol
        """
        # Check if item already exists
        existing = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == item_data.user_id,
            PortfolioItem.symbol == item_data.symbol.upper()
        ).first()
        
        if existing:
            raise ValueError(f"Stock {item_data.symbol} already exists in portfolio")
        
        # Create new item
        portfolio_item = PortfolioItem(
            id=str(uuid.uuid4()),
            user_id=item_data.user_id,
            symbol=item_data.symbol.upper(),
            quantity=item_data.quantity,
            avg_price=item_data.avg_price
        )
        
        db.add(portfolio_item)
        db.commit()
        db.refresh(portfolio_item)
        
        return portfolio_item
    
    @staticmethod
    def remove_portfolio_item(db: Session, user_id: str, symbol: str) -> bool:
        """
        Remove a portfolio item for a user.
        
        Args:
            db: Database session
            user_id: User ID from authentication provider
            symbol: Stock symbol to remove
            
        Returns:
            True if item was removed, False if not found
        """
        item = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id,
            PortfolioItem.symbol == symbol.upper()
        ).first()
        
        if item:
            db.delete(item)
            db.commit()
            return True
        
        return False
    
    @staticmethod
    def calculate_portfolio_value(db: Session, user_id: str) -> float:
        """
        Calculate total value of user's portfolio.
        
        Args:
            db: Database session
            user_id: User ID from authentication provider
            
        Returns:
            Total portfolio value
        """
        items = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id
        ).all()
        
        return sum(item.total_value for item in items)
    
    @staticmethod
    def verify_user_exists(db: Session, user_id: str) -> Optional[User]:
        """
        Verify that a user exists in the database.
        
        Args:
            db: Database session
            user_id: User ID from authentication provider
            
        Returns:
            User object if exists, None otherwise
        """
        return db.query(User).filter(User.id == user_id).first()


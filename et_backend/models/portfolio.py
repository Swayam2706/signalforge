"""
Portfolio Model for SignalForge

This module defines the PortfolioItem model for user portfolio management.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base import Base


class PortfolioItem(Base):
    """
    PortfolioItem model representing stocks in user portfolios.
    
    This model stores user's stock holdings including quantity,
    average price, and other portfolio information.
    """
    __tablename__ = "portfolio_items"
    
    # Primary key
    id = Column(String, primary_key=True, index=True, comment="Portfolio item ID")
    
    # Foreign key to User
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True, comment="User ID")
    
    # Stock information
    symbol = Column(String(10), nullable=False, index=True, comment="Stock symbol (e.g., RELIANCE)")
    quantity = Column(Integer, nullable=False, comment="Number of shares owned")
    avg_price = Column(Float, nullable=False, comment="Average purchase price per share")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="Portfolio item creation timestamp")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="Last update timestamp")
    
    # Relationships
    user = relationship("User", back_populates="portfolio_items")
    
    def __repr__(self) -> str:
        """String representation of PortfolioItem."""
        return f"<PortfolioItem(symbol='{self.symbol}', quantity={self.quantity}, avg_price={self.avg_price})>"
    
    def to_dict(self) -> dict:
        """
        Convert PortfolioItem model to dictionary.
        
        Returns:
            Dictionary representation of portfolio item
        """
        return {
            "id": self.id,
            "user_id": self.user_id,
            "symbol": self.symbol,
            "quantity": self.quantity,
            "avg_price": self.avg_price,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @property
    def total_value(self) -> float:
        """
        Calculate total value of this portfolio item.
        
        Returns:
            Total value (quantity * avg_price)
        """
        return self.quantity * self.avg_price

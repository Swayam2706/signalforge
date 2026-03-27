"""
User Model for SignalForge

This module defines the User model for user management.
"""

from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base import Base


class User(Base):
    """
    User model representing application users.
    
    This model stores user information from authentication providers
    like Clerk or other auth systems.
    """
    __tablename__ = "users"
    
    # Primary key - typically from auth provider (Clerk user ID)
    id = Column(String, primary_key=True, index=True, comment="User ID from auth provider")
    
    # User email
    email = Column(String(255), unique=True, index=True, nullable=False, comment="User email address")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="User creation timestamp")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="Last update timestamp")
    
    # Relationships
    portfolio_items = relationship("PortfolioItem", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation of User."""
        return f"<User(id='{self.id}', email='{self.email}')>"
    
    def to_dict(self) -> dict:
        """
        Convert User model to dictionary.
        
        Returns:
            Dictionary representation of user
        """
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

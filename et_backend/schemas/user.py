"""
User Schemas for SignalForge

This module contains Pydantic schemas for user management APIs.
"""

from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class UserResponse(BaseModel):
    """Schema for user response."""
    
    id: str = Field(..., description="User ID from authentication provider")
    email: str = Field(..., description="User email address")
    created_at: datetime = Field(..., description="User creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "id": "user_123",
                "email": "user@example.com",
                "created_at": "2025-03-25T15:30:00Z",
                "updated_at": "2025-03-25T15:30:00Z"
            }
        }

"""
Database Router for SignalForge

This module provides database management endpoints for administrative tasks.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime

from db.session import get_db_session, DatabaseManager
from db.base import create_tables, drop_tables, check_database_connection
from models.user import User
from models.portfolio import PortfolioItem
from utils.logger import get_logger

# Create router
router = APIRouter(prefix="/database", tags=["database"])
logger = get_logger(__name__)


@router.get("/status")
async def get_database_status():
    """
    Get database connection status and basic information.
    
    Returns:
        Database status information
    """
    try:
        connection_ok = check_database_connection()
        
        status = {
            "status": "connected" if connection_ok else "disconnected",
            "timestamp": datetime.utcnow().isoformat(),
            "connection_check": connection_ok
        }
        
        if connection_ok:
            # Get additional stats when connected
            from db.base import engine, DATABASE_URL
            
            status.update({
                "database_url": DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL,  # Hide credentials
                "engine": str(engine.url.drivername).upper() if engine.url.drivername else "UNKNOWN"
            })
        
        return status
        
    except Exception as e:
        logger.logger.error(f"Database status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check database status")


@router.get("/stats")
async def get_database_stats(db: Session = Depends(get_db_session)):
    """
    Get database statistics and counts.
    
    Args:
        db: Database session
        
    Returns:
        Database statistics
    """
    try:
        # Count users
        user_count = db.query(User).count()
        
        # Count portfolio items
        portfolio_count = db.query(PortfolioItem).count()
        
        # Get table information
        from db.base import Base
        table_names = Base.metadata.tables.keys()
        
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "tables": list(table_names),
            "counts": {
                "users": user_count,
                "portfolio_items": portfolio_count
            },
            "total_records": user_count + portfolio_count
        }
        
        return stats
        
    except Exception as e:
        logger.logger.error(f"Database stats failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get database statistics")


@router.get("/users")
async def get_all_users(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db_session)
):
    """
    Get all users with pagination.
    
    Args:
        limit: Maximum number of users to return
        offset: Number of users to skip
        db: Database session
        
    Returns:
        List of users
    """
    try:
        users = db.query(User).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "users": [user.to_dict() for user in users],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(users)
            }
        }
        
    except Exception as e:
        logger.logger.error(f"Failed to get users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve users")


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db_session)
):
    """
    Get user by ID with their portfolio.
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        User information with portfolio
    """
    try:
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's portfolio
        portfolio_items = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id
        ).all()
        
        return {
            "success": True,
            "user": user.to_dict(),
            "portfolio_items": [item.to_dict() for item in portfolio_items],
            "portfolio_count": len(portfolio_items)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.logger.error(f"Failed to get user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user")


@router.post("/tables/create")
async def create_database_tables():
    """
    Create all database tables.
    
    Returns:
        Table creation result
    """
    try:
        create_tables()
        
        logger.logger.info("Database tables created via API")
        
        return {
            "success": True,
            "message": "Database tables created successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.logger.error(f"Failed to create tables: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create database tables")


@router.post("/tables/drop")
async def drop_database_tables():
    """
    Drop all database tables.
    
    WARNING: This will delete all data!
    
    Returns:
        Table drop result
    """
    try:
        drop_tables()
        
        logger.logger.warning("Database tables dropped via API")
        
        return {
            "success": True,
            "message": "Database tables dropped successfully",
            "warning": "All data has been deleted",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.logger.error(f"Failed to drop tables: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to drop database tables")


@router.post("/seed")
async def seed_database(db: Session = Depends(get_db_session)):
    """
    Seed database with sample data for testing.
    
    Args:
        db: Database session
        
    Returns:
        Seeding result
    """
    try:
        # Create sample user
        user_data = {
            "id": "demo_user_123",
            "email": "demo@signalforge.com"
        }
        
        user, created = DatabaseManager.get_or_create(db, User, **user_data)
        
        # Create sample portfolio items
        if created:
            portfolio_items = [
                {
                    "user_id": user.id,
                    "symbol": "RELIANCE",
                    "quantity": 10,
                    "avg_price": 2500.0
                },
                {
                    "user_id": user.id,
                    "symbol": "TCS",
                    "quantity": 5,
                    "avg_price": 3500.0
                },
                {
                    "user_id": user.id,
                    "symbol": "INFY",
                    "quantity": 15,
                    "avg_price": 1500.0
                }
            ]
            
            DatabaseManager.bulk_create(db, PortfolioItem, portfolio_items)
        
        db.commit()
        
        logger.logger.info("Database seeded with sample data")
        
        return {
            "success": True,
            "message": "Database seeded successfully",
            "user_created": created,
            "portfolio_items_added": len(portfolio_items) if created else 0,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        logger.logger.error(f"Failed to seed database: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to seed database")


@router.delete("/cleanup")
async def cleanup_database(db: Session = Depends(get_db_session)):
    """
    Clean up database by removing old or invalid data.
    
    Args:
        db: Database session
        
    Returns:
        Cleanup result
    """
    try:
        # Remove portfolio items without valid users
        invalid_portfolio = db.query(PortfolioItem).outerjoin(
            User, PortfolioItem.user_id == User.id
        ).filter(User.id.is_(None)).all()
        
        removed_count = 0
        for item in invalid_portfolio:
            db.delete(item)
            removed_count += 1
        
        db.commit()
        
        logger.logger.info(f"Database cleanup completed: {removed_count} invalid items removed")
        
        return {
            "success": True,
            "message": "Database cleanup completed",
            "removed_items": removed_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        logger.logger.error(f"Database cleanup failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cleanup database")


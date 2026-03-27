"""
Database Session Management for SignalForge

This module handles database session management and provides utilities
for working with database sessions.
"""

from typing import Generator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from .base import SessionLocal
from utils.logger import get_logger

logger = get_logger(__name__)


def get_db_session() -> Generator[Session, None, None]:
    """
    Get database session for dependency injection.
    
    Yields:
        Database session that will be automatically closed
        
    Usage:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db_session)):
            return db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.logger.error(f"Database session error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def create_session() -> Session:
    """
    Create a new database session.
    
    Returns:
        Database session
        
    Note:
        Caller is responsible for closing the session
    """
    return SessionLocal()


def close_session(session: Session) -> None:
    """
    Close database session.
    
    Args:
        session: Database session to close
    """
    try:
        session.close()
    except Exception as e:
        logger.logger.error(f"Error closing database session: {str(e)}")


def execute_with_session(func):
    """
    Decorator for executing functions with automatic session management.
    
    Args:
        func: Function to execute with session
        
    Returns:
        Decorated function
    """
    def wrapper(*args, **kwargs):
        session = create_session()
        try:
            result = func(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            logger.logger.error(f"Database operation failed: {str(e)}")
            raise
        finally:
            close_session(session)
    
    return wrapper


class DatabaseManager:
    """
    Database manager class for common operations.
    """
    
    @staticmethod
    def get_or_create(session: Session, model, defaults=None, **kwargs):
        """
        Get or create a database record.
        
        Args:
            session: Database session
            model: SQLAlchemy model class
            defaults: Default values for creation
            **kwargs: Filter criteria
            
        Returns:
            Tuple of (instance, created_bool)
        """
        instance = session.query(model).filter_by(**kwargs).first()
        if instance:
            return instance, False
        else:
            params = dict((k, v) for k, v in kwargs.items())
            params.update(defaults or {})
            instance = model(**params)
            session.add(instance)
            return instance, True
    
    @staticmethod
    def bulk_create(session: Session, model, objects):
        """
        Bulk create records.
        
        Args:
            session: Database session
            model: SQLAlchemy model class
            objects: List of objects to create
            
        Returns:
            List of created instances
        """
        instances = [model(**obj) for obj in objects]
        session.bulk_save_objects(instances)
        return instances
    
    @staticmethod
    def safe_commit(session: Session):
        """
        Safely commit a database session.
        
        Args:
            session: Database session
        """
        try:
            session.commit()
        except SQLAlchemyError as e:
            session.rollback()
            logger.logger.error(f"Database commit failed: {str(e)}")
            raise

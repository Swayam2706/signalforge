"""
Database Base Configuration for SignalForge

This module contains the base database configuration and setup.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL configuration
# For production: PostgreSQL
# For development: SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./signalforge.db")

# Create database engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL logging in development
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session.
    
    Returns:
        Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    Create all database tables.
    
    This should be called on application startup.
    """
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Failed to create database tables: {e}")
        raise


def drop_tables():
    """
    Drop all database tables.
    
    WARNING: This will delete all data!
    Use only for development/testing.
    """
    try:
        Base.metadata.drop_all(bind=engine)
        print("✅ Database tables dropped successfully")
    except Exception as e:
        print(f"❌ Failed to drop database tables: {e}")
        raise


def check_database_connection():
    """
    Check database connection health.
    
    Returns:
        bool: True if connection is successful
    """
    try:
        with engine.connect() as connection:
            connection.execute("SELECT 1")
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

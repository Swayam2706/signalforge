"""
Configuration Management for SignalForge

This module handles all configuration and environment variables.
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "SignalForge API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, env="DEBUG")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # Server
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    
    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./signalforge.db",
        env="DATABASE_URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=5, env="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, env="DATABASE_MAX_OVERFLOW")
    
    # Clerk Authentication
    CLERK_JWT_ISSUER: Optional[str] = Field(None, env="CLERK_JWT_ISSUER")
    CLERK_JWT_PUBLIC_KEY: Optional[str] = Field(None, env="CLERK_JWT_PUBLIC_KEY")
    CLERK_API_KEY: Optional[str] = Field(None, env="CLERK_API_KEY")
    
    # AI Services
    OPENAI_API_KEY: Optional[str] = Field(None, env="OPENAI_API_KEY")
    OPENROUTER_API_KEY: Optional[str] = Field(None, env="OPENROUTER_API_KEY")
    GEMINI_API_KEY: Optional[str] = Field(None, env="GEMINI_API_KEY")
    FINNHUB_API_KEY: Optional[str] = Field(None, env="FINNHUB_API_KEY")
    TAVILY_API_KEY: Optional[str] = Field(None, env="TAVILY_API_KEY")
    SUPABASE_URL: Optional[str] = Field(None, env="SUPABASE_URL")
    SUPABASE_ANON_KEY: Optional[str] = Field(None, env="SUPABASE_ANON_KEY")
    
    # Cache Configuration
    CACHE_TTL_STOCK_DATA: int = Field(default=600, env="CACHE_TTL_STOCK_DATA")  # 10 minutes
    CACHE_TTL_API_RESPONSE: int = Field(default=300, env="CACHE_TTL_API_RESPONSE")  # 5 minutes
    CACHE_TTL_PORTFOLIO: int = Field(default=180, env="CACHE_TTL_PORTFOLIO")  # 3 minutes
    CACHE_TTL_SIGNAL: int = Field(default=300, env="CACHE_TTL_SIGNAL")  # 5 minutes
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = Field(default=60, env="RATE_LIMIT_REQUESTS_PER_MINUTE")
    RATE_LIMIT_REQUESTS_PER_HOUR: int = Field(default=1000, env="RATE_LIMIT_REQUESTS_PER_HOUR")
    RATE_LIMIT_REQUESTS_PER_DAY: int = Field(default=10000, env="RATE_LIMIT_REQUESTS_PER_DAY")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json", env="LOG_FORMAT")  # json or text
    LOG_FILE_PATH: Optional[str] = Field(None, env="LOG_FILE_PATH")
    
    # Security
    SECRET_KEY: str = Field(
        default="your-secret-key-change-in-production",
        env="SECRET_KEY"
    )
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
        env="CORS_ORIGINS"
    )

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return ["http://localhost:5173"]
            try:
                import json
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                # Handle comma-separated string fallback
                return [o.strip() for o in v.split(",") if o.strip()]
        return ["http://localhost:5173"]
    
    # External API Configuration
    YFINANCE_TIMEOUT: int = Field(default=30, env="YFINANCE_TIMEOUT")
    YFINANCE_RETRY_ATTEMPTS: int = Field(default=3, env="YFINANCE_RETRY_ATTEMPTS")
    
    # Performance
    MAX_WORKERS: int = Field(default=4, env="MAX_WORKERS")
    REQUEST_TIMEOUT: int = Field(default=60, env="REQUEST_TIMEOUT")
    
    # Monitoring
    ENABLE_METRICS: bool = Field(default=True, env="ENABLE_METRICS")
    METRICS_PORT: int = Field(default=9090, env="METRICS_PORT")
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def database_config(self) -> dict:
        """Get database configuration dictionary."""
        return {
            "url": self.DATABASE_URL,
            "pool_size": self.DATABASE_POOL_SIZE,
            "max_overflow": self.DATABASE_MAX_OVERFLOW,
            "echo": self.DEBUG
        }
    
    @property
    def cors_config(self) -> dict:
        """Get CORS configuration dictionary."""
        return {
            "allow_origins": self.CORS_ORIGINS,
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"]
        }
    
    @property
    def clerk_config(self) -> dict:
        """Get Clerk authentication configuration."""
        return {
            "issuer": self.CLERK_JWT_ISSUER,
            "public_key": self.CLERK_JWT_PUBLIC_KEY,
            "api_key": self.CLERK_API_KEY
        }
    
    @property
    def ai_config(self) -> dict:
        """Get AI services configuration."""
        return {
            "openai_api_key": self.OPENAI_API_KEY,
            "openrouter_api_key": self.OPENROUTER_API_KEY,
            "gemini_api_key": self.GEMINI_API_KEY
        }
    
    @property
    def cache_config(self) -> dict:
        """Get cache configuration."""
        return {
            "stock_data_ttl": self.CACHE_TTL_STOCK_DATA,
            "api_response_ttl": self.CACHE_TTL_API_RESPONSE,
            "portfolio_ttl": self.CACHE_TTL_PORTFOLIO,
            "signal_ttl": self.CACHE_TTL_SIGNAL
        }
    
    @property
    def rate_limit_config(self) -> dict:
        """Get rate limiting configuration."""
        return {
            "requests_per_minute": self.RATE_LIMIT_REQUESTS_PER_MINUTE,
            "requests_per_hour": self.RATE_LIMIT_REQUESTS_PER_HOUR,
            "requests_per_day": self.RATE_LIMIT_REQUESTS_PER_DAY
        }
    
    def validate_required_configs(self) -> List[str]:
        """Validate required configuration values."""
        missing_configs = []
        
        # Check critical production configs
        if self.is_production:
            if not self.SECRET_KEY or self.SECRET_KEY == "your-secret-key-change-in-production":
                missing_configs.append("SECRET_KEY")
            
            if not self.CLERK_JWT_ISSUER:
                missing_configs.append("CLERK_JWT_ISSUER")
            
            if not self.CLERK_JWT_PUBLIC_KEY:
                missing_configs.append("CLERK_JWT_PUBLIC_KEY")
        
        return missing_configs
    
    def get_log_config(self) -> dict:
        """Get logging configuration."""
        return {
            "level": self.LOG_LEVEL,
            "format": self.LOG_FORMAT,
            "file_path": self.LOG_FILE_PATH,
            "enable_metrics": self.ENABLE_METRICS
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()

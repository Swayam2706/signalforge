"""
Custom Exceptions for SignalForge

This module defines custom exception classes for better error handling.
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status


class SignalForgeException(Exception):
    """Base exception class for SignalForge application."""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(SignalForgeException):
    """Authentication related errors."""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTH_ERROR", details)


class AuthorizationError(SignalForgeException):
    """Authorization related errors."""
    
    def __init__(self, message: str = "Access denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHZ_ERROR", details)


class ValidationError(SignalForgeException):
    """Validation related errors."""
    
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "VALIDATION_ERROR", details)


class DatabaseError(SignalForgeException):
    """Database related errors."""
    
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "DB_ERROR", details)


class ExternalAPIError(SignalForgeException):
    """External API related errors."""
    
    def __init__(self, message: str = "External API call failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "API_ERROR", details)


class StockDataError(SignalForgeException):
    """Stock data related errors."""
    
    def __init__(self, message: str = "Stock data unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "STOCK_DATA_ERROR", details)


class SignalProcessingError(SignalForgeException):
    """Signal processing related errors."""
    
    def __init__(self, message: str = "Signal processing failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "SIGNAL_ERROR", details)


class AIServiceError(SignalForgeException):
    """AI service related errors."""
    
    def __init__(self, message: str = "AI service unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AI_ERROR", details)


class CacheError(SignalForgeException):
    """Cache related errors."""
    
    def __init__(self, message: str = "Cache operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CACHE_ERROR", details)


class RateLimitError(SignalForgeException):
    """Rate limiting related errors."""
    
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "RATE_LIMIT_ERROR", details)


class ConfigurationError(SignalForgeException):
    """Configuration related errors."""
    
    def __init__(self, message: str = "Configuration error", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CONFIG_ERROR", details)


# HTTP Exception helpers
def create_http_exception(
    status_code: int,
    message: str,
    error_code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> HTTPException:
    """Create HTTPException with structured error information."""
    return HTTPException(
        status_code=status_code,
        detail={
            "error_code": error_code,
            "message": message,
            "details": details or {}
        }
    )


def create_authentication_error(message: str = "Authentication failed") -> HTTPException:
    """Create authentication HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_401_UNAUTHORIZED,
        message=message,
        error_code="AUTH_ERROR"
    )


def create_authorization_error(message: str = "Access denied") -> HTTPException:
    """Create authorization HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_403_FORBIDDEN,
        message=message,
        error_code="AUTHZ_ERROR"
    )


def create_validation_error(message: str, details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create validation HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message=message,
        error_code="VALIDATION_ERROR",
        details=details
    )


def create_not_found_error(resource: str, details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create not found HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_404_NOT_FOUND,
        message=f"{resource} not found",
        error_code="NOT_FOUND",
        details=details
    )


def create_server_error(message: str = "Internal server error", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create server error HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message=message,
        error_code="INTERNAL_ERROR",
        details=details
    )


def create_rate_limit_error(message: str = "Rate limit exceeded") -> HTTPException:
    """Create rate limit HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        message=message,
        error_code="RATE_LIMIT_ERROR"
    )


def create_external_api_error(message: str = "External service unavailable") -> HTTPException:
    """Create external API error HTTP exception."""
    return create_http_exception(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        message=message,
        error_code="EXTERNAL_API_ERROR"
    )

"""
Global Exception Handlers for SignalForge

This module provides centralized exception handling for the FastAPI application.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from pydantic import ValidationError as PydanticValidationError
import traceback

from config import settings
from exceptions import (
    SignalForgeException,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    DatabaseError,
    ExternalAPIError,
    StockDataError,
    SignalProcessingError,
    AIServiceError,
    CacheError,
    RateLimitError,
    ConfigurationError
)
from utils.response import StandardResponse

logger = logging.getLogger(__name__)


class GlobalExceptionHandler:
    """Global exception handler for SignalForge application."""
    
    def __init__(self):
        self.debug_mode = settings.DEBUG
    
    def create_error_response(
        self,
        message: str,
        error_code: Optional[str] = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
        include_traceback: bool = False
    ) -> JSONResponse:
        """Create standardized error response."""
        error_data = {
            "success": False,
            "data": None,
            "message": message,
            "error": {
                "code": error_code or "INTERNAL_ERROR",
                "details": details or {}
            }
        }
        
        # Add traceback in debug mode
        if self.debug_mode and include_traceback:
            error_data["error"]["traceback"] = traceback.format_exc()
        
        return JSONResponse(
            status_code=status_code,
            content=error_data
        )
    
    def handle_signal_forge_exception(self, request: Request, exc: SignalForgeException) -> JSONResponse:
        """Handle SignalForge custom exceptions."""
        logger.error(f"SignalForgeException: {exc.message} - {exc.error_code}")
        
        # Map exception types to HTTP status codes
        status_mapping = {
            AuthenticationError: status.HTTP_401_UNAUTHORIZED,
            AuthorizationError: status.HTTP_403_FORBIDDEN,
            ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
            RateLimitError: status.HTTP_429_TOO_MANY_REQUESTS,
            ConfigurationError: status.HTTP_500_INTERNAL_SERVER_ERROR,
            DatabaseError: status.HTTP_500_INTERNAL_SERVER_ERROR,
            ExternalAPIError: status.HTTP_503_SERVICE_UNAVAILABLE,
            StockDataError: status.HTTP_404_NOT_FOUND,
            SignalProcessingError: status.HTTP_500_INTERNAL_SERVER_ERROR,
            AIServiceError: status.HTTP_503_SERVICE_UNAVAILABLE,
            CacheError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        }
        
        # Get appropriate status code
        status_code = status_mapping.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return self.create_error_response(
            message=exc.message,
            error_code=exc.error_code,
            status_code=status_code,
            details=exc.details,
            include_traceback=self.debug_mode
        )
    
    def handle_http_exception(self, request: Request, exc: HTTPException) -> JSONResponse:
        """Handle FastAPI HTTP exceptions."""
        logger.warning(f"HTTPException: {exc.status_code} - {exc.detail}")
        
        # Extract error details if they exist
        error_detail = exc.detail
        error_code = "HTTP_ERROR"
        details = {}
        
        if isinstance(error_detail, dict):
            error_code = error_detail.get("error_code", "HTTP_ERROR")
            message = error_detail.get("message", str(exc))
            details = error_detail.get("details", {})
        else:
            message = str(error_detail)
        
        return self.create_error_response(
            message=message,
            error_code=error_code,
            status_code=exc.status_code,
            details=details
        )
    
    def handle_validation_error(self, request: Request, exc: PydanticValidationError) -> JSONResponse:
        """Handle Pydantic validation errors."""
        logger.warning(f"ValidationError: {exc.errors()}")
        
        # Format validation errors
        validation_errors = []
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error["loc"])
            validation_errors.append({
                "field": field,
                "message": error["msg"],
                "type": error["type"]
            })
        
        return self.create_error_response(
            message="Validation failed",
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={
                "validation_errors": validation_errors
            }
        )
    
    def handle_database_error(self, request: Request, exc: SQLAlchemyError) -> JSONResponse:
        """Handle SQLAlchemy database errors."""
        logger.error(f"Database error: {str(exc)}")
        
        # Determine error type and message
        if isinstance(exc, IntegrityError):
            message = "Database integrity constraint violated"
            error_code = "DB_INTEGRITY_ERROR"
        elif isinstance(exc, OperationalError):
            message = "Database operation failed"
            error_code = "DB_OPERATION_ERROR"
        else:
            message = "Database error occurred"
            error_code = "DB_ERROR"
        
        return self.create_error_response(
            message=message,
            error_code=error_code,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"database_error": str(exc)} if self.debug_mode else {},
            include_traceback=self.debug_mode
        )
    
    def handle_general_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected exceptions."""
        logger.error(f"Unexpected exception: {type(exc).__name__}: {str(exc)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return self.create_error_response(
            message="An unexpected error occurred",
            error_code="UNEXPECTED_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"exception_type": type(exc).__name__} if self.debug_mode else {},
            include_traceback=self.debug_mode
        )


# Create global exception handler instance
exception_handler = GlobalExceptionHandler()


def setup_exception_handlers(app):
    """Setup global exception handlers for FastAPI application."""
    
    # Custom SignalForge exceptions
    @app.exception_handler(SignalForgeException)
    async def handle_signal_forge_exception(request: Request, exc: SignalForgeException):
        return exception_handler.handle_signal_forge_exception(request, exc)
    
    # HTTP exceptions
    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, exc: HTTPException):
        return exception_handler.handle_http_exception(request, exc)
    
    @app.exception_handler(StarletteHTTPException)
    async def handle_starlette_http_exception(request: Request, exc: StarletteHTTPException):
        return exception_handler.handle_http_exception(request, HTTPException(status_code=exc.status_code, detail=exc.detail))
    
    # Validation errors
    @app.exception_handler(PydanticValidationError)
    async def handle_validation_error(request: Request, exc: PydanticValidationError):
        return exception_handler.handle_validation_error(request, exc)
    
    # Database errors
    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(request: Request, exc: SQLAlchemyError):
        return exception_handler.handle_database_error(request, exc)
    
    # General exception (catch-all)
    @app.exception_handler(Exception)
    async def handle_general_exception(request: Request, exc: Exception):
        return exception_handler.handle_general_exception(request, exc)


# Decorator for error handling in service functions
def handle_service_errors(service_name: str):
    """Decorator to handle service-level errors consistently."""
    
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except SignalForgeException:
                raise  # Re-raise custom exceptions
            except SQLAlchemyError as e:
                logger.error(f"Database error in {service_name}.{func.__name__}: {str(e)}")
                raise DatabaseError(f"Database operation failed in {service_name}")
            except Exception as e:
                logger.error(f"Unexpected error in {service_name}.{func.__name__}: {str(e)}")
                raise SignalForgeException(f"Service error in {service_name}")
        
        return wrapper
    
    return decorator


# Error context manager for database operations
class DatabaseErrorHandler:
    """Context manager for database error handling."""
    
    def __init__(self, operation: str):
        self.operation = operation
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type and issubclass(exc_type, SQLAlchemyError):
            logger.error(f"Database error during {self.operation}: {str(exc_val)}")
            raise DatabaseError(f"Database operation failed: {self.operation}")
        return False


# Error reporting utilities
def log_api_error(
    endpoint: str,
    user_id: Optional[str],
    error: Exception,
    request_data: Optional[Dict[str, Any]] = None
):
    """Log API error with context."""
    error_data = {
        "endpoint": endpoint,
        "user_id": user_id,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "request_data": request_data or {},
        "timestamp": logger.handlers[0].formatter.formatTime(logger.makeRecord(
            name="", level=0, pathname="", lineno=0, msg="", args=(), exc_info=None
        )) if logger.handlers else None
    }
    
    logger.error(f"API Error: {error_data}")


def get_error_statistics() -> Dict[str, Any]:
    """Get error statistics (placeholder for future implementation)."""
    # This could be enhanced to track error rates, types, etc.
    return {
        "total_errors": 0,
        "error_types": {},
        "recent_errors": [],
        "error_rate": 0.0
    }

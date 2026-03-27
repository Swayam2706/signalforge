"""
Response Utility for SignalForge

This module provides standardized response formatting for all API endpoints.
"""

from typing import Any, Optional, Dict
from fastapi import HTTPException
from datetime import datetime


class StandardResponse:
    """
    Standard response formatter for consistent API responses.
    
    Format:
    {
        "success": true,
        "data": ...,
        "message": "",
        "error": null,
        "timestamp": "2025-03-25T15:30:00Z"
    }
    """
    
    @staticmethod
    def success(data: Any = None, message: str = "") -> Dict[str, Any]:
        """
        Create a successful response.
        
        Args:
            data: Response data (can be None)
            message: Success message
            
        Returns:
            Standardized success response
        """
        return {
            "success": True,
            "data": data,
            "message": message,
            "error": None,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def error(message: str, error_code: Optional[str] = None, details: Optional[str] = None) -> Dict[str, Any]:
        """
        Create an error response.
        
        Args:
            message: Error message
            error_code: Optional error code
            details: Optional error details
            
        Returns:
            Standardized error response
        """
        return {
            "success": False,
            "data": None,
            "message": message,
            "error": {
                "code": error_code,
                "details": details
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def created(data: Any, message: str = "Resource created successfully") -> Dict[str, Any]:
        """
        Create a created response (201 equivalent).
        
        Args:
            data: Created resource data
            message: Success message
            
        Returns:
            Standardized created response
        """
        return StandardResponse.success(data, message)
    
    @staticmethod
    def updated(data: Any, message: str = "Resource updated successfully") -> Dict[str, Any]:
        """
        Create an updated response.
        
        Args:
            data: Updated resource data
            message: Success message
            
        Returns:
            Standardized updated response
        """
        return StandardResponse.success(data, message)
    
    @staticmethod
    def deleted(message: str = "Resource deleted successfully") -> Dict[str, Any]:
        """
        Create a deleted response.
        
        Args:
            message: Success message
            
        Returns:
            Standardized deleted response
        """
        return StandardResponse.success(None, message)
    
    @staticmethod
    def not_found(resource: str) -> Dict[str, Any]:
        """
        Create a not found response.
        
        Args:
            resource: Resource name that was not found
            
        Returns:
            Standardized not found response
        """
        return StandardResponse.error(
            message=f"{resource} not found",
            error_code="NOT_FOUND"
        )
    
    @staticmethod
    def bad_request(message: str, error_code: str = "BAD_REQUEST") -> Dict[str, Any]:
        """
        Create a bad request response.
        
        Args:
            message: Error message
            error_code: Error code
            
        Returns:
            Standardized bad request response
        """
        return StandardResponse.error(message, error_code)
    
    @staticmethod
    def server_error(message: str = "Internal server error") -> Dict[str, Any]:
        """
        Create a server error response.
        
        Args:
            message: Error message
            
        Returns:
            Standardized server error response
        """
        return StandardResponse.error(
            message=message,
            error_code="INTERNAL_SERVER_ERROR"
        )
    
    @staticmethod
    def unauthorized(message: str = "Unauthorized") -> Dict[str, Any]:
        """
        Create an unauthorized response.
        
        Args:
            message: Error message
            
        Returns:
            Standardized unauthorized response
        """
        return StandardResponse.error(
            message=message,
            error_code="UNAUTHORIZED"
        )
    
    @staticmethod
    def forbidden(message: str = "Forbidden") -> Dict[str, Any]:
        """
        Create a forbidden response.
        
        Args:
            message: Error message
            
        Returns:
            Standardized forbidden response
        """
        return StandardResponse.error(
            message=message,
            error_code="FORBIDDEN"
        )


def handle_api_errors(func):
    """
    Decorator for handling API errors with standardized responses.
    
    Args:
        func: Function to wrap
        
    Returns:
        Wrapped function with standardized error handling
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            # Handle validation errors
            if "not found" in str(e).lower():
                return StandardResponse.not_found("Resource")
            elif "already exists" in str(e).lower():
                return StandardResponse.bad_request(str(e), "ALREADY_EXISTS")
            else:
                return StandardResponse.bad_request(str(e))
        except HTTPException as e:
            # Handle FastAPI HTTP exceptions
            if e.status_code == 404:
                return StandardResponse.not_found("Resource")
            elif e.status_code == 400:
                return StandardResponse.bad_request(e.detail)
            elif e.status_code == 401:
                return StandardResponse.unauthorized(e.detail)
            elif e.status_code == 403:
                return StandardResponse.forbidden(e.detail)
            elif e.status_code >= 500:
                return StandardResponse.server_error(e.detail)
            else:
                return StandardResponse.error(e.detail, f"HTTP_{e.status_code}")
        except Exception as e:
            # Handle unexpected errors
            return StandardResponse.server_error("An unexpected error occurred")
    
    return wrapper


def wrap_response(data: Any, success: bool = True, message: str = "", error: Optional[str] = None) -> Dict[str, Any]:
    """
    Wrap any response in standard format.
    
    Args:
        data: Response data
        success: Success status
        message: Response message
        error: Error message if any
        
    Returns:
        Standardized response
    """
    if success:
        return StandardResponse.success(data, message)
    else:
        return StandardResponse.error(error or "Unknown error", "GENERIC_ERROR")


# Convenience functions for common response types
def success_response(data: Any = None, message: str = "") -> Dict[str, Any]:
    """Create a success response."""
    return StandardResponse.success(data, message)


def error_response(message: str, error_code: Optional[str] = None) -> Dict[str, Any]:
    """Create an error response."""
    return StandardResponse.error(message, error_code)


def created_response(data: Any, message: str = "Created successfully") -> Dict[str, Any]:
    """Create a created response."""
    return StandardResponse.created(data, message)


def deleted_response(message: str = "Deleted successfully") -> Dict[str, Any]:
    """Create a deleted response."""
    return StandardResponse.deleted(message)

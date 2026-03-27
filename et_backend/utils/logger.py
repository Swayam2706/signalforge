"""
Structured Logging Utility for SignalForge

This module provides structured logging with performance tracking.
"""

import logging
import time
import json
from typing import Dict, Any, Optional
from datetime import datetime
from functools import wraps
import traceback


class StructuredLogger:
    """
    Structured logger with performance tracking and structured output.
    """
    
    def __init__(self, name: str, level: int = logging.INFO):
        """
        Initialize structured logger.
        
        Args:
            name: Logger name
            level: Logging level
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        
        # Create formatter for structured logging
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Create console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        
        # Add handler to logger
        if not self.logger.handlers:
            self.logger.addHandler(console_handler)
    
    def log_request(self, method: str, endpoint: str, user_id: Optional[str] = None, **kwargs):
        """
        Log API request.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            user_id: User ID if available
            **kwargs: Additional request data
        """
        log_data = {
            'event': 'api_request',
            'method': method,
            'endpoint': endpoint,
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        if user_id:
            log_data['user_id'] = user_id
        
        self.logger.info(f"API Request: {json.dumps(log_data)}")
    
    def log_response(self, method: str, endpoint: str, status_code: int, 
                    duration_ms: float, user_id: Optional[str] = None, **kwargs):
        """
        Log API response with performance metrics.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            status_code: HTTP status code
            duration_ms: Request duration in milliseconds
            user_id: User ID if available
            **kwargs: Additional response data
        """
        log_data = {
            'event': 'api_response',
            'method': method,
            'endpoint': endpoint,
            'status_code': status_code,
            'duration_ms': round(duration_ms, 2),
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        if user_id:
            log_data['user_id'] = user_id
        
        # Log with appropriate level based on status code
        if status_code >= 500:
            self.logger.error(f"API Response: {json.dumps(log_data)}")
        elif status_code >= 400:
            self.logger.warning(f"API Response: {json.dumps(log_data)}")
        else:
            self.logger.info(f"API Response: {json.dumps(log_data)}")
    
    def log_error(self, error: Exception, context: Optional[Dict[str, Any]] = None, **kwargs):
        """
        Log error with context and traceback.
        
        Args:
            error: Exception object
            context: Additional context information
            **kwargs: Additional error data
        """
        log_data = {
            'event': 'error',
            'error_type': type(error).__name__,
            'error_message': str(error),
            'traceback': traceback.format_exc(),
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        if context:
            log_data['context'] = context
        
        self.logger.error(f"Error: {json.dumps(log_data)}")
    
    def log_performance(self, operation: str, duration_ms: float, **kwargs):
        """
        Log performance metrics.
        
        Args:
            operation: Operation name
            duration_ms: Duration in milliseconds
            **kwargs: Additional performance data
        """
        log_data = {
            'event': 'performance',
            'operation': operation,
            'duration_ms': round(duration_ms, 2),
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        # Log as warning if operation is slow (> 5 seconds)
        if duration_ms > 5000:
            self.logger.warning(f"Performance: {json.dumps(log_data)}")
        else:
            self.logger.info(f"Performance: {json.dumps(log_data)}")
    
    def log_cache_operation(self, operation: str, cache_name: str, hit: bool, **kwargs):
        """
        Log cache operations.
        
        Args:
            operation: Cache operation (hit/miss/set/delete)
            cache_name: Name of cache instance
            hit: Whether it was a cache hit
            **kwargs: Additional cache data
        """
        log_data = {
            'event': 'cache_operation',
            'operation': operation,
            'cache_name': cache_name,
            'hit': hit,
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        self.logger.debug(f"Cache: {json.dumps(log_data)}")
    
    def log_business_event(self, event_name: str, user_id: Optional[str] = None, **kwargs):
        """
        Log business events.
        
        Args:
            event_name: Name of business event
            user_id: User ID if available
            **kwargs: Additional event data
        """
        log_data = {
            'event': 'business_event',
            'event_name': event_name,
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        if user_id:
            log_data['user_id'] = user_id
        
        self.logger.info(f"Business Event: {json.dumps(log_data)}")


def get_logger(name: str) -> StructuredLogger:
    """
    Get structured logger instance.
    
    Args:
        name: Logger name
        
    Returns:
        StructuredLogger instance
    """
    return StructuredLogger(name)


def log_api_calls(logger: StructuredLogger):
    """
    Decorator for logging API calls with performance tracking.
    
    Args:
        logger: StructuredLogger instance
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Extract request information
            request = kwargs.get('request') or (args[0] if args else None)
            endpoint = getattr(request, 'url', {}).get('path', 'unknown') if request else 'unknown'
            method = getattr(request, 'method', 'GET') if request else 'GET'
            user_id = getattr(request, 'query_params', {}).get('user_id') if request else None
            
            # Log request
            logger.log_request(method, endpoint, user_id=user_id)
            
            try:
                # Execute function
                result = await func(*args, **kwargs)
                
                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                
                # Extract status code from result if available
                status_code = getattr(result, 'status_code', 200)
                
                # Log response
                logger.log_response(method, endpoint, status_code, duration_ms, user_id=user_id)
                
                return result
                
            except Exception as e:
                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                
                # Log error
                logger.log_error(e, context={
                    'method': method,
                    'endpoint': endpoint,
                    'user_id': user_id,
                    'duration_ms': duration_ms
                })
                
                raise
        
        return wrapper
    return decorator


def log_performance(logger: StructuredLogger, operation_name: str):
    """
    Decorator for logging function performance.
    
    Args:
        logger: StructuredLogger instance
        operation_name: Name of operation for logging
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                # Execute function
                result = await func(*args, **kwargs)
                
                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                
                # Log performance
                logger.log_performance(operation_name, duration_ms)
                
                return result
                
            except Exception as e:
                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                
                # Log error with performance
                logger.log_error(e, context={
                    'operation': operation_name,
                    'duration_ms': duration_ms
                })
                
                raise
        
        return wrapper
    return decorator


def log_cache_operations(cache_instance, cache_name: str):
    """
    Decorator for logging cache operations.
    
    Args:
        cache_instance: Cache instance
        cache_name: Name of cache for logging
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Try to get from cache
            cache_key = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cached_result = cache_instance.get(cache_key)
            
            if cached_result is not None:
                # Cache hit
                logger_instance = get_logger(__name__)
                logger_instance.log_cache_operation('hit', cache_name, True, key=cache_key)
                return cached_result
            
            # Cache miss - execute function
            result = func(*args, **kwargs)
            
            # Set in cache
            cache_instance.set(cache_key, result)
            
            # Log cache miss and set
            logger_instance = get_logger(__name__)
            logger_instance.log_cache_operation('miss', cache_name, False, key=cache_key)
            logger_instance.log_cache_operation('set', cache_name, False, key=cache_key)
            
            return result
        
        return wrapper
    return decorator


# Global logger instances
api_logger = get_logger('api')
performance_logger = get_logger('performance')
cache_logger = get_logger('cache')
business_logger = get_logger('business')

"""
Performance Middleware for SignalForge

This middleware provides performance monitoring and optimization.
"""

import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from utils.logger import api_logger
from utils.cache import cleanup_expired_cache


class PerformanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware for performance monitoring and optimization.
    
    Features:
    - Request timing
    - Request ID tracking
    - Cache cleanup
    - Performance logging
    """
    
    def __init__(self, app, cache_cleanup_interval: int = 300):
        """
        Initialize performance middleware.
        
        Args:
            app: FastAPI application
            cache_cleanup_interval: Cache cleanup interval in seconds
        """
        super().__init__(app)
        self.cache_cleanup_interval = cache_cleanup_interval
        self.last_cleanup_time = time.time()
    
    async def dispatch(self, request: Request, call_next):
        """
        Process request with performance monitoring.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with performance headers
        """
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        
        # Add request ID to request state
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        # Periodic cache cleanup
        current_time = time.time()
        if current_time - self.last_cleanup_time > self.cache_cleanup_interval:
            try:
                cleanup_expired_cache()
                self.last_cleanup_time = current_time
            except Exception as e:
                api_logger.logger.error(f"Cache cleanup failed: {str(e)}")
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate processing time
            processing_time = (time.time() - request.state.start_time) * 1000
            
            # Add performance headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Processing-Time-ms"] = str(round(processing_time, 2))
            response.headers["X-Response-Time"] = f"{round(processing_time, 2)}ms"
            
            # Log performance
            self._log_performance(request, response, processing_time)
            
            return response
            
        except Exception as e:
            # Calculate processing time for failed requests
            processing_time = (time.time() - request.state.start_time) * 1000
            
            # Log error with performance data
            api_logger.log_error(e, context={
                'request_id': request_id,
                'method': request.method,
                'url': str(request.url),
                'processing_time_ms': processing_time
            })
            
            raise
    
    def _log_performance(self, request: Request, response: Response, processing_time: float):
        """
        Log performance metrics.
        
        Args:
            request: Request object
            response: Response object
            processing_time: Processing time in milliseconds
        """
        # Extract relevant information
        method = request.method
        url_path = request.url.path
        status_code = response.status_code
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Log slow requests (> 2 seconds)
        if processing_time > 2000:
            api_logger.logger.warning(
                f"Slow request detected: {method} {url_path} - "
                f"{processing_time:.2f}ms - Status: {status_code} - "
                f"User-Agent: {user_agent} - Request-ID: {request.state.request_id}"
            )
        
        # Log performance metrics
        api_logger.log_performance(
            operation=f"{method} {url_path}",
            duration_ms=processing_time,
            status_code=status_code,
            request_id=request.state.request_id,
            user_agent=user_agent
        )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for detailed request logging.
    """
    
    async def dispatch(self, request: Request, call_next):
        """
        Process request with detailed logging.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response
        """
        # Log request start
        start_time = time.time()
        
        # Extract request details
        method = request.method
        url_path = request.url.path
        query_params = dict(request.query_params)
        user_id = query_params.get('user_id')
        
        # Log request
        api_logger.log_request(method, url_path, user_id=user_id, query_params=query_params)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000
            
            # Log response
            api_logger.log_response(
                method, url_path, response.status_code, 
                processing_time, user_id=user_id
            )
            
            return response
            
        except Exception as e:
            # Calculate processing time for failed requests
            processing_time = (time.time() - start_time) * 1000
            
            # Log error
            api_logger.log_error(e, context={
                'method': method,
                'url_path': url_path,
                'user_id': user_id,
                'processing_time_ms': processing_time
            })
            
            raise


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware for security headers and rate limiting.
    """
    
    def __init__(self, app):
        """Initialize security middleware."""
        super().__init__(app)
        self.rate_limits = {}  # Simple in-memory rate limiting
    
    async def dispatch(self, request: Request, call_next):
        """
        Process request with security checks.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with security headers
        """
        # Simple rate limiting by IP
        client_ip = request.client.host
        current_time = time.time()
        
        # Clean old entries (older than 1 minute)
        self._cleanup_rate_limits(current_time)
        
        # Check rate limit (100 requests per minute per IP)
        if client_ip in self.rate_limits:
            requests_in_minute = len(self.rate_limits[client_ip])
            if requests_in_minute > 100:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later."
                )
        
        # Add to rate limit tracker
        if client_ip not in self.rate_limits:
            self.rate_limits[client_ip] = []
        self.rate_limits[client_ip].append(current_time)
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response
    
    def _cleanup_rate_limits(self, current_time: float):
        """
        Clean up old rate limit entries.
        
        Args:
            current_time: Current timestamp
        """
        cutoff_time = current_time - 60  # 1 minute ago
        
        for ip in list(self.rate_limits.keys()):
            # Remove entries older than 1 minute
            self.rate_limits[ip] = [
                timestamp for timestamp in self.rate_limits[ip]
                if timestamp > cutoff_time
            ]
            
            # Remove empty entries
            if not self.rate_limits[ip]:
                del self.rate_limits[ip]


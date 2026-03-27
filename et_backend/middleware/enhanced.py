"""
Middleware for SignalForge

This module contains various middleware for request logging, rate limiting, and monitoring.
"""

import time
import json
import logging
from typing import Dict, Any, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from collections import defaultdict, deque

from config import settings
from exceptions import RateLimitError
from utils.response import StandardResponse

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""
    
    def __init__(self, app):
        super().__init__(app)
        self.log_format = settings.LOG_FORMAT == "json"
    
    async def dispatch(self, request: Request, call_next):
        """Process request and log details."""
        start_time = time.time()
        
        # Extract request information
        method = request.method
        url = str(request.url)
        path = request.url.path
        query_params = str(request.query_params) if request.query_params else ""
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Get user agent
        user_agent = request.headers.get("user-agent", "Unknown")
        
        # Get user ID if authenticated
        user_id = getattr(request.state, "user_id", None)
        
        # Process request
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log request
            log_data = {
                "timestamp": time.time(),
                "method": method,
                "path": path,
                "query_params": query_params,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "user_id": user_id,
                "status_code": response.status_code,
                "process_time_ms": round(process_time * 1000, 2),
                "success": response.status_code < 400
            }
            
            if self.log_format:
                logger.info(json.dumps(log_data))
            else:
                logger.info(
                    f"{method} {path} - {response.status_code} - "
                    f"{process_time:.3f}s - {client_ip} - "
                    f"{'User:' + str(user_id) if user_id else 'Anonymous'}"
                )
            
            # Add timing header
            response.headers["X-Process-Time"] = f"{process_time:.3f}"
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            
            # Log error
            log_data = {
                "timestamp": time.time(),
                "method": method,
                "path": path,
                "query_params": query_params,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "user_id": user_id,
                "status_code": 500,
                "process_time_ms": round(process_time * 1000, 2),
                "success": False,
                "error": str(e)
            }
            
            if self.log_format:
                logger.error(json.dumps(log_data))
            else:
                logger.error(
                    f"{method} {path} - 500 - {process_time:.3f}s - "
                    f"{client_ip} - Error: {str(e)}"
                )
            
            # Re-raise exception
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to client IP
        return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests."""
    
    def __init__(self, app):
        super().__init__(app)
        self.requests_per_minute = settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        self.requests_per_hour = settings.RATE_LIMIT_REQUESTS_PER_HOUR
        self.requests_per_day = settings.RATE_LIMIT_REQUESTS_PER_DAY
        
        # In-memory storage for rate limiting
        self.minute_requests: Dict[str, deque] = defaultdict(deque)
        self.hour_requests: Dict[str, deque] = defaultdict(deque)
        self.day_requests: Dict[str, deque] = defaultdict(deque)
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Check rate limits
        if not self._check_rate_limit(client_ip, current_time):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=StandardResponse.error(
                    message="Rate limit exceeded",
                    error_code="RATE_LIMIT_ERROR",
                    details={
                        "retry_after": 60,
                        "limits": {
                            "per_minute": self.requests_per_minute,
                            "per_hour": self.requests_per_hour,
                            "per_day": self.requests_per_day
                        }
                    }
                ).dict()
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit-Minute"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Limit-Hour"] = str(self.requests_per_hour)
        response.headers["X-RateLimit-Limit-Day"] = str(self.requests_per_day)
        
        # Add current usage
        minute_count = len(self.minute_requests[client_ip])
        hour_count = len(self.hour_requests[client_ip])
        day_count = len(self.day_requests[client_ip])
        
        response.headers["X-RateLimit-Remaining-Minute"] = str(max(0, self.requests_per_minute - minute_count))
        response.headers["X-RateLimit-Remaining-Hour"] = str(max(0, self.requests_per_hour - hour_count))
        response.headers["X-RateLimit-Remaining-Day"] = str(max(0, self.requests_per_day - day_count))
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        return request.client.host if request.client else "unknown"
    
    def _check_rate_limit(self, client_ip: str, current_time: float) -> bool:
        """Check if client is within rate limits."""
        # Clean up old requests
        self._cleanup_old_requests(client_ip, current_time)
        
        # Check minute limit
        minute_window = 60  # 1 minute
        if len(self.minute_requests[client_ip]) >= self.requests_per_minute:
            return False
        
        # Check hour limit
        hour_window = 3600  # 1 hour
        if len(self.hour_requests[client_ip]) >= self.requests_per_hour:
            return False
        
        # Check day limit
        day_window = 86400  # 24 hours
        if len(self.day_requests[client_ip]) >= self.requests_per_day:
            return False
        
        # Add current request
        self.minute_requests[client_ip].append(current_time)
        self.hour_requests[client_ip].append(current_time)
        self.day_requests[client_ip].append(current_time)
        
        return True
    
    def _cleanup_old_requests(self, client_ip: str, current_time: float):
        """Clean up old requests from tracking."""
        # Clean minute requests
        minute_cutoff = current_time - 60
        while (self.minute_requests[client_ip] and 
               self.minute_requests[client_ip][0] < minute_cutoff):
            self.minute_requests[client_ip].popleft()
        
        # Clean hour requests
        hour_cutoff = current_time - 3600
        while (self.hour_requests[client_ip] and 
               self.hour_requests[client_ip][0] < hour_cutoff):
            self.hour_requests[client_ip].popleft()
        
        # Clean day requests
        day_cutoff = current_time - 86400
        while (self.day_requests[client_ip] and 
               self.day_requests[client_ip][0] < day_cutoff):
            self.day_requests[client_ip].popleft()


class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware for security headers and protections."""
    
    def __init__(self, app):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        """Process request with security headers."""
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Remove server information
        response.headers.pop("Server", None)
        
        return response


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware for performance monitoring and optimization."""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_times: Dict[str, list] = defaultdict(list)
        self.slow_request_threshold = 1.0  # 1 second
    
    async def dispatch(self, request: Request, call_next):
        """Process request with performance monitoring."""
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Track performance
        path = request.url.path
        self.request_times[path].append(process_time)
        
        # Keep only last 100 requests per path
        if len(self.request_times[path]) > 100:
            self.request_times[path] = self.request_times[path][-100:]
        
        # Log slow requests
        if process_time > self.slow_request_threshold:
            logger.warning(
                f"Slow request detected: {request.method} {path} - "
                f"{process_time:.3f}s (threshold: {self.slow_request_threshold}s)"
            )
        
        # Add performance headers
        response.headers["X-Performance-Score"] = self._calculate_performance_score(path)
        
        return response
    
    def _calculate_performance_score(self, path: str) -> str:
        """Calculate performance score for a path."""
        times = self.request_times.get(path, [])
        if not times:
            return "N/A"
        
        avg_time = sum(times) / len(times)
        
        if avg_time < 0.1:
            return "A"  # Excellent
        elif avg_time < 0.5:
            return "B"  # Good
        elif avg_time < 1.0:
            return "C"  # Fair
        else:
            return "D"  # Poor


def setup_cors_middleware(app):
    """Setup CORS middleware."""
    app.add_middleware(
        CORSMiddleware,
        **settings.cors_config
    )


def setup_logging_middleware(app):
    """Setup logging middleware."""
    app.add_middleware(RequestLoggingMiddleware)


def setup_rate_limit_middleware(app):
    """Setup rate limiting middleware."""
    if settings.RATE_LIMIT_REQUESTS_PER_MINUTE > 0:
        app.add_middleware(RateLimitMiddleware)


def setup_security_middleware(app):
    """Setup security middleware."""
    app.add_middleware(SecurityMiddleware)


def setup_performance_middleware(app):
    """Setup performance middleware."""
    app.add_middleware(PerformanceMiddleware)


def setup_all_middleware(app):
    """Setup all middleware."""
    setup_cors_middleware(app)
    setup_logging_middleware(app)
    setup_rate_limit_middleware(app)
    setup_security_middleware(app)
    setup_performance_middleware(app)

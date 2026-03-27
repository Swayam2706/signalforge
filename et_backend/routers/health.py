"""
Health Check and Monitoring Router for SignalForge

This module provides health check endpoints and system monitoring.
"""

import time
import psutil
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from config import settings
from db.session import get_db_session
from utils.response import StandardResponse
from utils.cache import get_all_cache_stats
from exceptions import DatabaseError, ExternalAPIError
from data.fetcher import get_single_stock_data

# Create router
router = APIRouter(prefix="/health", tags=["health"])


class HealthCheckService:
    """Service for health check operations."""
    
    def __init__(self):
        self.start_time = time.time()
    
    async def check_database_health(self, db: Session) -> Dict[str, Any]:
        """Check database connectivity and performance."""
        try:
            start_time = time.time()
            
            # Simple query to test connectivity
            result = db.execute(text("SELECT 1"))
            result.fetchone()
            
            query_time = time.time() - start_time
            
            # Get connection pool info if available
            pool_info = {}
            try:
                pool = db.bind.pool
                if pool:
                    pool_info = {
                        "size": pool.size(),
                        "checked_in": pool.checkedin(),
                        "checked_out": pool.checkedout(),
                        "overflow": pool.overflow(),
                        "invalid": pool.invalid()
                    }
            except:
                pass
            
            return {
                "status": "healthy",
                "query_time_ms": round(query_time * 1000, 2),
                "connection_pool": pool_info,
                "timestamp": time.time()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
    
    async def check_cache_health(self) -> Dict[str, Any]:
        """Check cache system health."""
        try:
            cache_stats = get_all_cache_stats()
            
            # Calculate total cache health
            total_items = cache_stats.get("total_items", 0)
            total_hits = sum(
                stats.get("hits", 0) 
                for stats in cache_stats.values() 
                if isinstance(stats, dict) and "hits" in stats
            )
            total_misses = sum(
                stats.get("misses", 0) 
                for stats in cache_stats.values() 
                if isinstance(stats, dict) and "misses" in stats
            )
            
            total_requests = total_hits + total_misses
            hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
            
            return {
                "status": "healthy",
                "total_items": total_items,
                "hit_rate_percent": round(hit_rate, 2),
                "cache_stats": cache_stats,
                "timestamp": time.time()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
    
    async def check_external_apis_health(self) -> Dict[str, Any]:
        """Check external API connectivity."""
        try:
            # Test yfinance API with a simple request
            start_time = time.time()
            
            test_data = get_single_stock_data("RELIANCE.NS")
            
            api_time = time.time() - start_time
            
            if test_data and not test_data.get("error"):
                return {
                    "status": "healthy",
                    "yfinance_api": {
                        "status": "healthy",
                        "response_time_ms": round(api_time * 1000, 2),
                        "test_symbol": "RELIANCE.NS",
                        "data_received": bool(test_data)
                    },
                    "timestamp": time.time()
                }
            else:
                return {
                    "status": "degraded",
                    "yfinance_api": {
                        "status": "unhealthy",
                        "error": test_data.get("error", "Unknown error"),
                        "response_time_ms": round(api_time * 1000, 2)
                    },
                    "timestamp": time.time()
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "yfinance_api": {
                    "status": "unhealthy",
                    "error": str(e)
                },
                "timestamp": time.time()
            }
    
    async def check_system_health(self) -> Dict[str, Any]:
        """Check system resources and performance."""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk usage
            disk = psutil.disk_usage('/')
            
            # Process info
            process = psutil.Process()
            process_memory = process.memory_info()
            
            return {
                "status": "healthy",
                "cpu": {
                    "percent": cpu_percent,
                    "count": psutil.cpu_count()
                },
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "percent": memory.percent,
                    "used_gb": round(memory.used / (1024**3), 2)
                },
                "disk": {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "percent": (disk.used / disk.total) * 100
                },
                "process": {
                    "pid": process.pid,
                    "memory_mb": round(process_memory.rss / (1024**2), 2),
                    "cpu_percent": process.cpu_percent()
                },
                "uptime_seconds": round(time.time() - self.start_time, 2),
                "timestamp": time.time()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
    
    async def get_application_health(self) -> Dict[str, Any]:
        """Get application-level health information."""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "debug_mode": settings.DEBUG,
            "uptime_seconds": round(time.time() - self.start_time, 2),
            "timestamp": time.time()
        }


# Global health check service
health_service = HealthCheckService()


@router.get("/")
async def health_check(db: Session = Depends(get_db_session)):
    """
    Comprehensive health check endpoint.
    
    Returns:
        Overall system health status
    """
    try:
        # Run all health checks concurrently
        db_health, cache_health, api_health, system_health, app_health = await asyncio.gather(
            health_service.check_database_health(db),
            health_service.check_cache_health(),
            health_service.check_external_apis_health(),
            health_service.check_system_health(),
            health_service.get_application_health(),
            return_exceptions=True
        )
        
        # Determine overall status
        checks = {
            "database": db_health,
            "cache": cache_health,
            "external_apis": api_health,
            "system": system_health,
            "application": app_health
        }
        
        # Calculate overall status
        unhealthy_count = sum(
            1 for check in checks.values() 
            if isinstance(check, dict) and check.get("status") == "unhealthy"
        )
        degraded_count = sum(
            1 for check in checks.values() 
            if isinstance(check, dict) and check.get("status") == "degraded"
        )
        
        if unhealthy_count > 0:
            overall_status = "unhealthy"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE
        elif degraded_count > 0:
            overall_status = "degraded"
            http_status = status.HTTP_200_OK
        else:
            overall_status = "healthy"
            http_status = status.HTTP_200_OK
        
        health_data = {
            "status": overall_status,
            "checks": checks,
            "summary": {
                "total_checks": len(checks),
                "healthy": len([c for c in checks.values() if isinstance(c, dict) and c.get("status") == "healthy"]),
                "degraded": degraded_count,
                "unhealthy": unhealthy_count
            }
        }
        
        return StandardResponse.success(health_data, f"System health: {overall_status}")
        
    except Exception as e:
        return StandardResponse.server_error(f"Health check failed: {str(e)}")


@router.get("/database")
async def database_health_check(db: Session = Depends(get_db_session)):
    """
    Database health check endpoint.
    
    Returns:
        Database health status
    """
    try:
        db_health = await health_service.check_database_health(db)
        
        if db_health["status"] == "healthy":
            return StandardResponse.success(db_health, "Database is healthy")
        else:
            return StandardResponse.error(
                message="Database is unhealthy",
                error_code="DB_UNHEALTHY",
                details=db_health
            )
            
    except Exception as e:
        return StandardResponse.server_error(f"Database health check failed: {str(e)}")


@router.get("/cache")
async def cache_health_check():
    """
    Cache health check endpoint.
    
    Returns:
        Cache system health status
    """
    try:
        cache_health = await health_service.check_cache_health()
        
        if cache_health["status"] == "healthy":
            return StandardResponse.success(cache_health, "Cache system is healthy")
        else:
            return StandardResponse.error(
                message="Cache system is unhealthy",
                error_code="CACHE_UNHEALTHY",
                details=cache_health
            )
            
    except Exception as e:
        return StandardResponse.server_error(f"Cache health check failed: {str(e)}")


@router.get("/external-apis")
async def external_apis_health_check():
    """
    External APIs health check endpoint.
    
    Returns:
        External API connectivity status
    """
    try:
        api_health = await health_service.check_external_apis_health()
        
        if api_health["status"] == "healthy":
            return StandardResponse.success(api_health, "External APIs are healthy")
        else:
            return StandardResponse.error(
                message="External APIs are unhealthy",
                error_code="EXTERNAL_APIS_UNHEALTHY",
                details=api_health
            )
            
    except Exception as e:
        return StandardResponse.server_error(f"External APIs health check failed: {str(e)}")


@router.get("/system")
async def system_health_check():
    """
    System health check endpoint.
    
    Returns:
        System resources health status
    """
    try:
        system_health = await health_service.check_system_health()
        
        if system_health["status"] == "healthy":
            return StandardResponse.success(system_health, "System is healthy")
        else:
            return StandardResponse.error(
                message="System is unhealthy",
                error_code="SYSTEM_UNHEALTHY",
                details=system_health
            )
            
    except Exception as e:
        return StandardResponse.server_error(f"System health check failed: {str(e)}")


@router.get("/readiness")
async def readiness_check(db: Session = Depends(get_db_session)):
    """
    Readiness check for Kubernetes/container orchestration.
    
    Returns:
        Application readiness status
    """
    try:
        # Check critical dependencies
        db_health = await health_service.check_database_health(db)
        
        if db_health["status"] != "healthy":
            return StandardResponse.error(
                message="Application not ready",
                error_code="NOT_READY",
                details={"database": db_health}
            )
        
        return StandardResponse.success(
            {"ready": True, "timestamp": time.time()},
            "Application is ready"
        )
        
    except Exception as e:
        return StandardResponse.server_error(f"Readiness check failed: {str(e)}")


@router.get("/liveness")
async def liveness_check():
    """
    Liveness check for Kubernetes/container orchestration.
    
    Returns:
        Application liveness status
    """
    try:
        # Simple check to see if the application is responsive
        uptime = time.time() - health_service.start_time
        
        return StandardResponse.success(
            {
                "alive": True,
                "uptime_seconds": round(uptime, 2),
                "timestamp": time.time()
            },
            "Application is alive"
        )
        
    except Exception as e:
        return StandardResponse.server_error(f"Liveness check failed: {str(e)}")


@router.get("/metrics")
async def get_metrics():
    """
    Basic metrics endpoint.
    
    Returns:
        Application metrics
    """
    try:
        # Collect basic metrics
        system_health = await health_service.check_system_health()
        cache_health = await health_service.check_cache_health()
        
        metrics = {
            "system": system_health,
            "cache": cache_health,
            "application": await health_service.get_application_health()
        }
        
        return StandardResponse.success(metrics, "Metrics retrieved")
        
    except Exception as e:
        return StandardResponse.server_error(f"Metrics collection failed: {str(e)}")

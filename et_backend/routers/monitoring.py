"""
Monitoring Router for SignalForge

This module provides endpoints for monitoring system performance and health.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime
import psutil
import time

from utils.cache import get_all_cache_stats, cleanup_expired_cache
from utils.logger import get_logger

# Create router
router = APIRouter(prefix="/monitoring", tags=["monitoring"])
logger = get_logger(__name__)


@router.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.
    
    Returns:
        System health status with detailed metrics
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "uptime_seconds": time.time() - psutil.boot_time(),
            "system": {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage_percent": psutil.disk_usage('/').percent
            },
            "cache_stats": get_all_cache_stats(),
            "checks": {
                "database": "healthy",  # Could be enhanced with actual DB health check
                "cache": "healthy",
                "external_apis": "healthy"  # Could be enhanced with actual API checks
            }
        }
        
        # Determine overall health
        if health_status["system"]["cpu_percent"] > 90:
            health_status["status"] = "degraded"
            health_status["checks"]["system"] = "high_cpu"
        
        if health_status["system"]["memory_percent"] > 90:
            health_status["status"] = "degraded"
            health_status["checks"]["system"] = "high_memory"
        
        if health_status["system"]["disk_usage_percent"] > 90:
            health_status["status"] = "degraded"
            health_status["checks"]["system"] = "low_disk"
        
        return health_status
        
    except Exception as e:
        logger.logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Health check failed")


@router.get("/performance")
async def get_performance_metrics():
    """
    Get detailed performance metrics.
    
    Returns:
        Performance metrics and statistics
    """
    try:
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get network stats
        network = psutil.net_io_counters()
        
        # Get process info
        process = psutil.Process()
        process_memory = process.memory_info()
        
        performance_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "system": {
                "cpu": {
                    "percent": cpu_percent,
                    "count": psutil.cpu_count()
                },
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "percent": memory.percent,
                    "used": memory.used
                },
                "disk": {
                    "total": disk.total,
                    "free": disk.free,
                    "percent": (disk.used / disk.total) * 100,
                    "used": disk.used
                },
                "network": {
                    "bytes_sent": network.bytes_sent,
                    "bytes_recv": network.bytes_recv,
                    "packets_sent": network.packets_sent,
                    "packets_recv": network.packets_recv
                }
            },
            "process": {
                "pid": process.pid,
                "memory": {
                    "rss": process_memory.rss,
                    "vms": process_memory.vms
                },
                "cpu_percent": process.cpu_percent(),
                "create_time": process.create_time(),
                "num_threads": process.num_threads()
            },
            "cache": get_all_cache_stats()
        }
        
        return performance_data
        
    except Exception as e:
        logger.logger.error(f"Performance metrics failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get performance metrics")


@router.get("/cache/stats")
async def get_cache_statistics():
    """
    Get detailed cache statistics.
    
    Returns:
        Cache performance statistics
    """
    try:
        cache_stats = get_all_cache_stats()
        
        # Calculate additional metrics
        total_requests = sum(
            stats['hits'] + stats['misses'] 
            for stats in cache_stats.values()
            if isinstance(stats, dict)
        )
        
        total_hits = sum(
            stats['hits'] 
            for stats in cache_stats.values()
            if isinstance(stats, dict)
        )
        
        overall_hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
        
        cache_info = {
            "timestamp": datetime.utcnow().isoformat(),
            "cache_stats": cache_stats,
            "summary": {
                "total_requests": total_requests,
                "total_hits": total_hits,
                "overall_hit_rate_percent": round(overall_hit_rate, 2),
                "total_cached_items": cache_stats.get('total_items', 0)
            }
        }
        
        return cache_info
        
    except Exception as e:
        logger.logger.error(f"Cache statistics failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get cache statistics")


@router.post("/cache/clear")
async def clear_all_caches():
    """
    Clear all cache instances.
    
    Returns:
        Cache clearing result
    """
    try:
        from utils.cache import stock_data_cache, signal_cache, portfolio_cache, api_response_cache
        
        cleared_items = 0
        cleared_items += len(stock_data_cache._cache)
        cleared_items += len(signal_cache._cache)
        cleared_items += len(portfolio_cache._cache)
        cleared_items += len(api_response_cache._cache)
        
        # Clear all caches
        stock_data_cache.clear()
        signal_cache.clear()
        portfolio_cache.clear()
        api_response_cache.clear()
        
        result = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "cleared_items": cleared_items,
            "message": f"Cleared {cleared_items} items from all caches"
        }
        
        logger.logger.info(f"All caches cleared: {cleared_items} items")
        
        return result
        
    except Exception as e:
        logger.logger.error(f"Cache clear failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear caches")


@router.post("/cache/cleanup")
async def cleanup_expired_caches():
    """
    Clean up expired items from all cache instances.
    
    Returns:
        Cleanup result
    """
    try:
        cleaned_items = cleanup_expired_cache()
        
        result = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "cleaned_items": cleaned_items,
            "message": f"Cleaned up {cleaned_items} expired items from caches"
        }
        
        return result
        
    except Exception as e:
        logger.logger.error(f"Cache cleanup failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cleanup caches")


@router.get("/logs/recent")
async def get_recent_logs(lines: int = 50):
    """
    Get recent log entries (placeholder implementation).
    
    Args:
        lines: Number of recent log lines to return
        
    Returns:
        Recent log entries
    """
    # This is a placeholder - in production, you'd implement actual log reading
    return {
        "success": True,
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Log reading not implemented in this demo",
        "requested_lines": lines
    }


@router.get("/metrics")
async def get_application_metrics():
    """
    Get application-level metrics.
    
    Returns:
        Application performance metrics
    """
    try:
        # This would be enhanced with actual metrics collection
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "api_endpoints": {
                "/scan": {"calls": 0, "avg_response_time_ms": 0},
                "/stock/{symbol}": {"calls": 0, "avg_response_time_ms": 0},
                "/portfolio": {"calls": 0, "avg_response_time_ms": 0},
                "/assistant/chat": {"calls": 0, "avg_response_time_ms": 0}
            },
            "errors": {
                "total_errors": 0,
                "error_rate_percent": 0,
                "last_error": None
            },
            "performance": {
                "avg_response_time_ms": 0,
                "p95_response_time_ms": 0,
                "p99_response_time_ms": 0
            }
        }
        
        return metrics
        
    except Exception as e:
        logger.logger.error(f"Application metrics failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get application metrics")


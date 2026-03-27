"""
Cache Utility for SignalForge

This module provides caching functionality for performance optimization.
"""

import time
import hashlib
import json
import logging
from typing import Any, Optional, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class SimpleCache:
    """
    Simple in-memory cache with TTL support.
    
    Provides thread-safe caching with automatic cleanup of expired items.
    """
    
    def __init__(self, default_ttl: int = 300):
        """
        Initialize cache with default TTL.
        
        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
        """
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._default_ttl = default_ttl
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'evictions': 0
        }
    
    def _generate_key(self, key: str, **kwargs) -> str:
        """
        Generate cache key from base key and additional parameters.
        
        Args:
            key: Base cache key
            **kwargs: Additional parameters to include in key
            
        Returns:
            Generated cache key
        """
        if kwargs:
            # Sort kwargs to ensure consistent key generation
            sorted_kwargs = sorted(kwargs.items())
            key_data = f"{key}:{json.dumps(sorted_kwargs, sort_keys=True)}"
        else:
            key_data = key
        
        # Use hash for consistent key length
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str, **kwargs) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            **kwargs: Additional parameters for key generation
            
        Returns:
            Cached value or None if not found/expired
        """
        cache_key = self._generate_key(key, **kwargs)
        
        if cache_key not in self._cache:
            self._stats['misses'] += 1
            return None
        
        cache_item = self._cache[cache_key]
        
        # Check if expired
        if time.time() > cache_item['expires_at']:
            del self._cache[cache_key]
            self._stats['evictions'] += 1
            self._stats['misses'] += 1
            return None
        
        self._stats['hits'] += 1
        logger.debug(f"Cache hit for key: {key}")
        return cache_item['value']
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None, **kwargs) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if None)
            **kwargs: Additional parameters for key generation
        """
        cache_key = self._generate_key(key, **kwargs)
        ttl = ttl or self._default_ttl
        
        cache_item = {
            'value': value,
            'created_at': time.time(),
            'expires_at': time.time() + ttl,
            'ttl': ttl,
            'key': key
        }
        
        self._cache[cache_key] = cache_item
        self._stats['sets'] += 1
        logger.debug(f"Cache set for key: {key}, TTL: {ttl}s")
    
    def delete(self, key: str, **kwargs) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            **kwargs: Additional parameters for key generation
            
        Returns:
            True if item was deleted, False if not found
        """
        cache_key = self._generate_key(key, **kwargs)
        
        if cache_key in self._cache:
            del self._cache[cache_key]
            logger.debug(f"Cache delete for key: {key}")
            return True
        
        return False
    
    def clear(self) -> None:
        """Clear all cache items."""
        cleared_count = len(self._cache)
        self._cache.clear()
        logger.info(f"Cache cleared: {cleared_count} items removed")
    
    def cleanup_expired(self) -> int:
        """
        Remove expired items from cache.
        
        Returns:
            Number of items removed
        """
        current_time = time.time()
        expired_keys = [
            key for key, item in self._cache.items()
            if current_time > item['expires_at']
        ]
        
        for key in expired_keys:
            del self._cache[key]
        
        if expired_keys:
            self._stats['evictions'] += len(expired_keys)
            logger.info(f"Cache cleanup: {len(expired_keys)} expired items removed")
        
        return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Cache statistics dictionary
        """
        total_requests = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'hits': self._stats['hits'],
            'misses': self._stats['misses'],
            'sets': self._stats['sets'],
            'evictions': self._stats['evictions'],
            'hit_rate_percent': round(hit_rate, 2),
            'total_items': len(self._cache),
            'memory_usage_estimate': len(str(self._cache))  # Rough estimate
        }
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get detailed cache information.
        
        Returns:
            Detailed cache information
        """
        current_time = time.time()
        
        # Calculate time until next expiration
        next_expiration = None
        if self._cache:
            next_expiration = min(item['expires_at'] for item in self._cache.values())
            next_expiration = max(0, next_expiration - current_time)
        
        return {
            'default_ttl': self._default_ttl,
            'total_items': len(self._cache),
            'next_expiration_in_seconds': next_expiration,
            'stats': self.get_stats(),
            'oldest_item_age_seconds': min(
                current_time - item['created_at'] 
                for item in self._cache.values()
            ) if self._cache else 0
        }


# Global cache instances
stock_data_cache = SimpleCache(default_ttl=600)  # 10 minutes for stock data
signal_cache = SimpleCache(default_ttl=300)      # 5 minutes for signals
portfolio_cache = SimpleCache(default_ttl=180)   # 3 minutes for portfolio data
api_response_cache = SimpleCache(default_ttl=60)  # 1 minute for API responses


def cache_result(cache_instance: SimpleCache, ttl: Optional[int] = None):
    """
    Decorator for caching function results.
    
    Args:
        cache_instance: Cache instance to use
        ttl: Time-to-live in seconds
        
    Returns:
        Decorated function
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            
            # Try to get from cache
            cached_result = cache_instance.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache_instance.set(cache_key, result, ttl=ttl)
            
            return result
        
        wrapper.cache_info = lambda: cache_instance.get_info()
        wrapper.cache_clear = lambda: cache_instance.clear()
        wrapper.cache_stats = lambda: cache_instance.get_stats()
        
        return wrapper
    
    return decorator


# Cache cleanup task
def cleanup_expired_cache():
    """Clean up expired items in all cache instances."""
    global stock_data_cache, signal_cache, portfolio_cache, api_response_cache
    
    total_cleaned = 0
    total_cleaned += stock_data_cache.cleanup_expired()
    total_cleaned += signal_cache.cleanup_expired()
    total_cleaned += portfolio_cache.cleanup_expired()
    total_cleaned += api_response_cache.cleanup_expired()
    
    if total_cleaned > 0:
        logger.info(f"Cache cleanup completed: {total_cleaned} items removed")
    
    return total_cleaned


def get_all_cache_stats() -> Dict[str, Any]:
    """
    Get statistics for all cache instances.
    
    Returns:
        Combined cache statistics
    """
    return {
        'stock_data_cache': stock_data_cache.get_stats(),
        'signal_cache': signal_cache.get_stats(),
        'portfolio_cache': portfolio_cache.get_stats(),
        'api_response_cache': api_response_cache.get_stats(),
        'total_items': sum([
            len(stock_data_cache._cache),
            len(signal_cache._cache),
            len(portfolio_cache._cache),
            len(api_response_cache._cache)
        ])
    }

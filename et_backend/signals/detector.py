"""
Signal Detection Engine for SignalForge

This module analyzes stock data to detect meaningful market signals.
It identifies patterns like breakouts, momentum, and weak signals.
"""

from typing import Dict, List, Tuple


def validate_stock_data(data: dict) -> bool:
    """Validate that stock data has required fields."""
    return bool(data and data.get('current_price', 0) > 0)


def calculate_price_change(current_price: float, previous_close: float) -> float:
    """
    Calculate percentage change between current price and previous close.
    
    Args:
        current_price: Current stock price
        previous_close: Previous day's closing price
        
    Returns:
        Percentage change (positive for gain, negative for loss)
    """
    if previous_close == 0:
        return 0.0
    
    return ((current_price - previous_close) / previous_close) * 100


def detect_volume_spike(current_volume: int, historical_volumes: List[int]) -> bool:
    """
    Detect if current volume shows a significant spike.
    
    Args:
        current_volume: Current day's trading volume
        historical_volumes: List of historical volumes
        
    Returns:
        True if volume spike detected, False otherwise
    """
    if not historical_volumes or current_volume == 0:
        return False
    
    # Calculate average of historical volumes
    avg_volume = sum(historical_volumes) / len(historical_volumes)
    
    # Volume spike if current volume is 50% higher than average
    return current_volume > (avg_volume * 1.5)


def estimate_volume_spike(current_volume: int) -> bool:
    """
    Estimate volume spike when historical data not available.
    Uses simple thresholds based on volume levels.
    
    Args:
        current_volume: Current day's trading volume
        
    Returns:
        True if volume spike estimated, False otherwise
    """
    # Simple volume thresholds for Indian stocks
    if current_volume > 5000000:  # Very high volume
        return True
    elif current_volume > 2000000:  # High volume
        return True
    else:
        return False


def analyze_trend(closing_prices: List[float]) -> str:
    """
    Analyze trend based on last 3-5 days of closing prices.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        Trend type: 'uptrend', 'sideways', 'downtrend', 'weak'
    """
    if len(closing_prices) < 3:
        return 'weak'
    
    # Use last 5 days for analysis
    prices = closing_prices[-5:] if len(closing_prices) >= 5 else closing_prices
    
    # Calculate daily changes
    changes = []
    for i in range(1, len(prices)):
        change = (prices[i] - prices[i-1]) / prices[i-1] * 100
        changes.append(change)
    
    if not changes:
        return 'weak'
    
    # Count up vs down days
    up_days = sum(1 for change in changes if change > 0)
    down_days = sum(1 for change in changes if change < 0)
    total_days = len(changes)
    
    # Calculate overall change
    total_change = ((prices[-1] - prices[0]) / prices[0]) * 100
    
    # Determine trend with clear conditions
    up_ratio = up_days / total_days
    
    if up_ratio >= 0.75 and total_change > 1.0:
        return 'uptrend'
    elif up_ratio <= 0.25 and total_change < -1.0:
        return 'downtrend'
    elif 0.4 <= up_ratio <= 0.6 and abs(total_change) < 1.0:
        return 'sideways'
    else:
        return 'weak'


def is_sideways_breakout(closing_prices: List[float], price_change: float) -> bool:
    """
    Check if current price movement is a breakout from sideways pattern.
    
    Args:
        closing_prices: List of closing prices
        price_change: Current price change percentage
        
    Returns:
        True if sideways breakout detected
    """
    if len(closing_prices) < 4:
        return False
    
    # Check if previous days were sideways
    previous_prices = closing_prices[:-1]  # Exclude current day
    trend = analyze_trend(previous_prices)
    
    # Sideways breakout if previous trend was sideways and current change is significant
    return trend == 'sideways' and price_change > 1.5


def detect_signal(stock_data: Dict) -> Dict:
    """
    Main signal detection function with clear classification logic.
    
    Args:
        stock_data: Dictionary containing stock data from fetcher
        
    Returns:
        Signal analysis dictionary with:
        - signal_type: 'Breakout', 'Momentum', or 'Weak'
        - price_change: Percentage change
        - volume_spike: Boolean
        - trend: Trend analysis
        - confidence: Signal confidence level
    """
    # Validate input data
    if not validate_stock_data(stock_data):
        return {
            'signal_type': 'Weak',
            'price_change': 0.0,
            'volume_spike': False,
            'trend': 'weak',
            'confidence': 0
        }
    
    # Extract data
    current_price = stock_data['current_price']
    previous_close = stock_data['previous_close']
    current_volume = stock_data['volume']
    closing_prices = stock_data['last_5_days_closes']
    
    # Calculate metrics
    price_change = calculate_price_change(current_price, previous_close)
    trend = analyze_trend(closing_prices)
    volume_spike = estimate_volume_spike(current_volume)
    sideways_breakout = is_sideways_breakout(closing_prices, price_change)
    
    # Clear signal classification logic
    signal_type = 'Weak'
    confidence = 0
    
    # BREAKOUT: Strong price + strong volume + sideways breakout
    if (price_change >= 2.0 and volume_spike and sideways_breakout):
        signal_type = 'Breakout'
        confidence = 85
    
    # MOMENTUM: Steady upward trend + moderate volume + decent price change
    elif (trend == 'uptrend' and current_volume > 1000000 and price_change >= 1.0):
        signal_type = 'Momentum'
        confidence = 70
    
    # MODERATE MOMENTUM: Some upward movement with volume
    elif (trend in ['uptrend', 'sideways'] and current_volume > 500000 and price_change >= 0.8):
        signal_type = 'Momentum'
        confidence = 55
    
    # WEAK: Minimal movement or no confirmation
    elif (price_change >= 0.3):
        signal_type = 'Weak'
        confidence = 30
    
    # VERY WEAK: No meaningful movement
    else:
        signal_type = 'Weak'
        confidence = 15
    
    return {
        'signal_type': signal_type,
        'price_change': round(price_change, 2),
        'volume_spike': volume_spike,
        'trend': trend,
        'confidence': confidence
    }


def detect_signals_batch(stocks_data: Dict[str, Dict]) -> Dict[str, Dict]:
    """
    Detect signals for multiple stocks.
    
    Args:
        stocks_data: Dictionary with stock data for multiple symbols
        
    Returns:
        Dictionary with signal analysis for each symbol
    """
    results = {}
    
    for symbol, stock_data in stocks_data.items():
        results[symbol] = detect_signal(stock_data)
    
    return results

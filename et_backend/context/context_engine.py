"""
Context Engine for SignalForge

This module analyzes historical price behavior and generates meaningful
context explanations for detected signals.
"""

from typing import List, Dict
import statistics


def detect_sideways_behavior(closing_prices: List[float]) -> bool:
    """
    Detect if the stock has been moving sideways.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        True if sideways behavior detected, False otherwise
    """
    if len(closing_prices) < 3:
        return False
    
    # Calculate price range
    min_price = min(closing_prices)
    max_price = max(closing_prices)
    price_range = max_price - min_price
    
    # Calculate average price
    avg_price = statistics.mean(closing_prices)
    
    # Sideways if range is less than 3% of average price
    range_percentage = (price_range / avg_price) * 100
    return range_percentage < 3.0


def detect_trend_strength(closing_prices: List[float]) -> str:
    """
    Analyze the strength and direction of price trend.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        Trend strength: 'strong_up', 'moderate_up', 'weak_up', 'strong_down', 'moderate_down', 'weak_down'
    """
    if len(closing_prices) < 3:
        return 'weak_up'
    
    # Calculate overall trend
    first_price = closing_prices[0]
    last_price = closing_prices[-1]
    total_change = ((last_price - first_price) / first_price) * 100
    
    # Calculate daily volatility
    daily_changes = []
    for i in range(1, len(closing_prices)):
        change = abs((closing_prices[i] - closing_prices[i-1]) / closing_prices[i-1] * 100)
        daily_changes.append(change)
    
    avg_volatility = statistics.mean(daily_changes) if daily_changes else 0
    
    # Determine trend strength based on change and volatility
    if total_change > 0:
        if total_change > 5.0 and avg_volatility < 2.0:
            return 'strong_up'
        elif total_change > 2.0:
            return 'moderate_up'
        else:
            return 'weak_up'
    else:
        if total_change < -5.0 and avg_volatility < 2.0:
            return 'strong_down'
        elif total_change < -2.0:
            return 'moderate_down'
        else:
            return 'weak_down'


def count_consecutive_moves(closing_prices: List[float]) -> Dict[str, int]:
    """
    Count consecutive up and down moves.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        Dictionary with consecutive up/down moves
    """
    if len(closing_prices) < 2:
        return {'consecutive_up': 0, 'consecutive_down': 0, 'total_moves': 0}
    
    consecutive_up = 0
    consecutive_down = 0
    current_up_streak = 0
    current_down_streak = 0
    
    for i in range(1, len(closing_prices)):
        if closing_prices[i] > closing_prices[i-1]:
            current_up_streak += 1
            current_down_streak = 0
            consecutive_up = max(consecutive_up, current_up_streak)
        elif closing_prices[i] < closing_prices[i-1]:
            current_down_streak += 1
            current_up_streak = 0
            consecutive_down = max(consecutive_down, current_down_streak)
        else:
            current_up_streak = 0
            current_down_streak = 0
    
    return {
        'consecutive_up': consecutive_up,
        'consecutive_down': consecutive_down,
        'total_moves': len(closing_prices) - 1
    }


def detect_uptrend(closing_prices: List[float]) -> bool:
    """
    Detect if the stock is in an uptrend.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        True if uptrend detected, False otherwise
    """
    if len(closing_prices) < 3:
        return False
    
    # Check if at least 3 out of last 4 days are up
    up_days = 0
    for i in range(1, len(closing_prices)):
        if closing_prices[i] > closing_prices[i-1]:
            up_days += 1
    
    return up_days >= (len(closing_prices) - 1) * 0.75


def detect_weak_movement(closing_prices: List[float]) -> bool:
    """
    Detect if the stock shows weak/unclear movement.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        True if weak movement detected, False otherwise
    """
    if len(closing_prices) < 3:
        return True
    
    # Calculate daily changes
    daily_changes = []
    for i in range(1, len(closing_prices)):
        change = abs((closing_prices[i] - closing_prices[i-1]) / closing_prices[i-1] * 100)
        daily_changes.append(change)
    
    # Weak if average daily change is less than 0.5%
    avg_change = statistics.mean(daily_changes)
    return avg_change < 0.5


def detect_breakout_pattern(closing_prices: List[float], current_price_change: float) -> bool:
    """
    Detect breakout pattern: sideways movement followed by significant jump.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        current_price_change: Current day's price change percentage
        
    Returns:
        True if breakout pattern detected, False otherwise
    """
    if len(closing_prices) < 4:
        return False
    
    # Check if first 3-4 days were sideways
    sideways_period = closing_prices[:-1]  # Exclude current day
    is_sideways = detect_sideways_behavior(sideways_period)
    
    # Check if current day shows significant jump
    significant_jump = current_price_change > 1.5
    
    return is_sideways and significant_jump


def analyze_price_behavior(closing_prices: List[float]) -> str:
    """
    Analyze overall price behavior pattern.
    
    Args:
        closing_prices: List of closing prices (oldest to newest)
        
    Returns:
        Behavior type: 'sideways', 'uptrend', 'weak_movement'
    """
    if detect_sideways_behavior(closing_prices):
        return 'sideways'
    elif detect_uptrend(closing_prices):
        return 'uptrend'
    elif detect_weak_movement(closing_prices):
        return 'weak_movement'
    else:
        return 'mixed'


def generate_context(signal_type: str, closing_prices: List[float], price_change: float) -> str:
    """
    Generate meaningful context explanation for the signal.
    
    Args:
        signal_type: Type of signal ('Breakout', 'Momentum', 'Weak')
        closing_prices: Historical closing prices
        price_change: Current price change percentage
        
    Returns:
        Context explanation string
    """
    if not closing_prices:
        return "Insufficient historical data for context analysis."
    
    # Analyze price behavior
    behavior = analyze_price_behavior(closing_prices)
    is_breakout = detect_breakout_pattern(closing_prices, price_change)
    consecutive_moves = count_consecutive_moves(closing_prices)
    
    # Generate natural language explanations with stronger market context
    if signal_type == 'Breakout':
        if is_breakout:
            return f"After several days of consolidation, the stock broke out with strong momentum"
        elif behavior == 'sideways':
            return f"Breaking out of extended sideways consolidation with {price_change:.1f}% upward movement"
        elif consecutive_moves['consecutive_down'] >= 2:
            return f"Reversing {consecutive_moves['consecutive_down']}-day decline with explosive breakout momentum"
        else:
            return f"Strong breakout detected as stock overcomes previous resistance levels"
    
    elif signal_type == 'Momentum':
        if behavior == 'uptrend':
            if consecutive_moves['consecutive_up'] >= 3:
                return f"The stock shows steady upward trend with increasing strength and market participation"
            else:
                return f"Continuing upward momentum with consistent buying interest and volume support"
        elif behavior == 'sideways':
            return f"Building momentum as stock breaks out of consolidation with growing conviction"
        else:
            return f"Developing upward momentum with increasing institutional accumulation"
    
    else:  # Weak signal
        if behavior == 'sideways':
            return f"Price moved up but without strong volume confirmation or market conviction"
        elif behavior == 'weak_movement':
            return f"Minimal price action with no clear directional movement or institutional interest"
        elif price_change > 0:
            return f"Slight upward movement but lacking strong market participation or conviction"
        else:
            return f"Weak signal with no clear market direction or institutional backing"


def generate_volume_context(volume_spike: bool, signal_type: str) -> str:
    """
    Generate volume-related context.
    
    Args:
        volume_spike: Whether volume spike was detected
        signal_type: Type of signal
        
    Returns:
        Volume context string
    """
    if volume_spike:
        if signal_type == 'Breakout':
            return "supported by high trading volume, indicating strong buying interest"
        elif signal_type == 'Momentum':
            return "with increasing trading participation"
        else:
            return "with elevated trading activity"
    else:
        if signal_type in ['Breakout', 'Momentum']:
            return "but without strong volume confirmation"
        else:
            return "with normal trading volume"


def generate_full_context(signal_type: str, closing_prices: List[float], 
                          price_change: float, volume_spike: bool) -> str:
    """
    Generate comprehensive context explanation.
    
    Args:
        signal_type: Type of signal
        closing_prices: Historical closing prices
        price_change: Current price change percentage
        volume_spike: Whether volume spike was detected
        
    Returns:
        Complete context explanation
    """
    price_context = generate_context(signal_type, closing_prices, price_change)
    volume_context = generate_volume_context(volume_spike, signal_type)
    
    # Combine contexts
    if volume_spike:
        return f"{price_context}, {volume_context}"
    else:
        return f"{price_context}, {volume_context}"

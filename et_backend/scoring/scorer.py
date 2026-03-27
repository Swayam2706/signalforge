"""
Scoring System for SignalForge

This module assigns confidence scores to detected signals based on
price strength, volume confirmation, and trend consistency.
"""

from typing import Dict, Tuple


def calculate_price_score(price_change: float) -> float:
    """
    Calculate price strength score (0-30 points) based on percentage change.
    
    Args:
        price_change: Percentage change in price
        
    Returns:
        Price score from 0 to 30
    """
    if price_change <= 0:
        return 0.0
    elif price_change <= 0.5:
        return 3.0
    elif price_change <= 1.0:
        return 8.0
    elif price_change <= 1.5:
        return 12.0
    elif price_change <= 2.0:
        return 18.0
    elif price_change <= 3.0:
        return 24.0
    elif price_change <= 4.0:
        return 27.0
    else:
        return 30.0


def calculate_volume_score(current_volume: int, volume_spike: bool) -> float:
    """
    Calculate volume strength score (0-40 points) based on volume spike ratio.
    
    Args:
        current_volume: Current trading volume
        volume_spike: Whether volume spike was detected
        
    Returns:
        Volume score from 0 to 40
    """
    if volume_spike:
        # Maximum points for confirmed volume spike
        return 40.0
    elif current_volume >= 5000000:
        # Very high volume
        return 32.0
    elif current_volume >= 2000000:
        # High volume
        return 25.0
    elif current_volume >= 1000000:
        # Moderate volume
        return 18.0
    elif current_volume >= 500000:
        # Low volume
        return 10.0
    else:
        # Very low volume
        return 5.0


def calculate_trend_score(trend: str, signal_type: str) -> float:
    """
    Calculate trend strength score (0-30 points) based on trend consistency.
    
    Args:
        trend: Trend analysis result ('uptrend', 'sideways', 'downtrend', 'weak')
        signal_type: Type of signal detected
        
    Returns:
        Trend score from 0 to 30
    """
    # Base scores for different trend types
    trend_scores = {
        'uptrend': 25.0,
        'sideways': 15.0,
        'downtrend': 8.0,
        'weak': 5.0
    }
    
    base_score = trend_scores.get(trend, 5.0)
    
    # Bonus points for signal-trend alignment
    if signal_type == 'Breakout' and trend == 'sideways':
        base_score += 5.0  # Breakout from sideways is ideal
    elif signal_type == 'Momentum' and trend == 'uptrend':
        base_score += 5.0  # Momentum with uptrend is ideal
    elif signal_type == 'Weak':
        base_score = min(base_score, 10.0)  # Cap weak signals
    
    return min(base_score, 30.0)


def classify_strength(total_score: float) -> str:
    """
    Classify signal strength based on total score.
    
    Args:
        total_score: Total confidence score (0-100)
        
    Returns:
        Strength classification: 'Strong', 'Moderate', or 'Weak'
    """
    if total_score >= 70:
        return 'Strong'
    elif total_score >= 50:
        return 'Moderate'
    else:
        return 'Weak'


def calculate_simple_score(price_change: float, current_volume: int, 
                           volume_spike: bool, trend: str, signal_type: str) -> Dict:
    """
    Calculate simple signal score with clear output format.
    
    Args:
        price_change: Percentage change in price
        current_volume: Current trading volume
        volume_spike: Whether volume spike was detected
        trend: Trend analysis result
        signal_type: Type of signal detected
        
    Returns:
        Dictionary with score and strength:
        - score: int (0-100)
        - strength: "Strong" or "Weak"
    """
    # Calculate individual components
    price_score = calculate_price_score(price_change)
    volume_score = calculate_volume_score(current_volume, volume_spike)
    trend_score = calculate_trend_score(trend, signal_type)
    
    # Calculate total score
    total_score = price_score + volume_score + trend_score
    
    # Classify strength
    strength = classify_strength(total_score)
    
    return {
        "score": int(round(total_score)),
        "strength": strength
    }


def calculate_signal_score(price_change: float, current_volume: int, 
                          volume_spike: bool, trend: str, signal_type: str) -> Dict:
    """
    Calculate comprehensive signal score with breakdown.
    
    Args:
        price_change: Percentage change in price
        current_volume: Current trading volume
        volume_spike: Whether volume spike was detected
        trend: Trend analysis result
        signal_type: Type of signal detected
        
    Returns:
        Dictionary with detailed scoring breakdown:
        - total_score: Overall score (0-100)
        - price_score: Price strength score (0-30)
        - volume_score: Volume strength score (0-40)
        - trend_score: Trend strength score (0-30)
        - strength: 'Strong' or 'Weak'
    """
    # Calculate individual components
    price_score = calculate_price_score(price_change)
    volume_score = calculate_volume_score(current_volume, volume_spike)
    trend_score = calculate_trend_score(trend, signal_type)
    
    # Calculate total score
    total_score = price_score + volume_score + trend_score
    
    # Classify strength
    strength = classify_strength(total_score)
    
    return {
        'total_score': round(total_score, 1),
        'price_score': round(price_score, 1),
        'volume_score': round(volume_score, 1),
        'trend_score': round(trend_score, 1),
        'strength': strength
    }


def score_batch_signals(signals_data: Dict[str, Dict]) -> Dict[str, Dict]:
    """
    Score multiple signals in batch.
    
    Args:
        signals_data: Dictionary with signal data for multiple stocks
        
    Returns:
        Dictionary with scoring results for each symbol
    """
    results = {}
    
    for symbol, signal_data in signals_data.items():
        # Extract signal components
        price_change = signal_data.get('price_change', 0.0)
        volume_spike = signal_data.get('volume_spike', False)
        trend = signal_data.get('trend', 'weak')
        signal_type = signal_data.get('signal_type', 'Weak')
        
        # For volume, we'd need the actual volume data
        # Using placeholder for now - in real implementation, pass actual volume
        current_volume = 1000000  # Default placeholder
        
        results[symbol] = calculate_signal_score(
            price_change, current_volume, volume_spike, trend, signal_type
        )
    
    return results


def get_score_breakdown(score_data: Dict) -> str:
    """
    Get human-readable breakdown of scoring components.
    
    Args:
        score_data: Dictionary with scoring results
        
    Returns:
        Formatted string with score breakdown
    """
    breakdown = f"""
Score Breakdown:
- Total Score: {score_data['total_score']}/100 ({score_data['strength']})
- Price Strength: {score_data['price_score']}/30
- Volume Strength: {score_data['volume_score']}/40  
- Trend Strength: {score_data['trend_score']}/30
    """.strip()
    
    return breakdown

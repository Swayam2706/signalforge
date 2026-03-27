"""
Tag Generator for SignalForge

This module generates descriptive tags for stock signals
based on volume, trend, and signal characteristics.
"""

from typing import List


def generate_tags(volume: int, volume_spike: bool, trend: str, 
                signal_type: str, score: int) -> List[str]:
    """
    Generate relevant tags for stock signal.
    
    Args:
        volume: Current trading volume
        volume_spike: Whether volume spike was detected
        trend: Trend analysis result
        signal_type: Type of signal detected
        score: Confidence score
        
    Returns:
        List of descriptive tags
    """
    tags = []
    
    # Volume-based tags
    if volume_spike:
        tags.append("High Volume")
    elif volume > 1000000:
        tags.append("Moderate Volume")
    else:
        tags.append("Low Volume")
    
    # Trend-based tags
    if trend == "uptrend":
        tags.append("Uptrend")
    elif trend == "sideways":
        tags.append("Sideways")
    elif trend == "downtrend":
        tags.append("Downtrend")
    else:
        tags.append("Weak Trend")
    
    # Signal-based tags
    if signal_type == "Breakout":
        tags.append("Breakout")
        if trend == "sideways":
            tags.append("Sideways Break")
    elif signal_type == "Momentum":
        tags.append("Momentum")
    else:
        tags.append("Weak Signal")
    
    # Score-based tags
    if score >= 80:
        tags.append("High Confidence")
    elif score >= 60:
        tags.append("Medium Confidence")
    else:
        tags.append("Low Confidence")
    
    # Conviction tags
    if volume_spike and signal_type in ["Breakout", "Momentum"]:
        tags.append("High Conviction")
    elif not volume_spike and signal_type in ["Breakout", "Momentum"]:
        tags.append("Low Conviction")
    else:
        tags.append("Uncertain")
    
    return tags


def generate_risk_note(signal_type: str, volume_spike: bool, 
                    trend: str, score: int) -> str:
    """
    Generate simple risk note for stock signal.
    
    Args:
        signal_type: Type of signal detected
        volume_spike: Whether volume spike was detected
        trend: Trend analysis result
        score: Confidence score
        
    Returns:
        Risk note string
    """
    if signal_type == "Breakout":
        if not volume_spike:
            return "Risk of false breakout due to weak volume confirmation."
        elif score < 60:
            return "Risk of breakout failure without strong momentum."
        else:
            return "Risk of consolidation after initial breakout move."
    
    elif signal_type == "Momentum":
        if not volume_spike:
            return "Risk of momentum reversal without volume support."
        elif trend == "weak":
            return "Risk of trend continuation with weak foundation."
        else:
            return "Risk of momentum fade in overbought conditions."
    
    else:  # Weak signal
        if trend == "sideways":
            return "Risk of continued consolidation with no clear direction."
        else:
            return "Risk of unpredictable movement with low conviction."

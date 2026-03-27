"""
Insight Generator for SignalForge

This module generates actionable insights for stock signals.
Provides concise, impactful summaries for quick decision-making.
"""

from typing import Dict


def generate_insight(signal_type: str, score: int, context: str) -> str:
    """
    Generate actionable insight based on signal analysis.
    
    Args:
        signal_type: Type of signal detected
        score: Confidence score (0-100)
        context: Market context description
        
    Returns:
        Actionable insight string
    """
    if signal_type == "Breakout":
        if score >= 85:
            return "Strong breakout opportunity"
        elif score >= 75:
            return "Early breakout momentum"
        elif score >= 70:
            return "Breakout confirmation needed"
        else:
            return "Potential breakout developing"
    
    elif signal_type == "Momentum":
        if score >= 85:
            return "Strong momentum continuation"
        elif score >= 75:
            return "Momentum building steadily"
        elif score >= 70:
            return "Watch momentum buildup"
        else:
            return "Early momentum signals"
    
    else:  # Weak signal
        if "sideways" in context.lower():
            return "Consolidation phase"
        elif "volume" in context.lower():
            return "Low conviction movement"
        else:
            return "Weak signal pattern"


def generate_batch_insights(stocks_data: Dict[str, Dict]) -> Dict[str, str]:
    """
    Generate insights for multiple stocks.
    
    Args:
        stocks_data: Dictionary with stock analysis data
        
    Returns:
        Dictionary with insights for each symbol
    """
    insights = {}
    
    for symbol, data in stocks_data.items():
        signal_type = data.get('signal_type', 'Weak')
        score = data.get('score', 0)
        context = data.get('context', '')
        
        insight = generate_insight(signal_type, score, context)
        insights[symbol] = insight
    
    return insights


def get_insight_priority(insight: str) -> int:
    """
    Get priority level for insight ranking.
    
    Args:
        insight: Insight string
        
    Returns:
        Priority score (higher = more important)
    """
    high_priority_keywords = [
        "strong breakout", "strong momentum", "early breakout",
        "momentum building", "breakout confirmation"
    ]
    
    medium_priority_keywords = [
        "watch momentum", "potential breakout", "momentum buildup"
    ]
    
    insight_lower = insight.lower()
    
    for keyword in high_priority_keywords:
        if keyword in insight_lower:
            return 3
    
    for keyword in medium_priority_keywords:
        if keyword in insight_lower:
            return 2
    
    return 1


def format_insight_for_display(insight: str, signal_type: str, score: int) -> str:
    """
    Format insight for clean display.
    
    Args:
        insight: Raw insight string
        signal_type: Signal type
        score: Confidence score
        
    Returns:
        Formatted insight
    """
    # Add emoji based on signal type and score
    if signal_type == "Breakout" and score >= 80:
        emoji = "🚀"
    elif signal_type == "Momentum" and score >= 80:
        emoji = "📈"
    elif score >= 70:
        emoji = "⚡"
    else:
        emoji = "👁️"
    
    return f"{emoji} {insight}"

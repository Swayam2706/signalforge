"""
Ranking System for SignalForge

This module ranks stocks based on their signal scores and provides
ordered lists of opportunities.
"""

from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class RankedStock:
    """
    Data class representing a ranked stock with all relevant information.
    """
    symbol: str
    signal_type: str
    score: float
    strength: str
    context: str
    explanation: str
    rank: int = 0


def rank_stocks_simple(stocks_with_scores: List[Dict]) -> Dict:
    """
    Simple and efficient ranking system for analyzed stocks.
    
    Args:
        stocks_with_scores: List of dictionaries with stock data including scores
        
    Returns:
        Dictionary with ranked list and top opportunities
    """
    if not stocks_with_scores:
        return {
            'ranked_stocks': [],
            'top_opportunities': [],
            'summary': {
                'total_stocks': 0,
                'top_stock': None,
                'top_3': []
            }
        }
    
    # Sort by score in descending order
    ranked_stocks = sorted(stocks_with_scores, key=lambda x: x.get('score', 0), reverse=True)
    
    # Add rank to each stock
    for i, stock in enumerate(ranked_stocks):
        stock['rank'] = i + 1
    
    # Identify top 3 opportunities
    top_opportunities = ranked_stocks[:3]
    
    # Create summary
    summary = {
        'total_stocks': len(ranked_stocks),
        'top_stock': ranked_stocks[0] if ranked_stocks else None,
        'top_3': [
            {
                'rank': i + 1,
                'stock': stock.get('stock', 'Unknown'),
                'score': stock.get('score', 0),
                'signal': stock.get('signal', 'Weak')
            }
            for i, stock in enumerate(top_opportunities)
        ]
    }
    
    return {
        'ranked_stocks': ranked_stocks,
        'top_opportunities': top_opportunities,
        'summary': summary
    }


def get_top_opportunities_simple(ranked_stocks: List[Dict], top_n: int = 3) -> List[Dict]:
    """
    Get top N opportunities from ranked stocks.
    
    Args:
        ranked_stocks: List of ranked stocks
        top_n: Number of top opportunities to return
        
    Returns:
        List of top N stocks with highlighted information
    """
    if not ranked_stocks:
        return []
    
    top_stocks = ranked_stocks[:top_n]
    
    # Add highlight flag for top opportunities
    for stock in top_stocks:
        stock['is_top_opportunity'] = True
    
    return top_stocks


def format_ranking_output(ranking_result: Dict) -> Dict:
    """
    Format ranking result for clean API output.
    
    Args:
        ranking_result: Result from rank_stocks_simple
        
    Returns:
        Formatted dictionary for API response
    """
    ranked_stocks = ranking_result['ranked_stocks']
    top_opportunities = ranking_result['top_opportunities']
    summary = ranking_result['summary']
    
    # Format ranked list
    formatted_ranked = []
    for stock in ranked_stocks:
        formatted_stock = {
            'rank': stock['rank'],
            'stock': stock.get('stock', ''),
            'signal': stock.get('signal', ''),
            'score': stock.get('score', 0),
            'strength': stock.get('strength', ''),
            'context': stock.get('context', ''),
            'explanation': stock.get('explanation', ''),
            'is_top_opportunity': stock.get('is_top_opportunity', False)
        }
        formatted_ranked.append(formatted_stock)
    
    # Format top opportunities
    formatted_top = []
    for stock in top_opportunities:
        formatted_top_stock = {
            'rank': stock['rank'],
            'stock': stock.get('stock', ''),
            'signal': stock.get('signal', ''),
            'score': stock.get('score', 0),
            'strength': stock.get('strength', ''),
            'explanation': stock.get('explanation', '')
        }
        formatted_top.append(formatted_top_stock)
    
    return {
        'ranked_stocks': formatted_ranked,
        'top_opportunities': formatted_top,
        'summary': summary
    }


def create_demo_response(stocks_data: List[Dict]) -> Dict:
    """
    Create demo-ready response with top_opportunities and others separation.
    
    Args:
        stocks_data: List of stock dictionaries with complete analysis
        
    Returns:
        Demo-ready response structure
    """
    if not stocks_data:
        return {
            "top_opportunities": [],
            "others": []
        }
    
    # Sort all stocks by score (descending)
    sorted_stocks = sorted(stocks_data, key=lambda x: x.get('score', 0), reverse=True)
    
    # Always return top 3 stocks as top_opportunities
    top_opportunities = sorted_stocks[:3]
    others = sorted_stocks[3:]
    
    # Add ranks to all stocks
    for i, stock in enumerate(sorted_stocks):
        stock['rank'] = i + 1
    
    # Format each stock with all required fields including chart data
    formatted_top = []
    for stock in top_opportunities:
        formatted_stock = {
            "stock": stock.get('stock', ''),
            "signal": stock.get('signal', ''),
            "score": stock.get('score', 0),
            "strength": stock.get('strength', ''),
            "context": stock.get('context', ''),
            "explanation": stock.get('explanation', ''),
            "insight": stock.get('insight', ''),
            "tags": stock.get('tags', []),
            "risk": stock.get('risk', ''),
            "rank": stock.get('rank', 0),
            # Chart-ready data
            "prices": stock.get('prices', []),
            "dates": stock.get('dates', [])
        }
        formatted_top.append(formatted_stock)
    
    formatted_others = []
    for stock in others:
        formatted_stock = {
            "stock": stock.get('stock', ''),
            "signal": stock.get('signal', ''),
            "score": stock.get('score', 0),
            "strength": stock.get('strength', ''),
            "context": stock.get('context', ''),
            "explanation": stock.get('explanation', ''),
            "insight": stock.get('insight', ''),
            "tags": stock.get('tags', []),
            "risk": stock.get('risk', ''),
            "rank": stock.get('rank', 0),
            # Chart-ready data
            "prices": stock.get('prices', []),
            "dates": stock.get('dates', [])
        }
        formatted_others.append(formatted_stock)
    
    return {
        "top_opportunities": formatted_top,
        "others": formatted_others
    }


def get_top_n_opportunities(stocks_data: List[Dict], n: int = 3) -> List[Dict]:
    """
    Get top N opportunities with score >= 70.
    
    Args:
        stocks_data: List of stock dictionaries
        n: Number of top opportunities to return
        
    Returns:
        List of top N opportunities
    """
    # Filter strong signals and sort by score
    strong_signals = [stock for stock in stocks_data if stock.get('score', 0) >= 70]
    strong_signals.sort(key=lambda x: x.get('score', 0), reverse=True)
    
    return strong_signals[:n]


def get_top_opportunity(ranked_stocks: List[RankedStock]) -> RankedStock:
    """
    Get the top-ranked opportunity from the list.
    
    Args:
        ranked_stocks: List of ranked stocks
        
    Returns:
        The top-ranked stock or None if list is empty
    """
    if not ranked_stocks:
        return None
    
    return ranked_stocks[0]


def filter_by_strength(ranked_stocks: List[RankedStock], 
                      min_strength: str = 'Strong') -> List[RankedStock]:
    """
    Filter ranked stocks by minimum strength level.
    
    Args:
        ranked_stocks: List of ranked stocks
        min_strength: Minimum strength ('Strong' or 'Weak')
        
    Returns:
        Filtered list of stocks
    """
    if min_strength == 'Strong':
        return [stock for stock in ranked_stocks if stock.strength == 'Strong']
    else:
        return ranked_stocks  # Return all if min_strength is 'Weak'


def filter_by_score(ranked_stocks: List[RankedStock], 
                   min_score: float = 0.0) -> List[RankedStock]:
    """
    Filter ranked stocks by minimum score.
    
    Args:
        ranked_stocks: List of ranked stocks
        min_score: Minimum score threshold
        
    Returns:
        Filtered list of stocks
    """
    return [stock for stock in ranked_stocks if stock.score >= min_score]


def get_top_n(ranked_stocks: List[RankedStock], n: int = 5) -> List[RankedStock]:
    """
    Get top N ranked stocks.
    
    Args:
        ranked_stocks: List of ranked stocks
        n: Number of top stocks to return
        
    Returns:
        List of top N stocks
    """
    return ranked_stocks[:n]


def rank_by_signal_type(ranked_stocks: List[RankedStock], 
                       signal_type: str) -> List[RankedStock]:
    """
    Get ranked stocks filtered by specific signal type.
    
    Args:
        ranked_stocks: List of ranked stocks
        signal_type: Signal type to filter by
        
    Returns:
        Filtered and ranked list of stocks
    """
    filtered = [stock for stock in ranked_stocks if stock.signal_type == signal_type]
    return filtered


def create_ranking_summary(ranked_stocks: List[RankedStock]) -> Dict:
    """
    Create a summary of the ranking results.
    
    Args:
        ranked_stocks: List of ranked stocks
        
    Returns:
        Dictionary with ranking summary statistics
    """
    if not ranked_stocks:
        return {
            'total_stocks': 0,
            'strong_signals': 0,
            'weak_signals': 0,
            'top_opportunity': None,
            'average_score': 0.0
        }
    
    strong_signals = len([s for s in ranked_stocks if s.strength == 'Strong'])
    weak_signals = len([s for s in ranked_stocks if s.strength == 'Weak'])
    average_score = sum(s.score for s in ranked_stocks) / len(ranked_stocks)
    
    return {
        'total_stocks': len(ranked_stocks),
        'strong_signals': strong_signals,
        'weak_signals': weak_signals,
        'top_opportunity': ranked_stocks[0].symbol if ranked_stocks else None,
        'average_score': round(average_score, 1)
    }


def format_ranked_results(ranked_stocks: List[RankedStock]) -> List[Dict]:
    """
    Format ranked results for API response.
    
    Args:
        ranked_stocks: List of ranked stocks
        
    Returns:
        List of dictionaries formatted for JSON response
    """
    formatted_results = []
    
    for stock in ranked_stocks:
        formatted_stock = {
            'rank': stock.rank,
            'stock': stock.symbol.replace('.NS', ''),
            'signal': stock.signal_type,
            'score': stock.score,
            'strength': stock.strength,
            'context': stock.context,
            'explanation': stock.explanation
        }
        formatted_results.append(formatted_stock)
    
    return formatted_results


def process_and_rank(stocks_data: Dict[str, Dict], 
                    min_score: float = 0.0,
                    max_results: int = None) -> List[Dict]:
    """
    Complete ranking pipeline from raw stock data to formatted results.
    
    Args:
        stocks_data: Dictionary with complete stock data
        min_score: Minimum score threshold
        max_results: Maximum number of results to return
        
    Returns:
        Formatted list of ranked results
    """
    # Rank stocks by score
    ranked_stocks = rank_stocks_by_score(stocks_data)
    
    # Filter by minimum score
    if min_score > 0:
        ranked_stocks = filter_by_score(ranked_stocks, min_score)
    
    # Limit results if specified
    if max_results:
        ranked_stocks = ranked_stocks[:max_results]
    
    # Format for API response
    return format_ranked_results(ranked_stocks)


def compare_rankings(ranking1: List[RankedStock], 
                    ranking2: List[RankedStock]) -> Dict:
    """
    Compare two different rankings and show differences.
    
    Args:
        ranking1: First ranking list
        ranking2: Second ranking list
        
    Returns:
        Dictionary with comparison results
    """
    symbols1 = {stock.symbol: stock.rank for stock in ranking1}
    symbols2 = {stock.symbol: stock.rank for stock in ranking2}
    
    # Find common symbols and rank changes
    common_symbols = set(symbols1.keys()) & set(symbols2.keys())
    rank_changes = {}
    
    for symbol in common_symbols:
        rank_change = symbols1[symbol] - symbols2[symbol]
        rank_changes[symbol] = rank_change
    
    # Find symbols only in one ranking
    only_in_1 = set(symbols1.keys()) - set(symbols2.keys())
    only_in_2 = set(symbols2.keys()) - set(symbols1.keys())
    
    return {
        'common_symbols': len(common_symbols),
        'rank_changes': rank_changes,
        'only_in_first': list(only_in_1),
        'only_in_second': list(only_in_2)
    }

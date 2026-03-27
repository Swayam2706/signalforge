"""
Multi-Stock Scanning Pipeline for SignalForge

This module provides a complete pipeline for scanning multiple stocks,
integrating all existing modules in a modular way.
"""

from typing import List, Dict, Optional
import logging
from datetime import datetime

# Import all existing modules
from data.fetcher import fetch_stock_data, validate_stock_data
from signals.detector import detect_signals_batch
from context.context_engine import generate_full_context
from scoring.scorer import calculate_signal_score
from ai.explainer import AIExplainer, generate_explanation_batch
from ranking.ranker import rank_stocks_by_score, filter_by_strength, format_ranked_results

logger = logging.getLogger(__name__)


def scan_multiple_stocks(
    stock_symbols: List[str],
    filter_weak: bool = True,
    use_ai: bool = True,
    api_provider: str = "openai"
) -> List[Dict]:
    """
    Complete multi-stock scanning pipeline.
    
    Args:
        stock_symbols: List of stock symbols to scan
        filter_weak: Whether to filter out weak signals
        use_ai: Whether to use AI explanations
        api_provider: AI provider to use ("openai" or "gemini")
        
    Returns:
        List of dictionaries with stock analysis results
    """
    start_time = datetime.now()
    
    try:
        # Step 1: Fetch stock data
        logger.info(f"Fetching data for {len(stock_symbols)} stocks...")
        stocks_data = fetch_stock_data(stock_symbols)
        
        # Filter out stocks with errors
        valid_stocks = {symbol: data for symbol, data in stocks_data.items() 
                       if not data.get('error') and validate_stock_data(data)}
        
        if not valid_stocks:
            logger.warning("No valid stock data found")
            return []
        
        logger.info(f"Valid data for {len(valid_stocks)} stocks")
        
        # Step 2: Detect signals
        logger.info("Detecting signals...")
        signals_data = detect_signals_batch(valid_stocks)
        
        # Step 3: Generate context
        logger.info("Generating context...")
        for symbol, signal_data in signals_data.items():
            stock_data = valid_stocks[symbol]
            context = generate_full_context(
                signal_data['signal_type'],
                stock_data['last_5_days_closes'],
                signal_data['price_change'],
                signal_data['volume_spike']
            )
            signal_data['context'] = context
        
        # Step 4: Score signals
        logger.info("Scoring signals...")
        for symbol, signal_data in signals_data.items():
            stock_data = valid_stocks[symbol]
            score_data = calculate_signal_score(
                signal_data['price_change'],
                stock_data['volume'],
                signal_data['volume_spike'],
                signal_data['trend'],
                signal_data['signal_type']
            )
            signal_data['score'] = score_data['total_score']
            signal_data['strength'] = score_data['strength']
        
        # Step 5: Generate AI explanations
        if use_ai:
            logger.info("Generating AI explanations...")
            try:
                explainer = AIExplainer(api_provider)
                explanations = generate_explanation_batch(explainer, signals_data)
                for symbol, explanation in explanations.items():
                    signals_data[symbol]['explanation'] = explanation
            except Exception as e:
                logger.warning(f"AI explanation failed: {e}. Using fallback.")
                _add_fallback_explanations(signals_data)
        else:
            _add_fallback_explanations(signals_data)
        
        # Step 6: Rank results
        logger.info("Ranking results...")
        ranked_stocks = rank_stocks_by_score(signals_data)
        
        # Step 7: Filter weak signals if requested
        if filter_weak:
            ranked_stocks = filter_by_strength(ranked_stocks, 'Strong')
        
        # Step 8: Format results
        results = _format_scan_results(ranked_stocks)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Scan completed in {processing_time:.2f}s - {len(results)} results")
        
        return results
        
    except Exception as e:
        logger.error(f"Error during multi-stock scan: {str(e)}")
        raise


def _add_fallback_explanations(signals_data: Dict[str, Dict]):
    """Add fallback explanations when AI is unavailable."""
    for symbol, signal_data in signals_data.items():
        signal_type = signal_data['signal_type'].lower()
        strength = signal_data['strength'].lower()
        signal_data['explanation'] = f"Stock shows {signal_type} signal with {strength} confidence."


def _format_scan_results(ranked_stocks: List) -> List[Dict]:
    """
    Format results according to specified output format.
    
    Args:
        ranked_stocks: List of RankedStock objects
        
    Returns:
        Formatted list of dictionaries
    """
    results = []
    
    for stock in ranked_stocks:
        result = {
            "stock": stock.symbol,
            "signal": stock.signal_type,
            "score": int(stock.score),
            "strength": stock.strength,
            "context": stock.context,
            "explanation": stock.explanation
        }
        results.append(result)
    
    return results


def scan_stocks_quick(
    stock_symbols: List[str],
    min_score: float = 70.0
) -> List[Dict]:
    """
    Quick scan with minimum score filtering.
    
    Args:
        stock_symbols: List of stock symbols
        min_score: Minimum confidence score
        
    Returns:
        List of results meeting minimum score
    """
    results = scan_multiple_stocks(stock_symbols, filter_weak=False, use_ai=False)
    
    # Filter by minimum score
    filtered_results = [r for r in results if r['score'] >= min_score]
    
    # Sort by score (highest first)
    filtered_results.sort(key=lambda x: x['score'], reverse=True)
    
    return filtered_results


def get_top_opportunities(
    stock_symbols: List[str],
    top_n: int = 5,
    min_score: float = 70.0
) -> List[Dict]:
    """
    Get top N opportunities from stock scan.
    
    Args:
        stock_symbols: List of stock symbols
        top_n: Number of top results to return
        min_score: Minimum confidence score
        
    Returns:
        List of top N opportunities
    """
    results = scan_multiple_stocks(stock_symbols, filter_weak=True, use_ai=True)
    
    # Filter by minimum score and take top N
    top_results = [r for r in results if r['score'] >= min_score][:top_n]
    
    return top_results


def create_scan_summary(results: List[Dict]) -> Dict:
    """
    Create summary of scan results.
    
    Args:
        results: List of scan results
        
    Returns:
        Summary dictionary
    """
    if not results:
        return {
            'total_scanned': 0,
            'valid_results': 0,
            'strong_signals': 0,
            'weak_signals': 0,
            'top_opportunity': None,
            'average_score': 0.0
        }
    
    strong_signals = len([r for r in results if r['strength'] == 'Strong'])
    weak_signals = len([r for r in results if r['strength'] == 'Weak'])
    average_score = sum(r['score'] for r in results) / len(results)
    
    return {
        'total_scanned': len(results),
        'valid_results': len(results),
        'strong_signals': strong_signals,
        'weak_signals': weak_signals,
        'top_opportunity': results[0]['stock'] if results else None,
        'average_score': round(average_score, 1)
    }


# Example usage function
def example_scan():
    """Example of how to use the multi-stock scanner."""
    stocks = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS"]
    
    # Full scan with AI explanations
    results = scan_multiple_stocks(stocks, filter_weak=True, use_ai=True)
    
    # Print results
    print(f"Scan Results ({len(results)} stocks):")
    print("-" * 50)
    
    for i, result in enumerate(results, 1):
        print(f"{i}. {result['stock']}")
        print(f"   Signal: {result['signal']} ({result['strength']})")
        print(f"   Score: {result['score']}")
        print(f"   Context: {result['context']}")
        print(f"   Explanation: {result['explanation']}")
        print()
    
    # Print summary
    summary = create_scan_summary(results)
    print(f"Summary: {summary['strong_signals']} strong, {summary['weak_signals']} weak signals")
    print(f"Top opportunity: {summary['top_opportunity']}")
    
    return results

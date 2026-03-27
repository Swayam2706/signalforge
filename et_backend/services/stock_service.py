"""
Stock Service for SignalForge

This module contains business logic for stock data and analysis.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

from data.fetcher import fetch_stock_ohlc_data, get_single_stock_data
from signals.detector import detect_signal
from context.context_engine import generate_full_context
from scoring.scorer import calculate_signal_score
from ai.explainer import AIExplainer
from utils.tag_generator import generate_tags, generate_risk_note
from utils.logger import get_logger

logger = get_logger(__name__)


class StockService:
    """Service class for stock data and analysis operations."""
    
    def __init__(self):
        """Initialize stock service with AI explainer."""
        try:
            self.explainer = AIExplainer()
            logger.logger.info(f"Stock service AI Explainer initialized with {self.explainer.api_provider}")
        except Exception as e:
            logger.logger.warning(f"Stock service AI Explainer setup failed: {e}. Using fallback explanations.")
            self.explainer = None
    
    def get_stock_detail(self, symbol: str, period_days: int = 60) -> Dict[str, Any]:
        """
        Get comprehensive stock detail with signal analysis.
        
        Args:
            symbol: Stock symbol (e.g., 'RELIANCE' or 'RELIANCE.NS')
            period_days: Number of days of historical data to fetch
            
        Returns:
            Dictionary with comprehensive stock information
            
        Raises:
            ValueError: If stock data not available
        """
        try:
            # Normalize symbol (add .NS if not present for Indian stocks)
            if not symbol.endswith('.NS'):
                symbol = f"{symbol.upper()}.NS"
            
            # Fetch OHLC data
            ohlc_data = fetch_stock_ohlc_data(symbol, period_days)
            
            if ohlc_data['error'] or not ohlc_data['historical_data']:
                raise ValueError(f"No data available for {symbol}")
            
            # Get basic stock data for signal analysis
            basic_data = get_single_stock_data(symbol)
            
            if basic_data and not basic_data.get('error'):
                # Perform signal analysis
                signal_data = self._analyze_stock_signal(basic_data)
                
                # Generate explanation
                explanation = self._generate_explanation(
                    symbol.replace('.NS', ''),
                    signal_data,
                    basic_data
                )
                
                # Generate tags and risk notes
                tags = generate_tags(
                    signal_data.get('signal_type', 'Unknown'),
                    basic_data.get('volume', 0),
                    signal_data.get('trend', 'Unknown'),
                    signal_data.get('score', 0)
                )
                
                risk_note = generate_risk_note(
                    signal_data.get('signal_type', 'Unknown'),
                    signal_data.get('score', 0)
                )
                
            else:
                # Default values if signal analysis fails
                signal_data = {
                    'signal_type': 'Weak',
                    'trend': 'Unknown',
                    'score': 0,
                    'strength': 'Weak'
                }
                explanation = f"Signal analysis unavailable for {symbol.replace('.NS', '')}"
                tags = ['No Data']
                risk_note = "Unable to assess risk due to insufficient data"
            
            # Prepare final response
            stock_detail = {
                'symbol': symbol.replace('.NS', ''),
                'price': ohlc_data['current_price'],
                'volume': ohlc_data['current_volume'],
                'ohlc': self._format_ohlc_data(ohlc_data['historical_data']),
                'signal': signal_data.get('signal_type', 'Unknown'),
                'confidence': signal_data.get('score', 0),
                'trend': signal_data.get('trend', 'Unknown'),
                'risk': risk_note,
                'tags': tags,
                'explanation': explanation,
                'data_points': len(ohlc_data['historical_data']),
                'last_updated': datetime.now().isoformat()
            }
            
            logger.logger.info(f"Generated stock detail for {symbol}")
            return stock_detail
            
        except ValueError:
            raise
        except Exception as e:
            logger.logger.error(f"Error getting stock detail for {symbol}: {str(e)}")
            raise ValueError(f"Failed to get stock detail: {str(e)}")
    
    def get_multiple_stocks(self, symbols: List[str], period_days: int = 60) -> Dict[str, Any]:
        """
        Get multiple stocks with basic data (no signal analysis for performance).
        
        Args:
            symbols: List of stock symbols
            period_days: Number of days of historical data
            
        Returns:
            Dictionary with multiple stocks data
        """
        try:
            stocks_data = []
            
            for symbol in symbols:
                try:
                    # Normalize symbol
                    if not symbol.endswith('.NS'):
                        symbol = f"{symbol.upper()}.NS"
                    
                    # Fetch OHLC data
                    ohlc_data = fetch_stock_ohlc_data(symbol, period_days)
                    
                    if not ohlc_data['error'] and ohlc_data['historical_data']:
                        stock_data = {
                            'symbol': symbol.replace('.NS', ''),
                            'price': ohlc_data['current_price'],
                            'volume': ohlc_data['current_volume'],
                            'ohlc': self._format_ohlc_data(ohlc_data['historical_data']),
                            'data_points': len(ohlc_data['historical_data']),
                            'last_updated': datetime.now().isoformat()
                        }
                        stocks_data.append(stock_data)
                        
                except Exception as e:
                    logger.logger.warning(f"Failed to fetch data for {symbol}: {str(e)}")
                    continue
            
            return {
                'success': True,
                'stocks': stocks_data,
                'total_stocks': len(stocks_data)
            }
            
        except Exception as e:
            logger.logger.error(f"Error getting multiple stocks: {str(e)}")
            raise ValueError(f"Failed to get multiple stocks: {str(e)}")
    
    def _analyze_stock_signal(self, stock_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze stock signal using existing pipeline logic.
        
        Args:
            stock_data: Basic stock data from fetcher
            
        Returns:
            Signal analysis results
        """
        try:
            # Detect signal using existing detector
            signal_result = detect_signal(
                stock_data['last_5_days_closes'],
                stock_data['volume'],
                stock_data['last_5_days_closes'][-1] - stock_data['last_5_days_closes'][0]
            )
            
            # Generate context
            context = generate_full_context(
                signal_result['signal_type'],
                stock_data['last_5_days_closes'],
                signal_result['price_change'],
                signal_result['volume_spike']
            )
            
            # Calculate score
            score_result = calculate_signal_score(
                signal_result['price_change'],
                stock_data['volume'],
                signal_result['volume_spike'],
                signal_result['trend'],
                signal_result['signal_type']
            )
            
            return {
                'signal_type': signal_result['signal_type'],
                'trend': signal_result['trend'],
                'score': int(score_result['total_score']),
                'strength': score_result['strength'],
                'price_change': signal_result['price_change'],
                'volume_spike': signal_result['volume_spike'],
                'context': context
            }
            
        except Exception as e:
            logger.logger.error(f"Error analyzing stock signal: {str(e)}")
            return {
                'signal_type': 'Weak',
                'trend': 'Unknown',
                'score': 0,
                'strength': 'Weak',
                'price_change': 0,
                'volume_spike': False,
                'context': 'Signal analysis failed'
            }
    
    def _generate_explanation(self, symbol: str, signal_data: Dict[str, Any], stock_data: Dict[str, Any]) -> str:
        """
        Generate AI explanation for stock signal.
        
        Args:
            symbol: Stock symbol
            signal_data: Signal analysis results
            stock_data: Basic stock data
            
        Returns:
            Generated explanation
        """
        try:
            if self.explainer:
                explanation = self.explainer.generate_explanation(
                    symbol,
                    signal_data['signal_type'],
                    signal_data['context'],
                    signal_data['score']
                )
                return explanation
            else:
                # Fallback explanation
                return f"{symbol} shows {signal_data['signal_type'].lower()} signal with {signal_data['score']}% confidence. {signal_data['context']}"
                
        except Exception as e:
            logger.logger.warning(f"AI explanation failed for {symbol}: {e}")
            return f"{symbol} shows {signal_data['signal_type'].lower()} signal with {signal_data['score']}% confidence."
    
    def _format_ohlc_data(self, historical_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format OHLC data for frontend consumption.
        
        Args:
            historical_data: Raw historical data from fetcher
            
        Returns:
            Formatted OHLC data
        """
        formatted_data = []
        
        for data_point in historical_data:
            formatted_point = {
                'open': float(data_point['open']),
                'high': float(data_point['high']),
                'low': float(data_point['low']),
                'close': float(data_point['close']),
                'timestamp': data_point['timestamp'].isoformat() if hasattr(data_point['timestamp'], 'isoformat') else str(data_point['timestamp']),
                'volume': int(data_point['volume'])
            }
            formatted_data.append(formatted_point)
        
        return formatted_data
    
    def get_stock_summary(self, symbol: str) -> Dict[str, Any]:
        """
        Get stock summary without detailed OHLC data.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Stock summary information
        """
        try:
            # Normalize symbol
            if not symbol.endswith('.NS'):
                symbol = f"{symbol.upper()}.NS"
            
            # Get basic stock data
            basic_data = get_single_stock_data(symbol)
            
            if not basic_data or basic_data.get('error'):
                raise ValueError(f"No data available for {symbol}")
            
            # Perform signal analysis
            signal_data = self._analyze_stock_signal(basic_data)
            
            # Generate explanation
            explanation = self._generate_explanation(
                symbol.replace('.NS', ''),
                signal_data,
                basic_data
            )
            
            # Generate tags and risk notes
            tags = generate_tags(
                signal_data.get('signal_type', 'Unknown'),
                basic_data.get('volume', 0),
                signal_data.get('trend', 'Unknown'),
                signal_data.get('score', 0)
            )
            
            risk_note = generate_risk_note(
                signal_data.get('signal_type', 'Unknown'),
                signal_data.get('score', 0)
            )
            
            return {
                'symbol': symbol.replace('.NS', ''),
                'price': basic_data['current_price'],
                'volume': basic_data['volume'],
                'signal': signal_data.get('signal_type', 'Unknown'),
                'confidence': signal_data.get('score', 0),
                'trend': signal_data.get('trend', 'Unknown'),
                'risk': risk_note,
                'tags': tags,
                'explanation': explanation,
                'last_updated': datetime.now().isoformat()
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.logger.error(f"Error getting stock summary for {symbol}: {str(e)}")
            raise ValueError(f"Failed to get stock summary: {str(e)}")


# Global service instance
stock_service_instance = None


def get_stock_service() -> StockService:
    """
    Get or create stock service instance.
    
    Returns:
        StockService instance
    """
    global stock_service_instance
    if stock_service_instance is None:
        stock_service_instance = StockService()
    return stock_service_instance


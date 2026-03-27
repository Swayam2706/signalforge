"""
Portfolio Service for SignalForge

This module contains business logic for portfolio management operations.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from models.portfolio import PortfolioItem
from models.user import User
from schemas.portfolio import PortfolioItemCreate, PortfolioItemResponse

from data.fetcher import get_single_stock_data
from signals.detector import detect_signal
from context.context_engine import generate_full_context
from scoring.scorer import calculate_signal_score
from ai.explainer import AIExplainer
from utils.tag_generator import generate_tags, generate_risk_note
from utils.logger import get_logger

logger = get_logger(__name__)


class PortfolioService:
    """Service class for portfolio management operations."""
    
    def __init__(self):
        """Initialize portfolio service with AI explainer."""
        try:
            self.explainer = AIExplainer()
            logger.logger.info(f"Portfolio service AI Explainer initialized with {self.explainer.api_provider}")
        except Exception as e:
            logger.logger.warning(f"Portfolio service AI Explainer setup failed: {e}. Using fallback explanations.")
            self.explainer = None
    
    def get_user_portfolio(self, db: Session, user_id: str) -> List[PortfolioItem]:
        """
        Get all portfolio items for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of portfolio items
            
        Raises:
            ValueError: If user not found
        """
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Get portfolio items
        portfolio_items = db.query(PortfolioItem).filter(PortfolioItem.user_id == user_id).all()
        return portfolio_items
    
    def get_enhanced_portfolio(self, db: Session, user_id: str) -> List[Dict[str, Any]]:
        """
        Get enhanced portfolio with live prices and signal analysis.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of enhanced portfolio items with live data
            
        Raises:
            ValueError: If user not found
        """
        # Get portfolio items from database
        portfolio_items = self.get_user_portfolio(db, user_id)
        
        if not portfolio_items:
            return []
        
        # Extract symbols for batch fetching
        symbols = [item.symbol + '.NS' for item in portfolio_items]
        
        # Fetch live stock data
        live_stock_data = {}
        try:
            for symbol in symbols:
                stock_data = get_single_stock_data(symbol)
                if stock_data and not stock_data.get('error'):
                    live_stock_data[symbol] = stock_data
        except Exception as e:
            logger.logger.error(f"Error fetching live stock data: {str(e)}")
        
        # Enhanced portfolio items
        enhanced_items = []
        
        for item in portfolio_items:
            symbol_with_ns = item.symbol + '.NS'
            stock_data = live_stock_data.get(symbol_with_ns)
            
            # Default values if no live data
            current_price = item.avg_price  # Use avg_price as fallback
            signal = "No Data"
            confidence = 0
            trend = "Unknown"
            risk = "Unable to assess"
            
            if stock_data:
                # Use live price
                current_price = stock_data.get('current_price', item.avg_price)
                
                # Perform signal analysis
                try:
                    # Detect signal
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
                    
                    # Update signal data
                    signal = signal_result['signal_type']
                    confidence = int(score_result['total_score'])
                    trend = signal_result['trend']
                    
                    # Generate risk note
                    risk = generate_risk_note(
                        signal_result['signal_type'],
                        score_result['total_score']
                    )
                    
                except Exception as e:
                    logger.logger.warning(f"Signal analysis failed for {item.symbol}: {str(e)}")
                    risk = "Analysis failed"
            
            # Calculate P&L
            price_change = current_price - item.avg_price
            price_change_percent = (price_change / item.avg_price * 100) if item.avg_price > 0 else 0
            total_value = current_price * item.quantity
            total_cost = item.avg_price * item.quantity
            total_pnl = total_value - total_cost
            
            enhanced_item = {
                'symbol': item.symbol,
                'quantity': item.quantity,
                'avg_price': item.avg_price,
                'current_price': current_price,
                'signal': signal,
                'confidence': confidence,
                'trend': trend,
                'risk': risk,
                'price_change': price_change,
                'price_change_percent': round(price_change_percent, 2),
                'total_value': total_value,
                'total_cost': total_cost,
                'total_pnl': total_pnl,
                'total_pnl_percent': round((total_pnl / total_cost * 100) if total_cost > 0 else 0, 2),
                'updated_at': item.updated_at.isoformat() if item.updated_at else None
            }
            
            enhanced_items.append(enhanced_item)
        
        return enhanced_items
    
    def add_portfolio_item(self, db: Session, item_data: PortfolioItemCreate) -> PortfolioItem:
        """
        Add a new portfolio item for a user.
        
        Args:
            db: Database session
            item_data: Portfolio item creation data
            
        Returns:
            Created portfolio item
            
        Raises:
            ValueError: If user not found or stock already exists
        """
        # Verify user exists
        user = db.query(User).filter(User.id == item_data.user_id).first()
        if not user:
            raise ValueError(f"User {item_data.user_id} not found")
        
        # Check if stock already exists in user's portfolio
        existing_item = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == item_data.user_id,
            PortfolioItem.symbol == item_data.symbol.upper()
        ).first()
        
        if existing_item:
            raise ValueError(f"Stock {item_data.symbol} already exists in portfolio")
        
        # Create new portfolio item
        portfolio_item = PortfolioItem(
            user_id=item_data.user_id,
            symbol=item_data.symbol.upper(),
            quantity=item_data.quantity,
            avg_price=item_data.avg_price,
            total_value=item_data.quantity * item_data.avg_price
        )
        
        db.add(portfolio_item)
        db.commit()
        db.refresh(portfolio_item)
        
        logger.logger.info(f"Added {item_data.symbol} to portfolio for user {item_data.user_id}")
        return portfolio_item
    
    def remove_portfolio_item(self, db: Session, user_id: str, symbol: str) -> bool:
        """
        Remove a portfolio item for a user.
        
        Args:
            db: Database session
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if removed, False if not found
            
        Raises:
            ValueError: If user not found
        """
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Find and delete portfolio item
        portfolio_item = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id,
            PortfolioItem.symbol == symbol.upper()
        ).first()
        
        if portfolio_item:
            db.delete(portfolio_item)
            db.commit()
            logger.logger.info(f"Removed {symbol} from portfolio for user {user_id}")
            return True
        else:
            return False
    
    def update_portfolio_item(self, db: Session, user_id: str, symbol: str, **updates):
        """
        Update an existing portfolio item.
        
        Args:
            db: Database session
            user_id: User ID
            symbol: Stock symbol
            **updates: Fields to update
            
        Returns:
            Updated portfolio item
            
        Raises:
            ValueError: If user or item not found
        """
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Find portfolio item
        portfolio_item = db.query(PortfolioItem).filter(
            PortfolioItem.user_id == user_id,
            PortfolioItem.symbol == symbol.upper()
        ).first()
        
        if not portfolio_item:
            raise ValueError(f"Portfolio item {symbol} not found")
        
        # Update fields
        for field, value in updates.items():
            if hasattr(portfolio_item, field):
                setattr(portfolio_item, field, value)
        
        # Recalculate total value if quantity or avg_price changed
        if 'quantity' in updates or 'avg_price' in updates:
            portfolio_item.total_value = portfolio_item.quantity * portfolio_item.avg_price
        
        db.commit()
        db.refresh(portfolio_item)
        
        logger.logger.info(f"Updated {symbol} in portfolio for user {user_id}")
        return portfolio_item
    
    def calculate_portfolio_value(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        Calculate total value of user's portfolio.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Portfolio value summary
            
        Raises:
            ValueError: If user not found
        """
        portfolio_items = self.get_user_portfolio(db, user_id)
        
        total_value = sum(item.total_value for item in portfolio_items)
        total_cost = sum(item.avg_price * item.quantity for item in portfolio_items)
        total_pnl = total_value - total_cost
        
        return {
            'user_id': user_id,
            'total_value': total_value,
            'total_cost': total_cost,
            'total_pnl': total_pnl,
            'total_pnl_percent': round((total_pnl / total_cost * 100) if total_cost > 0 else 0, 2),
            'total_items': len(portfolio_items)
        }
    
    def get_portfolio_summary(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive portfolio summary for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Portfolio summary with detailed analytics
            
        Raises:
            ValueError: If user not found
        """
        enhanced_portfolio = self.get_enhanced_portfolio(db, user_id)
        
        if not enhanced_portfolio:
            return {
                'user_id': user_id,
                'total_items': 0,
                'total_value': 0,
                'total_cost': 0,
                'total_pnl': 0,
                'total_pnl_percent': 0,
                'top_performers': [],
                'bottom_performers': [],
                'signal_summary': {},
                'risk_summary': {}
            }
        
        # Calculate totals
        total_value = sum(item['total_value'] for item in enhanced_portfolio)
        total_cost = sum(item['total_cost'] for item in enhanced_portfolio)
        total_pnl = total_value - total_cost
        total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
        
        # Sort by P&L percentage
        sorted_by_pnl = sorted(enhanced_portfolio, key=lambda x: x['total_pnl_percent'], reverse=True)
        
        # Top and bottom performers
        top_performers = sorted_by_pnl[:3]
        bottom_performers = sorted_by_pnl[-3:] if len(sorted_by_pnl) > 3 else []
        
        # Signal summary
        signal_counts = {}
        for item in enhanced_portfolio:
            signal = item['signal']
            signal_counts[signal] = signal_counts.get(signal, 0) + 1
        
        # Risk summary
        risk_counts = {}
        for item in enhanced_portfolio:
            risk = item['risk']
            risk_counts[risk] = risk_counts.get(risk, 0) + 1
        
        return {
            'user_id': user_id,
            'total_items': len(enhanced_portfolio),
            'total_value': total_value,
            'total_cost': total_cost,
            'total_pnl': total_pnl,
            'total_pnl_percent': round(total_pnl_percent, 2),
            'top_performers': top_performers,
            'bottom_performers': bottom_performers,
            'signal_summary': signal_counts,
            'risk_summary': risk_counts,
            'last_updated': datetime.now().isoformat()
        }


# Global service instance
portfolio_service_instance = None


def get_portfolio_service() -> PortfolioService:
    """
    Get or create portfolio service instance.
    
    Returns:
        PortfolioService instance
    """
    global portfolio_service_instance
    if portfolio_service_instance is None:
        portfolio_service_instance = PortfolioService()
    return portfolio_service_instance


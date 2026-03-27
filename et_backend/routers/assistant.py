"""
Assistant Router for SignalForge

This module contains API endpoints for AI assistant functionality.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime
import asyncio

from db.session import get_db_session
from models.user import User
from models.portfolio import PortfolioItem
from ai.assistant import get_assistant, chat_with_assistant
from schemas.assistant import ChatRequest, ChatResponse, AssistantStatusResponse
from utils.response import StandardResponse

# Create router
router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)


@router.post("/chat")
async def chat_with_ai(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session)
):
    """
    Chat with AI assistant for stock market guidance.
    
    Args:
        request: Chat request with user message and context
        background_tasks: FastAPI background tasks
        db: Database session
        
    Returns:
        AI assistant response with related stocks
    """
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            return StandardResponse.not_found("User")
        
        # Generate AI response with stock analysis
        start_time = datetime.now()
        
        try:
            # Use enhanced chat method that includes stock analysis
            assistant = get_assistant()
            chat_result = await assistant.chat(request.message, request.user_id)
            
            ai_response = chat_result['response']
            related_stocks = chat_result['related_stocks']
            provider_used = assistant.api_provider
            
        except Exception as e:
            logger.error(f"AI assistant error: {str(e)}")
            ai_response = "I'm having trouble connecting right now. Please try again later. For immediate assistance, I can help explain stock market concepts, investment strategies, or technical analysis basics."
            related_stocks = []
            provider_used = "fallback"
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Log conversation for analytics (background task)
        background_tasks.add_task(
            _log_conversation,
            request.user_id,
            request.message,
            ai_response,
            provider_used,
            processing_time
        )
        
        return StandardResponse.success({
            'response': ai_response,
            'related_stocks': related_stocks,
            'user_id': request.user_id,
            'timestamp': datetime.now().isoformat(),
            'provider_used': provider_used,
            'processing_time': round(processing_time, 2)
        }, f"Chat response generated using {provider_used}")
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        return StandardResponse.server_error("Failed to process chat request")


@router.get("/status")
async def get_assistant_status():
    """
    Get AI assistant status and capabilities.
    
    Returns:
        Assistant status information
    """
    try:
        assistant = get_assistant()
        
        return StandardResponse.success({
            'assistant_available': True,
            'provider': assistant.api_provider,
            'capabilities': [
                "Stock market education",
                "Technical analysis explanation", 
                "Portfolio management guidance",
                "Risk management advice",
                "Market trend analysis",
                "Investment concept explanation",
                "Signal interpretation",
                "Real-time stock analysis"
            ]
        }, "Assistant status retrieved")
        
    except Exception as e:
        logger.error(f"Status endpoint error: {str(e)}")
        return StandardResponse.success({
            'assistant_available': False,
            'provider': "fallback",
            'capabilities': [
                "Basic stock market education",
                "Investment concept explanation"
            ]
        }, "Assistant status retrieved (fallback mode)")


@router.get("/health")
async def assistant_health():
    """
    Health check for AI assistant service.
    
    Returns:
        Health status
    """
    try:
        assistant = get_assistant()
        return StandardResponse.success({
            "status": "healthy",
            "provider": assistant.api_provider,
            "timestamp": datetime.now().isoformat()
        }, "Assistant service is healthy")
    except Exception as e:
        return StandardResponse.success({
            "status": "degraded",
            "provider": "fallback",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }, "Assistant service is in degraded mode")


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db_session)
):
    """
    Stream chat response (for future implementation).
    
    Args:
        request: Chat request
        db: Database session
        
    Returns:
        Streaming response (placeholder)
    """
    # Placeholder for streaming implementation
    return StandardResponse.success({
        "message": "Streaming chat not yet implemented. Use /chat endpoint instead."
    }, "Streaming endpoint placeholder")


async def _build_user_context(user_id: str, db: Session, additional_context: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Build context for AI assistant from user data.
    
    Args:
        user_id: User ID
        db: Database session
        additional_context: Additional context from request
        
    Returns:
        Context dictionary for AI
    """
    context = {}
    
    try:
        # Get portfolio summary
        portfolio_items = db.query(PortfolioItem).filter(PortfolioItem.user_id == user_id).all()
        
        if portfolio_items:
            total_value = sum(item.total_value for item in portfolio_items)
            context['portfolio_summary'] = {
                'total_items': len(portfolio_items),
                'total_value': total_value,
                'stocks': [item.symbol for item in portfolio_items[:5]]  # Top 5 stocks
            }
        
        # Add user preferences (mock data - could be enhanced with user preferences table)
        context['user_preferences'] = {
            'risk_tolerance': 'moderate',
            'investment_horizon': 'medium-term'
        }
        
        # Merge additional context
        if additional_context:
            context.update(additional_context)
        
    except Exception as e:
        logger.warning(f"Error building context for user {user_id}: {str(e)}")
        # Return minimal context if error occurs
        context = {
            'portfolio_summary': {'total_items': 0, 'total_value': 0},
            'user_preferences': {'risk_tolerance': 'moderate'}
        }
    
    return context


def _log_conversation(
    user_id: str, 
    message: str, 
    response: str, 
    provider: str, 
    processing_time: float
):
    """
    Log conversation for analytics (background task).
    
    Args:
        user_id: User ID
        message: User message
        response: AI response
        provider: AI provider used
        processing_time: Processing time in seconds
    """
    try:
        # This could be enhanced to log to database or analytics service
        logger.info(f"Chat logged - User: {user_id}, Provider: {provider}, Time: {processing_time:.2f}s")
        
        # Additional analytics could be added here:
        # - Message length analysis
        # - Response quality metrics
        # - User engagement tracking
        
    except Exception as e:
        logger.error(f"Error logging conversation: {str(e)}")


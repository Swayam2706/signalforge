"""
AI Assistant Module for SignalForge

This module provides AI-powered conversational assistance for stock market queries.
"""

import os
import re
from typing import Dict, Optional, List
import openai
import requests
from dotenv import load_dotenv

from data.fetcher import fetch_stock_data
from signals.detector import detect_signal
from context.context_engine import generate_full_context
from scoring.scorer import calculate_signal_score
from ai.explainer import AIExplainer

# Load environment variables
load_dotenv()


class AIAssistant:
    """
    AI-powered assistant for stock market queries and analysis.
    
    Supports multiple AI providers with automatic fallback.
    """
    
    def __init__(self):
        """Initialize AI assistant with provider selection."""
        self.api_provider = self._select_provider()
        self._setup_api()
        self.explainer = None
        try:
            self.explainer = AIExplainer()
        except Exception:
            pass  # Fallback without AI explainer
    
    def _select_provider(self) -> str:
        """
        Select AI provider based on available keys.
        
        Priority: OpenRouter > OpenAI > Fallback
        
        Returns:
            Selected provider name
        """
        if os.getenv("OPENROUTER_API_KEY"):
            return "openrouter"
        elif os.getenv("OPENAI_API_KEY"):
            return "openai"
        elif os.getenv("GEMINI_API_KEY"):
            return "gemini"
        else:
            return "fallback"
    
    def _setup_api(self):
        """Setup API client based on provider."""
        if self.api_provider == "openrouter":
            self.openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if not self.openrouter_key:
                raise ValueError("OPENROUTER_API_KEY environment variable not set")
        elif self.api_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self.client = openai.OpenAI(api_key=api_key)
        elif self.api_provider == "gemini":
            self.gemini_key = os.getenv("GEMINI_API_KEY")
            if not self.gemini_key:
                raise ValueError("GEMINI_API_KEY environment variable not set")
        elif self.api_provider == "fallback":
            # No setup needed for fallback
            pass
        else:
            raise ValueError(f"Unsupported API provider: {self.api_provider}")
    
    def _extract_stock_symbols(self, message: str) -> List[str]:
        """
        Extract stock symbols from user message.
        
        Args:
            message: User message
            
        Returns:
            List of detected stock symbols
        """
        # Common Indian stock patterns
        patterns = [
            r'\b([A-Z]{2,5}(?:\.NS)?)\b',  # RELIANCE, TCS.NS
            r'\b([A-Z]{2,5}) stock\b',      # RELIANCE stock
            r'\b([A-Z]{2,5}) shares?\b',     # TCS shares
        ]
        
        symbols = set()
        for pattern in patterns:
            matches = re.findall(pattern, message.upper())
            for match in matches:
                # Normalize symbol
                symbol = match.upper()
                if not symbol.endswith('.NS'):
                    symbol += '.NS'
                symbols.add(symbol)
        
        # Filter common words that might match patterns
        common_words = {'THE', 'AND', 'FOR', 'ARE', 'WITH', 'FROM', 'HAVE', 'THIS', 'THAT', 'WILL', 'YOUR', 'WHAT', 'WHEN', 'WHERE', 'HOW', 'WHY', 'WHICH', 'WHO', 'CAN', 'MAY', 'MIGHT', 'SHOULD', 'COULD', 'WOULD', 'MUST'}
        symbols = {s for s in symbols if s.replace('.NS', '') not in common_words}
        
        return list(symbols)
    
    async def _analyze_stocks(self, symbols: List[str]) -> List[Dict]:
        """
        Analyze stocks using signal pipeline.
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            List of stock analysis results
        """
        results = []
        
        try:
            # Fetch stock data
            stock_data = fetch_stock_data(symbols)
            
            for symbol in symbols:
                if symbol not in stock_data or stock_data[symbol].get('error'):
                    continue
                
                data = stock_data[symbol]
                
                # Detect signal
                signal_result = detect_signal(
                    data['last_5_days_closes'],
                    data['volume'],
                    data['last_5_days_closes'][-1] - data['last_5_days_closes'][0]
                )
                
                # Generate context
                context = generate_full_context(
                    signal_result['signal_type'],
                    data['last_5_days_closes'],
                    signal_result['price_change'],
                    signal_result['volume_spike']
                )
                
                # Calculate score
                score_result = calculate_signal_score(
                    signal_result['price_change'],
                    data['volume'],
                    signal_result['volume_spike'],
                    signal_result['trend'],
                    signal_result['signal_type']
                )
                
                # Generate explanation
                explanation = ""
                if self.explainer:
                    try:
                        explanation = self.explainer.generate_explanation(
                            symbol.replace('.NS', ''),
                            signal_result['signal_type'],
                            context,
                            score_result['total_score']
                        )
                    except Exception:
                        explanation = f"{symbol.replace('.NS', '')} shows {signal_result['signal_type'].lower()} signal with {score_result['total_score']}% confidence."
                else:
                    explanation = f"{symbol.replace('.NS', '')} shows {signal_result['signal_type'].lower()} signal with {score_result['total_score']}% confidence."
                
                results.append({
                    'symbol': symbol.replace('.NS', ''),
                    'price': data['current_price'],
                    'signal': signal_result['signal_type'],
                    'confidence': int(score_result['total_score']),
                    'trend': signal_result['trend'],
                    'explanation': explanation
                })
                
        except Exception as e:
            print(f"Error analyzing stocks: {e}")
        
        return results
    
    def _create_system_prompt(self, context: Optional[Dict] = None) -> str:
        """
        Create system prompt for AI assistant.
        
        Args:
            context: Optional context data for personalization
            
        Returns:
            System prompt string
        """
        base_prompt = """You are SignalForge AI, an expert financial assistant specializing in Indian stock markets. You provide helpful, accurate, and responsible investment guidance.

Your expertise includes:
- Stock market analysis and trends
- Technical and fundamental analysis
- Portfolio management strategies
- Risk assessment and mitigation
- Market sentiment and news analysis

Guidelines:
- Provide educational and informational content only
- Never give direct financial advice or recommendations
- Always include appropriate disclaimers
- Focus on explaining concepts and strategies
- Use clear, accessible language
- Be concise but thorough

Disclaimer to include when appropriate:
"I am an AI assistant providing educational information only. This is not financial advice. Please consult with a qualified financial advisor before making investment decisions."

Current market context: Indian stock market (NSE/BSE)
Available data: Real-time signals, technical analysis, market trends"""
        
        if context and context.get('stock_analysis'):
            stock_info = f"\n\nRecent Stock Analysis:\n"
            for stock in context['stock_analysis']:
                stock_info += f"- {stock['symbol']}: {stock['signal']} signal ({stock['confidence']}% confidence) - {stock['explanation']}\n"
            base_prompt += stock_info
        
        return base_prompt
    
    def _create_conversation_prompt(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Create conversation prompt with context.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            Formatted prompt
        """
        prompt = f"User Query: {message}\n\nPlease provide a helpful response addressing their question about stock markets, investing, or financial concepts."
        
        if context and context.get('stock_analysis'):
            prompt += "\n\nIf the user asks about specific stocks mentioned in their query, include the analysis results in your response."
        
        return prompt
    
    async def generate_response_openrouter(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Generate response using OpenRouter API.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            AI response
        """
        try:
            system_prompt = self._create_system_prompt(context)
            conversation_prompt = self._create_conversation_prompt(message, context)
            
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": conversation_prompt}
                    ],
                    "max_tokens": 500,
                    "temperature": 0.7
                }
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"].strip()
            else:
                raise Exception(f"OpenRouter API error: {response.status_code}")
                
        except Exception as e:
            raise Exception(f"OpenRouter API call failed: {str(e)}")
    
    async def generate_response_openai(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Generate response using OpenAI API.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            AI response
        """
        try:
            system_prompt = self._create_system_prompt(context)
            conversation_prompt = self._create_conversation_prompt(message, context)
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": conversation_prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            raise Exception(f"OpenAI API call failed: {str(e)}")
    
    async def generate_response_gemini(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Generate response using Gemini API.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            AI response
        """
        try:
            system_prompt = self._create_system_prompt(context)
            conversation_prompt = self._create_conversation_prompt(message, context)
            
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={self.gemini_key}",
                json={
                    "contents": [
                        {"parts": [{"text": f"{system_prompt}\n\n{conversation_prompt}"}]}
                    ],
                    "generationConfig": {
                        "temperature": 0.7,
                        "topK": 40,
                        "topP": 0.95,
                        "maxOutputTokens": 500,
                    }
                }
            )
            
            if response.status_code == 200:
                return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            else:
                raise Exception(f"Gemini API error: {response.status_code}")
                
        except Exception as e:
            raise Exception(f"Gemini API call failed: {str(e)}")
    
    def generate_fallback_response(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Generate fallback response without API calls.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            Fallback response
        """
        message_lower = message.lower()
        
        # Check if stock analysis is available
        if context and context.get('stock_analysis'):
            stock_info = "Based on the analysis:\n"
            for stock in context['stock_analysis']:
                stock_info += f"\n• {stock['symbol']}: {stock['signal']} signal with {stock['confidence']}% confidence. {stock['explanation']}"
            
            return f"""{stock_info}

Note: This analysis is for educational purposes only and should not be considered as financial advice. Always conduct your own research and consult with qualified financial advisors before making investment decisions."""
        
        # Check for common topics
        if any(word in message_lower for word in ['what is', 'explain', 'definition']):
            return """I'm SignalForge AI, your assistant for stock market education. I can help explain:

• Stock market concepts and terminology
• Technical and fundamental analysis
• Investment strategies and risk management
• Market trends and signals analysis

Please ask me a specific question about any of these topics!

Note: I provide educational information only, not financial advice. Always consult a qualified financial advisor for investment decisions."""
        
        elif any(word in message_lower for word in ['signal', 'analysis', 'recommendation']):
            return """I can help you understand market signals and analysis concepts:

• Breakout signals: Stocks moving above resistance levels
• Momentum signals: Sustained price movement with volume
• Technical indicators: RSI, MACD, moving averages
• Risk management: Position sizing, stop-losses

For specific stock analysis, please check our signals dashboard. Remember that all signals should be used as part of a comprehensive analysis strategy, not as standalone buy/sell recommendations.

Note: This is educational information only, not financial advice."""
        
        elif any(word in message_lower for word in ['portfolio', 'diversify', 'risk']):
            return """Regarding portfolio management:

• Diversification: Spread investments across different sectors
• Risk management: Use position sizing and stop-losses
• Asset allocation: Balance between equity and debt
• Regular review: Rebalance portfolio periodically

Key principles:
- Never invest more than you can afford to lose
- Diversify across sectors and market caps
- Have clear investment goals and time horizon
- Stay informed about market trends

Note: This is educational guidance only. Please consult a financial advisor for personalized advice."""
        
        else:
            return """I'm SignalForge AI, here to help with stock market education and analysis. I can assist with:

📊 Market Analysis
• Understanding technical indicators
• Interpreting market signals
• Trend analysis basics

📈 Investment Concepts
• Portfolio diversification
• Risk management strategies
• Investment fundamentals

🔍 Market Education
• Stock market terminology
• Trading vs investing
• Market psychology

Ask me a specific question about any of these topics!

Note: I provide educational information only, not financial advice. Always consult with qualified financial professionals before making investment decisions."""
    
    async def generate_response(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Generate AI response with automatic fallback.
        
        Args:
            message: User message
            context: Optional context data
            
        Returns:
            AI response
        """
        if self.api_provider == "openrouter":
            try:
                return await self.generate_response_openrouter(message, context)
            except Exception as e:
                # Try other providers as backup
                for provider in ["openai", "gemini"]:
                    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
                        try:
                            return await self.generate_response_openai(message, context)
                        except Exception:
                            continue
                    elif provider == "gemini" and os.getenv("GEMINI_API_KEY"):
                        try:
                            return await self.generate_response_gemini(message, context)
                        except Exception:
                            continue
                # Final fallback
                return self.generate_fallback_response(message, context)
        
        elif self.api_provider == "openai":
            try:
                return await self.generate_response_openai(message, context)
            except Exception as e:
                return self.generate_fallback_response(message, context)
        
        elif self.api_provider == "gemini":
            try:
                return await self.generate_response_gemini(message, context)
            except Exception as e:
                return self.generate_fallback_response(message, context)
        
        else:  # fallback
            return self.generate_fallback_response(message, context)
    
    async def chat(self, message: str, user_id: Optional[str] = None) -> Dict[str, any]:
        """
        Chat with AI assistant and return structured response.
        
        Args:
            message: User message
            user_id: Optional user ID for context
            
        Returns:
            Structured response with AI response and related stocks
        """
        # Extract stock symbols from message
        stock_symbols = self._extract_stock_symbols(message)
        related_stocks = []
        
        # Analyze stocks if mentioned
        if stock_symbols:
            stock_analysis = await self._analyze_stocks(stock_symbols)
            related_stocks = stock_analysis
        
        # Create context for AI
        context = {
            'stock_analysis': related_stocks if related_stocks else None,
            'user_id': user_id
        }
        
        # Generate AI response
        ai_response = await self.generate_response(message, context)
        
        return {
            'response': ai_response,
            'related_stocks': related_stocks
        }


# Global assistant instance
assistant_instance = None


def get_assistant() -> AIAssistant:
    """
    Get or create AI assistant instance.
    
    Returns:
        AIAssistant instance
    """
    global assistant_instance
    if assistant_instance is None:
        try:
            assistant_instance = AIAssistant()
        except Exception as e:
            # Create fallback instance
            assistant_instance = AIAssistant()
            assistant_instance.api_provider = "fallback"
    
    return assistant_instance


# Convenience function for quick usage
async def chat_with_assistant(message: str, user_id: Optional[str] = None) -> Dict[str, any]:
    """
    Quick function to chat with AI assistant.
    
    Args:
        message: User message
        user_id: Optional user ID
        
    Returns:
        Structured response with AI response and related stocks
    """
    try:
        assistant = get_assistant()
        return await assistant.chat(message, user_id)
    except Exception as e:
        return {
            'response': "I'm having trouble connecting right now. Please try again later. For immediate assistance, I can help explain stock market concepts, investment strategies, or technical analysis basics.",
            'related_stocks': []
        }


"""
AI Explanation Engine for SignalForge

This module uses AI APIs to generate human-readable explanations
for detected stock signals and market opportunities.
"""

import os
from typing import Dict, Optional
import openai
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class AIExplainer:
    """
    Hybrid AI-powered explanation generator for stock signals.
    Supports OpenRouter (primary), OpenAI (secondary), and local fallback.
    """
    
    def __init__(self):
        """
        Initialize AI explainer with automatic provider selection.
        """
        self.api_provider = self._select_provider()
        self._setup_api()
    
    def _select_provider(self) -> str:
        """
        Select API provider based on available keys.
        
        Priority: OpenRouter > OpenAI > Fallback
        
        Returns:
            Selected provider name
        """
        if os.getenv("OPENROUTER_API_KEY"):
            return "openrouter"
        elif os.getenv("OPENAI_API_KEY"):
            return "openai"
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
        elif self.api_provider == "fallback":
            # No setup needed for fallback
            pass
        else:
            raise ValueError(f"Unsupported API provider: {self.api_provider}")
    
    def _create_prompt(self, stock_name: str, signal_type: str, context: str, score: int) -> str:
        """
        Create a structured prompt for AI explanation with financial insight focus.
        
        Args:
            stock_name: Name of the stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            Structured prompt string
        """
        prompt = f"""You are an experienced financial analyst. Generate a concise explanation for {stock_name}.

Signal: {signal_type}
Context: {context}
Score: {score}/100

Requirements:
- Maximum 2 sentences
- Maximum 25 words total
- Be specific to this stock
- Avoid generic phrases like "market direction"
- Focus on what this specific signal means

Example format:
"RELIANCE shows weak momentum despite price rise, indicating low buying conviction."

Write the explanation:
"""
        return prompt
    
    def generate_explanation_openrouter(self, stock_name: str, signal_type: str, 
                                   context: str, score: int) -> str:
        """
        Generate explanation using OpenRouter API.
        
        Args:
            stock_name: Name of the stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            AI-generated explanation string
        """
        try:
            prompt = self._create_prompt(stock_name, signal_type, context, score)
            
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are an experienced financial analyst providing market insights. Write concisely with professional financial terminology."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 80,
                    "temperature": 0.4
                }
            )
            
            if response.status_code == 200:
                explanation = response.json()["choices"][0]["message"]["content"].strip()
                explanation = self._clean_explanation(explanation)
                return explanation
            else:
                raise Exception(f"OpenRouter API error: {response.status_code}")
                
        except Exception as e:
            # Fallback to enhanced template explanation if API fails
            return self._get_enhanced_fallback(signal_type, context, score)
    
    def generate_explanation_openai(self, stock_name: str, signal_type: str, 
                                  context: str, score: int) -> str:
        """
        Generate explanation using OpenAI API with financial analyst persona.
        
        Args:
            stock_name: Name of the stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            AI-generated explanation string
        """
        try:
            prompt = self._create_prompt(stock_name, signal_type, context, score)
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an experienced financial analyst providing market insights. Write concisely with professional financial terminology."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=80,
                temperature=0.4  # Slightly higher for more natural financial language
            )
            
            explanation = response.choices[0].message.content.strip()
            
            # Clean up common AI artifacts
            explanation = self._clean_explanation(explanation)
            
            return explanation
            
        except Exception as e:
            # Fallback to enhanced template explanation if API fails
            return self._get_enhanced_fallback(signal_type, context, score)
    
    def generate_fallback_explanation(self, stock_name: str, signal_type: str, 
                                    context: str, score: int) -> str:
        """
        Generate local fallback explanation without any API calls.
        
        Args:
            stock_name: Name of stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            Local explanation string
        """
        # Create unique, concise explanations (max 25 words)
        if signal_type == "Breakout":
            if score >= 80:
                return f"{stock_name} breaks out with strong volume support."
            elif score >= 55:
                return f"{stock_name} shows breakout pattern with solid participation."
            else:
                return f"{stock_name} displays early breakout signs with initial momentum."
        
        elif signal_type == "Momentum":
            if score >= 80:
                return f"{stock_name} demonstrates strong upward momentum consistently."
            elif score >= 55:
                return f"{stock_name} builds steady momentum with growing confidence."
            else:
                return f"{stock_name} shows developing momentum with selective interest."
        
        else:  # Weak signal
            if score >= 40:
                return f"{stock_name} shows weak momentum despite price movement."
            else:
                return f"{stock_name} displays weak signal with limited participation."
    
    def _clean_explanation(self, explanation: str) -> str:
        """
        Clean up common AI response artifacts.
        
        Args:
            explanation: Raw AI explanation
            
        Returns:
            Cleaned explanation
        """
        # Remove common AI artifacts
        explanation = explanation.strip()
        
        # Remove quotes if present
        if explanation.startswith('"') and explanation.endswith('"'):
            explanation = explanation[1:-1]
        
        # Truncate if too long (max 25 words)
        words = explanation.split()
        if len(words) > 25:
            explanation = ' '.join(words[:25])
            if explanation.endswith(','):
                explanation = explanation[:-1]
        
        return explanation.strip()
    
    def _get_enhanced_fallback(self, signal_type: str, context: str, score: int) -> str:
        """
        Generate enhanced fallback explanation with financial insight tone.
        
        Args:
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            Enhanced template-based explanation
        """
        if signal_type == "Breakout":
            if score >= 80:
                return "Stock breaks out with strong volume and institutional participation."
            elif score >= 55:
                return "Breaking out of range with solid volume accumulation."
            else:
                return "Early breakout pattern shows initial momentum needs confirmation."
        
        elif signal_type == "Momentum":
            if score >= 80:
                return "Strong momentum with consistent volume and institutional accumulation."
            elif score >= 55:
                return "Building momentum with steady volume and growing confidence."
            else:
                return "Developing momentum indicates selective buying interest."
        
        else:  # Weak signal
            if "volume" in context.lower():
                return "Limited price movement without volume confirmation."
            else:
                return "Consolidation pattern shows uncertain market direction."
    
    def generate_explanation_gemini(self, stock_name: str, signal_type: str, 
                                 context: str, score: int) -> str:
        """
        Generate explanation using Gemini API (placeholder).
        
        Args:
            stock_name: Name of the stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            AI-generated explanation string
        """
        # Placeholder for Gemini implementation
        return self._get_fallback_explanation(signal_type, context, score)
    
    def _get_fallback_explanation(self, signal_type: str, context: str, score: int) -> str:
        """
        Generate fallback explanation when AI API is unavailable.
        
        Args:
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            Template-based explanation
        """
        if signal_type == "Breakout":
            if score >= 70:
                return "This stock shows a strong breakout with significant price movement and volume support."
            else:
                return "Stock shows breakout pattern but with limited confirmation."
        
        elif signal_type == "Momentum":
            if score >= 70:
                return "The stock demonstrates strong upward momentum with consistent buying interest."
            else:
                return "Stock shows moderate momentum but lacks strong conviction."
        
        else:  # Weak signal
            return "Limited signal strength with no clear market direction."
    
    def generate_explanation(self, stock_name: str, signal_type: str, 
                           context: str, score: int) -> str:
        """
        Generate explanation using available AI provider with automatic fallback.
        
        Args:
            stock_name: Name of the stock
            signal_type: Type of signal detected
            context: Market context description
            score: Confidence score (0-100)
            
        Returns:
            AI-generated or fallback explanation string
        """
        if self.api_provider == "openrouter":
            try:
                return self.generate_explanation_openrouter(stock_name, signal_type, context, score)
            except Exception as e:
                # Try OpenAI as backup
                if os.getenv("OPENAI_API_KEY"):
                    try:
                        return self.generate_explanation_openai(stock_name, signal_type, context, score)
                    except Exception:
                        pass
                # Final fallback
                return self.generate_fallback_explanation(stock_name, signal_type, context, score)
        
        elif self.api_provider == "openai":
            try:
                return self.generate_explanation_openai(stock_name, signal_type, context, score)
            except Exception as e:
                return self.generate_fallback_explanation(stock_name, signal_type, context, score)
        
        else:  # fallback
            return self.generate_fallback_explanation(stock_name, signal_type, context, score)


def generate_explanation_batch(explainer: AIExplainer, stocks_data: Dict[str, Dict]) -> Dict[str, str]:
    """
    Generate explanations for multiple stocks.
    
    Args:
        explainer: AIExplainer instance
        stocks_data: Dictionary with stock data for multiple symbols
        
    Returns:
        Dictionary with explanations for each symbol
    """
    explanations = {}
    
    for symbol, data in stocks_data.items():
        stock_name = symbol.replace('.NS', '')  # Clean up symbol name
        signal_type = data.get('signal_type', 'Weak')
        context = data.get('context', 'No context available')
        score = data.get('score', 0)
        
        explanation = explainer.generate_explanation(stock_name, signal_type, context, score)
        explanations[symbol] = explanation
    
    return explanations


# Convenience function for quick usage
def explain_signal(stock_name: str, signal_type: str, context: str, score: int) -> str:
    """
    Quick function to generate explanation for a single signal with automatic provider selection.
    
    Args:
        stock_name: Name of the stock
        signal_type: Type of signal detected
        context: Market context description
        score: Confidence score (0-100)
        
    Returns:
        AI-generated or fallback explanation
    """
    try:
        explainer = AIExplainer()
        return explainer.generate_explanation(stock_name, signal_type, context, score)
    except Exception as e:
        # Ultimate fallback
        return f"{stock_name} shows {signal_type.lower()} signal with {score}% confidence. {context}"

/**
 * AI Assistant Engine
 * Handles query parsing, ticker resolution, data fetching, and analysis generation
 */

import { getStockDetail, getLiveQuotes, scanMarket } from './api';

// Intent types
export const INTENTS = {
  STOCK_ANALYSIS: 'stock_analysis',
  RISKY_STOCKS: 'risky_stocks',
  FIND_OPPORTUNITIES: 'find_opportunities',
  MARKET_OVERVIEW: 'market_overview',
  PORTFOLIO_ANALYSIS: 'portfolio_analysis',
  SECTOR_ANALYSIS: 'sector_analysis',
  GENERAL_CLARIFICATION: 'general_clarification'
};

// Response modes
export const RESPONSE_MODES = {
  STOCK_RESULT: 'stock_result',
  LIST_RESULT: 'list_result',
  MARKET_RESULT: 'market_result',
  PORTFOLIO_RESULT: 'portfolio_result',
  CLARIFICATION_RESULT: 'clarification_result'
};

// Comprehensive ticker/company name mapping for Indian stocks
const TICKER_MAP = {
  // Major stocks
  'reliance': 'RELIANCE',
  'reliance industries': 'RELIANCE',
  'ril': 'RELIANCE',
  'tcs': 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  'infosys': 'INFY',
  'infy': 'INFY',
  'wipro': 'WIPRO',
  'hdfc bank': 'HDFCBANK',
  'hdfcbank': 'HDFCBANK',
  'hdfc': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  'icicibank': 'ICICIBANK',
  'icici': 'ICICIBANK',
  'sbi': 'SBIN',
  'state bank': 'SBIN',
  'state bank of india': 'SBIN',
  'kotak': 'KOTAKBANK',
  'kotak bank': 'KOTAKBANK',
  'kotak mahindra': 'KOTAKBANK',
  'axis bank': 'AXISBANK',
  'axis': 'AXISBANK',
  'bajaj finance': 'BAJFINANCE',
  'bajaj': 'BAJFINANCE',
  'bharti airtel': 'BHARTIARTL',
  'airtel': 'BHARTIARTL',
  'bharti': 'BHARTIARTL',
  'itc': 'ITC',
  'hindustan unilever': 'HINDUNILVR',
  'hul': 'HINDUNILVR',
  'unilever': 'HINDUNILVR',
  'asian paints': 'ASIANPAINT',
  'maruti': 'MARUTI',
  'maruti suzuki': 'MARUTI',
  'mahindra': 'M&M',
  'm&m': 'M&M',
  'mahindra and mahindra': 'M&M',
  'titan': 'TITAN',
  'titan company': 'TITAN',
  'sun pharma': 'SUNPHARMA',
  'sun pharmaceutical': 'SUNPHARMA',
  'dr reddy': 'DRREDDY',
  'cipla': 'CIPLA',
  'adani': 'ADANIENT',
  'adani enterprises': 'ADANIENT',
  'larsen': 'LT',
  'l&t': 'LT',
  'larsen and toubro': 'LT',
  'ultratech': 'ULTRACEMCO',
  'ultratech cement': 'ULTRACEMCO',
  'power grid': 'POWERGRID',
  'ntpc': 'NTPC',
  'ongc': 'ONGC',
  'coal india': 'COALINDIA',
  'ioc': 'IOC',
  'indian oil': 'IOC',
  'bpcl': 'BPCL',
  'bharat petroleum': 'BPCL',
  'grasim': 'GRASIM',
  'tata steel': 'TATASTEEL',
  'tata motors': 'TATAMOTORS',
  'tech mahindra': 'TECHM',
  'hcl tech': 'HCLTECH',
  'hcl': 'HCLTECH',
  'britannia': 'BRITANNIA',
  'nestle': 'NESTLEIND',
  'dabur': 'DABUR',
  'godrej': 'GODREJCP',
  'pidilite': 'PIDILITIND',
  'divi': 'DIVISLAB',
  'biocon': 'BIOCON',
  'srf': 'SRF',
  'indusind': 'INDUSINDBK',
  'indusind bank': 'INDUSINDBK',
  'bandhan': 'BANDHANBNK',
  'bandhan bank': 'BANDHANBNK',
  'yes bank': 'YESBANK',
  'pnb': 'PNB',
  'punjab national bank': 'PNB',
  'bank of baroda': 'BANKBARODA',
  'canara bank': 'CANBK',
};

/**
 * Classify user intent BEFORE ticker resolution
 */
export function classifyIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // RISKY_STOCKS intent
  if (
    lowerMessage.includes('risky stocks') ||
    lowerMessage.includes('show risky') ||
    lowerMessage.includes('weak stocks') ||
    lowerMessage.includes('stocks to avoid') ||
    lowerMessage.includes('bearish stocks') ||
    lowerMessage === 'show risky stocks'
  ) {
    return INTENTS.RISKY_STOCKS;
  }
  
  // FIND_OPPORTUNITIES intent
  if (
    lowerMessage.includes('find opportunities') ||
    lowerMessage.includes('best stocks') ||
    lowerMessage.includes('top stocks') ||
    lowerMessage.includes('opportunities') ||
    lowerMessage.includes('good stocks') ||
    lowerMessage.includes('stocks to buy') ||
    lowerMessage === 'find opportunities'
  ) {
    return INTENTS.FIND_OPPORTUNITIES;
  }
  
  // MARKET_OVERVIEW intent
  if (
    lowerMessage.includes('market overview') ||
    lowerMessage.includes('how is the market') ||
    lowerMessage.includes('market summary') ||
    lowerMessage.includes('market status') ||
    lowerMessage.includes('market today') ||
    lowerMessage === 'market overview'
  ) {
    return INTENTS.MARKET_OVERVIEW;
  }
  
  // PORTFOLIO_ANALYSIS intent
  if (
    lowerMessage.includes('analyze portfolio') ||
    lowerMessage.includes('my portfolio') ||
    lowerMessage.includes('portfolio analysis') ||
    lowerMessage.includes('portfolio review') ||
    lowerMessage === 'analyze portfolio'
  ) {
    return INTENTS.PORTFOLIO_ANALYSIS;
  }
  
  // SECTOR_ANALYSIS intent
  if (
    lowerMessage.includes('sector') ||
    lowerMessage.includes('it stocks') ||
    lowerMessage.includes('banking stocks') ||
    lowerMessage.includes('pharma stocks') ||
    lowerMessage.includes('auto stocks')
  ) {
    return INTENTS.SECTOR_ANALYSIS;
  }
  
  // STOCK_ANALYSIS intent - check if ticker/company mentioned
  const hasTicker = Object.keys(TICKER_MAP).some(key => lowerMessage.includes(key)) ||
                    /\b([A-Z]{2,10})\b/.test(message);
  
  if (
    hasTicker ||
    lowerMessage.includes('analyze') ||
    lowerMessage.includes('outlook') ||
    lowerMessage.includes('should i buy') ||
    lowerMessage.includes('should i sell') ||
    lowerMessage.includes('what about') ||
    lowerMessage.includes('tell me about')
  ) {
    return INTENTS.STOCK_ANALYSIS;
  }
  
  // Default to clarification if truly ambiguous
  return INTENTS.GENERAL_CLARIFICATION;
}

/**
 * Parse user query to extract ticker and timeframe (only for stock analysis)
 */
export function parseStockQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Extract ticker/company name
  let ticker = null;
  let matchedPhrase = null;
  
  // Try to match company names (longest match first)
  const sortedKeys = Object.keys(TICKER_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerMessage.includes(key)) {
      ticker = TICKER_MAP[key];
      matchedPhrase = key;
      break;
    }
  }
  
  // Try to match ticker symbols directly (2-10 uppercase letters)
  if (!ticker) {
    const tickerMatch = message.match(/\b([A-Z]{2,10})\b/);
    if (tickerMatch) {
      ticker = tickerMatch[1];
      matchedPhrase = ticker;
    }
  }
  
  // Extract timeframe
  let timeframe = 'short-term';
  if (lowerMessage.includes('long term') || lowerMessage.includes('long-term')) {
    timeframe = 'long-term';
  } else if (lowerMessage.includes('medium term') || lowerMessage.includes('medium-term')) {
    timeframe = 'medium-term';
  } else if (lowerMessage.includes('intraday') || lowerMessage.includes('today')) {
    timeframe = 'intraday';
  }
  
  return {
    ticker,
    matchedPhrase,
    timeframe
  };
}

/**
 * Fetch comprehensive stock data
 */
export async function fetchStockData(ticker) {
  try {
    // Fetch both detail and live quote in parallel
    const [detail, quotes] = await Promise.all([
      getStockDetail(ticker).catch(() => null),
      getLiveQuotes([ticker]).catch(() => null)
    ]);
    
    // Merge data
    const stockData = detail || {};
    const liveQuote = quotes?.quotes?.[ticker];
    
    if (liveQuote) {
      stockData.currentPrice = liveQuote.price;
      stockData.changePercent = liveQuote.changePercent;
      stockData.change = liveQuote.change;
    }
    
    return stockData;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch risky stocks list
 */
export async function fetchRiskyStocks() {
  try {
    const scanData = await scanMarket({ maxResults: 50, useAi: true });
    if (!scanData || !scanData.stocks) {
      return [];
    }
    
    // Filter for risky/bearish stocks
    const riskyStocks = scanData.stocks
      .filter(stock => {
        const signal = (stock.signal || '').toLowerCase();
        return signal.includes('sell') || signal.includes('short') || 
               stock.signalConfidence < 40 || stock.changePercent < -2;
      })
      .slice(0, 10)
      .map(stock => ({
        symbol: stock.symbol,
        name: stock.companyName || stock.symbol,
        price: stock.currentPrice,
        change: stock.changePercent,
        signal: stock.signal || 'Sell',
        confidence: stock.signalConfidence || 50,
        reason: stock.aiExplanation || stock.insight || 'Showing weakness in recent sessions'
      }));
    
    return riskyStocks;
  } catch (error) {
    console.error('Error fetching risky stocks:', error);
    return [];
  }
}

/**
 * Fetch opportunity stocks list
 */
export async function fetchOpportunities() {
  try {
    const scanData = await scanMarket({ maxResults: 50, useAi: true });
    if (!scanData || !scanData.stocks) {
      return [];
    }
    
    // Filter for bullish/opportunity stocks
    const opportunities = scanData.stocks
      .filter(stock => {
        const signal = (stock.signal || '').toLowerCase();
        return signal.includes('buy') || signal.includes('breakout') || 
               stock.signalConfidence > 70;
      })
      .slice(0, 10)
      .map(stock => ({
        symbol: stock.symbol,
        name: stock.companyName || stock.symbol,
        price: stock.currentPrice,
        change: stock.changePercent,
        signal: stock.signal || 'Buy',
        confidence: stock.signalConfidence || 70,
        reason: stock.aiExplanation || stock.insight || 'Showing positive momentum'
      }));
    
    return opportunities;
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }
}

/**
 * Generate market overview
 */
export async function generateMarketOverview() {
  try {
    const scanData = await scanMarket({ maxResults: 30, useAi: true });
    if (!scanData || !scanData.stocks) {
      return null;
    }
    
    const stocks = scanData.stocks;
    const bullishCount = stocks.filter(s => (s.signal || '').toLowerCase().includes('buy')).length;
    const bearishCount = stocks.filter(s => (s.signal || '').toLowerCase().includes('sell')).length;
    const avgChange = stocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / stocks.length;
    
    const topGainers = stocks
      .filter(s => s.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3);
    
    const topLosers = stocks
      .filter(s => s.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 3);
    
    return {
      sentiment: avgChange > 1 ? 'Bullish' : avgChange < -1 ? 'Bearish' : 'Neutral',
      avgChange,
      bullishCount,
      bearishCount,
      totalStocks: stocks.length,
      topGainers,
      topLosers
    };
  } catch (error) {
    console.error('Error generating market overview:', error);
    return null;
  }
}

/**
 * Generate dynamic analysis from real stock data
 */
export function generateStockAnalysis(stockData, timeframe) {
  if (!stockData || !stockData.symbol) {
    return null;
  }
  
  const {
    symbol,
    currentPrice = 0,
    changePercent = 0,
    signal = 'Hold',
    confidence = 50,
    volume,
    trend,
    rsi,
    momentum,
    aiSummary,
    aiExplanation,
    risk = {},
    tags = []
  } = stockData;
  
  // Determine signal status
  const isBullish = signal.includes('Buy');
  const isBearish = signal.includes('Sell');
  const signalStatus = signal || 'Hold';
  
  // Calculate dynamic confidence
  const dynamicConfidence = confidence || 50;
  
  // Generate summary based on real data
  let summary = `${symbol} is currently trading at ₹${currentPrice.toLocaleString('en-IN')} with a ${changePercent >= 0 ? 'gain' : 'loss'} of ${Math.abs(changePercent).toFixed(2)}% today. `;
  
  if (isBullish) {
    summary += `The stock shows ${signal.toLowerCase()} signal with ${dynamicConfidence}% confidence. `;
    summary += aiSummary || aiExplanation || `Technical indicators suggest positive momentum with ${trend || 'upward'} trend.`;
  } else if (isBearish) {
    summary += `The stock shows ${signal.toLowerCase()} signal with ${dynamicConfidence}% confidence. `;
    summary += aiSummary || aiExplanation || `Technical indicators suggest caution with ${trend || 'downward'} pressure.`;
  } else {
    summary += `The stock shows a ${signal.toLowerCase()} signal. `;
    summary += aiSummary || aiExplanation || `Current market conditions suggest a wait-and-watch approach.`;
  }
  
  // Generate risk factors
  const riskFactors = [];
  if (changePercent < -2) {
    riskFactors.push(`Significant intraday decline of ${Math.abs(changePercent).toFixed(2)}%`);
  }
  if (risk.level > 60) {
    riskFactors.push('High volatility detected in recent trading sessions');
  }
  if (isBearish) {
    riskFactors.push('Technical indicators showing bearish divergence');
  }
  if (volume && volume.includes('M')) {
    const volNum = parseFloat(volume);
    if (volNum < 1) {
      riskFactors.push('Below-average trading volume may indicate low liquidity');
    }
  }
  if (riskFactors.length === 0) {
    riskFactors.push('Standard market risk applies');
    riskFactors.push('Monitor for trend reversal signals');
  }
  
  // Generate catalysts
  const catalysts = tags.length > 0 
    ? tags.map(tag => `${tag} pattern detected in recent price action`)
    : [
        `${momentum || 'Current'} momentum in ${symbol}`,
        `${trend || 'Market'} trend alignment`,
        `Volume analysis suggests ${isBullish ? 'accumulation' : isBearish ? 'distribution' : 'consolidation'}`
      ];
  
  // Determine action plan
  let action = 'Monitor';
  let actionTerm = timeframe;
  let actionTarget = null;
  
  if (isBullish && dynamicConfidence > 70) {
    action = 'Consider Entry';
    actionTarget = risk.rewardAmt || `Target: ${(currentPrice * 1.05).toFixed(2)}`;
  } else if (isBearish && dynamicConfidence > 70) {
    action = 'Reduce Exposure';
    actionTerm = 'Near-term';
  } else {
    action = 'Hold & Monitor';
  }
  
  // Calculate signal strength (1-5)
  const signalStrength = Math.ceil(dynamicConfidence / 20);
  
  return {
    summary,
    signalStatus,
    confidence: dynamicConfidence,
    action,
    actionTerm,
    actionTarget,
    riskFactors,
    catalysts,
    sentimentChange: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
    signalStrength,
    riskLevel: risk.level > 60 ? 'High' : risk.level > 40 ? 'Medium' : 'Low',
    ticker: symbol,
    currentPrice,
    liveQuote: {
      price: currentPrice,
      changePercent,
      change: stockData.change || 0
    },
    chartData: stockData.chartData || []
  };
}

/**
 * Generate risky stocks response
 */
export function generateRiskyStocksResponse(riskyStocks) {
  if (!riskyStocks || riskyStocks.length === 0) {
    return {
      summary: 'Currently, I don\'t have enough data on risky stocks. The market appears relatively stable. Check back later for updated risk analysis.',
      signalStatus: 'No Data',
      confidence: 0,
      action: 'Monitor Market',
      actionTerm: 'Ongoing',
      riskFactors: ['Insufficient data for risk analysis'],
      catalysts: [],
      sentimentChange: 'N/A',
      signalStrength: 0,
      stocksList: []
    };
  }
  
  const summary = `I've identified ${riskyStocks.length} stocks showing weakness or bearish signals. These stocks are experiencing downward pressure, negative momentum, or elevated risk levels. Consider reviewing your exposure to these positions.`;
  
  return {
    summary,
    signalStatus: 'Risk Alert',
    confidence: 75,
    action: 'Review Exposure',
    actionTerm: 'Immediate',
    riskFactors: [
      `${riskyStocks.length} stocks showing bearish signals`,
      'Downward momentum detected',
      'Consider risk management strategies'
    ],
    catalysts: riskyStocks.slice(0, 3).map(s => `${s.symbol}: ${s.reason}`),
    sentimentChange: `${riskyStocks[0]?.change?.toFixed(2) || 'N/A'}%`,
    signalStrength: 4,
    stocksList: riskyStocks
  };
}

/**
 * Generate opportunities response
 */
export function generateOpportunitiesResponse(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return {
      summary: 'Currently, I don\'t see strong opportunities with high-confidence signals. The market may be in a consolidation phase. I recommend waiting for clearer setups.',
      signalStatus: 'No Clear Opportunities',
      confidence: 0,
      action: 'Wait for Setup',
      actionTerm: 'Pending',
      riskFactors: ['Market in consolidation'],
      catalysts: [],
      sentimentChange: 'N/A',
      signalStrength: 0,
      stocksList: []
    };
  }
  
  const summary = `I've found ${opportunities.length} high-potential opportunities with strong buy signals. These stocks are showing positive momentum, bullish patterns, and favorable risk/reward setups based on current technical analysis.`;
  
  return {
    summary,
    signalStatus: 'Strong Buy',
    confidence: 85,
    action: 'Consider Entry',
    actionTerm: 'Short-term',
    actionTarget: 'Multiple Targets',
    riskFactors: ['Standard market risk applies', 'Use proper position sizing'],
    catalysts: opportunities.slice(0, 3).map(s => `${s.symbol}: ${s.reason}`),
    sentimentChange: `+${opportunities[0]?.change?.toFixed(2) || 'N/A'}%`,
    signalStrength: 5,
    stocksList: opportunities
  };
}

/**
 * Generate market overview response
 */
export function generateMarketOverviewResponse(marketData) {
  if (!marketData) {
    return {
      summary: 'Unable to generate market overview at this time. Please try again later.',
      signalStatus: 'No Data',
      confidence: 0,
      action: 'Retry',
      actionTerm: 'Later',
      riskFactors: ['Data unavailable'],
      catalysts: [],
      sentimentChange: 'N/A',
      signalStrength: 0
    };
  }
  
  const { sentiment, avgChange, bullishCount, bearishCount, totalStocks, topGainers, topLosers } = marketData;
  
  const summary = `Market sentiment is ${sentiment} with an average change of ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}% across ${totalStocks} tracked stocks. ${bullishCount} stocks showing bullish signals vs ${bearishCount} bearish signals. `;
  
  const gainersText = topGainers.length > 0 
    ? `Top gainers: ${topGainers.map(s => `${s.symbol} (+${s.changePercent.toFixed(2)}%)`).join(', ')}. `
    : '';
  
  const losersText = topLosers.length > 0
    ? `Top losers: ${topLosers.map(s => `${s.symbol} (${s.changePercent.toFixed(2)}%)`).join(', ')}.`
    : '';
  
  return {
    summary: summary + gainersText + losersText,
    signalStatus: sentiment,
    confidence: 70,
    action: sentiment === 'Bullish' ? 'Look for Opportunities' : sentiment === 'Bearish' ? 'Exercise Caution' : 'Monitor',
    actionTerm: 'Ongoing',
    riskFactors: [
      `${bearishCount} stocks showing weakness`,
      sentiment === 'Bearish' ? 'Market under pressure' : 'Standard market risk'
    ],
    catalysts: [
      `${bullishCount} bullish signals detected`,
      `Average market movement: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
      `${topGainers.length} strong gainers identified`
    ],
    sentimentChange: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
    signalStrength: sentiment === 'Bullish' ? 4 : sentiment === 'Bearish' ? 2 : 3,
    marketData
  };
}

/**
 * Generate clarification response
 */
export function generateClarificationResponse(message) {
  return {
    summary: `I can help you with:\n\n• Stock Analysis - Ask about specific stocks like "Analyze RELIANCE" or "Outlook for TCS"\n• Find Opportunities - Get top buy signals and high-confidence setups\n• Show Risky Stocks - Identify stocks with bearish signals or weakness\n• Market Overview - Get broad market sentiment and notable movers\n• Portfolio Analysis - Review your holdings (if available)\n\nWhat would you like to explore?`,
    signalStatus: 'Awaiting Input',
    confidence: 0,
    action: 'Choose Command',
    actionTerm: 'Immediate',
    riskFactors: [],
    catalysts: [],
    sentimentChange: 'N/A',
    signalStrength: 0,
    needsClarification: true
  };
}

/**
 * Generate stock clarification response (when ticker not found)
 */
export function generateStockClarificationResponse() {
  return {
    summary: `Please specify which stock you'd like to analyze. You can use either the ticker symbol (like TCS, RELIANCE, INFY) or the company name (like "Tata Consultancy Services", "Reliance Industries").`,
    signalStatus: 'Awaiting Ticker',
    confidence: 0,
    action: 'Specify Stock',
    actionTerm: 'Immediate',
    riskFactors: ['Stock ticker not identified'],
    catalysts: [],
    sentimentChange: 'N/A',
    signalStrength: 0,
    needsClarification: true
  };
}

/**
 * Main assistant engine - processes query and returns complete analysis
 */
export async function processAssistantQuery(message) {
  // Step 1: Classify intent
  const intent = classifyIntent(message);
  
  // Step 2: Route based on intent
  switch (intent) {
    case INTENTS.RISKY_STOCKS: {
      const riskyStocks = await fetchRiskyStocks();
      const data = generateRiskyStocksResponse(riskyStocks);
      return {
        mode: RESPONSE_MODES.LIST_RESULT,
        type: 'risky',
        data,
        intent
      };
    }
    
    case INTENTS.FIND_OPPORTUNITIES: {
      const opportunities = await fetchOpportunities();
      const data = generateOpportunitiesResponse(opportunities);
      return {
        mode: RESPONSE_MODES.LIST_RESULT,
        type: 'bullish',
        data,
        intent
      };
    }
    
    case INTENTS.MARKET_OVERVIEW: {
      const marketData = await generateMarketOverview();
      const data = generateMarketOverviewResponse(marketData);
      return {
        mode: RESPONSE_MODES.MARKET_RESULT,
        type: marketData?.sentiment === 'Bullish' ? 'bullish' : marketData?.sentiment === 'Bearish' ? 'risky' : 'neutral',
        data,
        intent
      };
    }
    
    case INTENTS.PORTFOLIO_ANALYSIS: {
      return {
        mode: RESPONSE_MODES.PORTFOLIO_RESULT,
        type: 'neutral',
        data: {
          summary: 'Portfolio analysis feature is coming soon. For now, you can view your portfolio on the Portfolio page.',
          signalStatus: 'Feature Pending',
          confidence: 0,
          action: 'Visit Portfolio Page',
          actionTerm: 'Now',
          riskFactors: [],
          catalysts: [],
          sentimentChange: 'N/A',
          signalStrength: 0
        },
        intent
      };
    }
    
    case INTENTS.STOCK_ANALYSIS: {
      // Parse stock query
      const parsed = parseStockQuery(message);
      
      // If no ticker found, ask for clarification
      if (!parsed.ticker) {
        return {
          mode: RESPONSE_MODES.CLARIFICATION_RESULT,
          type: 'neutral',
          data: generateStockClarificationResponse(),
          intent
        };
      }
      
      // Fetch stock data
      const stockData = await fetchStockData(parsed.ticker);
      
      // If data fetch failed, return error
      if (!stockData || !stockData.symbol) {
        return {
          mode: RESPONSE_MODES.CLARIFICATION_RESULT,
          type: 'neutral',
          data: {
            summary: `Unable to fetch data for ${parsed.ticker}. Please verify the ticker symbol and try again. Common tickers: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK.`,
            signalStatus: 'Data Error',
            confidence: 0,
            action: 'Verify Ticker',
            actionTerm: 'Immediate',
            riskFactors: [`Data unavailable for ${parsed.ticker}`],
            catalysts: [],
            sentimentChange: 'N/A',
            signalStrength: 0,
            error: true
          },
          intent
        };
      }
      
      // Generate analysis
      const analysis = generateStockAnalysis(stockData, parsed.timeframe);
      
      // Determine response type
      const type = analysis.signalStatus.includes('Buy') ? 'bullish' : 
                   analysis.signalStatus.includes('Sell') ? 'risky' : 'neutral';
      
      return {
        mode: RESPONSE_MODES.STOCK_RESULT,
        type,
        data: analysis,
        stockData,
        intent
      };
    }
    
    case INTENTS.GENERAL_CLARIFICATION:
    default: {
      return {
        mode: RESPONSE_MODES.CLARIFICATION_RESULT,
        type: 'neutral',
        data: generateClarificationResponse(message),
        intent
      };
    }
  }
}

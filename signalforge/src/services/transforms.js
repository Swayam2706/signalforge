/**
 * Data transformation utilities.
 * Maps backend API response shapes to the frontend's expected data shapes.
 * This keeps UI components clean and decoupled from API changes.
 */

// ─── Signal label normalisation ───────────────────────────────────────────────
// Backend may return "Bullish", "Bearish", "Neutral" — map to frontend labels.

const SIGNAL_MAP = {
  bullish: 'Buy',
  strong_bullish: 'Strong Buy',
  bearish: 'Sell',
  strong_bearish: 'Sell',
  neutral: 'Hold',
  momentum: 'Buy',
  breakout: 'Strong Buy',
  risky: 'Sell',
};

export function normaliseSignal(raw = '') {
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  return SIGNAL_MAP[key] || raw;
}

// ─── Stock list item (for dashboard signals list) ─────────────────────────────

/**
 * Transform a backend scan result stock into the frontend stock shape.
 * Backend: { symbol, price, signal, confidence, trend, risk, tags, explanation }
 * Frontend: { symbol, name, sector, price, change, signal, confidence, logo }
 */
export function transformScanStock(backendStock) {
  return {
    symbol: backendStock.symbol,
    name: backendStock.symbol, // backend doesn't return full name in scan
    sector: backendStock.trend || 'Market',
    price: backendStock.price ?? 0,
    change: backendStock.change ?? 0,
    signal: normaliseSignal(backendStock.signal),
    confidence: backendStock.confidence ?? 0,
    logo: (backendStock.symbol || '').slice(0, 2).toUpperCase(),
    explanation: backendStock.explanation || '',
    tags: backendStock.tags || [],
    risk: backendStock.risk || '',
  };
}

// ─── Stock detail (for StockDetailPage) ──────────────────────────────────────

/**
 * Transform backend StockDetailResponse into the frontend stockDetails shape.
 * Backend: { symbol, price, volume, ohlc[], signal, confidence, trend, risk, tags, explanation }
 * Frontend: { symbol, name, price, change, signal, confidence, volume, aiSummary, chartData, ... }
 */
export function transformStockDetail(backendDetail) {
  const ohlc = backendDetail.ohlc || [];
  
  // Pre-compute min/max for chart scaling
  const closes = ohlc.map(pt => pt.close);
  const minClose = closes.length > 0 ? Math.min(...closes) : 0;
  const maxClose = closes.length > 0 ? Math.max(...closes) : 1;
  const range = maxClose - minClose || 1;

  // Convert OHLC to SVG chart coordinates (800x300 viewBox)
  const chartData = ohlc.map((pt, i) => ({
    x: ohlc.length > 1 ? i * (800 / (ohlc.length - 1)) : 400,
    y: 280 - ((pt.close - minClose) / range) * 260 + 10,
  }));

  const signal = normaliseSignal(backendDetail.signal);
  const isBuy = signal.includes('Buy');

  // Compute change from OHLC data
  const firstClose = closes[0] || 0;
  const lastClose = closes[closes.length - 1] || 0;
  const changePct = firstClose ? round2(((lastClose - firstClose) / firstClose) * 100) : (backendDetail.change || 0);
  const changeAmt = round2(lastClose - firstClose) || (backendDetail.changeAmt || 0);

  return {
    symbol: backendDetail.symbol,
    name: backendDetail.symbol,
    sector: 'Market',
    price: backendDetail.price ?? lastClose ?? 0,
    change: changePct,
    changeAmt: changeAmt,
    signal,
    confidence: backendDetail.confidence ?? 0,
    volume: backendDetail.volume ? `${(backendDetail.volume / 1e6).toFixed(1)}M` : 'N/A',
    volumeChange: '',
    rsi: 50,
    momentum: backendDetail.trend || 'Neutral',
    volatility: 'Medium',
    iv: 'N/A',
    conclusion: isBuy ? 'Positive Momentum Detected' : 'Caution Advised',
    conclusionText: backendDetail.explanation || '',
    timeHorizon: 'Short Term',
    targetPrice: 'N/A',
    aiSummary: backendDetail.explanation || '',
    aiExplanation: backendDetail.explanation || '',
    confidenceDrivers: backendDetail.tags || [],
    contextInsights: backendDetail.contextInsights?.length > 0
      ? backendDetail.contextInsights
      : (backendDetail.tags || []).map((tag, i) => ({
          title: tag,
          strength: 'Medium',
          color: ['emerald', 'amber', 'blue', 'purple'][i % 4],
          text: tag,
        })),
    timeline: [
      { label: 'Signal Detected', time: 'Just now', status: 'active' },
      { label: 'Analysis Complete', time: 'Just now', status: 'complete' },
    ],
    risk: {
      level: isBuy ? 40 : 70,
      reward: isBuy ? 75 : 30,
      ratio: isBuy ? '1:2' : '2:1',
      riskAmt: 'N/A',
      rewardAmt: 'N/A',
      entry: 'Market',
      stopLoss: 'N/A',
    },
    warnings: backendDetail.risk ? [{ title: 'Risk Note', text: backendDetail.risk }] : [],
    chartData: chartData.length > 0 ? chartData : [{ x: 0, y: 150 }, { x: 800, y: 150 }],
    lastUpdated: backendDetail.last_updated || new Date().toISOString(),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

// ─── Portfolio ────────────────────────────────────────────────────────────────

/**
 * Transform backend portfolio response into frontend portfolio shape.
 */
export function transformPortfolio(backendPortfolio) {
  const items = backendPortfolio.items || backendPortfolio.portfolio_items || [];
  const holdings = items.map(item => ({
    symbol: item.symbol,
    name: item.symbol,
    price: item.current_price ?? item.avg_price ?? 0,
    shares: item.quantity ?? 0,
    signal: normaliseSignal(item.signal || 'Hold'),
    confidence: item.confidence ?? 60,
    risk: item.risk_level || 'Medium',
    change: item.pnl_percent ?? 0,
  }));

  return {
    totalValue: backendPortfolio.total_value ?? 0,
    dailyChange: backendPortfolio.total_pnl_percent ?? 0,
    dailyChangeAmt: backendPortfolio.total_pnl ?? 0,
    healthScore: 75,
    riskLevel: 'Medium',
    beta: 1.0,
    volatility: 12,
    holdings,
    riskDistribution: { low: 40, medium: 40, high: 20 },
    sectorDistribution: { Tech: 40, Energy: 20, Consumer: 20, Finance: 20 },
    insights: [],
    actions: [],
    trendData: [],
  };
}

// ─── Assistant response ───────────────────────────────────────────────────────

/**
 * Transform backend ChatResponse into the frontend assistantResponse shape.
 * Handles both the new structured AI response and legacy format.
 */
export function transformAssistantResponse(backendResponse) {
  // New structured format from OpenRouter pipeline
  if (backendResponse.signal || backendResponse.riskFactors) {
    return {
      summary: backendResponse.response || backendResponse.summary || '',
      signalStatus: backendResponse.signal || 'Hold',
      confidence: backendResponse.confidence ?? 70,
      action: backendResponse.actionPlan?.label || 'Monitor',
      actionTerm: backendResponse.actionPlan?.timeframe || 'Short-term',
      riskFactors: backendResponse.riskFactors || [],
      riskLevel: backendResponse.riskLevel || 'Medium',
      sentimentChange: backendResponse.liveQuote
        ? `${backendResponse.liveQuote.changePercent >= 0 ? '+' : ''}${backendResponse.liveQuote.changePercent}%`
        : 'N/A',
      signalStrength: Math.ceil((backendResponse.confidence ?? 50) / 20),
      catalysts: backendResponse.riskFactors || [],
      providerUsed: backendResponse.provider_used || 'AI',
      processingTime: backendResponse.processing_time || 0,
      ticker: backendResponse.ticker,
      liveQuote: backendResponse.liveQuote,
    };
  }

  // Legacy format fallback
  const relatedStocks = backendResponse.related_stocks || [];
  const isBuy = relatedStocks.some(s => normaliseSignal(s.signal).includes('Buy'));

  return {
    summary: backendResponse.response || '',
    signalStatus: isBuy ? 'Strong Buy' : 'Hold',
    confidence: relatedStocks[0]?.confidence ?? 70,
    action: isBuy ? 'Consider Entry' : 'Monitor',
    actionTerm: 'Short-term',
    catalysts: relatedStocks.map(s => `${s.symbol}: ${s.explanation}`),
    providerUsed: backendResponse.provider_used || 'AI',
    processingTime: backendResponse.processing_time || 0,
  };
}

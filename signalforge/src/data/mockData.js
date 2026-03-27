// ─── Stocks ───
export const stocks = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Semiconductors', price: 875.28, change: 2.45, signal: 'Strong Buy', confidence: 94, logo: 'NV' },
  { symbol: 'TSLA', name: 'Tesla Inc', sector: 'Auto Manufacturers', price: 172.40, change: -1.82, signal: 'Sell', confidence: 82, logo: 'TS' },
  { symbol: 'AAPL', name: 'Apple Inc', sector: 'Consumer Electronics', price: 168.90, change: 0.15, signal: 'Hold', confidence: 65, logo: 'AA' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Software', price: 24.80, change: 4.2, signal: 'Strong Buy', confidence: 91, logo: 'PL' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', price: 164.20, change: 3.12, signal: 'Buy', confidence: 88, logo: 'AM' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Cybersecurity', price: 285.50, change: -1.45, signal: 'Sell', confidence: 76, logo: 'CR' },
  { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Software', price: 415.10, change: 1.1, signal: 'Buy', confidence: 85, logo: 'MS' },
  { symbol: 'XOM', name: 'ExxonMobil', sector: 'Energy', price: 112.80, change: 2.3, signal: 'Buy', confidence: 81, logo: 'XO' },
];

export const topPick = {
  symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Tech', price: 24.80, change: 4.2,
  signal: 'Strong Buy', confidence: 91, rank: 1,
  trendStrength: 87, volumeSpike: '2.3x avg', momentum: 'Strong Buy',
  insight: 'Unusual options activity detected combined with positive sentiment shift in recent enterprise software procurement data. Breakout probability high within 48h.',
};

// ─── Dashboard Metrics ───
export const dashboardMetrics = {
  dataPoints: '2.4M', modelAccuracy: '94%', latency: '<50ms',
  sentiment: 78, sentimentLabel: 'Positive Momentum', techInflow: '+1.4%',
  sectors: { Tech: 35, Finance: 25, Energy: 20, Healthcare: 20 },
  topMovers: [
    { symbol: 'PLTR', change: '+5.2%', up: true },
    { symbol: 'NVDA', change: '+3.8%', up: true },
    { symbol: 'AMD', change: '+2.9%', up: true },
    { symbol: 'TSLA', change: '-2.1%', up: false },
  ],
  buyVsSell: { bull: 70, bear: 30, mixed: 45 },
};

// ─── Stock Detail ───
export const stockDetails = {
  NVDA: {
    name: 'NVIDIA Corp.', symbol: 'NVDA', sector: 'Semiconductors', price: 822.79, change: 0.39, changeAmt: 3.18,
    signal: 'Strong Buy', confidence: 92,
    volume: '45.2M', volumeChange: '+145%', rsi: 68.4, momentum: 'Strong', volatility: 'Medium', iv: '24.8%',
    conclusion: 'Momentum Continuation Expected',
    conclusionText: 'Technical structure strongly favors the upside following a decisive breakout on high relative volume.',
    timeHorizon: 'Short/Medium Term (1-3 wks)', targetPrice: '₹72,660',
    aiSummary: 'Strong Buy momentum with breakout confirmation above key resistance. Volume surge indicates institutional participation.',
    aiExplanation: "NVIDIA's stock just pushed past a key resistance ceiling with 145% above-average volume. This breakout, combined with positive sentiment alignment, suggests the path is open for a move toward ₹72,000-₹73,000 in the near term.",
    confidenceDrivers: ['Breakout confirmed', 'Volume surge', 'Sentiment positive'],
    contextInsights: [
      { title: 'Breakout above resistance', strength: 'Strong', color: 'emerald', text: 'Price cleanly broke the $815 resistance level established over the past 3 weeks, confirming a new upward channel.' },
      { title: 'Unusual Volume Spike', strength: 'Strong', color: 'amber', text: 'Trading volume is 145% above the 20-day average, indicating strong institutional conviction behind the move.' },
      { title: 'MACD Buy Crossover', strength: 'Strong', color: 'blue', text: 'The MACD line crossed above the signal line in positive territory, a classic momentum indicator supporting the uptrend.' },
      { title: 'Option Flow Positioning', strength: 'Medium', color: 'purple', text: 'Heavy call buying detected at the $850 strike expiring next Friday, suggesting expectations of continued upside.' },
    ],
    timeline: [
      { label: 'Breakout Detected', time: '2h ago', status: 'complete' },
      { label: 'Volume Spike', time: '45m ago', status: 'active' },
      { label: 'Momentum Shift', time: 'Active', status: 'complete' },
      { label: 'Sentiment Alignment', time: 'Pending', status: 'pending' },
    ],
    risk: { level: 45, reward: 82, ratio: '1:3', riskAmt: '₹1,411', rewardAmt: '₹3,546', entry: '₹68,460 - ₹69,300', stopLoss: 'Below ₹67,032' },
    warnings: [
      { title: 'Macro Headwinds', text: "Upcoming Fed inflation data tomorrow could cause sector-wide tech selloffs, regardless of NVDA's technicals." },
      { title: 'False Breakout', text: 'If the price drops back and closes below $800, this buy setup is completely invalidated.' },
    ],
    chartData: [
      { x: 0, y: 250 }, { x: 50, y: 260 }, { x: 100, y: 230 }, { x: 150, y: 240 }, { x: 200, y: 250 },
      { x: 250, y: 180 }, { x: 300, y: 190 }, { x: 350, y: 200 }, { x: 400, y: 130 }, { x: 450, y: 140 },
      { x: 500, y: 150 }, { x: 550, y: 110 }, { x: 600, y: 85 }, { x: 650, y: 60 }, { x: 700, y: 70 }, { x: 750, y: 40 }, { x: 800, y: 30 },
    ],
  },
  TSLA: {
    name: 'Tesla Inc', symbol: 'TSLA', sector: 'Auto Manufacturers', price: 172.40, change: -1.82, changeAmt: -3.19,
    signal: 'Sell', confidence: 78,
    volume: '32.1M', volumeChange: '+45%', rsi: 42.1, momentum: 'Weak', volatility: 'High', iv: '38.2%',
    conclusion: 'Selling Pressure Continues',
    conclusionText: 'Technical breakdown continuing with elevated probability of further downside.',
    timeHorizon: 'Short Term (1-2 wks)', targetPrice: '₹13,020',
    aiSummary: 'Sell signal with negative momentum. Distribution patterns forming with declining institutional support.',
    aiExplanation: 'Tesla is showing a double top formation validated by MACD sell crossover. Insider selling cluster detected over last 7 days.',
    confidenceDrivers: ['Sell pattern', 'Volume decline', 'Insider selling'],
    contextInsights: [
      { title: 'Double Top Formation', strength: 'Strong', color: 'red', text: 'Classic reversal pattern confirmed at the $180 level.' },
      { title: 'Declining Volume', strength: 'Medium', color: 'amber', text: 'Buying volume has decreased 30% over the past 5 sessions.' },
      { title: 'MACD Sell Signal', strength: 'Strong', color: 'red', text: 'MACD crossed below signal line, confirming downward momentum.' },
      { title: 'Insider Activity', strength: 'Strong', color: 'purple', text: 'Multiple insider sales reported in the last 7 days totaling $12M.' },
    ],
    timeline: [
      { label: 'Pattern Detected', time: '1d ago', status: 'complete' },
      { label: 'Volume Drop', time: '6h ago', status: 'complete' },
      { label: 'MACD Cross', time: '2h ago', status: 'active' },
      { label: 'Support Test', time: 'Pending', status: 'pending' },
    ],
    risk: { level: 72, reward: 35, ratio: '2:1', riskAmt: '₹1,882', rewardAmt: '₹1,462', entry: 'Avoid', stopLoss: 'N/A' },
    warnings: [
      { title: 'Continued Selling', text: 'Institutional holders reducing positions. Risk of accelerated decline.' },
      { title: 'Earnings Risk', text: 'Upcoming earnings could amplify volatility in either direction.' },
    ],
    chartData: [
      { x: 0, y: 50 }, { x: 100, y: 80 }, { x: 200, y: 60 }, { x: 300, y: 120 }, { x: 400, y: 100 },
      { x: 500, y: 180 }, { x: 600, y: 150 }, { x: 700, y: 220 }, { x: 800, y: 280 },
    ],
  },
  AMD: {
    name: 'Advanced Micro Devices', symbol: 'AMD', sector: 'Semiconductors', price: 164.20, change: 3.12, changeAmt: 4.96,
    signal: 'Buy', confidence: 88,
    volume: '28.4M', volumeChange: '+82%', rsi: 61.2, momentum: 'Strong', volatility: 'Medium', iv: '22.1%',
    conclusion: 'Breakout Setup Forming',
    conclusionText: 'Volume divergence on the 4H chart aligning with heavy call buying in the $170 strike.',
    timeHorizon: 'Short Term (1-2 wks)', targetPrice: '₹14,952',
    aiSummary: 'Buy momentum building with volume confirmation and options flow support.',
    aiExplanation: 'AMD is showing strong accumulation patterns with volume 82% above average. Supply zone broken with call buying at key strike levels.',
    confidenceDrivers: ['Volume breakout', 'Options flow', 'Sector strength'],
    contextInsights: [
      { title: 'Volume Breakout', strength: 'Strong', color: 'emerald', text: 'Volume divergence confirms buying pressure at current levels.' },
      { title: 'Options Activity', strength: 'Strong', color: 'purple', text: 'Heavy call buying at $170 strike suggests upside expectations.' },
      { title: 'Sector Tailwind', strength: 'Medium', color: 'blue', text: 'Semiconductor sector showing broad strength with positive rotation.' },
      { title: 'RSI Momentum', strength: 'Medium', color: 'amber', text: 'RSI at 61.2 shows room for further upside before overbought territory.' },
    ],
    timeline: [
      { label: 'Accumulation', time: '3d ago', status: 'complete' },
      { label: 'Volume Spike', time: '1d ago', status: 'complete' },
      { label: 'Breakout', time: 'Active', status: 'active' },
      { label: 'Target Zone', time: 'Pending', status: 'pending' },
    ],
    risk: { level: 38, reward: 75, ratio: '1:2.5', riskAmt: '₹1,193', rewardAmt: '₹1,159', entry: '₹13,440 - ₹13,860', stopLoss: 'Below ₹12,600' },
    warnings: [
      { title: 'Competition Risk', text: 'NVIDIA dominance in AI chips could limit AMD upside.' },
      { title: 'Sector Rotation', text: 'Broad market rotation out of tech could impact momentum.' },
    ],
    chartData: [
      { x: 0, y: 200 }, { x: 100, y: 180 }, { x: 200, y: 190 }, { x: 300, y: 160 }, { x: 400, y: 140 },
      { x: 500, y: 120 }, { x: 600, y: 100 }, { x: 700, y: 80 }, { x: 800, y: 60 },
    ],
  },
};

// Default detail for any stock not explicitly defined
export const getStockDetail = (symbol) => {
  if (stockDetails[symbol]) return stockDetails[symbol];
  const stock = stocks.find(s => s.symbol === symbol);
  if (!stock) return stockDetails.NVDA;
  return {
    ...stockDetails.NVDA,
    name: stock.name, symbol: stock.symbol, sector: stock.sector,
    price: stock.price, change: stock.change, changeAmt: stock.price * (stock.change / 100),
    signal: stock.signal, confidence: stock.confidence,
  };
};

// ─── AI Assistant ───
export const assistantResponses = {
  'Show risky stocks today': {
    summary: 'The tech sector is exhibiting localized weakness. Analysis indicates CRM and SNOW are showing significant distribution patterns at technical resistance, combined with declining institutional accumulation.',
    riskFactors: ['High volume spike selling (4 sessions)', 'Aggressive put buying detected', 'RSI divergence on daily'],
    sentimentChange: '-12.4%', signalStrength: 4, signalStatus: 'Risky',
    confidence: 84, action: 'Avoid / Hedge', actionTerm: 'Short-term',
  },
  'Why is TCS a Strong Buy right now?': {
    summary: 'TCS (Tata Consultancy Services) is displaying a confirmed positive momentum structure, driven by a surge in large-cap cloud transformation deals and a favorable currency tailwind.',
    catalysts: [
      'Clear breakout above multi-month consolidation at ₹3,850 with strong volume confirmation.',
      'Unusual options activity signals institutional positioning for ₹4,100 target.',
      'Sector rotation into IT services providing macro support.',
    ],
    signalStatus: 'Strong Buy', confidence: 93, action: 'Consider Entry', actionTarget: 'Target: ₹4,100',
    momentum: { rsi: '62.4 ↑', macd: 'Buy Cross' },
    flow: { fii: '+₹124Cr', dii: '+₹89Cr' },
  },
};

export const suggestedPrompts = [
  'Show risky stocks today',
  'Why is TCS a Strong Buy right now?',
  'What are the top opportunities in biotech this week?',
  'Analyze my portfolio risk exposure',
  'Which sectors are showing momentum?',
];

// ─── Portfolios ───
export const portfolios = {
  'Growth Portfolio': {
    totalValue: 1245890, dailyChange: 1.24, dailyChangeAmt: 15448.20,
    healthScore: 84, riskLevel: 'Medium', beta: 1.12, volatility: 14,
    holdings: [
      { symbol: 'NVDA', name: 'NVIDIA', price: 875.28, shares: 120, signal: 'Strong Buy', confidence: 92, risk: 'High', change: 2.45 },
      { symbol: 'MSFT', name: 'Microsoft', price: 415.10, shares: 200, signal: 'Buy', confidence: 85, risk: 'Low', change: 1.1 },
      { symbol: 'TSLA', name: 'Tesla', price: 175.34, shares: 150, signal: 'Sell', confidence: 78, risk: 'High', change: -1.82 },
      { symbol: 'AAPL', name: 'Apple', price: 168.45, shares: 300, signal: 'Hold', confidence: 65, risk: 'Low', change: 0.15 },
      { symbol: 'XOM', name: 'ExxonMobil', price: 112.80, shares: 250, signal: 'Buy', confidence: 81, risk: 'Medium', change: 2.3 },
    ],
    riskDistribution: { low: 45, medium: 35, high: 20 },
    sectorDistribution: { Tech: 42, Energy: 18, Consumer: 25, Finance: 15 },
    insights: [
      { type: 'warning', icon: 'alert', title: 'Risk Alert: Tech Overexposure', confidence: 'High', text: 'Portfolio is 42% weighted in Tech. Recommended max: 35% for your risk profile.' },
      { type: 'negative', icon: 'check', title: 'Weak Position: TSLA', confidence: '78%', text: 'Technical breakdown continuing. Elevated probability of further downside.' },
      { type: 'positive', icon: 'trend', title: 'Opportunity: Energy Sector', confidence: '91%', text: 'Macro conditions improving. Consider XOM or broad energy exposure.' },
      { type: 'neutral', icon: 'dollar', title: 'Yield Below Target', confidence: 'Data', text: 'Projected annual yield: 1.8%. Target: 2.5%. Gap: -0.7%' },
    ],
    actions: [
      { title: 'Rebalance Tech Exposure', impact: 'Medium', text: 'Sell 5% of MSFT and AAPL to reduce sector concentration risk.', outcome: '-7% Tech Weight • Lower Beta', color: 'blue' },
      { title: 'Hedge TSLA Position', impact: 'High', text: 'Consider buying out-of-the-money put options to protect downside.', outcome: '-12% Risk Beta • Downside Protection', color: 'orange' },
      { title: 'Increase Energy Allocation', impact: 'Medium', text: 'Deploy available cash ($45k) into XOM to hit target sector weighting.', outcome: '+2.4% Yield • Sector Balance', color: 'teal' },
    ],
    trendData: [
      { month: 'Oct', value: 1100000, benchmark: 1050000 },
      { month: 'Nov', value: 1150000, benchmark: 1080000 },
      { month: 'Dec', value: 1180000, benchmark: 1100000 },
      { month: 'Jan', value: 1210000, benchmark: 1130000 },
      { month: 'Feb', value: 1230000, benchmark: 1160000 },
      { month: 'Mar', value: 1245890, benchmark: 1190000 },
    ],
  },
  'Balanced Portfolio': {
    totalValue: 890450, dailyChange: 0.68, dailyChangeAmt: 6055.06,
    healthScore: 91, riskLevel: 'Low', beta: 0.85, volatility: 9,
    holdings: [
      { symbol: 'MSFT', name: 'Microsoft', price: 415.10, shares: 100, signal: 'Buy', confidence: 85, risk: 'Low', change: 1.1 },
      { symbol: 'AAPL', name: 'Apple', price: 168.45, shares: 250, signal: 'Hold', confidence: 65, risk: 'Low', change: 0.15 },
      { symbol: 'XOM', name: 'ExxonMobil', price: 112.80, shares: 300, signal: 'Buy', confidence: 81, risk: 'Medium', change: 2.3 },
      { symbol: 'AMD', name: 'AMD', price: 164.20, shares: 80, signal: 'Buy', confidence: 88, risk: 'Medium', change: 3.12 },
    ],
    riskDistribution: { low: 55, medium: 35, high: 10 },
    sectorDistribution: { Tech: 30, Energy: 28, Consumer: 22, Finance: 20 },
    insights: [
      { type: 'positive', icon: 'check', title: 'Well Diversified', confidence: '91%', text: 'Portfolio is well balanced across sectors with low correlation risk.' },
      { type: 'positive', icon: 'trend', title: 'Energy Momentum', confidence: '85%', text: 'XOM position benefiting from sector rotation into energy.' },
      { type: 'neutral', icon: 'dollar', title: 'Moderate Growth', confidence: 'Data', text: 'YTD return: 8.2%. Benchmark: 7.5%. Outperforming by 0.7%.' },
    ],
    actions: [
      { title: 'Add Growth Exposure', impact: 'Medium', text: 'Consider adding NVDA for AI sector exposure.', outcome: '+3% Growth Potential', color: 'teal' },
      { title: 'Lock in XOM Gains', impact: 'Low', text: 'XOM up 18% YTD. Consider trimming 10% to lock profits.', outcome: 'Reduced Energy Risk', color: 'blue' },
    ],
    trendData: [
      { month: 'Oct', value: 840000, benchmark: 830000 },
      { month: 'Nov', value: 855000, benchmark: 845000 },
      { month: 'Dec', value: 865000, benchmark: 860000 },
      { month: 'Jan', value: 875000, benchmark: 870000 },
      { month: 'Feb', value: 882000, benchmark: 880000 },
      { month: 'Mar', value: 890450, benchmark: 890000 },
    ],
  },
  'Defensive Portfolio': {
    totalValue: 520300, dailyChange: -0.32, dailyChangeAmt: -1664.96,
    healthScore: 76, riskLevel: 'Low', beta: 0.62, volatility: 6,
    holdings: [
      { symbol: 'AAPL', name: 'Apple', price: 168.45, shares: 400, signal: 'Hold', confidence: 65, risk: 'Low', change: 0.15 },
      { symbol: 'XOM', name: 'ExxonMobil', price: 112.80, shares: 350, signal: 'Buy', confidence: 81, risk: 'Medium', change: 2.3 },
      { symbol: 'MSFT', name: 'Microsoft', price: 415.10, shares: 50, signal: 'Buy', confidence: 85, risk: 'Low', change: 1.1 },
    ],
    riskDistribution: { low: 70, medium: 25, high: 5 },
    sectorDistribution: { Tech: 25, Energy: 35, Consumer: 30, Finance: 10 },
    insights: [
      { type: 'positive', icon: 'check', title: 'Low Volatility', confidence: '88%', text: 'Portfolio beta of 0.62 provides strong downside protection.' },
      { type: 'warning', icon: 'alert', title: 'Limited Upside', confidence: '72%', text: 'Conservative positioning may underperform in bull markets.' },
      { type: 'neutral', icon: 'dollar', title: 'Dividend Focus', confidence: 'Data', text: 'Projected yield: 2.8%. Above target of 2.5%.' },
    ],
    actions: [
      { title: 'Add Dividend Stocks', impact: 'Low', text: 'Consider adding high-yield defensive names for income.', outcome: '+0.5% Yield Improvement', color: 'teal' },
    ],
    trendData: [
      { month: 'Oct', value: 510000, benchmark: 505000 },
      { month: 'Nov', value: 515000, benchmark: 510000 },
      { month: 'Dec', value: 518000, benchmark: 515000 },
      { month: 'Jan', value: 520000, benchmark: 518000 },
      { month: 'Feb', value: 522000, benchmark: 520000 },
      { month: 'Mar', value: 520300, benchmark: 522000 },
    ],
  },
};

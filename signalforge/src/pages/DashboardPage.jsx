import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import TopBar from '../components/TopBar';
import SignalBadge from '../components/SignalBadge';
import MiniSparkline from '../components/MiniSparkline';
import { stocks as mockStocks, topPick as mockTopPick, dashboardMetrics } from '../data/mockData';
import { useApi } from '../hooks/useApi';
import { scanMarket, getLiveQuotes, getDashboardOverview } from '../services/api';
import { transformScanStock } from '../services/transforms';

export default function DashboardPage() {
  // Signal filter state
  const [signalFilter, setSignalFilter] = useState('All');

  // Load scan data (signals + analysis) — refreshes every 5 min
  const { data: scanData } = useApi(
    () => scanMarket({ maxResults: 10 }),
    null, [], 300000
  );

  // Load live quotes — polls every 15 seconds
  const defaultSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'BAJFINANCE', 'ICICIBANK', 'KOTAKBANK', 'SBIN', 'HINDUNILVR', 'BHARTIARTL'];
  const scanSymbols = scanData?.top_stocks?.map(s => s.symbol) || [];
  const symbolsToQuote = scanSymbols.length > 0 ? scanSymbols : defaultSymbols;
  const { data: liveQuotes } = useApi(
    () => getLiveQuotes(symbolsToQuote),
    null, [symbolsToQuote.join(',')], 15000
  );

  // Load dashboard overview (right panel) — refreshes every 60s
  const { data: overview } = useApi(
    () => getDashboardOverview(),
    null, [], 60000
  );

  // Merge scan + live quotes
  const liveStocks = scanData?.top_stocks
    ? scanData.top_stocks.map(s => {
        const base = transformScanStock(s);
        const quote = liveQuotes?.quotes?.[s.symbol];
        if (quote) return { ...base, price: quote.price, change: quote.changePercent };
        return base;
      })
    : null;

  const stocks = liveStocks || mockStocks;
  const topPick = (liveStocks && liveStocks[0]) ? {
    ...liveStocks[0],
    trendStrength: liveStocks[0].confidence,
    volumeSpike: liveStocks[0].tags?.[0] || 'N/A',
    momentum: liveStocks[0].signal,
    insight: liveStocks[0].explanation || mockTopPick.insight,
    sector: liveStocks[0].sector || 'Market',
    rank: 1,
  } : mockTopPick;

  // Right panel data — live or fallback to mock
  const sentiment = overview?.marketSentiment || { score: dashboardMetrics.sentiment, label: dashboardMetrics.sentimentLabel, changeText: dashboardMetrics.techInflow + ' tech inflow' };
  const topMovers = overview?.topMovers || dashboardMetrics.topMovers;
  const dataPoints = overview?.dataPoints || dashboardMetrics.dataPoints;
  const chartLine = sentiment.chartLine || "M0,50 L40,45 L80,42 L120,38 L160,32 L200,28 L240,22 L280,18 L300,15";
  const chartArea = sentiment.chartArea || (chartLine + " L300,70 L0,70 Z");

  // CRITICAL FIX: Compute analytics dynamically from actual stocks data
  const analytics = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return { buyVsSell: dashboardMetrics.buyVsSell, sectors: dashboardMetrics.sectors };
    }

    // Normalize signal values for consistent matching
    const normalizeSignal = (signal) => {
      const s = (signal || '').toLowerCase().trim();
      if (s.includes('buy') || s === 'breakout' || s === 'momentum') return 'buy';
      if (s.includes('sell') || s === 'risky') return 'sell';
      return 'hold';
    };

    // Count buy/sell/hold signals
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    stocks.forEach(stock => {
      const normalized = normalizeSignal(stock.signal);
      if (normalized === 'buy') buyCount++;
      else if (normalized === 'sell') sellCount++;
      else holdCount++;
    });

    const total = stocks.length || 1;
    const buyVsSell = {
      bull: Math.round((buyCount / total) * 100),
      bear: Math.round((sellCount / total) * 100),
      mixed: Math.round((holdCount / total) * 100),
    };

    // Compute sector distribution from stocks
    const sectorCounts = {};
    stocks.forEach(stock => {
      const sector = stock.sector || 'Other';
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    // Get top 3 sectors
    const sortedSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const sectors = {};
    sortedSectors.forEach(([sector, count]) => {
      sectors[sector] = Math.round((count / total) * 100);
    });

    // If no sectors found, use defaults
    if (Object.keys(sectors).length === 0) {
      return { buyVsSell, sectors: dashboardMetrics.sectors };
    }

    return { buyVsSell, sectors };
  }, [stocks]);

  // CRITICAL FIX: Filter signals based on selected filter
  const filteredSignals = useMemo(() => {
    if (!stocks || stocks.length === 0) return [];
    
    const normalizeSignal = (signal) => {
      const s = (signal || '').toLowerCase().trim();
      if (s.includes('buy') || s === 'breakout' || s === 'momentum') return 'buy';
      if (s.includes('sell') || s === 'risky') return 'sell';
      return 'hold';
    };

    if (signalFilter === 'All') {
      return stocks.slice(0, 5);
    }

    const filterLower = signalFilter.toLowerCase();
    const filtered = stocks.filter(stock => {
      const normalized = normalizeSignal(stock.signal);
      return normalized === filterLower;
    });

    return filtered.slice(0, 5);
  }, [stocks, signalFilter]);

  const activeSignals = filteredSignals;
  return (
    <DashboardLayout>
      <TopBar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
            <span className="live-dot" />
            <span>Analyzing {dataPoints} data points in real-time</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Top AI Pick */}
              <div className="glass-card rounded-2xl p-6 border border-gold/10 shadow-[0_20px_40px_-20px_rgba(212,175,55,0.15)]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Top AI Pick</span>
                  <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-medium">Ranked #1 Opportunity</span>
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center font-semibold text-sm">{topPick.symbol.slice(0, 2)}</div>
                    <div>
                      <div className="font-semibold text-[17px]">{topPick.name}</div>
                      <div className="text-xs text-gray-500">{topPick.symbol} • {topPick.sector} <span className={topPick.change >= 0 ? 'text-signal-green' : 'text-signal-red'}>{topPick.change >= 0 ? '↑ +' : '↓ '}{topPick.change}%</span></div>
                    </div>
                  </div>
                  <SignalBadge signal={topPick.signal} />
                </div>
                {/* Metrics */}
                <div className="flex gap-6 my-4 py-4 border-y border-white/5">
                  {[
                    { label: 'Trend Strength', value: `${topPick.trendStrength}/100`, pct: topPick.trendStrength, color: 'bg-gold' },
                    { label: 'Volume Spike', value: topPick.volumeSpike, pct: 92, color: 'bg-signal-green' },
                    { label: 'Momentum', value: topPick.momentum, pct: 78, color: 'bg-signal-green' },
                  ].map(m => (
                    <div key={m.label} className="flex-1">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">{m.label}</span>
                      <div className="h-[3px] bg-white/5 rounded-full overflow-hidden mt-1.5 mb-1">
                        <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-white">{m.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed pl-3.5 border-l-2 border-gold">{topPick.insight}</p>
              </div>

              {/* Active Signals */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Active Signals</span>
                  <div className="flex gap-1">
                    {['All', 'Buy', 'Sell'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSignalFilter(filter)}
                        className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-all ${
                          signalFilter === filter
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:bg-white/5'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {activeSignals.length > 0 ? (
                    activeSignals.map(s => (
                      <Link key={s.symbol} to={`/stock/${s.symbol}`}
                        className="glass-card rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:translate-x-0.5 transition-all group">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm ${
                          s.signal === 'Buy' || s.signal === 'Strong Buy' || s.signal === 'Breakout' || s.signal === 'Momentum' ? 'bg-signal-greenLight text-signal-green' :
                          s.signal === 'Sell' || s.signal === 'Risky' ? 'bg-signal-redLight text-signal-red' : 'bg-white/5 text-white'
                        }`}>{s.logo}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{s.name.split(' ')[0]}</div>
                          <div className="text-[11px] text-gray-500">{s.symbol} <span className={s.change >= 0 ? 'text-signal-green' : 'text-signal-red'}>
                            {s.change >= 0 ? '↑' : '↓'} {s.change >= 0 ? '+' : ''}{s.change}%
                          </span></div>
                        </div>
                        <MiniSparkline trend={s.change >= 0 ? 'up' : 'down'} />
                        <SignalBadge signal={s.signal} />
                        <span className="text-[11px] text-gray-500 font-medium w-8 text-right">{s.confidence}%</span>
                        <button className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                          s.signal === 'Buy' || s.signal === 'Strong Buy' || s.signal === 'Breakout' || s.signal === 'Momentum' ? 'bg-gold/10 text-gold hover:bg-gold/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}>
                          {s.signal === 'Sell' || s.signal === 'Risky' ? 'Monitor' : 'Review'}
                        </button>
                      </Link>
                    ))
                  ) : (
                    <div className="glass-card rounded-xl p-6 text-center">
                      <p className="text-sm text-gray-500">No {signalFilter.toLowerCase()} signals found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Market Sentiment */}
              <div className="glass-card rounded-2xl p-5">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-3">Market Sentiment</span>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-light text-white">{sentiment.score}</div>
                  <div className="flex-1">
                    <div className="text-[11px] text-gray-500 mb-1">{sentiment.label} <span className={sentiment.score > 50 ? 'text-signal-green' : 'text-signal-red'}>{sentiment.score > 50 ? '↑' : '↓'}</span></div>
                    <div className="w-full h-1 bg-white/5 rounded-full relative">
                      <div className="h-full rounded-full bg-gradient-to-r from-signal-red via-gold to-signal-green" style={{ width: '100%' }} />
                      <div className="absolute top-[-3px] w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]" style={{ left: `${sentiment.score}%`, transform: 'translateX(-50%)' }} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between mt-3 text-xs">
                  <span className="text-signal-green font-medium">{sentiment.changeText}</span>
                  <span className="text-gray-600">vs yesterday</span>
                </div>
                {/* Dynamic chart */}
                <div className="mt-4 h-16">
                  <svg viewBox="0 0 300 70" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={chartArea} fill="url(#goldGrad)" />
                    <path d={chartLine} fill="none" stroke="#D4AF37" strokeWidth="2" />
                  </svg>
                </div>
                <div className="flex gap-2 mt-3">
                  {['1D', '1W', '1M'].map((t, i) => (
                    <span key={t} className={`px-2 py-1 rounded text-[11px] cursor-pointer ${i === 0 ? 'bg-white/10 text-white' : 'text-gray-500'}`}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Signal Analytics */}
              <div className="glass-card rounded-2xl p-5">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-3">Signal Analytics</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Buy vs Sell</div>
                    <div className="flex items-end gap-1.5 h-12">
                      {[
                        { h: analytics.buyVsSell.bull, color: 'bg-signal-green', label: 'Buy' },
                        { h: analytics.buyVsSell.bear, color: 'bg-signal-red', label: 'Sell' },
                        { h: analytics.buyVsSell.mixed, color: 'bg-gold', label: 'Hold' },
                      ].map(b => (
                        <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full ${b.color} rounded-t`} style={{ height: `${b.h}%` }} />
                          <span className="text-[9px] text-gray-500">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sector Distribution</div>
                    <div className="flex items-center gap-3 mt-2">
                      <svg width="50" height="50" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                        <circle cx="25" cy="25" r="20" fill="none" stroke="#16A34A" strokeWidth="8" strokeDasharray="35 125" strokeDashoffset="-10" />
                        <circle cx="25" cy="25" r="20" fill="none" stroke="#D4AF37" strokeWidth="8" strokeDasharray="25 125" strokeDashoffset="-55" />
                        <circle cx="25" cy="25" r="20" fill="none" stroke="#3B82F6" strokeWidth="8" strokeDasharray="20 125" strokeDashoffset="-90" />
                      </svg>
                      <div className="text-[10px] space-y-0.5">
                        {Object.entries(analytics.sectors).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-sm ${k === 'Tech' ? 'bg-signal-green' : k === 'Finance' ? 'bg-gold' : k === 'Energy' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                            {k} {v}%
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Movers */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Top Movers</span>
                </div>
                {topMovers.map(m => (
                  <div key={m.symbol} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <Link to={`/stock/${m.symbol}`} className="text-xs font-medium text-white hover:text-gold transition-colors">{m.symbol}</Link>
                    <span className={`text-[11px] font-medium ${m.up ? 'text-signal-green' : 'text-signal-red'}`}>{m.change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

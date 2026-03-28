import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import DashboardLayout from '../components/DashboardLayout';
import TopBar from '../components/TopBar';
import SignalBadge from '../components/SignalBadge';
import MiniSparkline from '../components/MiniSparkline';
import Modal from '../components/Modal';
import { useApi } from '../hooks/useApi';
import { usePortfolioPrices } from '../hooks/usePortfolioPrices';
import { dbGetPortfolio, dbAddHolding, dbDeleteHolding, searchStocks, getUnifiedQuote, scanMarket } from '../services/api';
import { fmtPrice, fmtPct } from '../utils/currency';

// Flash a value when it changes (green/red pulse)
function useFlash(value) {
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === null || prev.current === undefined) { prev.current = value; return; }
    if (value > prev.current) setFlash('up');
    else if (value < prev.current) setFlash('down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [value]);
  return flash;
}

export default function PortfolioPage() {
  const [showModal, setShowModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [optimisticHoldings, setOptimisticHoldings] = useState([]);
  const [hadHoldings, setHadHoldings] = useState(false);
  const { user } = useUser();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const searchInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const debounceRef = useRef(null);
  const searchRef = useRef(null);

  // ── Modal search state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [qty, setQty] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (showModal) { const t = setTimeout(() => searchInputRef.current?.focus(), 80); return () => clearTimeout(t); }
  }, [showModal]);

  useEffect(() => {
    if (selectedStock) { const t = setTimeout(() => qtyInputRef.current?.focus(), 50); return () => clearTimeout(t); }
  }, [selectedStock]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val); setSelectedStock(null); setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try { const d = await searchStocks(val.trim()); setSuggestions(d?.results || []); }
      catch { setSuggestions([]); } finally { setSearchLoading(false); }
    }, 250);
  };

  const handleSelectStock = useCallback(async (stock) => {
    setSearchQuery(stock.name || stock.symbol);
    setShowSuggestions(false); setSuggestions([]);
    setSelectedStock({ symbol: stock.symbol, name: stock.name || stock.symbol, exchange: stock.exchange || 'NSE', price: stock.price || 0 });
    try {
      const quote = await getUnifiedQuote(stock.symbol);
      if (quote?.price) setSelectedStock(prev => prev?.symbol === stock.symbol ? { ...prev, price: quote.price } : prev);
    } catch {}
  }, []);

  useEffect(() => {
    const h = (e) => { if (!searchRef.current?.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const resetModal = () => {
    setSearchQuery(''); setSuggestions([]); setSelectedStock(null);
    setQty(''); setShowSuggestions(false); setSearchLoading(false);
  };

  const addStock = async () => {
    if (!selectedStock || !qty || !user?.id) return;
    setAddLoading(true);
    const optimisticId = `optimistic-${Date.now()}`;
    const newHolding = {
      id: optimisticId, symbol: selectedStock.symbol, company_name: selectedStock.name,
      exchange: selectedStock.exchange, quantity: parseFloat(qty),
      average_price: selectedStock.price || 1, currentPrice: selectedStock.price || 1,
      averagePrice: selectedStock.price || 1, pnl: 0, pnlPct: 0, changePercent: 0, _optimistic: true,
    };
    setOptimisticHoldings(prev => [...prev, newHolding]);
    resetModal(); setShowModal(false);
    try {
      const payload = { 
        userId: user.id, 
        symbol: selectedStock.symbol, 
        companyName: selectedStock.name,
        exchange: selectedStock.exchange, 
        quantity: parseFloat(qty), 
        averagePrice: selectedStock.price || 1 
      };
      const result = await dbAddHolding(payload);
      
      // Wait a moment for DB commit, then refetch
      await new Promise(resolve => setTimeout(resolve, 300));
      await refetch();
    } catch (e) {
      console.error('[Portfolio] Add holding failed:', e);
      // Only remove optimistic entry if the INSERT itself failed
      setOptimisticHoldings(prev => prev.filter(h => h.id !== optimisticId));
    } finally { 
      setAddLoading(false); 
    }
  };

  // ── Portfolio DB data — full refresh every 30s ────────────────────────────
  const { data: portfolioData, loading, refetch } = useApi(
    () => user?.id ? dbGetPortfolio(user.id) : Promise.reject('No user'),
    null, [user?.id], 30000
  );

  // Track if we've ever received portfolio data (prevents empty state flash on initial load)
  const [dataReceived, setDataReceived] = useState(false);
  
  useEffect(() => {
    if (portfolioData !== null && portfolioData !== undefined) {
      setDataReceived(true);
    }
  }, [portfolioData]);

  useEffect(() => {
    if (!loading && portfolioData?.holdings !== undefined) {
      const realHoldingsCount = (portfolioData.holdings || []).length;
      const realSymbols = new Set((portfolioData.holdings || []).map(h => h.symbol));
      
      // Check if all optimistic holdings are now in the real data
      const allOptimisticConfirmed = optimisticHoldings.every(opt => realSymbols.has(opt.symbol));
      
      if (realHoldingsCount > 0) {
        setHadHoldings(true);
        // Only clear optimistic if they're all confirmed in DB
        if (allOptimisticConfirmed || optimisticHoldings.length === 0) {
          if (optimisticHoldings.length > 0) {
            setOptimisticHoldings([]);
          }
        }
      } else if (optimisticHoldings.length === 0) {
        // No holdings at all - truly empty
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioData, loading]);

  // ── Live price engine — WebSocket + 15s REST polling ─────────────────────
  // Stable symbol key — only recomputes when symbol list actually changes
  const symbolKey = (portfolioData?.holdings || []).map(h => h.symbol).sort().join(',');
  const dbSymbols = useMemo(
    () => (portfolioData?.holdings || []).map(h => h.symbol),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbolKey]
  );
  const { prices: livePrices, lastUpdated: pricesUpdatedAt, wsConnected } = usePortfolioPrices(dbSymbols);

  // ── Holdings — P&L computed from live prices ──────────────────────────────
  const dbHoldings = useMemo(() => {
    return (portfolioData?.holdings || []).map(h => {
      // Get live price data
      const live = livePrices[h.symbol];
      
      // CRITICAL: Separate average buy price from current market price
      const avgBuyPrice = parseFloat(h.averagePrice || h.average_price || h.avg_price || 0);
      
      // Determine current market price with priority:
      // 1. Live price from WebSocket/polling (best, most current)
      // 2. Backend-fetched current_price (good, from last portfolio load)
      // 3. Average buy price as absolute fallback (prevents NaN but shows 0% P&L)
      let currentMarketPrice = avgBuyPrice; // Fallback
      
      if (live?.price > 0) {
        currentMarketPrice = live.price; // Best: live data
      } else if (h.currentPrice > 0) {
        currentMarketPrice = h.currentPrice; // Good: backend data
      } else if (h.current_price > 0) {
        currentMarketPrice = h.current_price; // Backend snake_case variant
      }
      
      const qty = parseFloat(h.quantity || 0);
      
      // CORRECT P&L FORMULAS
      const investedValue = qty * avgBuyPrice;
      const currentValue = qty * currentMarketPrice;
      const pnlAmount = currentValue - investedValue;
      const pnlPercent = avgBuyPrice > 0 ? ((currentMarketPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

      return {
        symbol: h.symbol,
        name: h.company_name || h.symbol,
        price: currentMarketPrice,
        prevPrice: live?.prevPrice ?? currentMarketPrice,
        shares: qty,
        signal: currentMarketPrice > avgBuyPrice * 1.005 ? 'Buy' : currentMarketPrice < avgBuyPrice * 0.97 ? 'Sell' : 'Hold',
        confidence: Math.min(90, Math.max(40, 50 + Math.round(pnlPercent * 3))),
        risk: Math.abs(pnlPercent) > 10 ? 'High' : Math.abs(pnlPercent) > 5 ? 'Medium' : 'Low',
        change: live?.changePercent ?? h.changePercent ?? h.price_change_percent ?? 0,
        pnl: Math.round(pnlAmount * 100) / 100,
        pnlPct: Math.round(pnlPercent * 100) / 100,
        id: h.id,
        averagePrice: avgBuyPrice,
        investedValue,
        currentValue,
      };
    });
  }, [portfolioData?.holdings, livePrices]);

  const confirmedSymbols = new Set(dbHoldings.map(h => h.symbol));
  const pendingOptimistic = optimisticHoldings
    .filter(o => !confirmedSymbols.has(o.symbol))
    .map(o => ({
      symbol: o.symbol, name: o.company_name, price: o.currentPrice, prevPrice: o.currentPrice,
      shares: o.quantity, signal: 'Hold', confidence: 50, risk: 'Low',
      change: 0, pnl: 0, pnlPct: 0, id: o.id, averagePrice: o.averagePrice, _optimistic: true,
    }));

  const holdings = [...dbHoldings, ...pendingOptimistic];
  
  // CRITICAL FIX: Only show empty state after we've confirmed data was received
  // This prevents the flash of empty state during initial load
  const isEmpty = holdings.length === 0 && !loading && dataReceived;

  // ── Portfolio-level calculations ──────────────────────────────────────────
  // ALWAYS calculate from live-enriched dbHoldings for accuracy
  const totalValue = useMemo(() => 
    dbHoldings.reduce((sum, h) => sum + h.currentValue, 0),
    [dbHoldings]
  );
  
  const totalCost = useMemo(() => 
    dbHoldings.reduce((sum, h) => sum + h.investedValue, 0),
    [dbHoldings]
  );
  
  const totalPnl = useMemo(() => totalValue - totalCost, [totalValue, totalCost]);
  
  const totalPnlPct = useMemo(() => 
    totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    [totalPnl, totalCost]
  );

  // Health score: base 60 + P&L factor + diversification bonus - risk penalty
  const healthScore = useMemo(() => {
    if (isEmpty) return 0;
    const diversificationBonus = Math.min(15, holdings.length * 3);
    const highRiskPenalty = holdings.filter(h => h.risk === 'High').length * 8;
    return Math.min(95, Math.max(20,
      60 + Math.round(totalPnlPct * 1.5) + diversificationBonus - highRiskPenalty
    ));
  }, [isEmpty, holdings.length, totalPnlPct, holdings]);

  const riskLevel = useMemo(() => {
    const high = holdings.filter(h => h.risk === 'High').length;
    const total = Math.max(holdings.length, 1);
    if (high / total > 0.5) return 'High';
    if (high / total > 0.2) return 'Medium';
    return 'Low';
  }, [holdings]);

  // Risk distribution by current value (not count) - fully dynamic with live prices
  const riskDistribution = useMemo(() => {
    if (dbHoldings.length === 0) {
      return {
        low: { percent: 0, value: 0 },
        medium: { percent: 0, value: 0 },
        high: { percent: 0, value: 0 },
      };
    }

    const buckets = { low: 0, medium: 0, high: 0 };
    
    // Calculate bucket values using current live prices
    for (const h of dbHoldings) {
      const currentValue = h.price * h.shares;
      const riskKey = h.risk.toLowerCase();
      buckets[riskKey] = (buckets[riskKey] || 0) + currentValue;
    }
    
    // Calculate total from buckets to ensure consistency
    const total = buckets.low + buckets.medium + buckets.high;
    
    if (total === 0) {
      return {
        low: { percent: 0, value: 0 },
        medium: { percent: 0, value: 0 },
        high: { percent: 0, value: 0 },
      };
    }
    
    return {
      low: { 
        percent: Math.round((buckets.low / total) * 100), 
        value: buckets.low 
      },
      medium: { 
        percent: Math.round((buckets.medium / total) * 100), 
        value: buckets.medium 
      },
      high: { 
        percent: Math.round((buckets.high / total) * 100), 
        value: buckets.high 
      },
    };
  }, [dbHoldings]);

  // ── Portfolio Intelligence — Derived from real holdings ──────────────────
  const portfolioInsights = useMemo(() => {
    if (dbHoldings.length === 0) return null;

    // Sort by P&L percentage for performance analysis
    const sortedByPnl = [...dbHoldings].sort((a, b) => b.pnlPct - a.pnlPct);
    
    // Top Performer - best P&L, but must be different from worst
    const topPerformer = sortedByPnl[0];
    
    // Worst Performer - worst P&L, ensure it's different from top
    const worstPerformer = sortedByPnl.length > 1 ? sortedByPnl[sortedByPnl.length - 1] : sortedByPnl[0];
    
    // If all have same P&L, use absolute P&L amount as tiebreaker
    let finalTop = topPerformer;
    let finalWorst = worstPerformer;
    
    if (topPerformer.symbol === worstPerformer.symbol && dbHoldings.length > 1) {
      // All have same P&L%, sort by absolute amount
      const sortedByAmount = [...dbHoldings].sort((a, b) => b.pnl - a.pnl);
      finalTop = sortedByAmount[0];
      finalWorst = sortedByAmount[sortedByAmount.length - 1];
    }
    
    // Largest Holding by value
    const largestHolding = [...dbHoldings].sort((a, b) => b.currentValue - a.currentValue)[0];
    const largestHoldingPct = totalValue > 0 ? (largestHolding.currentValue / totalValue) * 100 : 0;
    
    // Signal Breakdown
    const signalBreakdown = {
      buy: dbHoldings.filter(h => h.signal === 'Buy').length,
      hold: dbHoldings.filter(h => h.signal === 'Hold').length,
      sell: dbHoldings.filter(h => h.signal === 'Sell').length,
    };
    
    // Live Movers (biggest price changes today)
    const liveMovers = [...dbHoldings]
      .filter(h => Math.abs(h.change) > 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3);
    
    // Portfolio AI Summary
    const positiveCount = dbHoldings.filter(h => h.pnl > 0).length;
    const negativeCount = dbHoldings.filter(h => h.pnl < 0).length;
    const neutralCount = dbHoldings.filter(h => h.pnl === 0).length;
    
    let aiSummary = '';
    if (neutralCount === dbHoldings.length) {
      // All holdings at break-even
      aiSummary = `Portfolio at break-even. ${dbHoldings.length} holdings tracking live prices. Market movement will update P&L in real-time.`;
    } else if (totalPnlPct > 5) {
      aiSummary = `Strong portfolio performance with ${fmtPct(totalPnlPct)} gains. ${positiveCount} of ${dbHoldings.length} holdings are profitable.`;
    } else if (totalPnlPct > 0) {
      aiSummary = `Portfolio showing modest gains at ${fmtPct(totalPnlPct)}. ${positiveCount} holdings in profit${negativeCount > 0 ? `, ${negativeCount} need attention` : ''}.`;
    } else if (totalPnlPct > -5) {
      aiSummary = `Portfolio slightly down ${fmtPct(Math.abs(totalPnlPct))}. ${negativeCount} holdings underperforming, consider rebalancing.`;
    } else {
      aiSummary = `Portfolio facing headwinds with ${fmtPct(Math.abs(totalPnlPct))} losses. ${negativeCount} of ${dbHoldings.length} holdings need review.`;
    }
    
    // Concentration Risk
    const concentrationRisk = largestHoldingPct > 40 ? 'High' : largestHoldingPct > 25 ? 'Medium' : 'Low';
    
    return {
      topPerformer: finalTop,
      worstPerformer: finalWorst,
      largestHolding,
      largestHoldingPct,
      signalBreakdown,
      liveMovers,
      aiSummary,
      concentrationRisk,
    };
  }, [dbHoldings, totalValue, totalPnlPct]);

  // Flash on total P&L change
  const pnlFlash = useFlash(Math.round(totalPnl));

  const removeHolding = async (holdingId) => {
    if (!user?.id) return;
    try { await dbDeleteHolding(holdingId, user.id); refetch(); }
    catch (e) { console.error('Delete holding failed:', e); }
  };

  // ── Trending stocks for empty state ──────────────────────────────────────
  const [scanLastUpdated, setScanLastUpdated] = useState(null);
  const { data: scanData, loading: scanLoading } = useApi(
    () => scanMarket({ maxResults: 6, useAi: false }), null, [], 60000
  );
  const trendingStocks = (scanData?.top_stocks || []).slice(0, 6);
  useEffect(() => { if (scanData) setScanLastUpdated(new Date()); }, [scanData]);

  const handleQuickAdd = useCallback((stock) => {
    setShowModal(true);
    setSearchQuery(stock.name || stock.symbol);
    setSelectedStock({ symbol: stock.symbol, name: stock.name || stock.symbol, exchange: stock.exchange || 'NSE', price: stock.price || 0 });
    getUnifiedQuote(stock.symbol).then(q => {
      if (q?.price) setSelectedStock(prev => prev?.symbol === stock.symbol ? { ...prev, price: q.price } : prev);
    }).catch(() => {});
  }, []);

  const signalColor = (s) => s === 'Breakout' || s === 'Momentum' ? 'text-signal-green' : s === 'Risky' ? 'text-signal-red' : 'text-signal-amber';
  const signalBg = (s) => s === 'Breakout' || s === 'Momentum' ? 'bg-signal-green/10' : s === 'Risky' ? 'bg-signal-red/10' : 'bg-signal-amber/10';
  const updatedLabel = scanLastUpdated
    ? `Updated ${Math.floor((Date.now() - scanLastUpdated) / 1000) < 10 ? 'just now' : `${Math.floor((Date.now() - scanLastUpdated) / 60000)}m ago`}`
    : 'Fetching...';

  // Live status label - show "Ready" when portfolio is loaded but empty
  const liveStatus = loading ? 'Loading...' : wsConnected ? 'Live' : pricesUpdatedAt ? 'Near-live' : holdings.length > 0 ? 'Connecting...' : 'Ready';
  const liveColor = loading ? 'bg-gold' : wsConnected ? 'bg-signal-green' : pricesUpdatedAt ? 'bg-signal-amber' : holdings.length > 0 ? 'bg-gold' : 'bg-gray-500';

  return (
    <DashboardLayout>
      <TopBar title="Portfolio Analysis" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">

          {/* Header - Premium Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/[0.08] via-transparent to-gold/[0.05] border border-white/[0.06] p-6">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold/[0.03] rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-3xl" />
            </div>
            <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <span className="text-sm text-gold font-semibold tracking-wide">SignalForge AI</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Portfolio Intelligence</h1>
                <p className="text-sm text-gray-400">Real-time insights powered by live market data</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-white/[0.08] backdrop-blur-sm">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${liveColor}`} />
                  <span className="text-xs text-white font-medium">{loading ? 'Loading...' : liveStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Loading state ─────────────────────────────────────────────── */}
          {loading && !dataReceived && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
                    <div className="h-3 bg-white/[0.05] rounded w-20 mb-3" />
                    <div className="h-8 bg-white/[0.08] rounded w-32 mb-2" />
                    <div className="h-3 bg-white/[0.04] rounded w-24" />
                  </div>
                ))}
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-surfaceBorder">
                  <div className="h-4 bg-white/[0.05] rounded w-32 animate-pulse" />
                </div>
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="h-10 bg-white/[0.05] rounded flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {isEmpty && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[260px] bg-gold/[0.05] rounded-full blur-3xl" />
                </div>
                <div className="relative px-8 pt-10 pb-8 text-center">
                  <div className="relative w-14 h-14 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-2xl bg-gold/10 border border-gold/20 animate-pulse" />
                    <div className="relative w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                    {hadHoldings ? "Your portfolio is empty — let's rebuild it" : 'Start building your smart portfolio'}
                  </h3>
                  <p className="text-gray-400 text-sm max-w-[420px] mx-auto mb-7 leading-relaxed">
                    {hadHoldings
                      ? 'Add stocks back to resume real-time tracking, AI signals, and risk analysis.'
                      : 'One stock is all it takes. Get live prices, AI-powered signals, and risk analysis the moment you add it.'}
                  </p>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap mb-8">
                    {[{ icon: '📈', label: 'Real-time prices' }, { icon: '🤖', label: 'AI insights' }, { icon: '⚡', label: 'Smart signals' }, { icon: '🛡️', label: 'Risk analysis' }].map(f => (
                      <div key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-gray-400">
                        <span>{f.icon}</span><span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowModal(true)}
                    className="group relative inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-base font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_28px_rgba(212,175,55,0.3)] active:scale-[0.98]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-200"><path d="M12 5v14M5 12h14" /></svg>
                    Add Your First Stock
                  </button>
                </div>
                <div className="border-t border-surfaceBorder px-8 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${scanLoading ? 'bg-gold/50 animate-pulse' : 'bg-signal-green animate-pulse'}`} />
                      <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                        {scanLoading ? 'Fetching live market data...' : 'Trending now — click to add instantly'}
                      </span>
                    </div>
                    {scanLastUpdated && !scanLoading && <span className="text-[10px] text-gray-600">{updatedLabel}</span>}
                  </div>
                  {trendingStocks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {trendingStocks.map(s => (
                        <div key={s.symbol} className="relative group/chip">
                          <button onClick={() => handleQuickAdd(s)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] hover:border-gold/35 hover:bg-gold/[0.07] hover:-translate-y-px transition-all duration-150 active:scale-95">
                            <div className="w-6 h-6 rounded-md bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white shrink-0">{s.symbol.slice(0, 2)}</div>
                            <span className="text-xs font-semibold text-white">{s.symbol}</span>
                            <span className={`text-[10px] font-mono tabular-nums ${s.change >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>{s.change >= 0 ? '+' : ''}{s.change?.toFixed(1)}%</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${signalColor(s.signal)} ${signalBg(s.signal)}`}>{s.signal}</span>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150">
                            <div className="bg-[#0f0f13] border border-white/[0.1] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap text-center">
                              <div className="text-xs font-semibold text-white mb-0.5">{s.symbol}</div>
                              <div className="text-[11px] font-mono text-gold">{s.price > 0 ? fmtPrice(s.price) : '—'}</div>
                              <div className={`text-[10px] ${s.change >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>{s.change >= 0 ? '+' : ''}{s.change?.toFixed(2)}% today</div>
                              <div className="text-[9px] text-gray-500 mt-0.5">Click to add →</div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/[0.1]" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : scanLoading ? (
                    <div className="flex gap-2">
                      {[96, 80, 104, 88, 76, 92].map((w, i) => (
                        <div key={i} className="h-9 rounded-lg bg-white/[0.04] animate-pulse" style={{ width: `${w}px`, animationDelay: `${i * 80}ms` }} />
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-600">No trending data available right now.</p>}
                </div>
              </div>
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none pointer-events-none">
                  {[{ label: 'Total Value', val: '₹ ——', sub: 'INR' }, { label: 'P&L', val: '——', sub: 'Unrealised' }, { label: 'Health Score', val: '——', sub: '/ 100' }, { label: 'Overall Risk', val: '——', sub: '0 holdings' }].map(c => (
                    <div key={c.label} className="glass-card rounded-xl p-5 blur-[3px] opacity-50">
                      <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">{c.label}</span>
                      <div className="text-2xl font-light text-white/40 tabular-nums">{c.val}</div>
                      <div className="text-xs text-gray-600 mt-1">{c.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 border border-white/[0.08] backdrop-blur-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <span className="text-xs text-gray-400 font-medium">Add a stock to unlock your analytics</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Summary Cards ─────────────────────────────────────────────── */}
          {!isEmpty && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total Value</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums mb-1">{fmtPrice(totalValue)}</div>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${wsConnected ? 'bg-signal-green' : 'bg-signal-amber'}`} />
                <span className="text-xs text-gray-400">{wsConnected ? 'Live' : pricesUpdatedAt ? `Updated ${Math.floor((Date.now() - pricesUpdatedAt) / 1000)}s ago` : 'INR'}</span>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">P&L</span>
                <div className={`w-8 h-8 rounded-lg ${totalPnl >= 0 ? 'bg-signal-green/10 border-signal-green/20' : 'bg-signal-red/10 border-signal-red/20'} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={totalPnl >= 0 ? '#10B981' : '#EF4444'} strokeWidth="2">
                    {totalPnl >= 0 ? <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /> : <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />}
                    {totalPnl >= 0 ? <polyline points="17 6 23 6 23 12" /> : <polyline points="17 18 23 18 23 12" />}
                  </svg>
                </div>
              </div>
              <div className={`text-3xl font-bold tabular-nums transition-all duration-300 mb-1 ${
                pnlFlash === 'up' ? 'text-signal-green scale-105' :
                pnlFlash === 'down' ? 'text-signal-red scale-105' :
                totalPnl >= 0 ? 'text-signal-green' : 'text-signal-red'
              }`}>
                {fmtPct(totalPnlPct)}
              </div>
              <div className={`text-xs ${totalPnl >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                {totalPnl >= 0 ? '+' : '-'}{fmtPrice(Math.abs(totalPnl))} unrealized
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Health Score</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-white">{healthScore}</span>
                <span className="text-sm text-gray-500">/ 100</span>
              </div>
              <div className="w-full h-2 bg-surfaceBorder rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-signal-green via-blue-500 to-purple-500 rounded-full transition-all duration-1000" style={{ width: `${healthScore}%` }} />
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Overall Risk</span>
                <div className={`w-8 h-8 rounded-lg ${riskLevel === 'Low' ? 'bg-signal-green/10 border-signal-green/20' : riskLevel === 'Medium' ? 'bg-signal-amber/10 border-signal-amber/20' : 'bg-signal-red/10 border-signal-red/20'} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={riskLevel === 'Low' ? '#10B981' : riskLevel === 'Medium' ? '#F59E0B' : '#EF4444'} strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
              </div>
              <div className="mb-2">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${riskLevel === 'Low' ? 'bg-signal-greenLight text-signal-green border border-signal-green/20' : riskLevel === 'Medium' ? 'bg-signal-amberLight text-signal-amber border border-signal-amber/20' : 'bg-signal-redLight text-signal-red border border-signal-red/20'}`}>{riskLevel} Exposure</span>
              </div>
              <div className="text-xs text-gray-400">{holdings.length} holdings tracked</div>
            </div>
          </div>

          {/* ── AI Portfolio Insights ─────────────────────────────────────── */}
          {portfolioInsights && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* AI Summary Card */}
            <div className="glass-card rounded-xl p-5 lg:col-span-2 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-gold/20 border border-purple-500/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">AI Portfolio Summary</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">{portfolioInsights.aiSummary}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]">
                  <div className="text-xs text-gray-500 mb-1">Signal Mix</div>
                  <div className="flex items-center gap-2">
                    <span className="text-signal-green text-lg font-bold">{portfolioInsights.signalBreakdown.buy}</span>
                    <span className="text-signal-amber text-lg font-bold">{portfolioInsights.signalBreakdown.hold}</span>
                    <span className="text-signal-red text-lg font-bold">{portfolioInsights.signalBreakdown.sell}</span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">Buy / Hold / Sell</div>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]">
                  <div className="text-xs text-gray-500 mb-1">Concentration</div>
                  <div className="text-lg font-bold text-white">{portfolioInsights.largestHoldingPct.toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-600 mt-1">{portfolioInsights.largestHolding.symbol}</div>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]">
                  <div className="text-xs text-gray-500 mb-1">Risk Level</div>
                  <div className={`text-lg font-bold ${portfolioInsights.concentrationRisk === 'Low' ? 'text-signal-green' : portfolioInsights.concentrationRisk === 'Medium' ? 'text-signal-amber' : 'text-signal-red'}`}>
                    {portfolioInsights.concentrationRisk}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">Concentration</div>
                </div>
              </div>
            </div>

            {/* Top & Worst Performers */}
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal-green/20 to-signal-red/20 border border-signal-green/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">Performance Leaders</span>
              </div>
              
              {/* Top Performer */}
              <div className={`rounded-lg p-3 border mb-3 ${
                portfolioInsights.topPerformer.pnl > 0 
                  ? 'bg-signal-green/[0.05] border-signal-green/20' 
                  : portfolioInsights.topPerformer.pnl < 0
                  ? 'bg-signal-red/[0.05] border-signal-red/20'
                  : 'bg-white/[0.02] border-white/[0.05]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${
                    portfolioInsights.topPerformer.pnl > 0 ? 'text-signal-green' : 
                    portfolioInsights.topPerformer.pnl < 0 ? 'text-signal-red' : 'text-gray-400'
                  }`}>Top Performer</span>
                  <span className={`text-xs font-bold ${
                    portfolioInsights.topPerformer.pnl > 0 ? 'text-signal-green' : 
                    portfolioInsights.topPerformer.pnl < 0 ? 'text-signal-red' : 'text-gray-400'
                  }`}>
                    {portfolioInsights.topPerformer.pnlPct >= 0 ? '+' : ''}{portfolioInsights.topPerformer.pnlPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{portfolioInsights.topPerformer.symbol}</span>
                  <span className={`text-xs ${
                    portfolioInsights.topPerformer.pnl > 0 ? 'text-signal-green' : 
                    portfolioInsights.topPerformer.pnl < 0 ? 'text-signal-red' : 'text-gray-400'
                  }`}>
                    {portfolioInsights.topPerformer.pnl >= 0 ? '+' : ''}{fmtPrice(Math.abs(portfolioInsights.topPerformer.pnl))}
                  </span>
                </div>
              </div>

              {/* Worst Performer */}
              <div className={`rounded-lg p-3 border ${
                portfolioInsights.worstPerformer.pnl < 0 
                  ? 'bg-signal-red/[0.05] border-signal-red/20' 
                  : portfolioInsights.worstPerformer.pnl > 0
                  ? 'bg-signal-green/[0.05] border-signal-green/20'
                  : 'bg-white/[0.02] border-white/[0.05]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${
                    portfolioInsights.worstPerformer.pnl < 0 ? 'text-signal-red' : 
                    portfolioInsights.worstPerformer.pnl > 0 ? 'text-signal-green' : 'text-gray-400'
                  }`}>Needs Attention</span>
                  <span className={`text-xs font-bold ${
                    portfolioInsights.worstPerformer.pnl < 0 ? 'text-signal-red' : 
                    portfolioInsights.worstPerformer.pnl > 0 ? 'text-signal-green' : 'text-gray-400'
                  }`}>
                    {portfolioInsights.worstPerformer.pnlPct >= 0 ? '+' : ''}{portfolioInsights.worstPerformer.pnlPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{portfolioInsights.worstPerformer.symbol}</span>
                  <span className={`text-xs ${
                    portfolioInsights.worstPerformer.pnl < 0 ? 'text-signal-red' : 
                    portfolioInsights.worstPerformer.pnl > 0 ? 'text-signal-green' : 'text-gray-400'
                  }`}>
                    {portfolioInsights.worstPerformer.pnl >= 0 ? '+' : ''}{fmtPrice(Math.abs(portfolioInsights.worstPerformer.pnl))}
                  </span>
                </div>
              </div>
            </div>
          </div>
          )}
          </>
          )}

          {/* ── Holdings Table ────────────────────────────────────────────── */}
          {!isEmpty && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surfaceBorder bg-gradient-to-r from-purple-500/[0.03] to-transparent">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Active Holdings</h3>
                  <p className="text-xs text-gray-400">{holdings.length} positions • Live tracking enabled</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all hover:scale-105 active:scale-95">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-sm font-medium">Add Stock</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-surfaceBorder bg-white/[0.01]">
                    <th className="px-6 py-3 font-semibold">Asset</th>
                    <th className="px-3 py-3 font-semibold">Price</th>
                    <th className="px-3 py-3 font-semibold">Qty</th>
                    <th className="px-3 py-3 font-semibold">Avg Price</th>
                    <th className="px-3 py-3 font-semibold">P&L</th>
                    <th className="px-3 py-3 font-semibold">Signal</th>
                    <th className="px-3 py-3 font-semibold">Trend</th>
                    <th className="px-3 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const priceFlash = h.price > h.prevPrice ? 'up' : h.price < h.prevPrice ? 'down' : null;
                    return (
                    <tr key={h.id || h.symbol} className={`border-b border-surfaceBorder/50 transition-all ${h._optimistic ? 'opacity-60 animate-pulse' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-gold/10 border border-white/[0.08] flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{h.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <div className="text-white font-semibold text-sm">{h.name}</div>
                            <div className="text-gray-500 text-[11px]">{h.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-4 font-mono text-sm font-semibold transition-colors duration-300 ${priceFlash === 'up' ? 'text-signal-green' : priceFlash === 'down' ? 'text-signal-red' : 'text-white'}`}>
                        {fmtPrice(h.price)}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-300 font-medium">{h.shares}</td>
                      <td className="px-3 py-4 font-mono text-sm text-gray-400">{fmtPrice(h.averagePrice)}</td>
                      <td className="px-3 py-4 text-sm">
                        <div className={`font-semibold ${h.pnl >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                          {h.pnl >= 0 ? '+' : '-'}{fmtPrice(Math.abs(h.pnl))}
                        </div>
                        <div className={`text-[11px] ${h.pnl >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                          {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct?.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-3 py-4"><SignalBadge signal={h.signal} /></td>
                      <td className="px-3 py-4"><MiniSparkline trend={h.change >= 0 ? 'up' : 'down'} /></td>
                      <td className="px-3 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Link to={`/stock/${h.symbol}`} className="text-[11px] px-3 py-1.5 rounded-md bg-white/5 border border-surfaceBorder text-gray-400 hover:text-white hover:bg-white/10 hover:border-gold/30 transition-all">Analyze</Link>
                          <button onClick={() => removeHolding(h.id)} className="text-[11px] px-2 py-1.5 rounded-md bg-signal-redLight border border-signal-red/20 text-signal-red hover:bg-signal-red/20 transition-all">×</button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* ── Risk Distribution ─────────────────────────────────────────── */}
          {!isEmpty && (
          <div className="glass-card rounded-xl p-6 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal-red/20 via-signal-amber/20 to-signal-green/20 border border-white/[0.1] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Risk Distribution</h3>
                <p className="text-xs text-gray-400">Portfolio allocation by risk level</p>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(riskDistribution).map(([k, data]) => (
                <div key={k} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${k === 'low' ? 'bg-signal-green' : k === 'medium' ? 'bg-signal-amber' : 'bg-signal-red'}`} />
                      <span className="text-sm font-medium text-white capitalize">{k} Risk</span>
                      <span className="text-xs text-gray-500">({data.percent}%)</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{fmtPrice(data.value)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-surfaceBorder rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 group-hover:scale-x-[1.02] origin-left ${k === 'low' ? 'bg-gradient-to-r from-signal-green to-signal-green/80' : k === 'medium' ? 'bg-gradient-to-r from-signal-amber to-signal-amber/80' : 'bg-gradient-to-r from-signal-red to-signal-red/80'}`} style={{ width: `${data.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

        </div>
      </main>

      {/* ── Add Stock Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetModal(); }} title="Add Stock to Portfolio">
        <div className="space-y-4">
          <div ref={searchRef} className="relative">
            <label className="text-xs text-gray-400 block mb-1">Search Stock</label>
            <div className={`flex items-center bg-surface border rounded-lg px-3 py-2 gap-2 transition-colors ${selectedStock ? 'border-gold/50' : 'border-surfaceBorder focus-within:border-gold/50'}`}>
              {searchLoading
                ? <svg className="animate-spin text-gray-500 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                : selectedStock
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" className="shrink-0"><path d="M5 12l5 5L20 7" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 shrink-0"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              }
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={handleSearchChange}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                placeholder="Type stock name or symbol..."
                className="bg-transparent text-sm text-white outline-none flex-1 placeholder-gray-600" autoComplete="off" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSelectedStock(null); setSuggestions([]); }} className="text-gray-600 hover:text-gray-400 shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {selectedStock && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-gold/[0.06] border border-gold/15 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white">{selectedStock.symbol}</span>
                  <span className="text-xs text-gray-400 ml-2">{selectedStock.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-gold">{selectedStock.price > 0 ? fmtPrice(selectedStock.price) : 'Price loading...'}</div>
                  <div className="text-[10px] text-gray-500">{selectedStock.exchange} · Current price</div>
                </div>
              </div>
            )}
            {showSuggestions && (suggestions.length > 0 || searchLoading) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f13] border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                {searchLoading && suggestions.length === 0 && <div className="px-4 py-3 text-xs text-gray-500">Searching...</div>}
                {suggestions.map((s, i) => (
                  <button key={s.symbol + i} onClick={() => handleSelectStock(s)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white shrink-0">{s.symbol.slice(0, 2)}</div>
                      <div>
                        <div className="text-sm font-semibold text-white">{s.symbol}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[160px]">{s.name}</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.06] text-gray-400 shrink-0">{s.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Quantity</label>
            <input ref={qtyInputRef} type="number" value={qty} onChange={e => setQty(e.target.value)} min="0.0001" step="any"
              className="w-full bg-surface border border-surfaceBorder rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
              placeholder="e.g. 10" />
          </div>
          <p className="text-[11px] text-gray-600">Current market price will be used as your reference buy price.</p>
          <button onClick={addStock} disabled={addLoading || !selectedStock || !qty}
            className="w-full py-2.5 bg-gold hover:bg-gold-hover text-base font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {addLoading ? 'Adding...' : !selectedStock ? 'Select a stock first' : 'Add to Portfolio'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

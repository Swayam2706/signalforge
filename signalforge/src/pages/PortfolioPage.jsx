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
    setOptimisticHoldings(prev => [...prev, {
      id: optimisticId, symbol: selectedStock.symbol, company_name: selectedStock.name,
      exchange: selectedStock.exchange, quantity: parseFloat(qty),
      average_price: selectedStock.price || 1, currentPrice: selectedStock.price || 1,
      averagePrice: selectedStock.price || 1, pnl: 0, pnlPct: 0, changePercent: 0, _optimistic: true,
    }]);
    resetModal(); setShowModal(false);
    try {
      await dbAddHolding({ userId: user.id, symbol: selectedStock.symbol, companyName: selectedStock.name,
        exchange: selectedStock.exchange, quantity: parseFloat(qty), averagePrice: selectedStock.price || 1 });
      refetch();
    } catch (e) {
      console.error('Add holding failed:', e);
      setOptimisticHoldings(prev => prev.filter(h => h.id !== optimisticId));
    } finally { setAddLoading(false); }
  };

  // ── Portfolio DB data — full refresh every 30s ────────────────────────────
  const { data: portfolioData, loading, refetch } = useApi(
    () => user?.id ? dbGetPortfolio(user.id) : Promise.reject('No user'),
    null, [user?.id], 30000
  );

  useEffect(() => {
    if (portfolioData && !loading) {
      setOptimisticHoldings([]);
      if ((portfolioData.holdings || []).length > 0) setHadHoldings(true);
    }
  }, [portfolioData, loading]);

  // ── Live price engine — WebSocket + 15s REST polling ─────────────────────
  // Stable symbol list — only recomputes when holdings actually change
  const dbSymbols = useMemo(
    () => (portfolioData?.holdings || []).map(h => h.symbol),
    [portfolioData?.holdings] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { prices: livePrices, lastUpdated: pricesUpdatedAt, wsConnected } = usePortfolioPrices(dbSymbols);

  // ── Holdings — P&L computed from live prices ──────────────────────────────
  const dbHoldings = useMemo(() => (portfolioData?.holdings || []).map(h => {
    // Priority: livePrices (15s poll) > h.currentPrice (from /api/portfolio) > h.averagePrice
    const live = livePrices[h.symbol];
    const price = (live?.price > 0)
      ? live.price
      : (h.currentPrice > 0 && h.currentPrice !== h.averagePrice)
        ? h.currentPrice
        : (h.currentPrice || 0);
    const avg = parseFloat(h.averagePrice || h.average_price || 0);
    const qty = parseFloat(h.quantity || 0);
    const cost = qty * avg;
    const currentValue = qty * price;
    const pnl = cost > 0 ? currentValue - cost : 0;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    // Debug: log when price equals avg (indicates stale data)
    if (price === avg && avg > 0) {
      console.warn(`[Portfolio] ${h.symbol}: currentPrice (${price}) === averagePrice (${avg}) — live price not yet loaded`);
    }

    return {
      symbol: h.symbol,
      name: h.company_name || h.symbol,
      price,
      prevPrice: live?.prevPrice ?? price,
      shares: qty,
      signal: price > avg * 1.005 ? 'Buy' : price < avg * 0.97 ? 'Sell' : 'Hold',
      confidence: Math.min(90, Math.max(40, 50 + Math.round(pnlPct * 3))),
      risk: Math.abs(pnlPct) > 10 ? 'High' : Math.abs(pnlPct) > 5 ? 'Medium' : 'Low',
      change: live?.changePercent ?? h.changePercent ?? 0,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
      id: h.id,
      averagePrice: avg,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [portfolioData?.holdings, livePrices]);

  const confirmedSymbols = new Set(dbHoldings.map(h => h.symbol));
  const pendingOptimistic = optimisticHoldings
    .filter(o => !confirmedSymbols.has(o.symbol))
    .map(o => ({
      symbol: o.symbol, name: o.company_name, price: o.currentPrice, prevPrice: o.currentPrice,
      shares: o.quantity, signal: 'Hold', confidence: 50, risk: 'Low',
      change: 0, pnl: 0, pnlPct: 0, id: o.id, averagePrice: o.averagePrice, _optimistic: true,
    }));

  const holdings = [...dbHoldings, ...pendingOptimistic];
  const isEmpty = holdings.length === 0 && (!portfolioData || portfolioData.isEmpty);

  // ── Portfolio-level calculations ──────────────────────────────────────────
  const totalValue = dbHoldings.reduce((s, h) => s + h.price * h.shares, 0) || portfolioData?.totalValue || 0;
  const totalCost = dbHoldings.reduce((s, h) => s + h.averagePrice * h.shares, 0) || portfolioData?.totalCost || 0;
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Health score: base 60 + P&L factor + diversification bonus
  const diversificationBonus = Math.min(15, holdings.length * 3);
  const highRiskPenalty = holdings.filter(h => h.risk === 'High').length * 8;
  const healthScore = isEmpty ? 0 : Math.min(95, Math.max(20,
    60 + Math.round(totalPnlPct * 1.5) + diversificationBonus - highRiskPenalty
  ));

  const riskLevel = (() => {
    const high = holdings.filter(h => h.risk === 'High').length;
    const total = Math.max(holdings.length, 1);
    if (high / total > 0.5) return 'High';
    if (high / total > 0.2) return 'Medium';
    return 'Low';
  })();

  // Risk distribution by invested value (not count)
  const riskDistribution = useMemo(() => {
    const buckets = { low: 0, medium: 0, high: 0 };
    for (const h of dbHoldings) {
      const val = h.price * h.shares;
      buckets[h.risk.toLowerCase()] = (buckets[h.risk.toLowerCase()] || 0) + val;
    }
    const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
    return {
      low: Math.round((buckets.low / total) * 100),
      medium: Math.round((buckets.medium / total) * 100),
      high: Math.round((buckets.high / total) * 100),
    };
  }, [dbHoldings]);

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

  // Live status label
  const liveStatus = wsConnected ? 'WebSocket Live' : pricesUpdatedAt ? 'Near-live' : 'Loading...';
  const liveColor = wsConnected ? 'bg-signal-green' : pricesUpdatedAt ? 'bg-signal-amber' : 'bg-gold';

  return (
    <DashboardLayout>
      <TopBar title="Portfolio Analysis" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-sm text-white font-medium">SignalForge AI</div>
              <div className="text-base font-normal text-gray-400">Portfolio Analysis</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/[0.08] border border-purple-500/15">
                <div className={`w-2 h-2 rounded-full animate-pulse ${liveColor}`} />
                <span className="text-xs text-purple-400 font-medium">{loading ? 'Loading...' : liveStatus}</span>
              </div>
            </div>
          </div>

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!loading && isEmpty && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total Value</span>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${wsConnected ? 'bg-signal-green' : 'bg-signal-amber'}`} />
              </div>
              <div className="text-2xl font-light text-white tabular-nums">{fmtPrice(totalValue)}</div>
              <div className="text-xs text-gray-500 mt-1">{wsConnected ? 'WebSocket live' : pricesUpdatedAt ? `Updated ${Math.floor((Date.now() - pricesUpdatedAt) / 1000)}s ago` : 'INR'}</div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">P&L</span>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${wsConnected ? 'bg-signal-green' : 'bg-signal-amber'}`} />
              </div>
              <div className={`text-2xl font-light tabular-nums transition-all duration-300 ${
                pnlFlash === 'up' ? 'text-signal-green scale-105' :
                pnlFlash === 'down' ? 'text-signal-red scale-105' :
                totalPnl >= 0 ? 'text-signal-green' : 'text-signal-red'
              }`}>
                {fmtPct(totalPnlPct)}
              </div>
              <div className={`text-xs mt-1 ${totalPnl >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                {totalPnl >= 0 ? '+' : '-'}{fmtPrice(Math.abs(totalPnl))}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">Health Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-light text-white">{healthScore}</span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
              <div className="w-full h-1 bg-surfaceBorder rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-signal-green to-blue-500 rounded-full transition-all duration-1000" style={{ width: `${healthScore}%` }} />
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">Overall Risk</span>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${riskLevel === 'Low' ? 'bg-signal-greenLight text-signal-green border border-signal-green/20' : riskLevel === 'Medium' ? 'bg-signal-amberLight text-signal-amber border border-signal-amber/20' : 'bg-signal-redLight text-signal-red border border-signal-red/20'}`}>{riskLevel} Exposure</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">{holdings.length} holdings tracked</div>
            </div>
          </div>
          )}

          {/* ── Holdings Table ────────────────────────────────────────────── */}
          {!isEmpty && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-surfaceBorder flex justify-between items-center">
              <span className="text-sm font-medium text-white">Active Holdings</span>
              <button onClick={() => setShowModal(true)} className="text-xs px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors">
                + Add Stock
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-surfaceBorder">
                    <th className="px-5 py-3 font-normal">Asset</th>
                    <th className="px-3 py-3 font-normal">Price</th>
                    <th className="px-3 py-3 font-normal">Qty</th>
                    <th className="px-3 py-3 font-normal">Avg Price</th>
                    <th className="px-3 py-3 font-normal">P&L</th>
                    <th className="px-3 py-3 font-normal">Signal</th>
                    <th className="px-3 py-3 font-normal">Trend</th>
                    <th className="px-3 py-3 font-normal text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const priceFlash = h.price > h.prevPrice ? 'up' : h.price < h.prevPrice ? 'down' : null;
                    return (
                    <tr key={h.id || h.symbol} className={`border-b border-surfaceBorder transition-all ${h._optimistic ? 'opacity-60 animate-pulse' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-5 py-3">
                        <span className="text-white font-medium">{h.name}</span>
                        <span className="text-gray-500 text-[11px] ml-1.5">{h.symbol}</span>
                      </td>
                      <td className={`px-3 py-3 font-mono text-xs transition-colors duration-300 ${priceFlash === 'up' ? 'text-signal-green' : priceFlash === 'down' ? 'text-signal-red' : 'text-white'}`}>
                        {fmtPrice(h.price)}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-300">{h.shares}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-400">{fmtPrice(h.averagePrice)}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className={h.pnl >= 0 ? 'text-signal-green' : 'text-signal-red'}>
                          {h.pnl >= 0 ? '+' : '-'}{fmtPrice(Math.abs(h.pnl))} ({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct?.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="px-3 py-3"><SignalBadge signal={h.signal} /></td>
                      <td className="px-3 py-3"><MiniSparkline trend={h.change >= 0 ? 'up' : 'down'} /></td>
                      <td className="px-3 py-3 text-right flex items-center gap-2 justify-end">
                        <Link to={`/stock/${h.symbol}`} className="text-[11px] px-3 py-1.5 rounded-md bg-white/5 border border-surfaceBorder text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Analyze</Link>
                        <button onClick={() => removeHolding(h.id)} className="text-[11px] px-2 py-1.5 rounded-md bg-signal-redLight border border-signal-red/20 text-signal-red hover:bg-signal-red/20 transition-colors">×</button>
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
          <div className="glass-card rounded-xl p-5">
            <span className="text-sm font-medium text-white block mb-3">Risk Distribution</span>
            <div className="space-y-3">
              {Object.entries(riskDistribution).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                    <span className="capitalize">{k} Risk ({v}%)</span>
                    <span>{fmtPrice((totalValue * v) / 100)}</span>
                  </div>
                  <div className="w-full h-1 bg-surfaceBorder rounded-full">
                    <div className={`h-full rounded-full transition-all duration-700 ${k === 'low' ? 'bg-signal-green' : k === 'medium' ? 'bg-signal-amber' : 'bg-signal-red'}`} style={{ width: `${v}%` }} />
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

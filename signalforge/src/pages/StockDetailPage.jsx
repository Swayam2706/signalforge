import { useParams, Link } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import TopBar from '../components/TopBar';
import SignalBadge from '../components/SignalBadge';
import ConfidenceMeter from '../components/ConfidenceMeter';
import { getStockDetail as getMockStockDetail } from '../data/mockData';
import { getStockDetail as fetchStockDetail, getFinnhubQuote, dbCreateAlert, getCachedDetail } from '../services/api';
import { transformStockDetail } from '../services/transforms';
import { fmtPrice, fmtChange, fmtPct } from '../utils/currency';
import { useFinnhubWS } from '../hooks/useFinnhubWS';
import { useUser } from '@clerk/clerk-react';

const timeframes = ['1D', '1W', '1M', '3M', '1Y'];

/**
 * Compute risk/reward levels from real price data.
 * Uses ATR-style volatility estimate from OHLC closes.
 */
function computeRiskReward(price, signal, ohlcCloses, confidence) {
  if (!price || price <= 0) return null;

  const isBuy = signal?.includes('Buy');
  const isSell = signal === 'Sell';
  const isHold = signal === 'Hold';

  // Estimate volatility: average daily range as % of price
  let atrPct = 0.02; // default 2%
  if (ohlcCloses && ohlcCloses.length >= 3) {
    const diffs = [];
    for (let i = 1; i < ohlcCloses.length; i++) {
      diffs.push(Math.abs(ohlcCloses[i] - ohlcCloses[i - 1]) / ohlcCloses[i - 1]);
    }
    atrPct = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    atrPct = Math.max(0.005, Math.min(0.08, atrPct)); // clamp 0.5%–8%
  }

  // Scale stop/target by confidence (higher confidence = tighter stop, bigger target)
  const confFactor = (confidence || 70) / 100;
  const stopPct = atrPct * (1.5 - confFactor * 0.5);   // 1.0x–1.5x ATR
  const targetPct = atrPct * (3 + confFactor * 4);      // 3x–7x ATR

  let entry, stopLoss, targetPrice, riskAmt, rewardAmt, riskPct, rewardPct, ratio, riskLevel, rewardLevel;

  if (isBuy) {
    entry = price;
    stopLoss = price * (1 - stopPct);
    targetPrice = price * (1 + targetPct);
    riskAmt = price - stopLoss;
    rewardAmt = targetPrice - price;
    riskPct = stopPct * 100;
    rewardPct = targetPct * 100;
    riskLevel = Math.min(70, Math.round(riskPct * 8));
    rewardLevel = Math.min(90, Math.round(rewardPct * 5));
  } else if (isSell) {
    entry = price;
    stopLoss = price * (1 + stopPct);   // stop above for short
    targetPrice = price * (1 - targetPct);
    riskAmt = stopLoss - price;
    rewardAmt = price - targetPrice;
    riskPct = stopPct * 100;
    rewardPct = targetPct * 100;
    riskLevel = Math.min(80, Math.round(riskPct * 10));
    rewardLevel = Math.min(85, Math.round(rewardPct * 5));
  } else {
    // Hold — show meaningful context instead of "no setup"
    // Determine why we're holding based on volatility and confidence
    let holdReason = 'Sideways trend';
    if (atrPct < 0.01) holdReason = 'Low volatility — waiting for catalyst';
    else if (atrPct > 0.05) holdReason = 'High volatility — waiting for stability';
    else if (confFactor < 0.6) holdReason = 'Low conviction — monitoring for clarity';
    
    return {
      entry: fmtPrice(price),
      stopLoss: 'Monitor',
      targetPrice: fmtPrice(Math.round(price * (1 + atrPct * 2))),
      riskAmt: '—',
      rewardAmt: '—',
      ratio: '—',
      riskLevel: 30,
      rewardLevel: 40,
      rewardPct: Math.round(atrPct * 200 * 10) / 10,
      action: holdReason,
      isHold: true,
    };
  }

  const ratioNum = rewardAmt / riskAmt;
  const ratioStr = ratioNum >= 1 ? `1:${ratioNum.toFixed(1)}` : `${(1 / ratioNum).toFixed(1)}:1`;

  return {
    entry: `${fmtPrice(Math.round(entry * 0.995))} – ${fmtPrice(Math.round(entry * 1.005))}`,
    stopLoss: fmtPrice(Math.round(stopLoss)),
    targetPrice: fmtPrice(Math.round(targetPrice)),
    riskAmt: fmtPrice(Math.round(riskAmt)),
    rewardAmt: fmtPrice(Math.round(rewardAmt)),
    ratio: ratioStr,
    riskLevel: Math.round(riskLevel),
    rewardLevel: Math.round(rewardLevel),
    rewardPct: Math.round(rewardPct * 10) / 10,
    action: isBuy ? 'Consider Entry' : 'Avoid / Hedge',
  };
}

export default function StockDetailPage() {
  const { symbol } = useParams();
  const mockData = getMockStockDetail(symbol);
  const { user } = useUser();
  const [alertState, setAlertState] = useState('idle');

  // ── Priority-based loading state ─────────────────────────────────────────
  // Phase 1: instant render with skeleton / mock
  // Phase 2: quote arrives (fast ~300ms) → price updates
  // Phase 3: OHLC + analysis arrives (slow ~3-8s) → chart + signals update
  const [liveData, setLiveData] = useState(() => getCachedDetail(symbol) || null);
  const [finnhubQuote, setFinnhubQuote] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(!getCachedDetail(symbol));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!symbol) return;

    // Check cache first — if hit, no loading state needed
    const cached = getCachedDetail(symbol);
    if (cached) {
      setLiveData(cached);
      setLoadingDetail(false);
    } else {
      setLoadingDetail(true);
    }

    // Fetch quote + detail in parallel — quote is fast, detail is slow
    const quotePromise = getFinnhubQuote(symbol).catch(() => null);
    const detailPromise = fetchStockDetail(symbol).catch(() => null);

    // Quote resolves first — update price immediately
    quotePromise.then(q => {
      if (mountedRef.current && q?.price > 0) setFinnhubQuote(q);
    });

    // Detail resolves later — update full analysis
    detailPromise.then(d => {
      if (mountedRef.current && d) {
        setLiveData(d);
        setLoadingDetail(false);
      }
    });

    // Poll quote every 15s
    const pollId = setInterval(() => {
      getFinnhubQuote(symbol).then(q => {
        if (mountedRef.current && q?.price > 0) setFinnhubQuote(q);
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(pollId);
  }, [symbol]);

  // Finnhub WebSocket for live price ticks
  const { livePrice: wsTick, connected: wsConnected } = useFinnhubWS(symbol);

  // Build the display data — use mock immediately, upgrade when live arrives
  const baseData = liveData ? transformStockDetail(liveData) : mockData;

  // Price priority: WS tick > Finnhub quote > OHLC
  const d = useMemo(() => {
    const result = { ...baseData };

    if (finnhubQuote && finnhubQuote.price > 0) {
      result.price = finnhubQuote.price;
      result.change = finnhubQuote.changePercent;
      result.changeAmt = finnhubQuote.change;
      result.dayHigh = finnhubQuote.high;
      result.dayLow = finnhubQuote.low;
      result.openPrice = finnhubQuote.open;
      result.prevClose = finnhubQuote.prevClose;
    }

    if (wsTick && wsTick.price > 0) {
      result.price = wsTick.price;
      result.changeAmt = wsTick.prevPrice ? round2(wsTick.price - wsTick.prevPrice) : result.changeAmt;
      result.change = wsTick.prevPrice ? round2(((wsTick.price - wsTick.prevPrice) / wsTick.prevPrice) * 100) : result.change;
    }

    // Extend chart with live price point
    if (result.price > 0 && result.chartData && result.chartData.length > 1) {
      const pts = result.chartData;
      const lastPt = pts[pts.length - 1];
      const step = pts.length > 1 ? pts[1].x - pts[0].x : 40;
      const newX = lastPt.x + step;
      const prevClose = finnhubQuote?.prevClose || result.price;
      const priceDelta = result.price - prevClose;
      const allY = pts.map(p => p.y);
      const yRange = Math.max(...allY) - Math.min(...allY) || 1;
      const yPerUnit = yRange / (pts.length * 2 || 1);
      const newY = Math.max(10, Math.min(280, lastPt.y - priceDelta * yPerUnit * 0.5));
      result.chartData = [...pts, { x: newX, y: newY }];
    }

    return result;
  }, [baseData, finnhubQuote, wsTick]);

  const [tf, setTf] = useState('1M');

  // round2 must be defined BEFORE useMemo that uses it
  const round2 = (n) => Math.round(n * 100) / 100;

  const isBullish = d.signal.includes('Buy') || d.signal === 'Strong Buy';
  const signalColor = isBullish ? 'emerald' : 'red';

  // Compute risk/reward from real price data — never use hardcoded values
  const ohlcCloses = liveData?.ohlc?.map(pt => pt.close) || [];
  const rr = useMemo(
    () => computeRiskReward(d.price, d.signal, ohlcCloses, d.confidence),
    [d.price, d.signal, d.confidence, ohlcCloses.length]
  );

  // Generate dynamic warnings based on actual risk factors
  const dynamicWarnings = useMemo(() => {
    const warnings = [];
    const ohlcCloses = liveData?.ohlc?.map(pt => pt.close) || [];
    
    // Calculate volatility
    let atrPct = 0.02;
    if (ohlcCloses.length >= 3) {
      const diffs = [];
      for (let i = 1; i < ohlcCloses.length; i++) {
        diffs.push(Math.abs(ohlcCloses[i] - ohlcCloses[i - 1]) / ohlcCloses[i - 1]);
      }
      atrPct = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }

    // High volatility warning
    if (atrPct > 0.04) {
      warnings.push({
        title: 'High Volatility Detected',
        text: `Daily price swings averaging ${(atrPct * 100).toFixed(1)}% — position sizing critical`
      });
    }

    // Low confidence warning
    if (d.confidence < 65) {
      warnings.push({
        title: 'Lower Confidence Signal',
        text: 'Mixed indicators suggest waiting for clearer confirmation before entry'
      });
    }

    // Momentum warning for buy signals
    if (isBullish && d.momentum && parseFloat(d.momentum) < 50) {
      warnings.push({
        title: 'Weak Momentum',
        text: 'Uptrend may lack strength to sustain breakout — watch for volume confirmation'
      });
    }

    // Volume warning
    if (d.volumeChange && d.volumeChange.includes('-')) {
      warnings.push({
        title: 'Declining Volume',
        text: 'Lower participation may signal weakening trend — monitor for reversal'
      });
    }

    // Resistance/support warning based on price position
    if (d.dayHigh && d.price && d.price > d.dayHigh * 0.98) {
      warnings.push({
        title: 'Near Resistance',
        text: 'Price approaching day high — potential pullback zone'
      });
    }

    // Default warning if none triggered
    if (warnings.length === 0) {
      warnings.push({
        title: 'Normal Market Risk',
        text: 'Standard market volatility applies — use proper position sizing and stop losses'
      });
    }

    return warnings;
  }, [d.confidence, d.momentum, d.volumeChange, d.dayHigh, d.price, isBullish, liveData?.ohlc]);

  // AI Insight Summary - dynamic intelligent insights
  const aiInsights = useMemo(() => {
    const insights = [];
    const ohlcCloses = liveData?.ohlc?.map(pt => pt.close) || [];
    
    // Trend analysis
    if (ohlcCloses.length >= 5) {
      const recent = ohlcCloses.slice(-5);
      const isUptrend = recent.every((val, i) => i === 0 || val >= recent[i - 1]);
      const isDowntrend = recent.every((val, i) => i === 0 || val <= recent[i - 1]);
      
      if (isUptrend) {
        insights.push('Stock is in short-term uptrend with consistent higher lows');
      } else if (isDowntrend) {
        insights.push('Stock is in short-term downtrend with weak momentum');
      } else {
        insights.push('Stock is consolidating in sideways range — awaiting directional catalyst');
      }
    }

    // Resistance/Support analysis
    if (d.dayHigh && d.dayLow && d.price) {
      const range = d.dayHigh - d.dayLow;
      const position = (d.price - d.dayLow) / range;
      if (position > 0.85) {
        insights.push(`Resistance near ${fmtPrice(d.dayHigh)}, breakout needed for bullish continuation`);
      } else if (position < 0.15) {
        insights.push(`Support near ${fmtPrice(d.dayLow)}, bounce expected if level holds`);
      }
    }

    // Volume analysis
    if (d.volumeChange) {
      const volChange = parseFloat(d.volumeChange.replace(/[^0-9.-]/g, ''));
      if (volChange > 50) {
        insights.push('High volume surge indicates strong institutional interest');
      } else if (volChange < -30) {
        insights.push('Volume decline suggests weakening conviction — monitor for reversal');
      }
    }

    // Momentum + Signal alignment
    if (d.momentum) {
      const mom = parseFloat(d.momentum);
      if (isBullish && mom > 70) {
        insights.push('Strong momentum aligns with buy signal — favorable risk/reward setup');
      } else if (isBullish && mom < 40) {
        insights.push('Momentum divergence detected — wait for confirmation before entry');
      }
    }

    // Fallback
    if (insights.length === 0) {
      insights.push('Analyzing market structure and price action patterns...');
      insights.push('Monitoring for high-probability entry opportunities');
    }

    return insights.slice(0, 3);
  }, [d.dayHigh, d.dayLow, d.price, d.volumeChange, d.momentum, isBullish, liveData?.ohlc]);

  // Key Levels - dynamic support/resistance
  const keyLevels = useMemo(() => {
    const ohlcData = liveData?.ohlc || [];
    if (ohlcData.length < 10 || !d.price) {
      return {
        resistance1: d.dayHigh || d.price * 1.03,
        resistance2: d.dayHigh ? d.dayHigh * 1.02 : d.price * 1.05,
        support1: d.dayLow || d.price * 0.97,
        support2: d.dayLow ? d.dayLow * 0.98 : d.price * 0.95,
      };
    }

    const highs = ohlcData.map(pt => pt.high).sort((a, b) => b - a);
    const lows = ohlcData.map(pt => pt.low).sort((a, b) => a - b);
    
    return {
      resistance1: highs[0] || d.price * 1.03,
      resistance2: highs[1] || d.price * 1.05,
      support1: lows[0] || d.price * 0.97,
      support2: lows[1] || d.price * 0.95,
    };
  }, [liveData?.ohlc, d.price, d.dayHigh, d.dayLow]);

  // Mini Trend Forecast
  const trendForecast = useMemo(() => {
    let trend = 'Neutral';
    let confidence = 50;
    
    if (isBullish && d.confidence > 70) {
      trend = 'Bullish';
      confidence = d.confidence;
    } else if (!isBullish && d.confidence > 70) {
      trend = 'Bearish';
      confidence = d.confidence;
    } else if (d.confidence >= 50) {
      trend = 'Neutral';
      confidence = d.confidence;
    }

    return { trend, confidence };
  }, [isBullish, d.confidence]);

  // Volume & Momentum Snapshot
  const volumeMomentum = useMemo(() => {
    let volumeStatus = 'Normal';
    let momentumStrength = 'Moderate';
    let trendStrength = 50;

    if (d.volumeChange) {
      const volChange = parseFloat(d.volumeChange.replace(/[^0-9.-]/g, ''));
      if (volChange > 50) volumeStatus = 'High';
      else if (volChange < -30) volumeStatus = 'Low';
    }

    if (d.momentum) {
      const mom = parseFloat(d.momentum);
      if (mom > 70) momentumStrength = 'Strong';
      else if (mom < 40) momentumStrength = 'Weak';
      trendStrength = Math.min(100, Math.max(0, mom));
    }

    return { volumeStatus, momentumStrength, trendStrength };
  }, [d.volumeChange, d.momentum]);

  const handleSetupAlert = async () => {
    if (rr?.isHold || !rr || !d.price) return;
    setAlertState('loading');
    try {
      await dbCreateAlert({
        symbol: d.symbol,
        companyName: d.name || d.symbol,
        action: rr.action,
        entryMin: parseFloat(rr.entry?.split('–')[0]?.replace(/[₹,]/g, '').trim()) || d.price,
        entryMax: parseFloat(rr.entry?.split('–')[1]?.replace(/[₹,]/g, '').trim()) || d.price,
        stopLoss: parseFloat(rr.stopLoss?.replace(/[₹,]/g, '')) || 0,
        targetPrice: parseFloat(rr.targetPrice?.replace(/[₹,]/g, '')) || 0,
        signalConfidence: d.confidence,
        userId: user?.id || 'anonymous',
      });
      setAlertState('success');
      setTimeout(() => setAlertState('idle'), 3000);
    } catch {
      setAlertState('error');
      setTimeout(() => setAlertState('idle'), 3000);
    }
  };

  return (
    <DashboardLayout>
      <TopBar title="Analysis" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1440px] mx-auto space-y-6">
          {/* Breadcrumb */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Link to="/dashboard" className="hover:text-gray-300">Equities</Link>
              <span>›</span>
              <span className="text-gray-500">{d.sector}</span>
              <span>›</span>
              <span className="text-gray-300">{d.symbol}</span>
            </div>
          </div>

          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold text-white tracking-tight">{d.name}</h1>
                <span className="px-2.5 py-1 rounded bg-surface border border-surfaceBorder text-gray-400 font-mono text-lg">{d.symbol}</span>
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-semibold text-white">{fmtPrice(d.price)}</span>
                <div className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded text-sm ${isBullish ? 'text-signal-green bg-signal-green/10' : 'text-signal-red bg-signal-red/10'}`}>
                  {isBullish ? '↑' : '↓'} {fmtChange(d.changeAmt)} ({fmtPct(d.change)})
                </div>
                <span className="text-gray-500 text-xs ml-2">Market Open</span>
                {loadingDetail && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-600">
                    <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    Loading analysis...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Primary Signal</span>
                <div className={`flex items-center gap-2 bg-gradient-to-r ${isBullish ? 'from-signal-green/20 border-signal-green/30' : 'from-signal-red/20 border-signal-red/30'} to-transparent border pl-3 pr-4 py-2 rounded-lg backdrop-blur-sm`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isBullish ? 'bg-signal-green' : 'bg-signal-red'} animate-pulse`} />
                  <span className={`${isBullish ? 'text-signal-green' : 'text-signal-red'} font-bold text-lg tracking-wide uppercase`}>{d.signal}</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface border border-surfaceBorder rounded-lg p-2 min-w-[100px]">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Confidence</span>
                <ConfidenceMeter value={d.confidence} size="ring" />
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Main Analysis Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Metrics Bar */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between px-5 py-4 bg-white/[0.02] border-b border-surfaceBorder gap-4">
                  {[
                    { label: 'Volume', value: d.volume, sub: d.volumeChange, color: 'emerald' },
                    { label: 'Day High', value: d.dayHigh ? fmtPrice(d.dayHigh) : d.volume, sub: 'Today', color: 'emerald' },
                    { label: 'Day Low', value: d.dayLow ? fmtPrice(d.dayLow) : d.momentum, sub: 'Today', color: isBullish ? 'emerald' : 'red' },
                    { label: 'Prev Close', value: d.prevClose ? fmtPrice(d.prevClose) : d.volatility, sub: d.dayHigh ? 'Yesterday' : `${d.iv} IV`, color: 'blue' },
                  ].map(m => (
                    <div key={m.label} className="min-w-[90px]">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{m.label}</span>
                      <div className={`text-lg font-bold text-${m.color}-400 mt-0.5`}>{m.value}</div>
                      <span className="text-[9px] text-gray-500">{m.sub}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </span>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-medium ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {wsConnected ? 'Live prices active' : 'AI actively analyzing'}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {wsConnected ? `Finnhub WebSocket` : 'Processing 2.4M data points'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="p-5 border-b border-surfaceBorder flex justify-between items-center bg-white/[0.01]">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                    Price Action & Key Levels
                  </h2>
                  <div className="flex bg-base rounded-md p-1 border border-surfaceBorder">
                    {timeframes.map(t => (
                      <button key={t} onClick={() => setTf(t)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-all ${t === tf ? 'bg-surface text-white border border-white/10' : 'text-gray-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="relative w-full h-[300px] p-6">
                  {loadingDetail && (
                    <div className="absolute inset-0 flex flex-col gap-3 p-6 z-10">
                      <div className="h-full rounded-xl bg-white/[0.03] animate-pulse" />
                    </div>
                  )}
                  <svg className="w-full h-full" viewBox={`0 0 ${Math.max(800, ...(d.chartData || []).map(p => p.x + 20))} 300`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={isBullish ? '#10B981' : '#EF4444'} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={isBullish ? '#10B981' : '#EF4444'} stopOpacity="0" />
                      </linearGradient>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    <line x1="0" y1="220" x2="800" y2="220" stroke="#6B7280" strokeWidth="1" strokeDasharray="4,4" />
                    <line x1="0" y1="95" x2="800" y2="95" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4,4" />
                    {d.chartData && d.chartData.length > 1 && (() => {
                      const lastX = d.chartData[d.chartData.length - 1].x;
                      const lastPt = d.chartData[d.chartData.length - 1];
                      const linePath = d.chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      return (
                        <>
                          <path d={linePath + ` L ${lastX} 300 L 0 300 Z`} fill="url(#areaGrad)" />
                          <path d={linePath} fill="none" stroke={isBullish ? '#10B981' : '#EF4444'} strokeWidth="3" strokeLinecap="round">
                            <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.5s" fill="freeze" />
                          </path>
                          {/* Live price dot — pulses */}
                          <circle cx={lastPt.x} cy={lastPt.y} r="5" fill={isBullish ? '#10B981' : '#EF4444'} stroke="#0A0A0A" strokeWidth="2">
                            <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
                          </circle>
                          {/* Live price label */}
                          <text x={lastPt.x + 10} y={lastPt.y - 8} fill={isBullish ? '#10B981' : '#EF4444'} fontSize="11" fontFamily="monospace" fontWeight="bold">
                            {d.price > 0 ? fmtPrice(d.price) : ''}
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              {/* Confidence Drivers */}
              <div className={`glass-card rounded-2xl p-5 border border-${signalColor}-500/20 bg-gradient-to-r from-${signalColor}-500/5 to-transparent`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-semibold text-${signalColor}-400 flex items-center gap-2`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                    Why this is High Confidence
                  </h3>
                  <span className={`px-2 py-0.5 rounded bg-${signalColor}-500/20 text-${signalColor}-400 text-xs font-medium`}>{d.confidence}% Match</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.confidenceDrivers?.map(driver => (
                    <span key={driver} className={`px-3 py-1.5 rounded-full bg-surface border border-${signalColor}-500/30 text-xs text-gray-300 flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-${signalColor}-500 animate-pulse`} />
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              {/* Context Insights */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                  Context Insights
                </h3>
                {loadingDetail ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-surface/50 border border-surfaceBorder animate-pulse">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-white/[0.06] rounded w-2/3" />
                          <div className="h-2.5 bg-white/[0.04] rounded w-full" />
                          <div className="h-2.5 bg-white/[0.04] rounded w-4/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {d.contextInsights?.map(ci => (
                    <div key={ci.title} className={`flex items-start gap-3 p-4 rounded-xl bg-surface/50 border border-surfaceBorder hover:bg-surface transition-all duration-300 hover:border-${ci.color}-500/30 group cursor-pointer`}>
                      <div className={`mt-0.5 w-7 h-7 rounded-lg bg-${ci.color}-500/10 flex items-center justify-center shrink-0 border border-${ci.color}-500/20`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-${ci.color}-400`}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-200">{ci.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded bg-${ci.color === 'amber' || ci.color === 'purple' ? 'amber' : 'emerald'}-500/20 text-${ci.color === 'amber' || ci.color === 'purple' ? 'amber' : 'emerald'}-400 text-[10px] font-semibold`}>{ci.strength}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{ci.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>

              {/* AI Insight Summary - NEW PREMIUM SECTION */}
              <div className="glass-card rounded-2xl p-6 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 relative overflow-hidden group">
                <div className="absolute -right-16 -top-16 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:blur-2xl transition-all duration-700" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/30">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h-1.73c.34.6.73 1.26.73 2a2 2 0 0 1-2 2c-.74 0-1.39-.4-1.73-1H14v1.27c.6.34 1 .99 1 1.73a2 2 0 0 1-2 2 2 2 0 0 1-2-2c0-.74.4-1.39 1-1.73V16H9.73A2 2 0 0 1 8 17a2 2 0 0 1-2-2c0-.74.4-1.39 1-1.73H6a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 13 4a2 2 0 0 1-1-2z" />
                        </svg>
                      </div>
                      <span>AI Insight Summary</span>
                    </h3>
                    <span className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      Live Analysis
                    </span>
                  </div>
                  <div className="space-y-3">
                    {aiInsights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-surface/40 border border-white/5 hover:border-purple-500/30 transition-all duration-300 group/item">
                        <div className="mt-0.5 w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover/item:bg-purple-500/20 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-purple-400">
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Key Levels - NEW PREMIUM SECTION */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                    <path d="M3 3v18h18" />
                    <path d="M7 12h10" />
                    <path d="M7 8h7" />
                    <path d="M7 16h4" />
                  </svg>
                  Key Price Levels
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-all duration-300 group">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Resistance</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">R2</span>
                        <span className="text-sm font-bold text-white">{fmtPrice(keyLevels.resistance2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">R1</span>
                        <span className="text-sm font-bold text-white">{fmtPrice(keyLevels.resistance1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 group">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Support</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">S1</span>
                        <span className="text-sm font-bold text-white">{fmtPrice(keyLevels.support1)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">S2</span>
                        <span className="text-sm font-bold text-white">{fmtPrice(keyLevels.support2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini Trend Forecast + Volume Momentum - NEW PREMIUM SECTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mini Trend Forecast */}
                <div className="glass-card rounded-2xl p-5 border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    Short-Term Outlook
                  </h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">Trend Direction</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      trendForecast.trend === 'Bullish' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      trendForecast.trend === 'Bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {trendForecast.trend === 'Bullish' ? '↗' : trendForecast.trend === 'Bearish' ? '↘' : '→'} {trendForecast.trend}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Confidence</span>
                      <span className="text-xs font-semibold text-white">{trendForecast.confidence}%</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          trendForecast.trend === 'Bullish' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                          trendForecast.trend === 'Bearish' ? 'bg-gradient-to-r from-red-600 to-red-400' :
                          'bg-gradient-to-r from-amber-600 to-amber-400'
                        }`}
                        style={{ width: `${trendForecast.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Volume & Momentum Snapshot */}
                <div className="glass-card rounded-2xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                      <path d="M12 20V10" />
                      <path d="M18 20V4" />
                      <path d="M6 20v-4" />
                    </svg>
                    Market Activity
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Volume</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        volumeMomentum.volumeStatus === 'High' ? 'bg-emerald-500/20 text-emerald-400' :
                        volumeMomentum.volumeStatus === 'Low' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {volumeMomentum.volumeStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Momentum</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        volumeMomentum.momentumStrength === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' :
                        volumeMomentum.momentumStrength === 'Weak' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {volumeMomentum.momentumStrength}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">Trend Strength</span>
                        <span className="text-xs font-semibold text-white">{volumeMomentum.trendStrength}/100</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-700"
                          style={{ width: `${volumeMomentum.trendStrength}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Action & Metrics (1/3 width) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Analysis Conclusion */}
              <div className="glass-card rounded-2xl p-6 border-t-[3px] border-t-gold relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Analysis Conclusion</h2>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />AI analyzing
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{d.conclusion}</h3>
                <p className="text-sm text-gray-300">{d.conclusionText}</p>
                <div className="grid grid-cols-2 gap-4 border-t border-surfaceBorder pt-4 mt-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Time Horizon</div>
                    <div className="text-sm font-semibold text-white">{d.timeHorizon}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Target Price</div>
                    <div className={`text-sm font-semibold ${isBullish ? 'text-signal-green' : 'text-signal-red'}`}>{rr?.targetPrice || d.targetPrice}</div>
                  </div>
                </div>
              </div>

              {/* AI Synthesis */}
              <div className="glass-card rounded-2xl p-5 border border-gold/20 bg-gradient-to-b from-gold/5 to-transparent">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center border border-gold/30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gold">SignalForge AI Synthesis</h3>
                      <span className="text-[10px] text-gray-500">{d.confidence}% confidence match</span>
                    </div>
                  </div>
                </div>
                <div className="mb-4 p-3 rounded-lg bg-surface/50 border border-surfaceBorder">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Signal Summary</h4>
                  <p className="text-sm text-white leading-relaxed">{d.aiSummary}</p>
                </div>
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What this means</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{d.aiExplanation}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.confidenceDrivers?.map(driver => (
                    <span key={driver} className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7" /></svg>
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              {/* Signal Timeline */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  Signal Timeline
                </h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-3 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500 rounded-full" />
                  {d.timeline?.map(step => (
                    <div key={step.label} className="relative flex flex-col items-center gap-2 z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        step.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                        step.status === 'active' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse' :
                        'bg-surface border-2 border-emerald-500'
                      }`}>
                        {step.status === 'pending' ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> :
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                      </div>
                      <span className="text-[10px] text-gray-400 text-center">{step.label}</span>
                      <span className={`text-[9px] ${step.status === 'active' ? 'text-amber-400' : 'text-emerald-400'}`}>{step.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk / Reward */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Risk / Reward Analysis
                </h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">Risk Level</span>
                      <span className="text-xs font-semibold text-amber-400">Medium ({rr?.riskLevel ?? d.risk?.level ?? 50}%)</span>
                    </div>
                    <div className="h-3 bg-surface rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-amber-400/20 to-red-500/20" />
                      <div className="h-full rounded-full relative overflow-hidden" style={{ width: `${rr?.riskLevel ?? d.risk?.level ?? 50}%` }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">Reward Potential</span>
                      <span className="text-xs font-semibold text-emerald-400">
                        {rr ? `+${rr.rewardPct}% to ${rr.targetPrice}` : 'N/A'}
                      </span>
                    </div>
                    <div className="h-3 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full" style={{ width: `${rr?.rewardLevel ?? d.risk?.reward ?? 50}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-surfaceBorder">
                    <div>
                      <span className="text-xs text-gray-400">Risk/Reward Ratio</span>
                      <div className="text-[10px] text-gray-500">
                        Risk {rr?.riskAmt ?? d.risk?.riskAmt ?? '—'} → Reward {rr?.rewardAmt ?? d.risk?.rewardAmt ?? '—'}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-emerald-400">{rr?.ratio ?? d.risk?.ratio ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              <div className="glass-card rounded-2xl p-6 border-l-4 border-l-signal-red bg-gradient-to-r from-signal-red/5 to-transparent">
                <h3 className="text-sm font-semibold text-signal-red mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                  What could go wrong
                </h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc pl-4 marker:text-gray-600">
                  {dynamicWarnings.map(w => (
                    <li key={w.title}><strong className="text-white font-medium">{w.title}:</strong> {w.text}</li>
                  ))}
                </ul>
              </div>

              {/* Action */}
              <div className="bg-surface rounded-2xl p-6 border border-surfaceBorder relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-surface to-emerald-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col items-center text-center">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Recommended Action</span>
                  <h2 className="text-3xl font-bold text-white mb-4">{rr?.action ?? (isBullish ? 'Consider Entry' : 'Avoid / Hedge')}</h2>
                  <div className="w-full grid grid-cols-2 gap-3 mb-4 text-left">
                    <div className="bg-base p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase">Suggested Entry</div>
                      <div className="text-white font-medium text-sm">{rr?.entry ?? d.risk?.entry ?? 'Market'}</div>
                    </div>
                    <div className="bg-base p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase">Stop Loss</div>
                      <div className="text-signal-red font-medium text-sm">{rr?.stopLoss ?? d.risk?.stopLoss ?? 'N/A'}</div>
                    </div>
                  </div>
                  <button className={`w-full py-3.5 px-4 ${isBullish ? 'bg-signal-green hover:bg-emerald-400' : rr?.isHold ? 'bg-amber-500/20 hover:bg-amber-500/30 cursor-default' : 'bg-signal-red hover:bg-red-400'} text-base font-bold rounded-xl transition-all flex items-center justify-center gap-2`}
                    disabled={rr?.isHold || alertState === 'loading'}
                    onClick={handleSetupAlert}>
                    {alertState === 'loading' && <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                    {alertState === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5L20 7" /></svg>}
                    {alertState === 'error' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>}
                    {alertState === 'idle' && !rr?.isHold && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>}
                    {alertState === 'idle' && rr?.isHold && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                    {alertState === 'idle' ? (rr?.isHold ? 'Monitor Position' : 'Setup Trade Alert') :
                     alertState === 'loading' ? 'Creating Alert...' :
                     alertState === 'success' ? 'Alert Created!' : 'Failed — Try Again'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

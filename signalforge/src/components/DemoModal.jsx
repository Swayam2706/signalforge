import { useEffect, useState, useRef, useCallback } from 'react';
import { fmtPrice } from '../utils/currency';
import { useApi } from '../hooks/useApi';
import { scanMarket, getDashboardOverview } from '../services/api';
import { transformScanStock } from '../services/transforms';

// Fallback demo data — only used when backend is unavailable
const FALLBACK_SIGNALS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 1413, change: '+0.09%', signal: 'Buy', confidence: 75, color: 'green' },
  { symbol: 'TCS', name: 'TCS', price: 3800, change: '+1.2%', signal: 'Strong Buy', confidence: 88, color: 'green' },
  { symbol: 'INFY', name: 'Infosys', price: 1279, change: '+4.8%', signal: 'Strong Buy', confidence: 83, color: 'green' },
  { symbol: 'SBIN', name: 'State Bank', price: 780, change: '-0.5%', signal: 'Hold', confidence: 60, color: 'amber' },
];

const FALLBACK_METRICS = [
  { target: 2.4, suffix: 'M', label: 'Data Points', color: 'text-white' },
  { target: 94, suffix: '%', label: 'Model Accuracy', color: 'text-signal-green' },
  { target: 50, prefix: '<', suffix: 'ms', label: 'Latency', color: 'text-white' },
  { target: 78, suffix: '%', label: 'Sentiment', color: 'text-gold' },
];

/*
 * Focus phases (8s loop):
 * 0: metrics (0–1.5s)
 * 1: top pick (1.5–3s)
 * 2: signals scanning (3–6s)
 * 3: sentiment (6–8s)
 */
const PHASE_DURATION = [1500, 1500, 3000, 2000]; // ms per phase
const TOTAL_CYCLE = PHASE_DURATION.reduce((a, b) => a + b, 0);

function useCountUp(target, duration, active) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setValue((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return value;
}

export default function DemoModal({ isOpen, onClose }) {
  const [entered, setEntered] = useState(false);
  const [phase, setPhase] = useState(0);
  const [activeSignal, setActiveSignal] = useState(-1);
  const [prices, setPrices] = useState([]);
  const [flashes, setFlashes] = useState([]);
  const phaseTimer = useRef(null);
  const tickTimer = useRef(null);

  // Fetch live scan data for demo
  const { data: scanData } = useApi(() => scanMarket({ maxResults: 4 }), null, []);
  const { data: overview } = useApi(() => getDashboardOverview(), null, []);

  // Build signals from live data or fallback
  const signals = scanData?.top_stocks
    ? scanData.top_stocks.slice(0, 4).map(s => {
        const base = transformScanStock(s);
        return {
          symbol: base.symbol,
          name: base.name || base.symbol,
          price: base.price,
          change: base.change >= 0 ? `+${base.change.toFixed(2)}%` : `${base.change.toFixed(2)}%`,
          signal: base.signal,
          confidence: base.confidence,
          color: base.signal.includes('Buy') ? 'green' : base.signal === 'Sell' ? 'red' : 'amber',
        };
      })
    : FALLBACK_SIGNALS;

  const topPick = signals[0] ? {
    symbol: signals[0].symbol,
    name: signals[0].name,
    confidence: signals[0].confidence,
    signal: signals[0].signal,
    insight: `${signals[0].signal} signal detected with ${signals[0].confidence}% confidence based on live market analysis.`,
  } : { symbol: 'RELIANCE', name: 'Reliance Industries', confidence: 75, signal: 'Buy', insight: 'Live market analysis in progress.' };

  // Build metrics from live overview or fallback
  const sentimentScore = overview?.marketSentiment?.score || 78;
  const metrics = [
    { target: parseFloat(overview?.dataPoints || '2.4'), suffix: 'M', label: 'Data Points', color: 'text-white' },
    { target: 94, suffix: '%', label: 'Model Accuracy', color: 'text-signal-green' },
    { target: 50, prefix: '<', suffix: 'ms', label: 'Latency', color: 'text-white' },
    { target: sentimentScore, suffix: '%', label: 'Sentiment', color: 'text-gold' },
  ];

  // Sentiment from live overview
  const buyPct = overview?.signalAnalytics?.buyVsSell?.bull || 70;
  const holdPct = overview?.signalAnalytics?.buyVsSell?.mixed || 15;
  const sellPct = overview?.signalAnalytics?.buyVsSell?.bear || 15;

  // Initialize prices when signals load
  useEffect(() => {
    if (signals.length > 0) {
      setPrices(signals.map(s => s.price));
      setFlashes(signals.map(() => 0));
    }
  }, [signals.length]);

  // Entrance
  useEffect(() => {
    if (!isOpen) { setEntered(false); setPhase(0); setActiveSignal(-1); return; }
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Phase cycling (continuous loop)
  useEffect(() => {
    if (!entered) return;
    let currentPhase = 0;
    const advance = () => {
      currentPhase = (currentPhase + 1) % 4;
      setPhase(currentPhase);
      if (currentPhase === 2) {
        let si = 0;
        setActiveSignal(0);
        const sigInterval = setInterval(() => {
          si++;
          if (si < signals.length) setActiveSignal(si);
          else clearInterval(sigInterval);
        }, 600);
      } else {
        setActiveSignal(-1);
      }
      phaseTimer.current = setTimeout(advance, PHASE_DURATION[currentPhase]);
    };
    phaseTimer.current = setTimeout(advance, PHASE_DURATION[0]);
    return () => clearTimeout(phaseTimer.current);
  }, [entered]);

  // Price micro-fluctuations with flash
  useEffect(() => {
    if (!isOpen) return;
    tickTimer.current = setInterval(() => {
      setPrices(prev => {
        const next = prev.map(p => {
          const delta = (Math.random() - 0.48) * p * 0.003;
          return +(p + delta).toFixed(2);
        });
        setFlashes(prev.map((_, i) => next[i] > prev[i] ? 1 : next[i] < prev[i] ? -1 : 0));
        setTimeout(() => setFlashes(signals.map(() => 0)), 600);
        return next;
      });
    }, 2500);
    return () => clearInterval(tickTimer.current);
  }, [isOpen]);

  // ESC + body lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [isOpen, onClose]);

  const m0 = useCountUp(metrics[0].target, 1000, entered);
  const m1 = useCountUp(metrics[1].target, 1200, entered);
  const m2 = useCountUp(metrics[2].target, 800, entered);
  const m3 = useCountUp(metrics[3].target, 1400, entered);
  const metricValues = [`${m0.toFixed(1)}M`, `${Math.round(m1)}%`, `<${Math.round(m2)}ms`, `${Math.round(m3)}%`];

  if (!isOpen) return null;

  const isFocused = (p) => phase === p;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" style={{ opacity: entered ? 1 : 0 }} onClick={onClose} />

      <div
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0c0c10] shadow-[0_20px_80px_-12px_rgba(0,0,0,0.8)] transition-all duration-500 ease-out"
        style={{ opacity: entered ? 1 : 0, transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)' }}
      >
        {/* Background grid */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)' }} />
          {/* Scanning line */}
          <div className="demo-scanline absolute left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.08) 50%, transparent 100%)' }} />
        </div>

        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0c0c10]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-signal-green" />
              </span>
              <span className="text-[10px] font-medium text-signal-green uppercase tracking-wider">Live Preview</span>
            </div>
            <span className="text-sm font-medium text-white">SignalForge Dashboard</span>
            <span className="text-[10px] text-gray-500 demo-dots ml-1">AI analyzing live market data</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-5 relative">
          {/* Metrics — focused in phase 0 */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 transition-opacity duration-500 ${isFocused(0) ? 'opacity-100' : 'opacity-60'}`}>
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className={`p-3 rounded-xl border transition-all duration-500 ${isFocused(0) ? 'bg-white/[0.05] border-gold/20 shadow-[0_0_15px_-4px_rgba(212,175,55,0.1)]' : 'bg-white/[0.03] border-white/[0.06]'}`}
                style={{ opacity: entered ? 1 : 0, transform: entered ? 'translateY(0)' : 'translateY(8px)', transitionDelay: `${200 + i * 100}ms` }}
              >
                <div className={`text-lg font-bold ${m.color} font-mono`}>{metricValues[i]}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Top AI Pick — focused in phase 1 */}
          <div
            className={`relative p-4 rounded-xl border overflow-hidden transition-all duration-500 ${isFocused(1) ? 'bg-gold/[0.06] border-gold/25 shadow-[0_0_25px_-4px_rgba(212,175,55,0.12)]' : 'bg-gold/[0.03] border-gold/10 opacity-60'}`}
            style={{ opacity: entered ? undefined : 0, transform: entered ? 'translateY(0)' : 'translateY(8px)', transitionDelay: '600ms' }}
          >
            {/* Scan sweep on focus */}
            {isFocused(1) && <div className="demo-sweep absolute inset-0 pointer-events-none" />}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full animate-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', animationDuration: '3s' }} />
            <div className="flex items-center gap-2 mb-2 relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4AF37" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span className="text-[10px] font-semibold text-gold uppercase tracking-wider">Top AI Pick</span>
            </div>
            <div className="flex items-center justify-between relative">
              <div>
                <span className="text-lg font-bold text-white">{topPick.symbol}</span>
                <span className="text-sm text-gray-400 ml-2">{topPick.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="demo-badge-glow px-2 py-0.5 rounded bg-signal-greenLight text-signal-green text-[10px] font-bold border border-signal-green/20 uppercase">↑ {topPick.signal}</span>
                <span className="text-sm font-mono text-gold">{topPick.confidence}%</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed relative">{topPick.insight}</p>
          </div>

          {/* Active Signals — focused in phase 2, individual highlight */}
          <div className={`transition-opacity duration-500 ${isFocused(2) ? 'opacity-100' : 'opacity-60'}`}
            style={{ opacity: entered ? undefined : 0, transform: entered ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.5s ease', transitionDelay: '800ms' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Signals</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-signal-green" />
                </span>
                <span className="text-[10px] text-gray-500">{signals.length} tracked</span>
              </div>
            </div>
            <div className="space-y-2">
              {signals.map((s, i) => {
                const isScanning = isFocused(2) && activeSignal === i;
                const flash = flashes[i];
                return (
                  <div
                    key={s.symbol}
                    className={`demo-signal-row flex items-center justify-between p-3 rounded-xl border transition-all duration-300 cursor-default ${
                      isScanning
                        ? 'bg-white/[0.05] border-gold/25 shadow-[0_0_20px_-4px_rgba(212,175,55,0.1)]'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-gold/20'
                    }`}
                    style={{ opacity: entered ? 1 : 0, transform: entered ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.4s ease', transitionDelay: `${900 + i * 120}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white border transition-all duration-300 ${isScanning ? 'bg-gold/10 border-gold/30' : 'bg-white/[0.04] border-white/[0.08]'}`}>{s.symbol.slice(0, 2)}</div>
                      <div>
                        <div className="text-sm font-medium text-white">{s.symbol}</div>
                        <div className="text-[10px] text-gray-500">{s.name}</div>
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <div className={`text-sm font-medium font-mono transition-colors duration-300 ${flash === 1 ? 'text-signal-green' : flash === -1 ? 'text-signal-red' : 'text-white'}`}>
                        {fmtPrice(prices[i])}
                      </div>
                      <div className={`text-[10px] font-medium ${s.change.startsWith('+') ? 'text-signal-green' : 'text-signal-red'}`}>{s.change}</div>
                    </div>
                    <div className="flex items-center gap-3 min-w-[140px] justify-end">
                      <span className={`demo-signal-badge px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        s.color === 'green' ? 'bg-signal-greenLight text-signal-green border-signal-green/20'
                        : s.color === 'red' ? 'bg-signal-redLight text-signal-red border-signal-red/20'
                        : 'bg-signal-amberLight text-signal-amber border-signal-amber/20'
                      }`}>{s.signal}</span>
                      <div className="w-12">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className="text-gray-500">AI</span>
                          <span className="text-white font-mono">{s.confidence}%</span>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${s.color === 'green' ? 'bg-signal-green' : s.color === 'red' ? 'bg-signal-red' : 'bg-signal-amber'}`}
                            style={{ width: entered ? `${s.confidence}%` : '0%', transitionDelay: `${1000 + i * 120}ms` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment — focused in phase 3 */}
          <div
            className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-500 ${isFocused(3) ? 'bg-white/[0.04] border-gold/15 shadow-[0_0_20px_-4px_rgba(212,175,55,0.08)]' : 'bg-white/[0.02] border-white/[0.05] opacity-60'}`}
            style={{ opacity: entered ? undefined : 0, transform: entered ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.5s ease', transitionDelay: '1300ms' }}
          >
            {isFocused(3) && <div className="demo-sweep absolute inset-0 pointer-events-none" />}
            <div className="flex items-center justify-between mb-2 relative">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Market Sentiment</span>
              <span className={`text-xs text-gold font-medium transition-opacity duration-500 ${isFocused(3) ? 'opacity-100' : 'opacity-50'}`}>Positive Momentum</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5 relative">
              <div className="bg-signal-green rounded-l-full transition-all duration-1000 ease-out" style={{ width: entered ? `${buyPct}%` : '0%', transitionDelay: '1500ms' }} />
              <div className="bg-signal-amber transition-all duration-1000 ease-out" style={{ width: entered ? `${holdPct}%` : '0%', transitionDelay: '1600ms' }} />
              <div className="bg-signal-red rounded-r-full transition-all duration-1000 ease-out" style={{ width: entered ? `${sellPct}%` : '0%', transitionDelay: '1700ms' }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] text-gray-500 transition-opacity duration-500" style={{ opacity: entered ? 1 : 0, transitionDelay: '2000ms' }}>
              <span>Buy {buyPct}%</span>
              <span>Hold {holdPct}%</span>
              <span>Sell {sellPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

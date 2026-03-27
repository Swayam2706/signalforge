import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SignalBadge from '../components/SignalBadge';
import CandlestickChart from '../components/CandlestickChart';
import DemoModal from '../components/DemoModal';
import { FullLogo } from '../components/Logo';

const features = [
  { title: 'Multi-Signal Detection', desc: 'Confluence modeling across technical patterns, options flow, and dark pool activity to confirm trend direction.', icon: <path d="M2 12h4l3-9 5 18 3-9h5" /> },
  { title: 'AI Explanations', desc: 'Never trade blindly. Every signal includes a natural language breakdown of the driving factors and underlying logic.', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></> },
  { title: 'Confidence Scoring', desc: 'Probabilistic modeling assigns a 1-100% confidence rating to every setup, allowing you to size positions optimally.', icon: <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></> },
  { title: 'Opportunity Ranking', desc: 'The dashboard dynamically sorts thousands of assets to surface only the most asymmetric risk/reward setups in real-time.', icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" x2="12" y1="22.08" y2="12" /></> },
];

const steps = [
  { num: '01', title: 'Data Ingestion', desc: 'Consuming real-time ticks, options flow, and global news feeds continuously.' },
  { num: '02', title: 'Neural Processing', desc: 'Deep learning models filter noise and identify historical pattern analogs.' },
  { num: '03', title: 'Signal Generation', desc: 'Synthesizing probability. A definitive Buy/Sell directive is created with a confidence score.' },
  { num: '04', title: 'Dashboard Delivery', desc: 'Instantaneous push to your terminal with clear parameters and risk logic.' },
];

const opportunities = [
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: '₹13,793', change: '+3.12%', signal: 'Buy', confidence: 88, rationale: 'Volume divergence on the 4H chart aligning with heavy call buying. Supply zone broken.', tags: ['Vol Breakout', 'Options Flow'], color: 'green' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: '₹23,982', change: '-1.45%', signal: 'Short', confidence: 76, rationale: 'Double top formation validated by MACD sell crossover. Insider selling cluster detected over last 7 days.', tags: ['Tech Weakness', 'Sell Pattern'], color: 'red' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: '₹74,962', change: '+4.28%', signal: 'Strong Buy', confidence: 95, rationale: 'Institutional accumulation detected across 3 consecutive sessions. RSI breakout above 70 with sustained volume confirming momentum.', tags: ['Breakout', 'Institutional Activity', 'Volume Spike'], color: 'green' },
];


export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const stepId = setInterval(() => setActiveStep(prev => (prev + 1) % 4), 2000);
    const featId = setInterval(() => setActiveFeature(prev => (prev + 1) % 4), 2500);
    return () => { clearInterval(stepId); clearInterval(featId); };
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="absolute inset-0 z-0 bg-grid pointer-events-none" />
      <div className="data-grid" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-base via-transparent to-base pointer-events-none" />
      <Navbar />

      <main className="relative z-10 pt-24 pb-24">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-4 pb-16 md:pb-24">
          {/* Unified glass container */}
          <div className="relative rounded-[28px] overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm shadow-[0_8px_60px_-12px_rgba(0,0,0,0.5)]">
            {/* Ambient glow behind container */}
            <div className="absolute top-1/2 right-[25%] -translate-y-1/2 w-[400px] h-[400px] bg-gold/[0.03] blur-[140px] rounded-full pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-stretch min-h-[520px]">
              {/* Left — Text content */}
              <div className="relative z-10 flex-1 p-10 lg:p-14 xl:p-16 flex flex-col justify-center space-y-10 hero-stagger">
                {/* Subtle radial glow behind headline */}
                <div className="absolute top-[15%] left-[10%] w-[350px] h-[350px] bg-gold/[0.025] blur-[100px] rounded-full pointer-events-none" />
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 w-fit hero-stagger-item">
                  <div className="flex items-center gap-1.5">
                    <span className="live-dot" />
                    <span className="text-xs font-medium text-signal-green uppercase tracking-wider">LIVE</span>
                  </div>
                  <div className="w-px h-3 bg-white/20" />
                  <span className="text-xs font-medium text-gray-400">Analyzing 50+ stocks in real-time...</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold tracking-tight text-white leading-[1.1] hero-stagger-item">
                  Turn Market Noise into <br /><span className="text-gradient">Actionable Signals</span>
                </h1>
                <p className="text-base md:text-lg text-gray-400 max-w-lg leading-relaxed hero-stagger-item">
                  Institutional-grade AI stock intelligence. We analyze millions of data points across technicals, fundamentals, and sentiment to detect high-probability opportunities before they break out.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-5 pt-2 hero-stagger-item">
                  <Link to="/dashboard" className="w-full sm:w-auto bg-gold hover:bg-gold-hover text-base font-semibold px-9 py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2">
                    Scan Market Now
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                  <button onClick={() => setDemoOpen(true)} className="w-full sm:w-auto text-gray-400 hover:text-white font-medium px-6 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    View Demo
                  </button>
                </div>
                <div className="flex items-center gap-6 pt-8 border-t border-white/[0.06] hero-stagger-item">
                  {[['4.2M+', 'Daily Datapoints'], ['94%', 'Model Accuracy'], ['<50ms', 'Processing Latency']].map(([val, label], i) => (
                    <div key={label} className="flex items-center gap-6">
                      {i > 0 && <div className="w-px h-8 bg-white/10" />}
                      <div>
                        <div className="text-2xl font-bold text-white">{val}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Candlestick visualization */}
              <div className="relative flex-1 lg:w-[46%] min-h-[360px] lg:min-h-0 opacity-[0.55]">
                {/* "Live Market Terminal" label */}
                <div className="absolute top-5 left-6 z-20 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" className="opacity-60"><rect width="18" height="18" x="3" y="3" rx="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" /></svg>
                  <span className="text-xs font-medium text-gray-500 tracking-wide">Live Market Terminal</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="live-dot" />
                    <span className="text-[10px] font-medium text-signal-green/70 uppercase tracking-wider">LIVE</span>
                  </div>
                </div>
                {/* Chart */}
                <div className="absolute inset-0 overflow-hidden rounded-br-[28px]">
                  <CandlestickChart />
                </div>
                {/* Left edge — wide gradient for smooth transition from text area */}
                <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[rgba(10,10,10,0.9)] via-[rgba(10,10,10,0.4)] to-transparent z-10 pointer-events-none" />
                {/* Top edge fade */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[rgba(10,10,10,0.5)] to-transparent z-10 pointer-events-none" />
                {/* Bottom edge fade */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[rgba(10,10,10,0.5)] to-transparent z-10 pointer-events-none" />
                {/* Right edge fade */}
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[rgba(10,10,10,0.3)] to-transparent z-10 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-28 relative border-t border-white/5">
          {/* Background depth */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/[0.02] blur-[160px] rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="inline-block text-[11px] font-semibold text-gold/80 uppercase tracking-[0.2em] mb-4">Why SignalForge</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">Enterprise-Grade Intelligence</h2>
              <p className="text-gray-400 leading-relaxed">Stop relying on lagging indicators. Our proprietary models synthesize complex market data into clear, actionable directives.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, idx) => {
                const isActive = idx === activeFeature;
                return (
                  <div
                    key={f.title}
                    className={`feature-card relative rounded-[24px] p-9 pb-10 border transition-all duration-500 group cursor-default ${
                      isActive
                        ? 'bg-white/[0.04] border-gold/25 shadow-[0_0_40px_-8px_rgba(212,175,55,0.1)]'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Active card ambient glow */}
                    {isActive && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 bg-gold/[0.06] blur-[60px] rounded-full pointer-events-none transition-opacity duration-500" />
                    )}

                    {/* Icon */}
                    <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-7 transition-all duration-500 ${
                      isActive
                        ? 'bg-gold/[0.12] border border-gold/25'
                        : 'bg-white/[0.04] border border-white/[0.08] group-hover:bg-gold/[0.08] group-hover:border-gold/20'
                    }`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`feature-icon transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>{f.icon}</svg>
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl border border-gold/15 animate-ping pointer-events-none" style={{ animationDuration: '2.5s' }} />
                      )}
                    </div>

                    <h3 className={`text-lg font-semibold mb-3 transition-colors duration-500 ${
                      isActive ? 'text-gold' : 'text-gray-200 group-hover:text-white'
                    }`}>{f.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it Works — Animated Pipeline */}
        <section id="how-it-works" className="py-24 relative bg-black/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-white mb-2">The Signal Generation Process</h2>
              <p className="text-gray-400">From raw data to executable edge in milliseconds.</p>
            </div>
            <div className="relative">
              {/* Connector line — edge of step 1 icon to edge of step 4 icon */}
              <div className="hidden md:block absolute top-12 h-px z-0" style={{ left: '3%', right: '3%' }}>
                {/* Base dim line */}
                <div className="absolute inset-0 bg-white/[0.06]" />
                {/* Gold progress fill — grows from 0% to 100% as activeStep goes 0→3 */}
                <div
                  className="absolute top-0 left-0 h-full bg-gold/50 transition-all duration-[1.8s] ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ width: `${(activeStep / 3) * 100}%` }}
                />
                {/* Traveling glow dot */}
                <div
                  className="absolute top-1/2 w-3 h-3 rounded-full bg-gold transition-all duration-[1.8s] ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    left: `${(activeStep / 3) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 12px 3px rgba(212,175,55,0.5)',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-6 relative z-10">
                {steps.map((s, idx) => {
                  const isActive = idx === activeStep;
                  const isPast = idx < activeStep;
                  const isFuture = idx > activeStep;
                  return (
                    <div key={s.num} className="flex flex-col items-start relative group">
                      <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-6 relative border transition-all duration-700 ${
                        isActive
                          ? 'border-gold/40 bg-[#131825] shadow-[0_0_30px_rgba(212,175,55,0.15)]'
                          : isPast
                            ? 'border-gold/15 bg-[#0f1318]'
                            : 'border-white/[0.06] bg-[#0d121c]'
                      }`}>
                        <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all duration-700 ${
                          isActive
                            ? 'bg-gold text-[#0A0A0A] shadow-[0_0_10px_rgba(212,175,55,0.4)]'
                            : isPast
                              ? 'bg-gold/20 border border-gold/30 text-gold'
                              : 'bg-base border border-white/10 text-gray-500'
                        }`}>{s.num}</div>
                        {isActive && (
                          <div className="absolute inset-0 rounded-2xl border border-gold/20 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                        )}
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                          stroke={isActive ? '#D4AF37' : isPast ? 'rgba(212,175,55,0.5)' : 'currentColor'}
                          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-all duration-700 ${isActive ? 'scale-110' : isFuture ? 'text-gray-600 opacity-40' : 'opacity-60'}`}
                        >
                          {s.num === '01' && <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></>}
                          {s.num === '02' && <><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /></>}
                          {s.num === '03' && <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>}
                          {s.num === '04' && <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" /></>}
                        </svg>
                      </div>
                      <h4 className={`text-lg font-semibold mb-2 transition-colors duration-700 ${isActive ? 'text-gold' : isPast ? 'text-gray-300' : 'text-gray-500'} group-hover:text-gold`}>{s.title}</h4>
                      <p className={`text-sm transition-colors duration-700 ${isFuture ? 'text-gray-600' : 'text-gray-400'}`}>{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Opportunities */}
        <section id="opportunities" className="py-24 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Active Opportunities</h2>
                <p className="text-gray-400">Real examples of setups currently tracked by our systems.</p>
              </div>
              <Link to="/dashboard" className="text-sm text-gold hover:text-white transition-colors flex items-center gap-2">
                View All Active Scans
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {opportunities.map(o => (
                <div key={o.symbol} className="glass-card rounded-[24px] p-6 border-t border-l border-white/10 hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-bold text-white tracking-tight">{o.symbol}</h3>
                        <SignalBadge signal={o.signal} />
                      </div>
                      <p className="text-sm text-gray-400">{o.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-medium text-white">{o.price}</div>
                      <div className={`text-sm ${o.color === 'green' ? 'text-signal-green' : 'text-signal-red'}`}>{o.change}</div>
                    </div>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">AI Confidence</span>
                        <span className="text-white font-mono">{o.confidence}%</span>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className={`h-full rounded-full ${o.color === 'green' ? 'bg-signal-green' : 'bg-signal-red'}`} style={{ width: `${o.confidence}%` }} />
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">AI Rationale</span>
                      <p className="text-sm text-gray-300 leading-snug">{o.rationale}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.tags.map(t => (
                      <span key={t} className="text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative">
          <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] bg-gold/[0.03] blur-[120px] rounded-full pointer-events-none" />

            <div className="relative rounded-[24px] border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-10 md:p-14">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Your Next Market Insight <br /><span className="text-gradient">Starts Here</span>
              </h2>
              <p className="text-base text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
                Explore AI-ranked opportunities, portfolio intelligence, and real-time market analysis — all in one terminal.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Link to="/dashboard" className="bg-gold hover:bg-gold-hover text-base font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] flex items-center gap-2">
                  Launch Dashboard
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </Link>
                <Link to="/assistant" className="text-gray-400 hover:text-white font-medium px-6 py-4 rounded-xl hover:bg-white/[0.04] transition-all duration-200 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Try AI Assistant
                </Link>
              </div>

              {/* Value chips */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {['AI-Ranked Signals', 'Portfolio Insights', 'Real-Time Analysis'].map(label => (
                  <span key={label} className="text-[11px] font-medium text-gray-500 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-base relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link to="/" className="hover:opacity-90 transition-opacity">
              <FullLogo iconSize={22} />
            </Link>
            <div className="flex gap-8 text-sm text-gray-400">
              <a href="#" className="hover:text-gold transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gold transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gold transition-colors">Documentation</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-600">© 2024 SignalForge AI. All rights reserved.</p>
            <p className="text-xs text-gray-600 max-w-2xl text-center md:text-right">Disclaimer: Trading involves significant risk. SignalForge provides intelligence and analysis, not financial advice.</p>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

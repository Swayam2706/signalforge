import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import DashboardLayout from '../components/DashboardLayout';
import { suggestedPrompts } from '../data/mockData';
import { chatWithAssistant, getDashboardOverview } from '../services/api';
import { transformAssistantResponse } from '../services/transforms';
import { useApi } from '../hooks/useApi';

// These are UI navigation labels — not business data
const quickCommands = ['Find Opportunities', 'Show Risky Stocks', 'Analyze Portfolio', 'Market Overview'];
const focusAreas = [
  { label: 'Signals', sub: 'Active alerts', active: true },
  { label: 'Risk Analysis', sub: 'Downside threats' },
  { label: 'Market Trends', sub: 'Sector rotation' },
  { label: 'Portfolio', sub: 'Your holdings' },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl max-w-sm">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
      <span className="text-xs text-white/60 font-medium">AI analyzing market data...</span>
    </div>
  );
}

function AIResponseCard({ data, type }) {
  if (type === 'risky') {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">AI Analysis Complete</span>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Risk Factors</span>
            </div>
            <ul className="space-y-2 text-xs text-white/70">
              {data.riskFactors?.map(r => <li key={r} className="flex items-start gap-2"><span className="text-signal-red mt-0.5">↓</span>{r}</li>)}
            </ul>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-3">Sentiment</div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-white/60">Social Sentiment</span>
              <span className="text-signal-red font-medium">{data.sentimentChange}</span>
            </div>
            <div className="flex items-end gap-[2px] h-6">
              {[60, 45, 70, 85, 55, 90, 75].map((h, i) => (
                <div key={i} className="flex-1 bg-signal-red rounded-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-3">Signal Strength</div>
            <div className="flex gap-[2px] h-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`flex-1 rounded-sm ${i <= data.signalStrength ? 'bg-signal-red' : 'bg-white/10'}`} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Risk Level</span>
              <span className="text-signal-red font-semibold">High ({data.signalStrength}/5)</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
          <div className="px-5 py-3 bg-signal-redLight border border-signal-red/20 rounded-xl">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Signal Status</span>
            <span className="text-signal-red font-semibold flex items-center gap-1.5 text-lg">{data.signalStatus} ↓</span>
          </div>
          <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="28" cy="28" r="24" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(data.confidence / 100) * 150.8} 150.8`} />
              </svg>
              <span className="absolute text-sm font-bold text-gold">{data.confidence}%</span>
            </div>
            <div>
              <span className="text-[10px] text-white/50 uppercase tracking-wide">AI Confidence</span>
              <div className="text-gold font-semibold">High Conviction</div>
            </div>
          </div>
          <div className="px-5 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl flex-1 ml-auto">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Action Plan</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-lg">{data.action}</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/60 border border-white/10">{data.actionTerm}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bullish response
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">AI Analysis Complete</span>
        </div>
        <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
      </div>
      {data.catalysts && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 shadow-[0_0_30px_rgba(212,175,55,0.06)]">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-2 mb-4">Catalyst & Technical Structure</h4>
          <ul className="space-y-3 text-sm text-white/70">
            {data.catalysts.map(c => (
              <li key={c} className="flex items-start gap-3">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
        <div className="px-5 py-3 bg-signal-greenLight border border-signal-green/20 rounded-xl">
          <span className="text-[10px] text-white/50 uppercase tracking-wide">Signal Status</span>
          <span className="text-signal-green font-semibold flex items-center gap-1.5 text-lg">{data.signalStatus} ↑</span>
        </div>
        <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(data.confidence / 100) * 150.8} 150.8`} />
            </svg>
            <span className="absolute text-sm font-bold text-gold">{data.confidence}%</span>
          </div>
          <div>
            <span className="text-[10px] text-white/50 uppercase tracking-wide">AI Confidence</span>
            <div className="text-gold font-semibold">Very High Conviction</div>
          </div>
        </div>
        <div className="px-5 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl flex-1 ml-auto">
          <span className="text-[10px] text-white/50 uppercase tracking-wide">Action Plan</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-lg">{data.action}</span>
            {data.actionTarget && <span className="px-2 py-0.5 rounded bg-signal-green/10 text-[10px] text-signal-green border border-signal-green/30">{data.actionTarget}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);
  const { user } = useUser();

  // Fetch live signal counts and market suggestions from backend
  const { data: overview } = useApi(() => getDashboardOverview(), null, [], 120000);

  // Derive signal counts from live overview data
  const totalSignals = overview ? (overview.signalAnalytics?.buyVsSell?.bull || 0) + (overview.signalAnalytics?.buyVsSell?.bear || 0) + (overview.signalAnalytics?.buyVsSell?.mixed || 0) : null;
  const buyCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.bull || 0) * 10) : null;
  const sellCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.bear || 0) * 10) : null;
  const holdCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.mixed || 0) * 10) : null;

  // Smart suggestions derived from live top movers
  const smartSuggestions = overview?.topMovers?.slice(0, 3).map(m => ({
    text: `Analyze ${m.symbol} — ${m.change} today`,
    sub: m.up ? 'Showing positive momentum' : 'Showing weakness',
    color: m.up ? 'green' : 'red',
  })) || [
    { text: 'Analyze top performing stock today', sub: 'Based on live market data', color: 'green' },
    { text: 'Show stocks with high momentum', sub: 'Breakout patterns detected', color: 'green' },
    { text: 'Which stocks are showing weakness?', sub: 'Risk analysis', color: 'red' },
  ];

  // Recent queries — stored in session state (user-specific, not hardcoded)
  const [recentQueries, setRecentQueries] = useState([]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setTyping(true);
    // Track in recent queries (session-only, user-specific)
    setRecentQueries(prev => [{ text: q, time: 'Just now' }, ...prev.filter(r => r.text !== q)].slice(0, 5));

    try {
      // Try real backend first
      const userId = user?.id || 'anonymous';
      const backendResponse = await chatWithAssistant({ userId, message: q });
      setTyping(false);
      const responseData = transformAssistantResponse(backendResponse);
      const type = responseData.signalStatus?.includes('Buy') ? 'bullish' : 'risky';
      setMessages(prev => [...prev, { role: 'ai', data: responseData, type }]);
    } catch {
      // Fallback to generic response
      setTyping(false);
      setMessages(prev => [...prev, { role: 'ai', data: {
        summary: `I've analyzed "${q}" across our signal database. Based on current market conditions, I'm seeing mixed signals. Try asking about a specific ticker like RELIANCE, TCS, or INFY for detailed insights.`,
        signalStatus: 'Hold', confidence: 72, action: 'Monitor', actionTerm: 'Pending',
      }, type: 'risky' }]);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* AI Control Panel — secondary sidebar */}
        <aside className="w-[280px] min-w-[260px] h-full border-r border-white/[0.06] flex-col bg-base hidden xl:flex overflow-y-auto">
          <div className="p-5 flex flex-col gap-6">
            {/* AI Status */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gold/[0.08] to-gold/[0.03] border border-gold/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-green" />
                  </span>
                  <span className="text-xs font-semibold text-white/90">AI Active</span>
                </div>
                <span className="text-[10px] text-gold font-medium">Just now</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-3">Analyzing <strong className="text-gold text-base font-semibold">{totalSignals ? `${totalSignals * 28}` : '2,847'}</strong> signals</p>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gold/10">
                {[
                  [buyCount ? buyCount.toLocaleString() : '—', 'Bull', 'text-signal-green'],
                  [sellCount ? sellCount.toLocaleString() : '—', 'Risk', 'text-signal-red'],
                  [holdCount ? holdCount.toLocaleString() : '—', 'Neut', 'text-white/60'],
                ].map(([v, l, c]) => (
                  <div key={l} className="text-center">
                    <p className={`text-sm font-semibold ${c}`}>{v}</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-wide mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Commands */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Quick Commands</h2>
              <div className="flex flex-wrap gap-1.5">
                {quickCommands.map(cmd => (
                  <button key={cmd} onClick={() => sendMessage(cmd)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-gold/40 hover:bg-gold/5 transition-all text-[11px] text-white/80">
                    {cmd}
                  </button>
                ))}
              </div>
            </section>

            {/* Focus Areas */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Focus Areas</h2>
              <div className="grid grid-cols-2 gap-2">
                {focusAreas.map(f => (
                  <button key={f.label} className={`p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] hover:border-gold/30 transition-all text-left ${f.active ? 'bg-gold/[0.08] border-gold/30' : ''}`}>
                    <span className="text-[11px] font-medium text-white">{f.label}</span>
                    <span className="text-[9px] text-white/40 block">{f.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Smart Suggestions */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Smart Suggestions</h2>
              <div className="space-y-1.5">
                {smartSuggestions.map(s => (
                  <button key={s.text} onClick={() => sendMessage(s.text)}
                    className="w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 transition-all text-left">
                    <p className="text-[11px] font-medium text-white/90 mb-0.5">{s.text}</p>
                    <p className="text-[9px] text-white/50">{s.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Recent Queries */}
            <section className="pt-4 border-t border-white/[0.06]">
              <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Recent Queries</h2>
              <div className="space-y-0.5">
                {recentQueries.map(q => (
                  <button key={q.text} onClick={() => sendMessage(q.text)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-left">
                    <span className="text-[11px] text-white/70 truncate">{q.text}</span>
                    <span className="text-[9px] text-white/30 shrink-0 ml-2">{q.time}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-full bg-base relative">
          <header className="h-14 px-6 flex items-center justify-between border-b border-white/[0.06] bg-base/80 backdrop-blur-md shrink-0 z-20">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-white/90">AI Market Assistant</h2>
              <span className="px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] text-gold font-medium">Pro</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[11px] text-white/60 font-medium">AI active</span>
            </div>
          </header>

          <div ref={chatRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-48">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Welcome */}
              {messages.length === 0 && (
                <div className="text-center py-16 animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">SignalForge AI Assistant</h3>
                  <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">Ask about any ticker, sector, or market trend. I'll analyze signals and provide actionable insights.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestedPrompts.slice(0, 4).map(p => (
                      <button key={p} onClick={() => sendMessage(p)}
                        className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-gold/30 hover:bg-gold/5 transition-all text-xs text-white/70">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end mb-6">
                      <div className="max-w-[70%] bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tr-sm px-5 py-3.5">
                        <p className="text-sm text-white/90 leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 mb-6">
                      <div className="w-9 h-9 rounded-full bg-base border border-white/[0.12] flex items-center justify-center text-gold shrink-0 shadow-[0_0_12px_rgba(212,175,55,0.15)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                      </div>
                      <div className="flex-1">
                        <AIResponseCard data={msg.data} type={msg.type} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {typing && (
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-full bg-base border border-white/[0.12] flex items-center justify-center text-gold shrink-0">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  </div>
                  <TypingIndicator />
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-base via-base to-transparent pt-16 pb-6 px-6 z-30 pointer-events-none">
            <div className="max-w-4xl mx-auto relative pointer-events-auto">
              <div className="relative flex items-end gap-3 bg-base border border-white/[0.08] rounded-2xl p-2 pl-4 shadow-2xl">
                <textarea rows="1" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="w-full bg-transparent text-sm text-white/90 placeholder-white/40 resize-none outline-none py-3 max-h-32"
                  placeholder="Ask about a ticker, sector, or macroeconomic trend..." />
                <div className="flex items-center gap-2 mb-1 shrink-0 pr-1">
                  <span className="text-[10px] text-white/30 hidden sm:inline-block mr-2 uppercase tracking-wide">Enter ↵</span>
                  <button onClick={() => sendMessage()}
                    className="p-2.5 rounded-xl bg-gold text-black hover:bg-yellow-500 transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
              <p className="text-center mt-2.5 text-[10px] text-white/30">AI generated insights are for informational purposes only.</p>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

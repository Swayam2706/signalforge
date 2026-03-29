import { Link } from 'react-router-dom';

export default function AIResponseCard({ data, type, mode }) {
  // CLARIFICATION_RESULT mode - neutral state with no misleading analytics
  if (mode === 'clarification_result' || data.needsClarification) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Assistant Response</span>
          </div>
          <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">{data.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
          <div className="px-5 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Status</span>
            <span className="text-white/70 font-semibold flex items-center gap-1.5 text-lg">{data.signalStatus}</span>
          </div>
          <div className="px-5 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl flex-1">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Next Step</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-lg">{data.action}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST_RESULT mode - for risky stocks or opportunities
  if (mode === 'list_result' && data.stocksList && data.stocksList.length > 0) {
    const isRisky = type === 'risky';
    const signalColor = isRisky ? 'signal-red' : 'signal-green';
    const bgColor = isRisky ? 'signal-redLight' : 'signal-greenLight';
    
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">AI Analysis Complete</span>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
        </div>
        
        {/* Stock List */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">
            {isRisky ? 'Risky Stocks Identified' : 'Top Opportunities'}
          </h4>
          <div className="space-y-3">
            {data.stocksList.map((stock, idx) => (
              <Link key={stock.symbol} to={`/stock/${stock.symbol}`}
                className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] rounded-xl transition-all group">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{stock.symbol}</span>
                    <span className="text-xs text-white/50">{stock.name}</span>
                  </div>
                  <p className="text-xs text-white/60 line-clamp-1">{stock.reason}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white mb-1">₹{stock.price?.toLocaleString('en-IN')}</div>
                  <div className={`text-xs font-medium ${stock.change >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)}%
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg bg-${bgColor} border border-${signalColor}/20 text-xs font-medium text-${signalColor}`}>
                  {stock.signal}
                </div>
                <svg className="w-4 h-4 text-white/30 group-hover:text-gold group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
          <div className={`px-5 py-3 bg-${bgColor} border border-${signalColor}/20 rounded-xl`}>
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Signal Status</span>
            <span className={`text-${signalColor} font-semibold flex items-center gap-1.5 text-lg`}>
              {data.signalStatus} {isRisky ? '↓' : '↑'}
            </span>
          </div>
          {data.confidence > 0 && (
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
                <div className="text-gold font-semibold">
                  {data.confidence > 80 ? 'Very High' : data.confidence > 60 ? 'High' : 'Moderate'}
                </div>
              </div>
            </div>
          )}
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

  // MARKET_RESULT mode - for market overview
  if (mode === 'market_result') {
    const marketData = data.marketData;
    const isBullish = data.signalStatus === 'Bullish';
    const isBearish = data.signalStatus === 'Bearish';
    const signalColor = isBullish ? 'signal-green' : isBearish ? 'signal-red' : 'white/60';
    const bgColor = isBullish ? 'signal-greenLight' : isBearish ? 'signal-redLight' : 'white/[0.04]';
    
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Market Analysis Complete</span>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
        </div>

        {/* Market Stats */}
        {marketData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {marketData.topGainers && marketData.topGainers.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
                  </svg>
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Top Gainers</span>
                </div>
                <div className="space-y-2">
                  {marketData.topGainers.map(stock => (
                    <Link key={stock.symbol} to={`/stock/${stock.symbol}`}
                      className="flex items-center justify-between text-xs hover:bg-white/[0.04] p-2 rounded-lg transition-all">
                      <span className="text-white/80 font-medium">{stock.symbol}</span>
                      <span className="text-signal-green font-semibold">+{stock.changePercent?.toFixed(2)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {marketData.topLosers && marketData.topLosers.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                    <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
                  </svg>
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Top Losers</span>
                </div>
                <div className="space-y-2">
                  {marketData.topLosers.map(stock => (
                    <Link key={stock.symbol} to={`/stock/${stock.symbol}`}
                      className="flex items-center justify-between text-xs hover:bg-white/[0.04] p-2 rounded-lg transition-all">
                      <span className="text-white/80 font-medium">{stock.symbol}</span>
                      <span className="text-signal-red font-semibold">{stock.changePercent?.toFixed(2)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
          <div className={`px-5 py-3 bg-${bgColor} border border-${signalColor}/20 rounded-xl`}>
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Market Sentiment</span>
            <span className={`text-${signalColor} font-semibold flex items-center gap-1.5 text-lg`}>
              {data.signalStatus} {isBullish ? '↑' : isBearish ? '↓' : '→'}
            </span>
          </div>
          {data.confidence > 0 && (
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
                <span className="text-[10px] text-white/50 uppercase tracking-wide">Analysis Confidence</span>
                <div className="text-gold font-semibold">Moderate</div>
              </div>
            </div>
          )}
          <div className="px-5 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl flex-1 ml-auto">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Recommended Action</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-lg">{data.action}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STOCK_RESULT mode - single stock analysis (risky or bullish)
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
              <span className="text-white/60">Price Change</span>
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
              <span className="text-signal-red font-semibold">
                {data.signalStrength >= 4 ? 'High' : data.signalStrength >= 3 ? 'Medium' : 'Low'} ({data.signalStrength}/5)
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
          <div className="px-5 py-3 bg-signal-redLight border border-signal-red/20 rounded-xl">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Signal Status</span>
            <span className="text-signal-red font-semibold flex items-center gap-1.5 text-lg">{data.signalStatus} ↓</span>
          </div>
          {data.confidence > 0 && (
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
                <div className="text-gold font-semibold">
                  {data.confidence > 80 ? 'Very High' : data.confidence > 60 ? 'High' : 'Moderate'}
                </div>
              </div>
            </div>
          )}
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

  // Bullish response (default for stock analysis)
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span className="text-[10px] text-white/50 uppercase tracking-wide font-medium">AI Analysis Complete</span>
        </div>
        <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
      </div>
      {data.catalysts && data.catalysts.length > 0 && (
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
        {data.confidence > 0 && (
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
              <div className="text-gold font-semibold">
                {data.confidence > 80 ? 'Very High' : data.confidence > 60 ? 'High' : 'Moderate'}
              </div>
            </div>
          </div>
        )}
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

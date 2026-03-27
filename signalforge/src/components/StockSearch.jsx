import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks, prefetchStock } from '../services/api';
import { fmtPrice, fmtPct } from '../utils/currency';

const DEBOUNCE_MS = 200;

export default function StockSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sf_recent') || '[]'); } catch { return []; }
  });

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    try {
      const data = await searchStocks(q.trim());
      setResults(data?.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIdx(-1);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(val), DEBOUNCE_MS);
  };

  const selectStock = (symbol) => {
    const updated = [symbol, ...recentSearches.filter(s => s !== symbol)].slice(0, 6);
    setRecentSearches(updated);
    try { sessionStorage.setItem('sf_recent', JSON.stringify(updated)); } catch {}
    setQuery('');
    setOpen(false);
    setResults([]);
    navigate(`/stock/${symbol}`);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    const items = results;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(activeIdx + 1, items.length - 1);
      setActiveIdx(next);
      if (items[next]) prefetchStock(items[next].symbol);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(activeIdx - 1, -1);
      setActiveIdx(prev);
      if (items[prev]) prefetchStock(items[prev].symbol);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        selectStock(items[activeIdx].symbol);
      } else if (items.length > 0) {
        selectStock(items[0].symbol);
      } else if (query.trim()) {
        selectStock(query.trim().toUpperCase());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showRecent = open && !query && recentSearches.length > 0;
  const showResults = open && query.length > 0;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      {/* Input */}
      <div className={`flex items-center bg-white/[0.04] border rounded-lg px-3 py-1.5 gap-2 transition-colors ${open ? 'border-gold/40' : 'border-surfaceBorder'}`}>
        {loading
          ? <svg className="animate-spin text-gray-500 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 shrink-0"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="Search stocks..."
          className="bg-transparent text-sm text-gray-200 outline-none w-44 placeholder-gray-600"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {(showRecent || showResults) && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-[#0f0f13] border border-white/[0.08] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden">

          {/* Recent searches */}
          {showRecent && (
            <div className="p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider px-2 py-1.5 flex items-center justify-between">
                <span>Recent</span>
                <button onClick={() => { setRecentSearches([]); sessionStorage.removeItem('sf_recent'); }}
                  className="text-gray-600 hover:text-gray-400 text-[9px]">Clear</button>
              </div>
              {recentSearches.map(sym => (
                <button key={sym} onClick={() => selectStock(sym)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left group">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <span className="text-sm text-gray-300 font-mono">{sym}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 ml-auto opacity-0 group-hover:opacity-100"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {showResults && !loading && results.length > 0 && (
            <div className="p-1.5">
              {results.map((stock, i) => (
                <button key={stock.symbol} onClick={() => selectStock(stock.symbol)}
                  onMouseEnter={() => prefetchStock(stock.symbol)}
                  className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg transition-colors text-left ${i === activeIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}>
                  <div className="flex items-center gap-2.5">
                    {/* Symbol avatar */}
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {stock.symbol.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{stock.symbol}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[140px]">{stock.name}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                    {stock.price != null ? (
                      <>
                        <span className="text-xs font-mono text-white">{fmtPrice(stock.price)}</span>
                        {stock.changePercent != null && (
                          <span className={`text-[9px] font-medium ${stock.changePercent >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                            {fmtPct(stock.changePercent)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.06] text-gray-400 font-medium">{stock.exchange}</span>
                        {stock.sector && <span className="text-[9px] text-gray-600">{stock.sector}</span>}
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {showResults && loading && (
            <div className="flex items-center gap-2 px-4 py-4 text-gray-500 text-xs">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Searching...
            </div>
          )}

          {/* No results */}
          {showResults && !loading && results.length === 0 && (
            <div className="px-4 py-5 text-center">
              <div className="text-gray-500 text-sm mb-2">No results for "{query}"</div>
              <button onClick={() => selectStock(query.trim().toUpperCase())}
                className="text-[11px] text-gold hover:text-gold/80 transition-colors flex items-center gap-1 mx-auto">
                Analyze {query.toUpperCase()} anyway
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

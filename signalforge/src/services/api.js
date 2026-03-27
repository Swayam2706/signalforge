/**
 * SignalForge API Service
 * Connects frontend to the et_backend FastAPI server.
 * Falls back to mock data gracefully when backend is unavailable.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Client-side cache for stock detail (90s TTL) ────────────────────────────
const _detailCache = new Map(); // symbol → { data, ts }
const _DETAIL_TTL = 90_000;

export function getCachedDetail(symbol) {
  const entry = _detailCache.get(symbol?.toUpperCase());
  if (entry && Date.now() - entry.ts < _DETAIL_TTL) return entry.data;
  return null;
}

function setCachedDetail(symbol, data) {
  _detailCache.set(symbol?.toUpperCase(), { data, ts: Date.now() });
}

// ─── Prefetch registry — tracks in-flight prefetches ─────────────────────────
const _prefetching = new Set();

/**
 * Prefetch stock detail + quote in parallel. Safe to call on hover.
 * Results are stored in cache so the page load is instant.
 */
export async function prefetchStock(symbol) {
  const sym = symbol?.toUpperCase();
  if (!sym || getCachedDetail(sym) || _prefetching.has(sym)) return;
  _prefetching.add(sym);
  try {
    const [detail] = await Promise.all([
      apiFetch(`/stock/${sym}`).then(d => d?.data ?? d).catch(() => null),
      apiFetch(`/stocks/quote/${sym}`).then(d => d?.data ?? d).catch(() => null),
    ]);
    if (detail) setCachedDetail(sym, detail);
  } finally {
    _prefetching.delete(sym);
  }
}



// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch('/health');
}


/**
 * Scan market for top opportunities.
 * Returns top stocks with signals, confidence, and AI explanations.
 */
export async function scanMarket({ maxResults = 10, useAi = true } = {}) {
  const params = new URLSearchParams({ max_results: maxResults, use_ai: useAi });
  const data = await apiFetch(`/scan?${params}`);
  return data?.data ?? data;
}

// ─── Stock Detail ─────────────────────────────────────────────────────────────

/**
 * Get detailed stock analysis for a single symbol.
 * Returns cached result if fresh (90s), otherwise fetches and caches.
 * @param {string} symbol - e.g. "RELIANCE" or "TCS"
 * @param {number} period - days of history (30-90)
 */
export async function getStockDetail(symbol, period = 60) {
  const sym = symbol?.toUpperCase();
  const cached = getCachedDetail(sym);
  if (cached) return cached;
  const params = new URLSearchParams({ period });
  const data = await apiFetch(`/stock/${sym}?${params}`);
  const result = data?.data ?? data;
  if (result) setCachedDetail(sym, result);
  return result;
}

/**
 * Get multiple stocks summary.
 * @param {string[]} symbols - array of symbols
 */
export async function getStocks(symbols) {
  const params = new URLSearchParams({ symbols: symbols.join(',') });
  const data = await apiFetch(`/stock/?${params}`);
  return data?.data ?? data;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

/**
 * Get user's portfolio with live prices and signals.
 * @param {string} userId - Clerk user ID
 */
export async function getPortfolio(userId) {
  const data = await apiFetch(`/portfolio/?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

/**
 * Add a stock to the user's portfolio.
 */
export async function addToPortfolio({ userId, symbol, quantity, avgPrice }) {
  const data = await apiFetch('/portfolio/add', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, symbol, quantity, avg_price: avgPrice }),
  });
  return data?.data ?? data;
}

/**
 * Remove a stock from the user's portfolio.
 */
export async function removeFromPortfolio({ userId, symbol }) {
  const data = await apiFetch('/portfolio/remove', {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId, symbol }),
  });
  return data?.data ?? data;
}

/**
 * Get portfolio summary with analytics.
 */
export async function getPortfolioSummary(userId) {
  const data = await apiFetch(`/portfolio/summary?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

/**
 * Send a message to the AI assistant.
 * @param {string} userId - Clerk user ID
 * @param {string} message - User's question
 */
export async function chatWithAssistant({ userId, message }) {
  const data = await apiFetch('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, message }),
  });
  return data?.data ?? data;
}

/**
 * Get assistant status.
 */
export async function getAssistantStatus() {
  const data = await apiFetch('/assistant/status');
  return data?.data ?? data;
}

// ─── Portfolio Analysis (full page data) ──────────────────────────────────────

/**
 * Get complete portfolio analysis — summary, holdings, trends, insights, actions.
 * Single endpoint that returns everything the PortfolioPage needs.
 */
export async function getPortfolioAnalysis() {
  const data = await apiFetch('/portfolio/analysis');
  return data?.data ?? data;
}

// ─── Live Quotes (Finnhub) ────────────────────────────────────────────────────

/**
 * Get live quotes for multiple symbols from Finnhub via backend.
 * @param {string[]} symbols - array of ticker symbols
 */
export async function getLiveQuotes(symbols) {
  const data = await apiFetch(`/live/quotes?symbols=${symbols.join(',')}`);
  return data?.data ?? data;
}

/**
 * Get a single live quote.
 * @param {string} symbol
 */
export async function getLiveQuote(symbol) {
  const data = await apiFetch(`/live/quote/${symbol}`);
  return data?.data ?? data;
}

// ─── Dashboard Overview (right panel data) ────────────────────────────────────

/**
 * Get dashboard overview — sentiment, analytics, top movers.
 */
export async function getDashboardOverview() {
  const data = await apiFetch('/dashboard/overview');
  return data?.data ?? data;
}

// ─── Stock Search ─────────────────────────────────────────────────────────────

/**
 * Search stocks by ticker or company name.
 * @param {string} query
 */
export async function searchStocks(query) {
  const data = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
  return data?.data ?? data;
}

// ─── Finnhub ──────────────────────────────────────────────────────────────────

/** Get full Finnhub quote (price, high, low, open, prevClose, change%). */
export async function getFinnhubQuote(symbol) {
  const data = await apiFetch(`/finnhub/quote/${symbol}`);
  return data?.data ?? data;
}

/** Get Finnhub API token for WebSocket connection. */
export async function getFinnhubToken() {
  const data = await apiFetch('/finnhub/token');
  return data?.data?.token ?? null;
}

// ─── Unified Stock Provider (hybrid Finnhub + Yahoo) ─────────────────────────

/**
 * Get unified quote — backend routes to Finnhub (US) or Yahoo Finance (Indian).
 * @param {string} symbol
 */
export async function getUnifiedQuote(symbol) {
  const data = await apiFetch(`/stocks/quote/${symbol}`);
  return data?.data ?? data;
}

/**
 * Get unified chart data — Yahoo Finance for both US and Indian.
 * @param {string} symbol
 * @param {string} period - 1d, 5d, 1mo, 6mo, 1y
 * @param {string} interval - 1m, 5m, 15m, 1h, 1d
 */
export async function getUnifiedChart(symbol, period = '1mo', interval = '1d') {
  const data = await apiFetch(`/stocks/chart/${symbol}?period=${period}&interval=${interval}`);
  return data?.data ?? data;
}

// ─── Trade Alerts ─────────────────────────────────────────────────────────────

/** Create a trade alert for the current user. */
export async function createTradeAlert(payload) {
  const data = await apiFetch('/alerts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data ?? data;
}

/** Get all trade alerts for a user. */
export async function getTradeAlerts(userId) {
  const data = await apiFetch(`/alerts?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

// ─── Database-backed Portfolio APIs ──────────────────────────────────────────

export async function dbGetPortfolio(userId) {
  const data = await apiFetch(`/api/portfolio?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

/**
 * Fetch live prices for a list of portfolio symbols in one batch call.
 * Returns { [symbol]: { price, changePercent } }
 */
export async function dbGetPortfolioPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};
  const data = await apiFetch(`/api/portfolio/prices?symbols=${symbols.map(encodeURIComponent).join(',')}`);
  return (data?.data ?? data)?.prices ?? {};
}

export async function dbAddHolding(payload) {
  const data = await apiFetch('/api/portfolio/holdings', { method: 'POST', body: JSON.stringify(payload) });
  return data?.data ?? data;
}

export async function dbUpdateHolding(holdingId, payload) {
  const data = await apiFetch(`/api/portfolio/holdings/${holdingId}`, { method: 'PUT', body: JSON.stringify(payload) });
  return data?.data ?? data;
}

export async function dbDeleteHolding(holdingId, userId) {
  const data = await apiFetch(`/api/portfolio/holdings/${holdingId}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  return data?.data ?? data;
}

export async function dbGetWatchlist(userId) {
  const data = await apiFetch(`/api/watchlist?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

export async function dbAddWatchlist(payload) {
  const data = await apiFetch('/api/watchlist', { method: 'POST', body: JSON.stringify(payload) });
  return data?.data ?? data;
}

export async function dbRemoveWatchlist(symbol, userId) {
  const data = await apiFetch(`/api/watchlist/${symbol}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  return data?.data ?? data;
}

export async function dbCreateAlert(payload) {
  const data = await apiFetch('/api/alerts', { method: 'POST', body: JSON.stringify(payload) });
  return data?.data ?? data;
}

export async function dbGetAlerts(userId) {
  const data = await apiFetch(`/api/alerts?user_id=${encodeURIComponent(userId)}`);
  return data?.data ?? data;
}

export async function dbDeleteAlert(alertId, userId) {
  const data = await apiFetch(`/api/alerts/${alertId}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  return data?.data ?? data;
}

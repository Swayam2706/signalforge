/**
 * Currency utility for SignalForge.
 * All prices are displayed in INR (₹).
 * Indian stocks (NSE) are already in INR from yfinance.
 * US stocks are converted using a cached exchange rate.
 */

// Cached exchange rate — refreshed every 10 minutes
let cachedRate = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const FALLBACK_RATE = 84; // fallback USD→INR rate

/**
 * Fetch live USD→INR exchange rate.
 * Uses exchangerate-api (free, no key needed for basic endpoint).
 */
export async function fetchUsdToInr() {
  const now = Date.now();
  if (cachedRate && now - cacheTime < CACHE_TTL) return cachedRate;

  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    const rate = data?.rates?.INR;
    if (rate && rate > 0) {
      cachedRate = rate;
      cacheTime = now;
      return rate;
    }
  } catch {
    // Silently fall back
  }
  return cachedRate || FALLBACK_RATE;
}

/**
 * Format a number as Indian Rupees with ₹ symbol.
 * Uses Indian numbering system (lakhs, crores).
 * @param {number} value
 * @param {number} decimals - decimal places (default 2)
 */
export function formatINR(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  const num = Number(value);
  if (num === 0) return '₹0';

  // Use Intl for Indian locale formatting
  try {
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch {
    return `₹${num.toFixed(decimals)}`;
  }
}

/**
 * Format a price — always returns ₹ formatted string.
 * @param {number} price
 * @param {number} decimals
 */
export function fmtPrice(price, decimals = 2) {
  return formatINR(price, decimals);
}

/**
 * Format a change amount with sign.
 * @param {number} change
 */
export function fmtChange(change) {
  if (!change && change !== 0) return '₹0.00';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${formatINR(change, 2)}`;
}

/**
 * Format a percentage change.
 * @param {number} pct
 */
export function fmtPct(pct) {
  if (!pct && pct !== 0) return '0.00%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Number(pct).toFixed(2)}%`;
}

/**
 * Format a large value (portfolio total etc.) with compact notation.
 * @param {number} value
 */
export function fmtLarge(value) {
  if (!value) return '₹0';
  const num = Number(value);
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)}Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(2)}L`;
  return formatINR(num, 0);
}

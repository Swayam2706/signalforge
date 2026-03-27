-- SignalForge Database Schema
-- Run this against your Supabase PostgreSQL database

CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'My Portfolio',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    clerk_user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    company_name TEXT,
    exchange TEXT DEFAULT 'NSE',
    quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
    average_price NUMERIC(15,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(portfolio_id, symbol)
);

CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    company_name TEXT,
    exchange TEXT DEFAULT 'NSE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clerk_user_id, symbol)
);

CREATE TABLE IF NOT EXISTS trade_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    company_name TEXT,
    action TEXT,
    entry_min NUMERIC(15,4),
    entry_max NUMERIC(15,4),
    stop_loss NUMERIC(15,4),
    target_price NUMERIC(15,4),
    signal_confidence INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON portfolio_holdings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlists(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON trade_alerts(clerk_user_id);

"""
Database Service for SignalForge — Supabase PostgreSQL
All user data is keyed by clerk_user_id.
"""

import os
import logging
import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")
# Remove duplicate sqlite:// prefix if present (env has two DATABASE_URL lines)
if "postgresql" in DATABASE_URL:
    pass  # use as-is
elif "sqlite" in DATABASE_URL:
    DATABASE_URL = ""  # force failure so we know


@contextmanager
def get_conn():
    """Context manager for database connections."""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _row_to_dict(cursor, row) -> Dict:
    """Convert a psycopg2 row to a dict using column names."""
    cols = [desc[0] for desc in cursor.description]
    return dict(zip(cols, row))


def _rows_to_dicts(cursor, rows) -> List[Dict]:
    return [_row_to_dict(cursor, r) for r in rows]


# ─── Portfolio ────────────────────────────────────────────────────────────────

def get_or_create_portfolio(clerk_user_id: str, name: str = "My Portfolio") -> Dict:
    """Get user's default portfolio, creating it if it doesn't exist."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM portfolios WHERE clerk_user_id = %s LIMIT 1", (clerk_user_id,))
        row = cur.fetchone()
        if row:
            return _row_to_dict(cur, row)
        cur.execute(
            "INSERT INTO portfolios (clerk_user_id, name) VALUES (%s, %s) RETURNING *",
            (clerk_user_id, name)
        )
        return _row_to_dict(cur, cur.fetchone())


def get_holdings(clerk_user_id: str) -> List[Dict]:
    """Get all holdings for a user."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM portfolio_holdings WHERE clerk_user_id = %s ORDER BY created_at DESC",
            (clerk_user_id,)
        )
        return _rows_to_dicts(cur, cur.fetchall())


def add_holding(clerk_user_id: str, symbol: str, company_name: str, exchange: str,
                quantity: float, average_price: float) -> Dict:
    """Add or update a holding (upsert by symbol). Minimises DB round-trips."""
    with get_conn() as conn:
        cur = conn.cursor()
        # Get or create portfolio — single query with upsert
        cur.execute("SELECT id FROM portfolios WHERE clerk_user_id = %s LIMIT 1", (clerk_user_id,))
        row = cur.fetchone()
        if row:
            portfolio_id = row[0]
        else:
            cur.execute(
                "INSERT INTO portfolios (clerk_user_id, name) VALUES (%s, 'My Portfolio') RETURNING id",
                (clerk_user_id,)
            )
            portfolio_id = cur.fetchone()[0]

        # Upsert holding
        cur.execute("""
            INSERT INTO portfolio_holdings (portfolio_id, clerk_user_id, symbol, company_name, exchange, quantity, average_price)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (portfolio_id, symbol)
            DO UPDATE SET
                quantity = portfolio_holdings.quantity + EXCLUDED.quantity,
                average_price = (portfolio_holdings.average_price * portfolio_holdings.quantity + EXCLUDED.average_price * EXCLUDED.quantity)
                                / (portfolio_holdings.quantity + EXCLUDED.quantity),
                company_name = EXCLUDED.company_name,
                updated_at = NOW()
            RETURNING *
        """, (portfolio_id, clerk_user_id, symbol.upper(), company_name, exchange, quantity, average_price))
        return _row_to_dict(cur, cur.fetchone())


def update_holding(holding_id: str, clerk_user_id: str, quantity: float, average_price: float) -> Optional[Dict]:
    """Update a holding's quantity and average price."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE portfolio_holdings
            SET quantity = %s, average_price = %s, updated_at = NOW()
            WHERE id = %s AND clerk_user_id = %s
            RETURNING *
        """, (quantity, average_price, holding_id, clerk_user_id))
        row = cur.fetchone()
        return _row_to_dict(cur, row) if row else None


def delete_holding(holding_id: str, clerk_user_id: str) -> bool:
    """Delete a holding."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM portfolio_holdings WHERE id = %s AND clerk_user_id = %s",
            (holding_id, clerk_user_id)
        )
        return cur.rowcount > 0


# ─── Watchlist ────────────────────────────────────────────────────────────────

def get_watchlist(clerk_user_id: str) -> List[Dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM watchlists WHERE clerk_user_id = %s ORDER BY created_at DESC", (clerk_user_id,))
        return _rows_to_dicts(cur, cur.fetchall())


def add_to_watchlist(clerk_user_id: str, symbol: str, company_name: str, exchange: str) -> Dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO watchlists (clerk_user_id, symbol, company_name, exchange)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (clerk_user_id, symbol) DO UPDATE SET company_name = EXCLUDED.company_name
            RETURNING *
        """, (clerk_user_id, symbol.upper(), company_name, exchange))
        return _row_to_dict(cur, cur.fetchone())


def remove_from_watchlist(clerk_user_id: str, symbol: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM watchlists WHERE clerk_user_id = %s AND symbol = %s", (clerk_user_id, symbol.upper()))
        return cur.rowcount > 0


# ─── Trade Alerts ─────────────────────────────────────────────────────────────

def create_alert(clerk_user_id: str, data: Dict) -> Dict:
    with get_conn() as conn:
        cur = conn.cursor()
        # Deactivate existing active alert for same symbol
        cur.execute(
            "UPDATE trade_alerts SET status = 'replaced', updated_at = NOW() WHERE clerk_user_id = %s AND symbol = %s AND status = 'active'",
            (clerk_user_id, data["symbol"].upper())
        )
        cur.execute("""
            INSERT INTO trade_alerts (clerk_user_id, symbol, company_name, action, entry_min, entry_max, stop_loss, target_price, signal_confidence)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            clerk_user_id, data["symbol"].upper(), data.get("companyName", data["symbol"]),
            data.get("action"), data.get("entryMin"), data.get("entryMax"),
            data.get("stopLoss"), data.get("targetPrice"), data.get("signalConfidence", 50)
        ))
        return _row_to_dict(cur, cur.fetchone())


def get_alerts(clerk_user_id: str) -> List[Dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM trade_alerts WHERE clerk_user_id = %s AND status = 'active' ORDER BY created_at DESC",
            (clerk_user_id,)
        )
        return _rows_to_dicts(cur, cur.fetchall())


def delete_alert(alert_id: str, clerk_user_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE trade_alerts SET status = 'deleted', updated_at = NOW() WHERE id = %s AND clerk_user_id = %s",
            (alert_id, clerk_user_id)
        )
        return cur.rowcount > 0

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { dbGetAlerts, dbDeleteAlert } from '../services/api';
import { fmtPrice } from '../utils/currency';

export default function NotificationBell() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch alerts when dropdown opens
  useEffect(() => {
    if (isOpen && user?.id) {
      setLoading(true);
      dbGetAlerts(user.id)
        .then(data => {
          console.log('[NotificationBell] Fetched alerts:', data);
          const alertsList = data?.alerts || data || [];
          const alertsArray = Array.isArray(alertsList) ? alertsList : [];
          console.log('[NotificationBell] Processed alerts:', alertsArray);
          setAlerts(alertsArray);
        })
        .catch(err => {
          console.error('[NotificationBell] Error fetching alerts:', err);
          setAlerts([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Poll for new alerts every 30s when dropdown is closed
  useEffect(() => {
    if (!user?.id) return;
    
    const pollAlerts = () => {
      dbGetAlerts(user.id)
        .then(data => {
          const alertsList = data?.alerts || data || [];
          const alertsArray = Array.isArray(alertsList) ? alertsList : [];
          setAlerts(alertsArray);
        })
        .catch(() => {});
    };

    // Initial fetch
    pollAlerts();

    // Poll every 30s
    const interval = setInterval(pollAlerts, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleDeleteAlert = async (alertId, e) => {
    e.stopPropagation();
    if (!user?.id) return;
    
    try {
      await dbDeleteAlert(alertId, user.id);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleBellClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[NotificationBell] Bell clicked, current state:', { isOpen, alertCount: alerts.length, userId: user?.id });
    setIsOpen(!isOpen);
  };

  const unreadCount = alerts.length;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button 
        onClick={handleBellClick}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200 group"
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:scale-110">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Notification badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-gold rounded-full text-[9px] font-bold text-black flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Compact and properly positioned */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#0f0f13]/98 border border-white/[0.12] rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.8)] backdrop-blur-xl z-[9999] overflow-hidden animate-slideDown">
          {/* Header - Compact */}
          <div className="px-3 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
            <div>
              <h3 className="text-xs font-bold text-white">Trade Alerts</h3>
              <p className="text-[9px] text-gray-500 mt-0.5">
                {unreadCount === 0 ? 'No active alerts' : `${unreadCount} active alert${unreadCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  if (user?.id) {
                    Promise.all(alerts.map(a => dbDeleteAlert(a.id, user.id)))
                      .then(() => setAlerts([]))
                      .catch(() => {});
                  }
                }}
                className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors font-medium px-2 py-1 rounded hover:bg-white/[0.06]"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Content - Compact with internal scroll */}
          <div className="max-h-[min(400px,calc(100vh-120px))] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="ml-2 text-[10px] text-gray-500">Loading alerts...</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-8 px-3 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 mb-1">No trade alerts yet</p>
                <p className="text-[10px] text-gray-600">
                  Create alerts from stock analysis pages
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {alerts.map((alert) => {
                  const isBuy = alert.action?.toLowerCase().includes('entry') || alert.action?.toLowerCase().includes('buy');
                  const createdAt = alert.created_at ? new Date(alert.created_at) : null;
                  const timeAgo = createdAt ? getTimeAgo(createdAt) : 'Recently';
                  
                  return (
                    <div key={alert.id} className="p-2.5 hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <Link 
                          to={`/stock/${alert.symbol}`}
                          onClick={() => setIsOpen(false)}
                          className="flex-1 min-w-0"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold border ${
                              isBuy 
                                ? 'bg-signal-greenLight text-signal-green border-signal-green/30' 
                                : 'bg-signal-redLight text-signal-red border-signal-red/30'
                            }`}>
                              {alert.symbol?.slice(0, 2) || 'AL'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">
                                  {alert.company_name || alert.symbol}
                                </span>
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                  isBuy 
                                    ? 'bg-signal-green/20 text-signal-green' 
                                    : 'bg-signal-red/20 text-signal-red'
                                }`}>
                                  {alert.action || 'Alert'}
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-500 mt-0.5">{timeAgo}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                            <div className="bg-white/[0.02] rounded px-1.5 py-1">
                              <span className="text-gray-600 block">Entry</span>
                              <div className="text-white font-semibold mt-0.5 truncate">
                                {alert.entry_min ? fmtPrice(alert.entry_min) : '—'}
                              </div>
                            </div>
                            <div className="bg-white/[0.02] rounded px-1.5 py-1">
                              <span className="text-gray-600 block">Target</span>
                              <div className="text-signal-green font-semibold mt-0.5 truncate">
                                {alert.target_price ? fmtPrice(alert.target_price) : '—'}
                              </div>
                            </div>
                            <div className="bg-white/[0.02] rounded px-1.5 py-1">
                              <span className="text-gray-600 block">Stop</span>
                              <div className="text-signal-red font-semibold mt-0.5 truncate">
                                {alert.stop_loss ? fmtPrice(alert.stop_loss) : '—'}
                              </div>
                            </div>
                          </div>
                          
                          {alert.signal_confidence && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-gold to-gold/60 rounded-full transition-all duration-500"
                                  style={{ width: `${alert.signal_confidence}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-gray-500 font-semibold">
                                {alert.signal_confidence}%
                              </span>
                            </div>
                          )}
                        </Link>
                        
                        <button
                          onClick={(e) => handleDeleteAlert(alert.id, e)}
                          className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
                          title="Delete alert"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

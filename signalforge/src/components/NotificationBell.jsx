import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { dbGetAlerts, dbDeleteAlert } from '../services/api';
import { fmtPrice } from '../utils/currency';

export default function NotificationBell() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
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
    <>
      {/* Bell Button */}
      <button 
        ref={buttonRef}
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

      {/* Dropdown - Portal to body for proper z-index layering */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-80 bg-[#0f0f13] border border-white/[0.12] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl overflow-hidden animate-slideDown"
          style={{ 
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            maxHeight: 'calc(100vh - 6rem)',
            zIndex: 99999,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white">Trade Alerts</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
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
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors font-medium px-2 py-1 rounded hover:bg-white/[0.06]"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Content - Scrollable */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="ml-2 text-xs text-gray-500">Loading alerts...</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 mb-1">No trade alerts yet</p>
                <p className="text-xs text-gray-600">
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
                    <div key={alert.id} className="p-3 hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                          isBuy 
                            ? 'bg-signal-greenLight text-signal-green border-signal-green/30' 
                            : 'bg-signal-redLight text-signal-red border-signal-red/30'
                        }`}>
                          {alert.symbol?.slice(0, 2) || 'AL'}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <Link 
                            to={`/stock/${alert.symbol}`}
                            onClick={() => setIsOpen(false)}
                            className="block"
                          >
                            {/* Row 1: Name + Badge + Time */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold text-white truncate">
                                  {alert.symbol}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                  isBuy 
                                    ? 'bg-signal-green/20 text-signal-green' 
                                    : 'bg-signal-red/20 text-signal-red'
                                }`}>
                                  {isBuy ? 'BUY' : 'SELL'}
                                </span>
                              </div>
                              <span className="text-[9px] text-gray-500 shrink-0">{timeAgo}</span>
                            </div>
                            
                            {/* Row 2: Entry / Target / Stop */}
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/[0.05]">
                                <div className="text-[9px] text-gray-500 mb-0.5">Entry</div>
                                <div className="text-xs font-bold text-white truncate">
                                  {alert.entry_min ? fmtPrice(alert.entry_min) : '—'}
                                </div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/[0.05]">
                                <div className="text-[9px] text-gray-500 mb-0.5">Target</div>
                                <div className="text-xs font-bold text-signal-green truncate">
                                  {alert.target_price ? fmtPrice(alert.target_price) : '—'}
                                </div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/[0.05]">
                                <div className="text-[9px] text-gray-500 mb-0.5">Stop</div>
                                <div className="text-xs font-bold text-signal-red truncate">
                                  {alert.stop_loss ? fmtPrice(alert.stop_loss) : '—'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Row 3: Confidence */}
                            {alert.signal_confidence && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-gray-500 shrink-0">Confidence</span>
                                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-gold to-gold/60 rounded-full transition-all duration-500"
                                    style={{ width: `${alert.signal_confidence}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-gray-400 font-bold shrink-0">
                                  {alert.signal_confidence}%
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        
                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteAlert(alert.id, e)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          title="Delete alert"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        </div>,
        document.body
      )}
    </>
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

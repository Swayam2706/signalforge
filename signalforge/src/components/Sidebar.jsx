import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconLogo } from './Logo';

const navItems = [
  {
    path: '/dashboard', 
    label: 'Dashboard',
    description: 'Market signals & opportunities',
    icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  },
  {
    path: '/portfolio', 
    label: 'Portfolio',
    description: 'Track your holdings',
    icon: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
  },
  {
    path: '/assistant', 
    label: 'AI Assistant',
    description: 'Get trading insights',
    icon: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></>,
  },
];

function NavItemTooltip({ item, buttonRef, isHovered }) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isHovered && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8, // 8px gap from sidebar
      });
    }
  }, [isHovered, buttonRef]);

  if (!isHovered) return null;

  return createPortal(
    <div 
      className="fixed pointer-events-none z-[9999] transition-opacity duration-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateY(-50%)',
      }}
    >
      <div className="px-2.5 py-1.5 rounded-md bg-[#0f0f13]/98 border border-white/[0.2] shadow-[0_4px_12px_rgba(0,0,0,0.9)] backdrop-blur-sm whitespace-nowrap">
        <div className="text-[11px] font-semibold text-white">{item.label}</div>
        <div className="text-[9px] text-gray-400 mt-0.5">{item.description}</div>
        
        {/* Arrow pointing to sidebar */}
        <div className="absolute right-full top-1/2 -translate-y-1/2">
          <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[4px] border-r-[#0f0f13]" />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const buttonRefs = useRef({});

  return (
    <nav className="hidden lg:flex flex-col w-[60px] bg-[rgba(10,10,10,0.6)] backdrop-blur-xl border-r border-white/[0.05] items-center py-5 gap-2 shrink-0">
      {/* Logo */}
      <Link to="/" className="group mb-5 hover:opacity-90 transition-opacity duration-200">
        <IconLogo size={32} />
      </Link>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-2 flex-1">
        {navItems.map(item => {
          const active = pathname === item.path || (item.path === '/dashboard' && pathname.startsWith('/stock'));
          return (
            <div 
              key={item.path} 
              className="relative"
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Active indicator bar */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
                active 
                  ? 'h-8 bg-gradient-to-b from-gold via-gold to-gold/60 shadow-[0_0_12px_rgba(212,175,55,0.6)]' 
                  : 'h-0 bg-transparent'
              }`} />

              <Link
                ref={el => buttonRefs.current[item.path] = el}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`sidebar-icon relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-br from-gold/[0.15] to-gold/[0.08] text-gold shadow-[0_0_20px_-4px_rgba(212,175,55,0.3)] scale-105'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.08] hover:scale-105 active:scale-95'
                }`}
              >
                <svg
                  width="22" 
                  height="22" 
                  viewBox="0 0 24 24"
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth={active ? '2.25' : '1.75'}
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                >
                  {item.icon}
                </svg>
                
                {/* Subtle glow effect on active */}
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-gold/5 animate-pulse" />
                )}
              </Link>

              {/* Portal-based tooltip - renders outside clipping containers */}
              <NavItemTooltip 
                item={item}
                buttonRef={{ current: buttonRefs.current[item.path] }}
                isHovered={hoveredItem === item.path}
              />
            </div>
          );
        })}
      </div>
    </nav>
  );
}

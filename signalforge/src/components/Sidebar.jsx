import { Link, useLocation } from 'react-router-dom';
import { IconLogo } from './Logo';

const navItems = [
  {
    path: '/dashboard', label: 'Dashboard',
    icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  },
  {
    path: '/portfolio', label: 'Portfolio',
    icon: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
  },
  {
    path: '/assistant', label: 'AI Assistant',
    icon: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></>,
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <nav className="hidden lg:flex flex-col w-[60px] bg-[rgba(10,10,10,0.6)] backdrop-blur-xl border-r border-white/[0.05] items-center py-5 gap-2 shrink-0">
      {/* Logo */}
      <Link to="/" className="group mb-5 hover:opacity-90 transition-opacity duration-200">
        <IconLogo size={32} />
      </Link>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(item => {
          const active = pathname === item.path || (item.path === '/dashboard' && pathname.startsWith('/stock'));
          return (
            <div key={item.path} className="relative group">
              {/* Active indicator bar */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
                active ? 'h-5 bg-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'h-0 bg-transparent'
              }`} />

              <Link
                to={item.path}
                className={`sidebar-icon relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250 ${
                  active
                    ? 'bg-gold/[0.12] text-gold shadow-[0_0_16px_-4px_rgba(212,175,55,0.2)]'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.06]'
                }`}
              >
                <svg
                  width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor"
                  strokeWidth={active ? '2' : '1.75'}
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
              </Link>

              {/* Tooltip */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                <span className="text-[11px] font-medium text-gray-300">{item.label}</span>
                {/* Arrow */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#1a1a1a]" />
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

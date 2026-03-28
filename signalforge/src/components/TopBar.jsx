import { useUser, UserButton } from '@clerk/clerk-react';
import StockSearch from './StockSearch';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar({ title, subtitle }) {
  const { user, isLoaded } = useUser();

  const displayTitle = title || (
    isLoaded && user
      ? `${getGreeting()}, ${user.firstName || 'there'}`
      : `${getGreeting()}`
  );

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-r from-base via-base to-base/95 backdrop-blur-xl shrink-0 relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold/[0.02] via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <h1 className="text-base font-semibold text-white tracking-tight">{displayTitle}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-4 relative z-10">
        {/* Enhanced stock search */}
        <StockSearch />
        
        {/* Notification bell with hover effect */}
        <button className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200 group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:scale-110">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold rounded-full animate-pulse" />
        </button>
        
        {/* Enhanced user button */}
        <div className="pl-3 border-l border-white/[0.08]">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'w-9 h-9 rounded-full border-2 border-white/[0.15] shadow-lg hover:border-gold/50 transition-all duration-200',
                userButtonPopoverCard: 'bg-[#0f0f13] border border-white/[0.12] shadow-2xl backdrop-blur-xl',
                userButtonPopoverActionButton: 'text-gray-300 hover:bg-white/[0.08] transition-colors',
                userButtonPopoverActionButtonText: 'text-gray-300',
                userButtonPopoverFooter: 'hidden',
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}

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
    <header className="h-14 px-6 flex items-center justify-between border-b border-surfaceBorder bg-base shrink-0">
      <div>
        <h1 className="text-sm font-medium text-white">{displayTitle}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {/* Live stock search */}
        <StockSearch />
        <button className="text-gray-400 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        </button>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 rounded-full border border-white/[0.1]',
              userButtonPopoverCard: 'bg-[#111] border border-white/[0.08] shadow-2xl',
              userButtonPopoverActionButton: 'text-gray-300 hover:bg-white/[0.06]',
              userButtonPopoverActionButtonText: 'text-gray-300',
              userButtonPopoverFooter: 'hidden',
            },
          }}
        />
      </div>
    </header>
  );
}

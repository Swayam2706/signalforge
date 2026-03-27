import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { FullLogo } from './Logo';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 py-4 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Contained glass bar */}
        <div className="relative rounded-2xl border border-white/[0.05] bg-[rgba(10,10,10,0.65)] backdrop-blur-xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.4)] px-6 h-[56px] flex items-center justify-between">

          {/* Left — Logo */}
          <Link to="/" className="group hover:opacity-90 transition-opacity duration-200">
            <FullLogo iconSize={26} />
          </Link>

          {/* Center — Nav links */}
          <div className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            {[
              ['Features', '#features'],
              ['How it Works', '#how-it-works'],
              ['Signals', '#opportunities'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="relative px-4 py-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-200 rounded-lg hover:bg-white/[0.04] transition-all duration-200 group"
              >
                {label}
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0 h-px bg-gold/70 group-hover:w-5 transition-all duration-300" />
              </a>
            ))}
          </div>

          {/* Right — Auth-aware actions */}
          <div className="flex items-center gap-2.5">
            {/* Live status chip */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.05]">
              <span className="live-dot" />
              <span className="text-[10px] font-medium text-gray-500 tracking-wide">Live Signals</span>
            </div>

            <div className="hidden md:block w-px h-4 bg-white/[0.06]" />

            {/* Logged OUT state */}
            <SignedOut>
              <Link
                to="/sign-in"
                className="hidden md:block text-[13px] font-medium text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
              >
                Log In
              </Link>
              <Link
                to="/sign-up"
                className="text-[13px] font-semibold text-base bg-gold hover:bg-gold-hover px-5 py-2 rounded-xl transition-all duration-200 shadow-[0_0_12px_rgba(212,175,55,0.15)] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center gap-1.5"
              >
                Get Started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </SignedOut>

            {/* Logged IN state */}
            <SignedIn>
              <Link
                to="/dashboard"
                className="text-[13px] font-medium text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
              >
                Dashboard
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8 rounded-lg border border-white/[0.1]',
                    userButtonPopoverCard: 'bg-[#111] border border-white/[0.08] shadow-2xl',
                    userButtonPopoverActionButton: 'text-gray-300 hover:bg-white/[0.06]',
                    userButtonPopoverActionButtonText: 'text-gray-300',
                    userButtonPopoverFooter: 'hidden',
                  },
                }}
              />
            </SignedIn>
          </div>

        </div>
      </div>
    </nav>
  );
}

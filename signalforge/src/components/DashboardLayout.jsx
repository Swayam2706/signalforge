import Sidebar from './Sidebar';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-base relative">
      {/* Subtle animated fintech background - only visible in empty spaces */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-[0.15] animate-grid-drift">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(212,175,55,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(212,175,55,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }} />
        </div>

        {/* Floating data points */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[15%] left-[20%] w-1 h-1 rounded-full bg-gold animate-float-data-1" />
          <div className="absolute top-[35%] left-[45%] w-1.5 h-1.5 rounded-full bg-signal-green animate-float-data-2" />
          <div className="absolute top-[55%] left-[70%] w-1 h-1 rounded-full bg-gold animate-float-data-3" />
          <div className="absolute top-[75%] left-[30%] w-1 h-1 rounded-full bg-signal-green animate-float-data-4" />
          <div className="absolute top-[25%] right-[25%] w-1.5 h-1.5 rounded-full bg-gold animate-float-data-5" />
          <div className="absolute top-[65%] right-[15%] w-1 h-1 rounded-full bg-signal-green animate-float-data-6" />
        </div>

        {/* Subtle candlestick silhouettes */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="absolute bottom-[20%] left-[10%] w-32 h-24 animate-fade-pulse-slow">
            <rect x="10" y="8" width="4" height="12" fill="rgba(212,175,55,0.6)" />
            <line x1="12" y1="4" x2="12" y2="20" stroke="rgba(212,175,55,0.6)" strokeWidth="1" />
            <rect x="30" y="12" width="4" height="8" fill="rgba(22,163,74,0.6)" />
            <line x1="32" y1="8" x2="32" y2="20" stroke="rgba(22,163,74,0.6)" strokeWidth="1" />
            <rect x="50" y="6" width="4" height="14" fill="rgba(212,175,55,0.6)" />
            <line x1="52" y1="2" x2="52" y2="20" stroke="rgba(212,175,55,0.6)" strokeWidth="1" />
          </svg>
          <svg className="absolute top-[30%] right-[15%] w-32 h-24 animate-fade-pulse-slower">
            <rect x="10" y="10" width="4" height="10" fill="rgba(22,163,74,0.6)" />
            <line x1="12" y1="6" x2="12" y2="20" stroke="rgba(22,163,74,0.6)" strokeWidth="1" />
            <rect x="30" y="8" width="4" height="12" fill="rgba(212,175,55,0.6)" />
            <line x1="32" y1="4" x2="32" y2="20" stroke="rgba(212,175,55,0.6)" strokeWidth="1" />
          </svg>
        </div>

        {/* Gradient transitions */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-base via-base/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-base via-base/80 to-transparent" />
        
        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-radial-vignette" />
      </div>

      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {children}
      </div>
    </div>
  );
}

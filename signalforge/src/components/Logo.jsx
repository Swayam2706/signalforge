/**
 * SignalForge Logo Components
 * - IconLogo: icon-only version for sidebar, favicon, compact spaces
 * - FullLogo: icon + "SignalForge" wordmark for navbar, auth pages, footer
 */

const gradientDefs = (
  <defs>
    <linearGradient id="sfGold" x1="80" y1="60" x2="360" y2="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#FDE68A" />
      <stop offset="0.45" stopColor="#FACC15" />
      <stop offset="1" stopColor="#B45309" />
    </linearGradient>
    <linearGradient id="sfBull" x1="170" y1="110" x2="250" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#86EFAC" />
      <stop offset="1" stopColor="#16A34A" />
    </linearGradient>
  </defs>
);

const iconPaths = (
  <>
    {/* Outer hexagonal frame */}
    <path d="M170 18L295 90V230L170 302L45 230V90L170 18Z" stroke="url(#sfGold)" strokeWidth="12" strokeLinejoin="round" fill="none" />
    {/* Signal lines */}
    <path d="M82 206L134 176L172 205L215 149L260 113" stroke="url(#sfGold)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M80 238L134 208L172 237L215 181L260 145" stroke="url(#sfGold)" strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Upward arrow */}
    <path d="M249 101L286 104L275 138" stroke="url(#sfGold)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* AI node stems */}
    <path d="M208 72V144M236 86V131M264 100V120" stroke="url(#sfGold)" strokeWidth="7" strokeLinecap="round" fill="none" />
    {/* AI node circles */}
    <circle cx="208" cy="62" r="9" fill="#0B0B0F" stroke="url(#sfGold)" strokeWidth="6" />
    <circle cx="236" cy="76" r="9" fill="#0B0B0F" stroke="url(#sfGold)" strokeWidth="6" />
    <circle cx="264" cy="90" r="9" fill="#0B0B0F" stroke="url(#sfGold)" strokeWidth="6" />
    {/* Bullish candle */}
    <path d="M133 112V171" stroke="url(#sfBull)" strokeWidth="6" strokeLinecap="round" fill="none" />
    <rect x="120" y="126" width="26" height="35" rx="4" fill="url(#sfBull)" />
    {/* Left candle */}
    <path d="M88 138V192" stroke="url(#sfGold)" strokeWidth="5" strokeLinecap="round" opacity="0.85" fill="none" />
    <rect x="77" y="149" width="22" height="28" rx="4" fill="url(#sfGold)" opacity="0.85" />
  </>
);

/** Icon-only logo for sidebar, compact spaces */
export function IconLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 340 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SignalForge"
    >
      {gradientDefs}
      {iconPaths}
    </svg>
  );
}

/** Full logo: icon + "SignalForge" text + optional tagline */
export function FullLogo({ iconSize = 28, className = '', showTagline = false }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <IconLogo size={iconSize} />
      <div className="flex flex-col">
        <span className="text-lg font-bold tracking-tight leading-none">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#FDE68A] via-[#FACC15] to-[#B45309]">Signal</span>
          <span className="text-[#F5F5F7]">Forge</span>
        </span>
        {showTagline && (
          <span className="text-[8px] font-medium tracking-[0.2em] text-gray-500 uppercase mt-0.5">AI Market Intelligence</span>
        )}
      </div>
    </div>
  );
}

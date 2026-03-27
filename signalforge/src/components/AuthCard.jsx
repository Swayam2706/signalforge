import { Link } from 'react-router-dom';
import { FullLogo } from './Logo';

const variantStyles = {
  default: 'bg-white/[0.02]',
  glass: 'bg-white/[0.03] backdrop-blur-xl',
  elevated: 'bg-white/[0.02] shadow-[0_16px_70px_-12px_rgba(0,0,0,0.7)]',
};
const sizeStyles = { sm: 'max-w-[360px]', md: 'max-w-[420px]', lg: 'max-w-[480px]' };
const borderStyles = {
  none: 'border-transparent',
  subtle: 'border-white/[0.06]',
  gradient: 'border-white/[0.06]',
};

export default function AuthCard({
  variant = 'glass',
  size = 'md',
  glow = 'subtle',
  border = 'gradient',
  heading,
  subheading,
  footer = 'Secured with enterprise-grade encryption',
  showBack = true,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden">

      {/* ── Visible grid background ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundSize: '40px 40px',
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 0%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 0%, transparent 70%)',
      }} />

      {/* ── Animated gradient orbs — high visibility ── */}
      <div className="auth-orb-1 absolute rounded-full pointer-events-none" style={{
        top: '-5%', right: '-10%', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0) 70%)',
      }} />
      <div className="auth-orb-2 absolute rounded-full pointer-events-none" style={{
        bottom: '-10%', left: '-5%', width: 450, height: 450,
        background: 'radial-gradient(circle, rgba(180,83,9,0.12) 0%, rgba(180,83,9,0) 70%)',
      }} />
      <div className="auth-orb-3 absolute rounded-full pointer-events-none" style={{
        top: '30%', left: '60%', width: 350, height: 350,
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0) 70%)',
      }} />

      {/* Central glow directly behind card */}
      {glow !== 'none' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
          width: glow === 'premium' ? 600 : 500,
          height: glow === 'premium' ? 600 : 500,
          background: `radial-gradient(circle, rgba(212,175,55,${glow === 'premium' ? '0.1' : '0.07'}) 0%, transparent 60%)`,
        }} />
      )}

      {/* Vignette edges */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, #050508 100%)',
      }} />

      {/* ── Card content ── */}
      <div className={`relative z-10 w-full ${sizeStyles[size]}`}>
        {showBack && (
          <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors duration-200 mb-10 group">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform duration-200">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Home
          </Link>
        )}

        <div className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${variantStyles[variant]} ${borderStyles[border]} shadow-[0_8px_50px_-12px_rgba(0,0,0,0.6)]`}>
          {border === 'gradient' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          )}
          <div className="px-8 pt-10 pb-8 sm:px-10">
            <div className="flex justify-center mb-8">
              <FullLogo iconSize={28} />
            </div>
            {(heading || subheading) && (
              <div className="text-center mb-8">
                {heading && <h1 className="text-xl font-bold text-white mb-2">{heading}</h1>}
                {subheading && <p className="text-sm text-gray-500">{subheading}</p>}
              </div>
            )}
            {children}
          </div>
        </div>

        {footer && (
          <p className="text-center mt-6 text-[11px] text-gray-600">{footer}</p>
        )}
      </div>
    </div>
  );
}

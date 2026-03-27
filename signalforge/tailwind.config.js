/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        base: '#0A0A0A',
        surface: '#111111',
        surfaceBorder: 'rgba(255, 255, 255, 0.08)',
        surfaceHover: 'rgba(255, 255, 255, 0.06)',
        gold: { DEFAULT: '#D4AF37', hover: '#C9A432', light: 'rgba(212, 175, 55, 0.12)' },
        signal: {
          green: '#16A34A', greenLight: 'rgba(22, 163, 74, 0.12)',
          red: '#DC2626', redLight: 'rgba(220, 38, 38, 0.12)',
          amber: '#F59E0B', amberLight: 'rgba(245, 158, 11, 0.12)',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        glow: '0 0 60px -15px rgba(212, 175, 55, 0.2)',
        card: '0 4px 24px -2px rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease infinite',
        'scan': 'scan 4s linear infinite',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
      },
      keyframes: {
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        'pulse-gold': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(212, 175, 55, 0)' } },
        shimmer: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        scan: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

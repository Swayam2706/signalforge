import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#D4AF37',
          colorBackground: 'transparent',
          colorText: '#F5F5F7',
          colorTextSecondary: '#9CA3AF',
          colorInputBackground: 'rgba(255,255,255,0.03)',
          colorInputText: '#F5F5F7',
          colorDanger: '#DC2626',
          borderRadius: '0.75rem',
          spacingUnit: '1rem',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        elements: {
          /* Root card — transparent so our wrapper controls the look */
          rootBox: 'w-full',
          card: 'bg-transparent shadow-none border-none p-0 w-full',
          cardBox: 'shadow-none w-full',

          /* Header — hidden because we render our own branded header above */
          header: 'hidden',
          headerTitle: 'hidden',
          headerSubtitle: 'hidden',

          /* Social buttons */
          socialButtonsBlockButton:
            'bg-white/[0.03] border border-white/[0.08] text-gray-300 hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-200 rounded-xl h-11 font-medium',
          socialButtonsBlockButtonText: 'text-[13px] font-medium',
          socialButtonsProviderIcon: 'w-5 h-5',

          /* Divider */
          dividerLine: 'bg-white/[0.06]',
          dividerText: 'text-gray-500 text-xs uppercase tracking-wider',

          /* Form fields */
          formFieldLabel: 'text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5',
          formFieldInput:
            'bg-white/[0.03] border border-white/[0.08] text-white rounded-xl h-11 px-4 text-sm placeholder:text-gray-600 focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all duration-200',
          formFieldInputShowPasswordButton: 'text-gray-500 hover:text-gray-300',

          /* Primary button */
          formButtonPrimary:
            'bg-gradient-to-r from-[#D4AF37] to-[#B8962E] hover:from-[#E0BC3F] hover:to-[#C9A432] text-[#0A0A0A] font-semibold rounded-xl h-11 text-sm shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_28px_rgba(212,175,55,0.25)] transition-all duration-300',

          /* Footer links */
          footerActionText: 'text-gray-500 text-sm',
          footerActionLink: 'text-[#D4AF37] hover:text-[#F4D03F] font-medium transition-colors duration-200',

          /* Identity preview */
          identityPreview: 'bg-white/[0.03] border border-white/[0.08] rounded-xl',
          identityPreviewText: 'text-gray-300',
          identityPreviewEditButton: 'text-[#D4AF37] hover:text-[#F4D03F]',

          /* Alert */
          alert: 'bg-red-500/10 border border-red-500/20 rounded-xl text-red-400',

          /* User button popover (reused in TopBar/Navbar) */
          userButtonPopoverCard: 'bg-[#111] border border-white/[0.08] shadow-2xl rounded-xl',
          userButtonPopoverActionButton: 'text-gray-300 hover:bg-white/[0.06] rounded-lg',
          userButtonPopoverActionButtonText: 'text-gray-300 text-sm',
          userButtonPopoverFooter: 'hidden',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
);

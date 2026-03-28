const config = {
  'Strong Buy': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/30', icon: '↑' },
  'Buy': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/30', icon: '↑' },
  'Sell': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/30', icon: '↓' },
  'High Risk': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/30', icon: '↓' },
  'Hold': { bg: 'bg-signal-amberLight', text: 'text-signal-amber', border: 'border-signal-amber/30', icon: '●' },
  'Short': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/30', icon: '↓' },
  'Breakout': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/30', icon: '↑' },
  'Momentum': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/30', icon: '↑' },
  'Risky': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/30', icon: '↓' },
};

export default function SignalBadge({ signal, className = '' }) {
  const c = config[signal] || config.Hold;
  return (
    <span className={`px-3 py-1.5 rounded-lg ${c.bg} ${c.text} text-[10px] font-bold border ${c.border} uppercase tracking-wider shadow-sm transition-all duration-200 hover:scale-105 ${className}`}>
      {c.icon} {signal}
    </span>
  );
}

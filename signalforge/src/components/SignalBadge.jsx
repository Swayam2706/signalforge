const config = {
  'Strong Buy': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/20', icon: '↑' },
  'Buy': { bg: 'bg-signal-greenLight', text: 'text-signal-green', border: 'border-signal-green/20', icon: '↑' },
  'Sell': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/20', icon: '↓' },
  'High Risk': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/20', icon: '↓' },
  'Hold': { bg: 'bg-signal-amberLight', text: 'text-signal-amber', border: 'border-signal-amber/20', icon: '●' },
  'Short': { bg: 'bg-signal-redLight', text: 'text-signal-red', border: 'border-signal-red/20', icon: '↓' },
};

export default function SignalBadge({ signal, className = '' }) {
  const c = config[signal] || config.Hold;
  return (
    <span className={`px-2.5 py-1 rounded ${c.bg} ${c.text} text-[10px] font-bold border ${c.border} uppercase tracking-wide ${className}`}>
      {c.icon} {signal}
    </span>
  );
}

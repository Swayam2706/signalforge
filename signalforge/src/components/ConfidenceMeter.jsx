export default function ConfidenceMeter({ value, size = 'sm' }) {
  const color = value >= 80 ? 'bg-signal-green' : value >= 60 ? 'bg-signal-amber' : 'bg-signal-red';
  if (size === 'ring') {
    const circumference = 2 * Math.PI * 15.9155;
    const offset = circumference - (value / 100) * circumference;
    const strokeColor = value >= 80 ? '#16A34A' : value >= 60 ? '#F59E0B' : '#DC2626';
    return (
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="100, 100" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={strokeColor} strokeWidth="3" strokeDasharray={`${value}, 100`} />
        </svg>
        <span className="absolute text-sm font-bold text-white">{value}<span className="text-[10px] text-gray-400">%</span></span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 font-mono">{value}%</span>
    </div>
  );
}

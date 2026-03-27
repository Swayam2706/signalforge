export default function SummaryCard({ label, value, sub, icon, color = 'white', glow }) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${glow || ''} transition-all hover:-translate-y-0.5`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-light tabular-nums tracking-tight text-${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">{sub}</div>}
    </div>
  );
}

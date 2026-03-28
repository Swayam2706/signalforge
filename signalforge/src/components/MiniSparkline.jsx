export default function MiniSparkline({ trend = 'up', className = '' }) {
  const color = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : '#F59E0B';
  const path = trend === 'up'
    ? 'M0,18 L10,16 L20,12 L30,14 L40,8 L50,10 L60,6 L70,4'
    : trend === 'down'
    ? 'M0,6 L10,8 L20,12 L30,14 L40,16 L50,18 L60,20 L70,22'
    : 'M0,12 L10,14 L20,11 L30,13 L40,12 L50,11 L60,13 L70,12';
  return (
    <svg viewBox="0 0 70 24" className={`w-16 h-6 ${className}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

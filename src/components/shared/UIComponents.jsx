import { healthColor, healthBadge } from '../../lib/utils';

export function HealthBadge({ level }) {
  const colorClasses = {
    Excellent: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
    Good:      'bg-green-900/60 text-green-300 border border-green-700/50',
    Fair:      'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50',
    Warning:   'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50',
    Poor:      'bg-red-900/60 text-red-300 border border-red-700/50',
  };
  const fallback = 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClasses[level] || fallback}`}>
      {level}
    </span>
  );
}

export function StatCard({ label, value, unit, sub, color }) {
  return (
    <div className="stat-card">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || 'text-gray-100'}`}>
        {value}{unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export function InfoPanel({ title, children, icon }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ToolHeader({ title, description, icon, health }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h1 className="text-xl font-bold text-gray-100">{title}</h1>
        {health && <HealthBadge level={health} />}
      </div>
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  );
}

export function NoDataMessage({ requiresCli, requiresBb }) {
  const needs = [];
  if (requiresCli) needs.push('CLI dump');
  if (requiresBb) needs.push('Blackbox log');
  return (
    <div className="card text-center py-12">
      <p className="text-gray-400 mb-2">No data loaded</p>
      <p className="text-xs text-gray-500">
        This tool requires: {needs.join(' and ')}
      </p>
      <p className="text-xs text-gray-600 mt-1">Upload files using the dashboard</p>
    </div>
  );
}

export function ProgressBar({ value, max = 100, color = 'violet' }) {
  const pct = Math.min(100, (value / max) * 100);
  const colorMap = {
    violet: 'bg-violet-500', green: 'bg-green-500', yellow: 'bg-yellow-500',
    red: 'bg-red-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
    cyan: 'bg-violet-500'
  };
  return (
    <div className="w-full bg-gray-800 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${colorMap[color] || colorMap.violet}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

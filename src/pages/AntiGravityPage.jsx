import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeAntiGravity } from '../lib/analyzers/antiGravity';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Flame } from 'lucide-react';

export default function AntiGravityPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();
  const [showDetail, setShowDetail] = useState(false);

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeAntiGravity(bbParsed, tuningParams); }
    catch (e) { console.error('AntiGravity error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed. Check data format.</div>;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Anti-Gravity Analysis"
        description="Detects gyro drift during throttle punches and recommends anti_gravity_gain adjustments"
        icon={<Flame size={22} className="text-orange-400" />}
        health={result.severity}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Punches Detected" value={result.punches?.length ?? 0} color="text-orange-300" />
        <StatCard label="Avg Drift" value={result.avgDrift?.toFixed(1) ?? '—'} unit="°/s" color="text-yellow-300" />
        <StatCard label="Max Drift" value={result.maxDrift?.toFixed(1) ?? '—'} unit="°/s" color="text-red-300" />
        <StatCard label="Current AG Gain" value={tuningParams.antiGravity?.gain ?? '—'} color="text-cyan-300" />
      </div>

      {/* Per-axis breakdown */}
      {result.axes && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Per-Axis Drift</h3>
          <div className="grid grid-cols-3 gap-4">
            {['roll', 'pitch', 'yaw'].map(axis => {
              const data = result.axes?.[axis];
              return (
                <div key={axis} className="bg-gray-900/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1 capitalize">{axis}</div>
                  <div className="text-lg font-bold text-gray-200">{data?.avgDrift?.toFixed(1) ?? '—'} <span className="text-xs text-gray-500">°/s</span></div>
                  <div className="text-xs text-gray-500">Max: {data?.maxDrift?.toFixed(1) ?? '—'} °/s</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">•</span>
                <span>
                  {typeof rec === 'string' ? rec : rec.message}
                  {typeof rec === 'object' && rec.currentValue !== null && rec.suggestedValue !== null && (
                    <span className="text-gray-500"> (was {rec.currentValue} → {rec.suggestedValue})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Suggested CLI Commands" />
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeThrottleAxis } from '../lib/analyzers/throttleAxis';
import { ToolHeader, StatCard, NoDataMessage, ProgressBar } from '../components/shared/UIComponents';
import { RotateCcw } from 'lucide-react';

export default function ThrottleAxisPage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeThrottleAxis(bbParsed); }
    catch (e) { console.error('ThrottleAxis error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const axes = ['roll', 'pitch', 'yaw'];

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Throttle & Axis Manager"
        description="Hover detection, throttle usage analysis, and flight style classification"
        icon={<RotateCcw size={22} className="text-amber-400" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Hover Throttle" value={result.hoverThrottle ? `${(result.hoverThrottle * 100).toFixed(0)}` : '—'} unit="%" color="text-amber-300" />
        <StatCard label="Peak Throttle" value={result.throttleStats?.peak ? `${(result.throttleStats.peak * 100).toFixed(0)}` : '—'} unit="%" color="text-red-300" />
        <StatCard label="Avg Max" value={result.throttleStats?.avgMax ? `${(result.throttleStats.avgMax * 100).toFixed(0)}` : '—'} unit="%" color="text-orange-300" />
        <StatCard label="Flight Style" value={result.flightStyle ?? '—'} color="text-cyan-300" />
      </div>

      {/* Hover info */}
      {result.hoverThrottle && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Hover Detection</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Method: </span>
              <span className="text-gray-200">{result.hoverMethod ?? 'Statistical'}</span>
            </div>
            <div>
              <span className="text-gray-400">Full Throttle Time: </span>
              <span className="text-gray-200">{((result.throttleStats?.fullThrottleTime ?? 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Axis usage */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Axis Usage</h3>
        <div className="space-y-4">
          {axes.map(axis => {
            const d = result.axisUsage?.[axis];
            if (!d) return null;
            return (
              <div key={axis}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400 capitalize">{axis}</span>
                  <span className="text-gray-300">RMS: {d.rms?.toFixed(1)} — Peak: {d.peak?.toFixed(0)}</span>
                </div>
                <ProgressBar value={Math.min(100, (d.rms || 0) / 5)} color={axis === 'roll' ? 'cyan' : axis === 'pitch' ? 'green' : 'yellow'} />
              </div>
            );
          })}
        </div>
      </div>

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeStickMovement } from '../lib/analyzers/stickAnalyzer';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge, ProgressBar } from '../components/shared/UIComponents';
import CLIOutput from '../components/shared/CLIOutput';
import { Crosshair } from 'lucide-react';

export default function StickAnalyzerPage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeStickMovement(bbParsed); }
    catch (e) { console.error('StickAnalyzer error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const axes = ['roll', 'pitch', 'yaw'];

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Stick Analyzer"
        description="Analyze RC input smoothness, symmetry, bounceback, and jitter"
        icon={<Crosshair size={22} className="text-blue-400" />}
        health={result.overallHealth}
      />

      {result.flightStyle && (
        <div className="card mb-4">
          <span className="text-xs text-gray-400">Detected Flight Style: </span>
          <span className="text-sm font-semibold text-blue-300">{result.flightStyle}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {axes.map(axis => {
          const d = result.axes?.[axis];
          if (!d) return null;
          return (
            <div key={axis} className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 capitalize">{axis} Axis</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Smoothness</span>
                    <span className="text-gray-300">{d.smoothness?.toFixed(1) ?? '—'}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (d.smoothness || 0) * 2)} color="blue" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Symmetry</span>
                    <span className="text-gray-300">{((d.symmetry ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={(d.symmetry || 0) * 100} color="green" />
                </div>
                <div className="text-xs text-gray-400">
                  Bounceback: <span className={`${d.bounceback > 0.3 ? 'text-red-400' : 'text-green-400'}`}>{(d.bounceback ?? 0).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Jitter: <span className={`${d.jitter > 5 ? 'text-yellow-400' : 'text-green-400'}`}>{d.jitter?.toFixed(1) ?? '0'}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Center Usage: <span className="text-gray-300">{((d.centerUsage ?? 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Suggested Expo / FF Commands" />
      )}
    </div>
  );
}

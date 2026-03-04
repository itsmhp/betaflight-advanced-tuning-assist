import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeFeedforward } from '../lib/analyzers/feedforward';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, ProgressBar } from '../components/shared/UIComponents';
import { ArrowRight } from 'lucide-react';

export default function FeedforwardPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeFeedforward(bbParsed, tuningParams); }
    catch (e) { console.error('Feedforward error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Feedforward Analyzer"
        description="Evaluate feedforward tracking quality and suggest optimal FF values"
        icon={<ArrowRight size={22} className="text-pink-400" />}
        health={result.health}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="FF Health" value={result.healthScore?.toFixed(0) ?? '—'} unit="/100" color="text-pink-300" />
        <StatCard label="Maneuvers" value={result.maneuverCount ?? 0} color="text-blue-300" />
        <StatCard label="Avg Lag" value={result.avgLag?.toFixed(1) ?? '—'} unit="ms" color="text-yellow-300" />
        <StatCard label="Diagnosis" value={result.diagnosis ?? '—'} color="text-cyan-300" />
      </div>

      {/* Per-axis */}
      {result.axes && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {['roll', 'pitch', 'yaw'].map(axis => {
            const d = result.axes?.[axis];
            if (!d) return null;
            return (
              <div key={axis} className="card">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 capitalize">{axis}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current FF</span>
                    <span className="text-gray-300">{d.currentFF ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Suggested FF</span>
                    <span className="text-pink-300 font-medium">{d.suggestedFF ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Health</span>
                    <span className="text-gray-300">{d.health?.toFixed(0) ?? '—'}/100</span>
                  </div>
                  <ProgressBar value={d.health ?? 0} color="pink" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Speed bands */}
      {result.speedBands && result.speedBands.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Speed Band Breakdown</h3>
          <div className="space-y-2">
            {result.speedBands.map((band, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24">{band.label}</span>
                <ProgressBar value={band.health ?? 0} color={band.health > 70 ? 'green' : band.health > 40 ? 'yellow' : 'red'} />
                <span className="text-xs text-gray-300 w-12 text-right">{band.health?.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Feedforward CLI Commands" />
      )}
    </div>
  );
}

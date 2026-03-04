import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeDynamicIdle } from '../lib/analyzers/dynamicIdle';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Gauge } from 'lucide-react';

export default function DynamicIdlePage() {
  const { cliParsed, tuningParams, bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeDynamicIdle(bbParsed, tuningParams); }
    catch (e) { console.error('DynamicIdle error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const levelColors = { Excellent: 'text-emerald-400', Good: 'text-green-400', Fair: 'text-yellow-400', Poor: 'text-red-400' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Dynamic Idle Analyzer"
        description="Idle stability, motor desync detection, and transition analysis"
        icon={<Gauge size={22} className="text-violet-400" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Health" value={result.healthScore} unit="/100" color={levelColors[result.healthLevel]} />
        <StatCard label="Status" value={result.healthLevel} color={levelColors[result.healthLevel]} />
        <StatCard label="Idle Segments" value={result.idleSegmentCount} color="text-violet-300" />
        <StatCard label="Desync Rate" value={result.desyncRate} unit="%" color={result.desyncRate > 5 ? 'text-red-300' : 'text-green-300'} />
      </div>

      {/* Dynamic Idle Config */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Current Configuration</h3>
        <div className="grid grid-cols-5 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500">Min RPM</p>
            <p className="text-lg font-bold text-violet-300">{result.dynIdleConfig.minRpm}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">P Gain</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.pGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">I Gain</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.iGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">D Gain</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.dGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Max Increase</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.maxIncrease}</p>
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className={`text-xs px-2 py-1 rounded ${result.dynIdleConfig.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {result.dynIdleConfig.enabled ? 'Dynamic Idle Enabled' : 'Dynamic Idle Disabled'}
          </span>
        </div>
      </div>

      {/* eRPM Analysis */}
      {result.erpmAnalysis && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">eRPM Analysis</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Min eRPM</p>
              <p className="text-lg font-bold text-orange-300">{result.erpmAnalysis.minErpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Min RPM</p>
              <p className="text-lg font-bold text-cyan-300">{result.erpmAnalysis.minRpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Configured Min</p>
              <p className="text-lg font-bold text-violet-300">{result.erpmAnalysis.configuredMinRpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Headroom</p>
              <p className={`text-lg font-bold ${result.erpmAnalysis.headroom > 500 ? 'text-green-300' : 'text-red-300'}`}>
                {result.erpmAnalysis.headroom}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Idle Stability */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Idle Stability</h3>
        <p className="text-xs text-gray-400 mb-2">Average motor variance at idle: <span className="text-orange-300 font-medium">{result.avgIdleStability}</span></p>
        {result.idleAnalysis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-1 pr-2">Time</th>
                  <th className="text-left py-1 pr-2">Duration</th>
                  <th className="text-left py-1 pr-2">Motor Means</th>
                  <th className="text-left py-1 pr-2">Motor Std</th>
                  <th className="text-left py-1">Gyro RMS</th>
                </tr>
              </thead>
              <tbody>
                {result.idleAnalysis.slice(0, 5).map((seg, i) => (
                  <tr key={i} className="text-gray-400 border-b border-gray-800/30">
                    <td className="py-1 pr-2">{seg.startTime}s</td>
                    <td className="py-1 pr-2">{seg.duration}s</td>
                    <td className="py-1 pr-2 text-gray-300">{seg.motorMeans.join(' / ')}</td>
                    <td className="py-1 pr-2 text-orange-300">{seg.motorStddevs.join(' / ')}</td>
                    <td className="py-1 text-cyan-300">{seg.gyroRms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-600">No idle segments detected in flight data.</p>
        )}
      </div>

      {/* Flight Transitions */}
      {result.transitions.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Idle → Flight Transitions</h3>
          <div className="space-y-2">
            {result.transitions.slice(0, 5).map((trans, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded p-2 text-xs">
                <span className="text-gray-400">@ {trans.time}s</span>
                <span className="text-violet-300">Response: {trans.responseMs ?? '—'}ms</span>
                <span className="text-orange-300">Gyro Spike: {trans.gyroSpike}°/s</span>
                <span className="text-gray-300">Motor Δ: {trans.motorDelta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations?.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">&#9656;</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cliChanges && Object.keys(result.cliChanges).length > 0 && (
        <CLIOutput commands={Object.entries(result.cliChanges).map(([k, v]) => `set ${k} = ${v}`)} title="Dynamic Idle CLI Commands" />
      )}
    </div>
  );
}

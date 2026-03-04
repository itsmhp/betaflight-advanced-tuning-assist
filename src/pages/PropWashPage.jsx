import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzePropWash } from '../lib/analyzers/propWash';
import { ToolHeader, StatCard, NoDataMessage, ProgressBar } from '../components/shared/UIComponents';
import { Wind } from 'lucide-react';

export default function PropWashPage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzePropWash(bbParsed); }
    catch (e) { console.error('PropWash error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const sevColor = result.severityLevel === 'Severe' ? 'text-red-400' :
    result.severityLevel === 'Moderate' ? 'text-yellow-400' :
    result.severityLevel === 'Mild' ? 'text-orange-300' : 'text-green-400';

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Prop Wash Detection"
        description="Detect prop wash oscillations through frequency analysis and motor-gyro correlation"
        icon={<Wind size={22} className="text-emerald-400" />}
        health={result.severityLevel === 'Severe' ? 'Critical' : result.severityLevel === 'Moderate' ? 'Warning' : 'Good'}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Severity Score" value={result.severityScore?.toFixed(2) ?? '—'} color={sevColor} />
        <StatCard label="Severity Level" value={result.severityLevel ?? '—'} color={sevColor} />
        <StatCard label="Events Detected" value={result.eventCount ?? 0} sub={`of ${result.totalWindows} windows (${result.eventRatio}%)`} color="text-orange-300" />
        <StatCard label="Motor-Gyro Corr." value={result.maxCorrelation?.toFixed(2) ?? '—'} color="text-cyan-300" />
      </div>

      {/* Frequency Bands */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Frequency Band Energy Distribution</h3>
        <div className="grid grid-cols-2 gap-4">
          {['roll', 'pitch'].map(axis => {
            const bands = result.frequencyBands?.[axis];
            if (!bands) return null;
            return (
              <div key={axis}>
                <h4 className="text-xs text-gray-400 mb-2 capitalize">{axis}</h4>
                <div className="space-y-2">
                  {[
                    { key: 'pilotInput', label: 'Pilot Input (<20Hz)', color: 'blue' },
                    { key: 'propWash', label: 'Prop Wash (20-100Hz)', color: 'red' },
                    { key: 'resonance', label: 'Resonance (100-250Hz)', color: 'yellow' },
                    { key: 'motorNoise', label: 'Motor Noise (>250Hz)', color: 'purple' },
                  ].map(band => (
                    <div key={band.key}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-gray-400">{band.label}</span>
                        <span className="text-gray-300">{((bands[band.key] ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <ProgressBar value={(bands[band.key] ?? 0) * 100} color={band.color} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events */}
      {result.events && result.events.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Detected Events (top {result.events.length})</h3>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1">#</th>
                  <th className="text-right py-1">RMS °/s</th>
                  <th className="text-right py-1">Motor Activity</th>
                  <th className="text-right py-1">Severity</th>
                </tr>
              </thead>
              <tbody>
                {result.events.map((ev, i) => (
                  <tr key={i} className="border-b border-gray-800/30">
                    <td className="py-1 text-gray-400">{i + 1}</td>
                    <td className="py-1 text-right text-gray-300">{ev.avgRMS}</td>
                    <td className="py-1 text-right text-gray-300">{ev.motorActivity}</td>
                    <td className="py-1 text-right">
                      <span className={ev.severity > 0.7 ? 'text-red-400' : ev.severity > 0.4 ? 'text-yellow-400' : 'text-green-400'}>
                        {(ev.severity * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

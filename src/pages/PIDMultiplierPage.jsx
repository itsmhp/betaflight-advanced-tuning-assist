import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { applyPIDMultiplier } from '../lib/analyzers/pidMultiplier';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, NoDataMessage } from '../components/shared/UIComponents';
import { Sliders } from 'lucide-react';

export default function PIDMultiplierPage() {
  const { cliParsed, tuningParams } = useData();
  const [multiplier, setMultiplier] = useState(1.0);

  const result = useMemo(() => {
    if (!tuningParams) return null;
    try { return applyPIDMultiplier(tuningParams, multiplier); }
    catch (e) { console.error('PIDMultiplier error:', e); return null; }
  }, [tuningParams, multiplier]);

  if (!cliParsed) return <NoDataMessage requiresCli />;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="PID Multiplier"
        description="Scale your PID values up or down by a multiplier. Useful for switching between prop sizes."
        icon={<Sliders size={22} className="text-purple-400" />}
      />

      {/* Slider */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-3">
          <label className="text-sm text-gray-300">Multiplier</label>
          <input
            type="range" min="0.1" max="2.0" step="0.05"
            value={multiplier}
            onChange={e => setMultiplier(parseFloat(e.target.value))}
            className="flex-1 accent-purple-500"
          />
          <span className="text-lg font-bold text-purple-300 w-16 text-right">{multiplier.toFixed(2)}×</span>
        </div>
        <div className="flex gap-2">
          {[0.5, 0.75, 1.0, 1.25, 1.5].map(v => (
            <button key={v} onClick={() => setMultiplier(v)}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                Math.abs(multiplier - v) < 0.01
                  ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}>
              {v}×
            </button>
          ))}
        </div>
      </div>

      {/* PID Table */}
      {result && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Scaled PID Values</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">Axis</th>
                <th className="text-right py-2">P</th>
                <th className="text-right py-2">I</th>
                <th className="text-right py-2">D</th>
                <th className="text-right py-2">F (FF)</th>
              </tr>
            </thead>
            <tbody>
              {['roll', 'pitch', 'yaw'].map(axis => {
                const orig   = tuningParams.pid?.[axis] || {};
                const scaled = result.scaled?.[axis]   || {};
                return (
                  <tr key={axis} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-300 capitalize">{axis}</td>
                    <td className="py-2 text-right">
                      <span className="text-gray-500">{orig.p ?? '—'} → </span>
                      <span className="text-purple-300 font-medium">{scaled.p ?? '—'}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-gray-500">{orig.i ?? '—'} → </span>
                      <span className="text-purple-300 font-medium">{scaled.i ?? '—'}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-gray-500">{orig.d ?? '—'} → </span>
                      <span className="text-purple-300 font-medium">{scaled.d ?? '—'}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-gray-500">{orig.f ?? '—'} → </span>
                      <span className="text-purple-300 font-medium">{scaled.f ?? '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result?.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Scaled PID CLI Commands" />
      )}
    </div>
  );
}

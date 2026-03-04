import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeNoiseProfile } from '../lib/analyzers/noiseProfile';
import { ToolHeader, StatCard, NoDataMessage } from '../components/shared/UIComponents';
import { Radio } from 'lucide-react';

export default function NoiseProfilePage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeNoiseProfile(bbParsed); }
    catch (e) { console.error('NoiseProfile error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const levelColors = { 'Very Clean': 'text-emerald-400', Clean: 'text-green-400', Moderate: 'text-yellow-400', Noisy: 'text-red-400' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Noise Profile Tool"
        description="Frequency-domain noise analysis and source identification"
        icon={<Radio size={22} className="text-violet-400" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Noise Level" value={result.noiseLevel} color={levelColors[result.noiseLevel]} />
        <StatCard label="Health" value={result.healthScore} unit="/100" color="text-violet-300" />
        <StatCard label="Avg Noise" value={result.avgNoiseRms} unit="°/s" color="text-orange-300" />
        <StatCard label="Sample Rate" value={result.sampleRate} unit="Hz" color="text-gray-300" />
      </div>

      {/* Frequency Band Breakdown per Axis */}
      {[result.rollProfile, result.pitchProfile, result.yawProfile].map((profile, idx) => (
        <div key={idx} className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">{profile.label} Axis</h3>
            <span className="text-xs text-gray-400">RMS: <span className="text-orange-300">{profile.noiseRms}°/s</span></span>
          </div>

          {/* Frequency bands */}
          <div className="space-y-2 mb-3">
            {Object.values(profile.bands).map((band, bi) => (
              <div key={bi} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-36 truncate">{band.label}</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{
                      width: `${Math.min(band.percent, 100)}%`,
                      background: band.percent > 25 ? '#ef4444' : band.percent > 15 ? '#f59e0b' : '#8b5cf6'
                    }} />
                </div>
                <span className="text-gray-400 w-12 text-right">{band.percent}%</span>
              </div>
            ))}
          </div>

          {/* Peaks */}
          {profile.peaks.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-700/30">
              {profile.peaks.slice(0, 5).map((peak, pi) => (
                <span key={pi} className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {peak.frequency}Hz
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Filter Effectiveness */}
      {result.filterEffectiveness && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Filter Effectiveness</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Unfiltered</p>
              <p className="text-lg font-bold text-red-300">{result.filterEffectiveness.unfilteredRms}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Filtered</p>
              <p className="text-lg font-bold text-green-300">{result.filterEffectiveness.filteredRms}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reduction</p>
              <p className="text-lg font-bold text-violet-300">{result.filterEffectiveness.reductionPercent}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Throttle-dependent Noise */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Noise vs Throttle</h3>
        <div className="grid grid-cols-4 gap-3">
          {result.throttleNoise.map((band, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-gray-500 mb-1">{band.label}</p>
              {band.rollRms !== null ? (
                <>
                  <p className="text-sm font-bold text-orange-300">R: {band.rollRms}</p>
                  <p className="text-sm font-bold text-cyan-300">P: {band.pitchRms}</p>
                </>
              ) : (
                <p className="text-xs text-gray-600">No data</p>
              )}
              <p className="text-xs text-gray-600 mt-1">{band.samples} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Noise Sources */}
      {result.noiseSources.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Identified Noise Sources</h3>
          <div className="space-y-2">
            {result.noiseSources.map((ns, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded p-2">
                <div>
                  <span className="text-xs font-medium text-gray-200">{ns.source}</span>
                  <span className="text-xs text-gray-500 ml-2">({ns.axis})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{ns.detail}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ns.severity === 'High' ? 'bg-red-500/20 text-red-300' :
                    ns.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{ns.severity}</span>
                </div>
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
    </div>
  );
}

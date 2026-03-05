import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeFilters } from '../lib/analyzers/filterAnalyzer';
import { generateNoiseHeatmap } from '../lib/analyzers/noiseProfile';
import NoiseHeatmap from '../components/NoiseHeatmap';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Filter } from 'lucide-react';

export default function FilterAnalyzerPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeFilters(bbParsed, tuningParams); }
    catch (e) { console.error('FilterAnalyzer error:', e); return null; }
  }, [bbParsed, tuningParams]);

  const heatmap = useMemo(() => {
    if (!bbParsed) return null;
    try { return generateNoiseHeatmap(bbParsed); }
    catch (e) { console.error('Noise heatmap error:', e); return null; }
  }, [bbParsed]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Filter Analyzer"
        description="FFT-based noise analysis with filter recommendations"
        icon={<Filter size={22} className="text-yellow-400" />}
        health={result.health}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="SNR" value={result.snr?.toFixed(1) ?? '—'} unit="dB" color="text-yellow-300" sub="Signal-to-noise" />
        <StatCard label="Peak Freq" value={result.peakFreq ?? '—'} unit="Hz" color="text-orange-300" />
        <StatCard label="Noise Floor" value={result.noiseFloor?.toFixed(1) ?? '—'} unit="dB" color="text-red-300" />
        <StatCard label="Throttle Corr." value={result.throttleCorrelation?.toFixed(2) ?? '—'} color="text-cyan-300" sub="Noise vs throttle" />
      </div>

      {/* Noise Peaks */}
      {result.peaks && result.peaks.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Detected Noise Peaks</h3>
          <div className="grid grid-cols-2 gap-2">
            {result.peaks.map((peak, i) => (
              <div key={i} className="bg-gray-900/50 rounded p-2 flex justify-between items-center">
                <span className="text-xs text-gray-400">{peak.freq} Hz</span>
                <span className="text-xs font-medium text-yellow-300">{peak.magnitude?.toFixed(1)} dB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Type Suggestion */}
      {result.filterMode && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Filter Strategy</h3>
          <p className="text-sm text-gray-200 font-medium">{result.filterMode}</p>
          {result.filterDetails && <p className="text-xs text-gray-400 mt-1">{result.filterDetails}</p>}
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
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

      {heatmap && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Noise Heatmap (Throttle vs Frequency)</h3>
          <NoiseHeatmap heatmapData={heatmap} />
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Filter CLI Commands" />
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzeTPA } from '../lib/analyzers/tpaAnalyzer';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage } from '../components/shared/UIComponents';
import { Gauge } from 'lucide-react';

export default function TPAPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeTPA(bbParsed, tuningParams); }
    catch (e) { console.error('TPA error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">{t('analysis_failed')}</div>;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="TPA Analyzer"
        description="D-term vs throttle breakpoint detection with multi-method analysis"
        icon={<Gauge size={22} className="text-indigo-400" />}
        health={result.health}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label={t('label_detected_breakpoint')} value={result.breakpoint ?? '—'} unit="%" color="text-indigo-300" />
        <StatCard label={t('label_tpa_rate')} value={result.tpaRate?.toFixed(2) ?? '—'} color="text-purple-300" />
        <StatCard label={t('label_current_breakpoint')} value={tuningParams.tpa?.breakpoint ?? '—'} color="text-cyan-300" />
        <StatCard label={t('label_confidence')} value={result.confidence?.toFixed(0) ?? '—'} unit="%" color="text-green-300" />
      </div>

      {/* Detection Methods */}
      {result.methods && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_detection_methods')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {result.methods.map((m, i) => (
              <div key={i} className="bg-gray-900/50 rounded p-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-400">{m.name}</span>
                  <span className="text-xs font-medium text-indigo-300">{m.breakpoint}%</span>
                </div>
                <div className="text-[10px] text-gray-500">Score: {m.score?.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D-noise profile */}
      {result.bins && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_dterm_noise_throttle')}</h3>
          <div className="flex items-end gap-0.5 h-32">
            {result.bins.map((bin, i) => {
              const maxVal = Math.max(...result.bins.map(b => b.dNoise || 0));
              const height = maxVal > 0 ? ((bin.dNoise || 0) / maxVal) * 100 : 0;
              const isBP = i === Math.round((result.breakpoint || 0) / (100 / result.bins.length));
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-full rounded-t transition-all ${isBP ? 'bg-indigo-500' : 'bg-gray-600'}`}
                    style={{ height: `${height}%`, minHeight: '2px' }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-1">Throttle →</div>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_recommendations')}</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="TPA CLI Commands" />
      )}
    </div>
  );
}

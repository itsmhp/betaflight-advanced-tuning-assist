import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzeAdvancedPidHealth } from '../lib/analyzers/advancedPidHealth';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { HeartPulse } from 'lucide-react';

export default function AdvancedPIDPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeAdvancedPidHealth(bbParsed, tuningParams); }
    catch (e) { console.error('AdvancedPIDHealth error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">{t('analysis_failed')}</div>;

  const levelColors = { Excellent: 'text-emerald-400', Good: 'text-green-400', Fair: 'text-yellow-400', Poor: 'text-red-400' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Advanced PID Health Check"
        description="Deep PID loop stability, saturation, and response analysis"
        icon={<HeartPulse size={22} className="text-violet-400" />}
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label={t('label_overall_score')} value={result.overallScore} unit="/100" color={levelColors[result.healthLevel] || 'text-gray-300'} />
        <StatCard label={t('label_health_level')} value={result.healthLevel} color={levelColors[result.healthLevel] || 'text-gray-300'} />
        <StatCard label={t('label_sample_rate')} value={result.sampleRate} unit="Hz" color="text-violet-300" />
      </div>

      {/* Per-axis breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['roll', 'pitch', 'yaw'].map(axis => {
          const a = result.axes[axis];
          if (!a) return null;
          return (
            <div key={axis} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200 capitalize">{axis}</h3>
                <HealthBadge score={a.healthScore} />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_pid_balance')}</span>
                  <span className="text-gray-200">{a.pRatio}% / {a.iRatio}% / {a.dRatio}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_error_rms')}</span>
                  <span className="text-orange-300">{a.errorRms}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_error_p95')}</span>
                  <span className="text-yellow-300">{a.errorP95}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_tracking_response')}</span>
                  <span className="text-cyan-300">{a.responseCorrelation}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_oscillation_rate')}</span>
                  <span className="text-pink-300">{a.oscillationRate}/s</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_dterm_noise')}</span>
                  <span className="text-red-300">{a.dNoise}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('label_pid_latency')}</span>
                  <span className="text-violet-300">{a.latencyMs}ms</span>
                </div>
                {/* Saturation bars */}
                <div className="pt-2 border-t border-gray-700/50">
                  <p className="text-gray-500 mb-1">{t('label_saturation')}</p>
                  {['P', 'I', 'D'].map(term => {
                    const val = a[`${term.toLowerCase()}Saturation`];
                    return (
                      <div key={term} className="flex items-center gap-2 mb-1">
                        <span className="w-4 text-gray-500">{term}</span>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.min(val * 10, 100)}%` }} />
                        </div>
                        <span className="text-gray-500 w-10 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result.recommendations?.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_recommendations')}</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">&#9656;</span>
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

      {result.cliChanges && Object.keys(result.cliChanges).length > 0 && (
        <CLIOutput commands={Object.entries(result.cliChanges).map(([k, v]) => `set ${k} = ${v}`)} title="PID Health CLI Commands" />
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzeThrustLinearization } from '../lib/analyzers/thrustLinearization';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { TrendingDown } from 'lucide-react';

export default function ThrustLinearPage() {
  const { cliParsed, tuningParams, bbParsed } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed || !tuningParams) return null;
    try { return analyzeThrustLinearization(bbParsed, tuningParams); }
    catch (e) { console.error('ThrustLinear error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!cliParsed || !bbParsed) return <NoDataMessage requiresCli requiresBb />;
  if (!result) return <div className="card text-gray-400">{t('analysis_failed')}</div>;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Thrust Linearization"
        description="Analyze motor response linearity and suggest thrust_linear value"
        icon={<TrendingDown size={22} className="text-red-400" />}
        health={result.health}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label={t('label_mape')} value={result.mape?.toFixed(1) ?? '—'} unit="%" color="text-red-300" sub={t('label_mean_abs_error')} />
        <StatCard label={t('label_nonlinear_onset')} value={result.nonLinearOnset?.toFixed(0) ?? '—'} unit="%" color="text-orange-300" sub={t('label_throttle_pct')} />
        <StatCard label={t('label_current_setting')} value={tuningParams.motor?.thrustLinear ?? '0'} color="text-cyan-300" />
        <StatCard label={t('label_suggested')} value={result.suggestedValue ?? '—'} color="text-green-300" />
      </div>

      {result.hoverThrottle !== undefined && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_hover_analysis')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-400">{t('label_detected_hover')}:</span>
              <span className="text-sm text-gray-200 ml-2">{(result.hoverThrottle * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">{t('label_pid_effort_hover')}:</span>
              <span className="text-sm text-gray-200 ml-2">{result.hoverPidEffort?.toFixed(1) ?? '—'}</span>
            </div>
          </div>
        </div>
      )}

      {result.diagnosis && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_diagnosis')}</h3>
          <p className="text-sm text-gray-300">{result.diagnosis}</p>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_recommendations')}</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cli && result.cli.length > 0 && (
        <CLIOutput commands={result.cli} title="Thrust Linearization Commands" />
      )}
    </div>
  );
}

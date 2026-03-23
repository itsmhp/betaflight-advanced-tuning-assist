import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzeDynamicIdle } from '../lib/analyzers/dynamicIdle';
import CLIOutput from '../components/shared/CLIOutput';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Gauge } from 'lucide-react';

export default function DynamicIdlePage() {
  const { cliParsed, tuningParams, bbParsed } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeDynamicIdle(bbParsed, tuningParams); }
    catch (e) { console.error('DynamicIdle error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">{t('analysis_failed')}</div>;

  const levelColors = { Excellent: 'text-emerald-400', Good: 'text-green-400', Fair: 'text-yellow-400', Poor: 'text-red-400' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Dynamic Idle Analyzer"
        description="Idle stability, motor desync detection, and transition analysis"
        icon={<Gauge size={22} className="text-violet-400" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label={t('label_health')} value={result.healthScore} unit="/100" color={levelColors[result.healthLevel]} />
        <StatCard label={t('label_status')} value={result.healthLevel} color={levelColors[result.healthLevel]} />
        <StatCard label={t('label_idle_segments')} value={result.idleSegmentCount} color="text-violet-300" />
        <StatCard label={t('label_desync_rate')} value={result.desyncRate} unit="%" color={result.desyncRate > 5 ? 'text-red-300' : 'text-green-300'} />
      </div>

      {/* Dynamic Idle Config */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_current_config')}</h3>
        <div className="grid grid-cols-5 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500">{t('label_min_rpm')}</p>
            <p className="text-lg font-bold text-violet-300">{result.dynIdleConfig.minRpm}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('label_p_gain')}</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.pGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('label_i_gain')}</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.iGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('label_d_gain')}</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.dGain}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('label_max_increase')}</p>
            <p className="text-lg font-bold text-gray-200">{result.dynIdleConfig.maxIncrease}</p>
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className={`text-xs px-2 py-1 rounded ${result.dynIdleConfig.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {result.dynIdleConfig.enabled ? t('status_dyn_idle_enabled') : t('status_dyn_idle_disabled')}
          </span>
        </div>
      </div>

      {/* eRPM Analysis */}
      {result.erpmAnalysis && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_erpm_analysis')}</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">{t('label_min_erpm')}</p>
              <p className="text-lg font-bold text-orange-300">{result.erpmAnalysis.minErpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('label_min_rpm')}</p>
              <p className="text-lg font-bold text-cyan-300">{result.erpmAnalysis.minRpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('label_configured_min')}</p>
              <p className="text-lg font-bold text-violet-300">{result.erpmAnalysis.configuredMinRpm}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('label_headroom')}</p>
              <p className={`text-lg font-bold ${result.erpmAnalysis.headroom > 500 ? 'text-green-300' : 'text-red-300'}`}>
                {result.erpmAnalysis.headroom}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Idle Stability */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_idle_stability')}</h3>
        <p className="text-xs text-gray-400 mb-2">{t('label_avg_motor_variance')}: <span className="text-orange-300 font-medium">{result.avgIdleStability}</span></p>
        {result.idleAnalysis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-1 pr-2">{t('header_time')}</th>
                  <th className="text-left py-1 pr-2">{t('header_duration')}</th>
                  <th className="text-left py-1 pr-2">{t('header_motor_means')}</th>
                  <th className="text-left py-1 pr-2">{t('header_motor_std')}</th>
                  <th className="text-left py-1">{t('header_gyro_rms')}</th>
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
          <p className="text-xs text-gray-600">{t('msg_no_idle_segments')}</p>
        )}
      </div>

      {/* Flight Transitions */}
      {result.transitions.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('label_transitions')}</h3>
          <div className="space-y-2">
            {result.transitions.slice(0, 5).map((trans, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded p-2 text-xs">
                <span className="text-gray-400">@ {trans.time}s</span>
                <span className="text-violet-300">{t('label_response')}: {trans.responseMs ?? '—'}ms</span>
                <span className="text-orange-300">{t('label_gyro_spike')}: {trans.gyroSpike}°/s</span>
                <span className="text-gray-300">{t('label_motor_delta')}: {trans.motorDelta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations?.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_recommendations')}</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">&#9656;</span> {typeof rec === 'string' ? rec : rec.message}
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

import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzePIDContribution } from '../lib/analyzers/pidContribution';
import { ToolHeader, NoDataMessage, ProgressBar } from '../components/shared/UIComponents';
import { BarChart3 } from 'lucide-react';

export default function PIDContributionPage() {
  const { bbParsed, tuningParams } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzePIDContribution(bbParsed, tuningParams); }
    catch (e) { console.error('PIDContrib error:', e); return null; }
  }, [bbParsed, tuningParams]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">{t('analysis_failed')}</div>;

  const axes = ['roll', 'pitch', 'yaw'];
  const termColors = { P: 'cyan', I: 'green', D: 'yellow', F: 'pink' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="PID Contribution"
        description="Analyze the relative contribution of P, I, D, and F terms from blackbox data"
        icon={<BarChart3 size={22} className="text-green-400" />}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {axes.map(axis => {
          const d = result.axes?.[axis];
          if (!d) return null;
          return (
            <div key={axis} className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 capitalize">{axis} Axis</h3>
              <div className="space-y-3">
                {['P', 'I', 'D', 'F'].map(term => {
                  const pct = d.ratios?.[term] ?? 0;
                  return (
                    <div key={term}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{term}-term</span>
                        <span className={`font-medium ${pct > 40 && term === 'D' ? 'text-red-400' : 'text-gray-300'}`}>
                          {(pct * 100).toFixed(1)}%
                        </span>
                      </div>
                      <ProgressBar value={pct * 100} color={termColors[term]} />
                    </div>
                  );
                })}
              </div>
              {d.dTermWarning && (
                <p className="text-xs text-red-400 mt-3">{t('warning_dterm_high')}</p>
              )}
            </div>
          );
        })}
      </div>

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('label_recommendations')}</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span> {typeof rec === 'string' ? rec : rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

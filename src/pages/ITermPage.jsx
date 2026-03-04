import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeITermBuildup } from '../lib/analyzers/itermBuildup';
import { ToolHeader, NoDataMessage, HealthBadge, ProgressBar, StatCard } from '../components/shared/UIComponents';
import { Activity } from 'lucide-react';

export default function ITermPage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeITermBuildup(bbParsed); }
    catch (e) { console.error('ITerm error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const axes = ['roll', 'pitch', 'yaw'];

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="I-Term Buildup"
        description="Check I-term accumulation health — high values indicate wind-up or I-term fighting P-term"
        icon={<Activity size={22} className="text-teal-400" />}
        health={result.overallHealth}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {axes.map(axis => {
          const d = result.axes?.[axis];
          if (!d) return null;
          const healthColor = d.health === 'Good' ? 'text-green-400' : d.health === 'Fair' ? 'text-yellow-400' : 'text-red-400';
          return (
            <div key={axis} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 capitalize">{axis}</h3>
                <HealthBadge level={d.health} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Max I-Term</span>
                    <span className={healthColor}>{d.maxValue?.toFixed(0) ?? '—'}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">P95 I-Term</span>
                    <span className="text-gray-300">{d.p95?.toFixed(0) ?? '—'}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Time above |75|</span>
                    <span className="text-gray-300">{((d.highRatio ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <ProgressBar
                    value={(d.highRatio ?? 0) * 100}
                    color={d.highRatio > 0.2 ? 'red' : d.highRatio > 0.1 ? 'yellow' : 'green'}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-teal-400 mt-0.5">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

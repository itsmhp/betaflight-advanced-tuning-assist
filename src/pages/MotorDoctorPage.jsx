import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { analyzeMotors } from '../lib/analyzers/motorDoctor';
import { ToolHeader, StatCard, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Cog } from 'lucide-react';

export default function MotorDoctorPage() {
  const { bbParsed } = useData();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeMotors(bbParsed); }
    catch (e) { console.error('MotorDoctor error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result) return <div className="card text-gray-400">Analysis failed.</div>;

  const levelColors = { Excellent: 'text-emerald-400', Good: 'text-green-400', Fair: 'text-yellow-400', Poor: 'text-red-400' };

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title="Motor Doctor"
        description="Motor balance, noise, saturation, and vibration diagnostics"
        icon={<Cog size={22} className="text-violet-400" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Health" value={result.overallScore} unit="/100" color={levelColors[result.healthLevel]} />
        <StatCard label="Balance Dev" value={result.balancePercent} unit="%" color="text-orange-300" sub="Motor mean deviation" />
        <StatCard label="CG Offset" value={result.cgOffsetDirection} color="text-cyan-300" />
        <StatCard label="Status" value={result.healthLevel} color={levelColors[result.healthLevel]} />
      </div>

      {/* Motor Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {result.motorStats.map((stat, idx) => {
          const health = result.motorHealth[idx];
          return (
            <div key={idx} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Motor {stat.motor}</h3>
                <HealthBadge score={health.score} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Mean</span><span className="text-gray-200">{stat.mean}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Std Dev</span><span className="text-gray-200">{stat.stddev}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Range (P5-P95)</span><span className="text-gray-200">{stat.p5} — {stat.p95}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Noise</span><span className="text-orange-300">{stat.noise}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Max Sat</span><span className="text-red-300">{stat.maxSaturation}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Min Sat</span><span className="text-yellow-300">{stat.minSaturation}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Corr Roll</span><span className="text-violet-300">{stat.corrRoll}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Corr Pitch</span><span className="text-violet-300">{stat.corrPitch}</span>
                </div>
              </div>

              {/* FFT peaks */}
              {result.motorFFT[idx]?.peaks.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-700/50">
                  <p className="text-xs text-gray-500 mb-1">Vibration Peaks</p>
                  <div className="flex flex-wrap gap-1">
                    {result.motorFFT[idx].peaks.slice(0, 3).map((peak, pi) => (
                      <span key={pi} className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        {peak.frequency}Hz ({peak.magnitude}dB)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Balance Diagnostics */}
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Balance Diagnostics</h3>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Front/Back Diff</span>
            <span className="text-gray-200">{result.frontBackDiff}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Left/Right Diff</span>
            <span className="text-gray-200">{result.leftRightDiff}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Diagonal Diff</span>
            <span className="text-gray-200">{result.diagonalDiff}</span>
          </div>
        </div>
      </div>

      {/* Throttle Response */}
      {result.motorResponsiveness && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Throttle Response</h3>
          <div className="grid grid-cols-4 gap-3">
            {result.motorResponsiveness.map((m, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-gray-500">Motor {m.motor}</p>
                <p className="text-lg font-bold text-violet-300">{m.throttleCorr}</p>
                <p className="text-xs text-gray-500">Correlation</p>
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

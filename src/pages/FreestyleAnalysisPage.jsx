/**
 * FreestyleAnalysisPage.jsx — Flight balance & trick detection dashboard.
 * Analyzes left/right balance, detects freestyle tricks, and provides
 * training recommendations to help pilots become more well-rounded.
 */
import { useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { analyzeFreestyle } from '../lib/analyzers/freestyleAnalyzer';
import { ToolHeader, NoDataMessage, HealthBadge } from '../components/shared/UIComponents';
import { Swords, TrendingUp, RotateCcw, ArrowUp, ArrowDown, Zap, CircleDot } from 'lucide-react';

// ── Trick icons & labels ──────────────────────────────────────────────────────
const TRICK_DEFS = {
  roll:      { icon: RotateCcw, label: 'Roll' },
  flip:      { icon: ArrowUp,   label: 'Flip' },
  splitS:    { icon: ArrowDown,  label: 'Split-S' },
  powerloop: { icon: TrendingUp, label: 'Powerloop' },
  inverted:  { icon: CircleDot,  label: 'Inverted' },
};

// ── Score Gauge ───────────────────────────────────────────────────────────────
function ScoreGauge({ score, size = 120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = size / 2 - 10;
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const scoreAngle = startAngle + (endAngle - startAngle) * (score / 100);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score arc
    const color = score >= 85 ? '#10b981' : score >= 65 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, scoreAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = '#f3f4f6';
    ctx.font = `bold ${size * 0.28}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score, cx, cy - 4);

    ctx.fillStyle = '#9ca3af';
    ctx.font = `${size * 0.11}px system-ui`;
    ctx.fillText('Balance', cx, cy + size * 0.16);
  }, [score, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

// ── Balance Bar (horizontal pyramid chart) ────────────────────────────────────
function BalanceBar({ leftPercent, rightPercent, leftLabel, rightLabel, axisName }) {
  const diff = Math.abs(leftPercent - rightPercent);
  const barColor = diff <= 10 ? 'bg-emerald-500' : diff <= 30 ? 'bg-yellow-500' : 'bg-red-500';
  const labelColor = diff <= 10 ? 'text-emerald-400' : diff <= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400 uppercase tracking-wide w-20">{leftLabel}</span>
        <span className="text-xs font-semibold text-gray-300">{axisName}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wide w-20 text-right">{rightLabel}</span>
      </div>
      <div className="flex items-center gap-1">
        {/* Left bar (grows from right to left) */}
        <div className="flex-1 flex justify-end">
          <div className="h-6 bg-gray-800 rounded-l-md w-full relative overflow-hidden">
            <div
              className={`absolute right-0 top-0 h-full ${barColor} rounded-l-md transition-all duration-700`}
              style={{ width: `${leftPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/90 z-10">
              {leftPercent}%
            </span>
          </div>
        </div>
        {/* Center divider */}
        <div className="w-0.5 h-8 bg-gray-600 flex-shrink-0" />
        {/* Right bar (grows from left to right) */}
        <div className="flex-1">
          <div className="h-6 bg-gray-800 rounded-r-md w-full relative overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full ${barColor} rounded-r-md transition-all duration-700`}
              style={{ width: `${rightPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/90 z-10">
              {rightPercent}%
            </span>
          </div>
        </div>
      </div>
      {diff > 10 && (
        <p className={`text-[10px] mt-1 text-center ${labelColor}`}>
          {diff > 30 ? 'Very dominant' : 'Slightly dominant'} — {leftPercent > rightPercent ? leftLabel : rightLabel} side
        </p>
      )}
    </div>
  );
}

// ── Trick Count Card ──────────────────────────────────────────────────────────
function TrickCard({ type, leftCount, rightCount, leftLabel, rightLabel }) {
  const def = TRICK_DEFS[type] || { icon: Zap, label: type };
  const Icon = def.icon;
  const total = leftCount + rightCount;
  const leftPct = total > 0 ? Math.round(leftCount / total * 100) : 50;
  const rightPct = total > 0 ? 100 - leftPct : 50;

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-orange-400" />
        <span className="text-sm font-medium text-gray-200">{def.label}</span>
        <span className="text-xs text-gray-500 ml-auto">{total} total</span>
      </div>
      {total > 0 ? (
        <>
          <div className="flex items-center gap-1.5 text-xs mb-1.5">
            <span className="text-blue-400 w-12 text-right">{leftCount}×</span>
            <span className="text-gray-600">{leftLabel}</span>
            <span className="mx-1 text-gray-700">|</span>
            <span className="text-gray-600">{rightLabel}</span>
            <span className="text-orange-400">{rightCount}×</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
            <div className="bg-blue-500 transition-all duration-500" style={{ width: `${leftPct}%` }} />
            <div className="bg-orange-500 transition-all duration-500" style={{ width: `${rightPct}%` }} />
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-600">None detected</p>
      )}
    </div>
  );
}

// ── Timeline Chart (canvas-based) ─────────────────────────────────────────────
function TrickTimeline({ timeline, flightDuration }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !timeline?.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth * dpr;
    const H = 180 * dpr;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = container.clientWidth;
    const h = 180;
    const PAD = { top: 24, right: 20, bottom: 36, left: 80 };
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    // Trick type lanes
    const types = ['roll', 'flip', 'splitS', 'powerloop', 'inverted'];
    const typeLabels = { roll: 'Roll', flip: 'Flip', splitS: 'Split-S', powerloop: 'Powerloop', inverted: 'Inverted' };
    const laneH = plotH / types.length;

    // Grid lines + labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < types.length; i++) {
      const y = PAD.top + i * laneH + laneH / 2;
      ctx.fillText(typeLabels[types[i]], PAD.left - 8, y);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, PAD.top + i * laneH);
      ctx.lineTo(PAD.left + plotW, PAD.top + i * laneH);
      ctx.stroke();
    }

    // X-axis labels (time)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxTime = flightDuration || 1;
    for (let t = 0; t <= maxTime; t += Math.max(10, Math.round(maxTime / 8))) {
      const x = PAD.left + (t / maxTime) * plotW;
      ctx.fillStyle = '#4b5563';
      ctx.fillText(`${t}s`, x, h - PAD.bottom + 8);
      ctx.strokeStyle = '#1f293720';
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, h - PAD.bottom);
      ctx.stroke();
    }

    // Plot dots
    const dirColors = {
      left: '#3b82f6', right: '#f97316',
      forward: '#f97316', backward: '#3b82f6',
    };

    for (const evt of timeline) {
      const typeIdx = types.indexOf(evt.type);
      if (typeIdx < 0) continue;
      const x = PAD.left + (evt.time / maxTime) * plotW;
      const y = PAD.top + typeIdx * laneH + laneH / 2;
      const color = dirColors[evt.direction] || '#9ca3af';

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Legend
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legendY = h - 12;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(PAD.left, legendY, 8, 8);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Left / Backward', PAD.left + 12, legendY);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(PAD.left + 110, legendY, 8, 8);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Right / Forward', PAD.left + 122, legendY);
  }, [timeline, flightDuration]);

  if (!timeline?.length) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Trick Timeline</h3>
        <p className="text-xs text-gray-600">No tricks detected in this flight.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Trick Timeline</h3>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} style={{ width: '100%', height: 180 }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FreestyleAnalysisPage() {
  const { bbParsed } = useData();
  const { t } = useLang();

  const result = useMemo(() => {
    if (!bbParsed) return null;
    try { return analyzeFreestyle(bbParsed); }
    catch (e) { console.error('FreestyleAnalysis error:', e); return null; }
  }, [bbParsed]);

  if (!bbParsed) return <NoDataMessage requiresBb />;
  if (!result || result.status) {
    return (
      <div className="card text-gray-400 text-center py-12">
        <Swords size={28} className="mx-auto mb-3 text-gray-600" />
        <p className="text-sm">{result?.message || 'Analysis failed. Upload a freestyle blackbox log.'}</p>
      </div>
    );
  }

  const { balance, trickSummary: ts, score, healthLevel, totalTricks, flightDuration, recommendations, timeline } = result;

  return (
    <div className="fade-in max-w-4xl">
      <ToolHeader
        title={t('tool_freestyle_analysis') || 'Freestyle Analysis'}
        description={t('desc_freestyle_analysis') || 'Left/right balance, trick detection & training recommendations'}
        icon={<Swords size={22} className="text-orange-400" />}
        health={healthLevel}
      />

      {/* ── Score + Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card flex flex-col items-center justify-center py-4">
          <ScoreGauge score={score} />
        </div>
        <div className="card flex flex-col justify-center gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">{t('fs_total_tricks') || 'Tricks Detected'}</div>
            <div className="text-2xl font-bold text-gray-100">{totalTricks}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">{t('fs_flight_duration') || 'Flight Duration'}</div>
            <div className="text-2xl font-bold text-gray-100">{flightDuration}s</div>
          </div>
        </div>
        <div className="card flex flex-col justify-center gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">{t('fs_tricks_per_min') || 'Tricks / Minute'}</div>
            <div className="text-2xl font-bold text-gray-100">
              {flightDuration > 0 ? (totalTricks / (flightDuration / 60)).toFixed(1) : '0'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">{t('fs_balance_level') || 'Balance Level'}</div>
            <HealthBadge level={healthLevel} />
          </div>
        </div>
      </div>

      {/* ── Balance Bars ── */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('fs_direction_balance') || 'Direction Balance'}</h3>
        <BalanceBar
          leftPercent={balance.roll.leftPercent}
          rightPercent={balance.roll.rightPercent}
          leftLabel={t('fs_left') || 'Left'}
          rightLabel={t('fs_right') || 'Right'}
          axisName={t('fs_roll') || 'Roll'}
        />
        <BalanceBar
          leftPercent={balance.pitch.leftPercent}
          rightPercent={balance.pitch.rightPercent}
          leftLabel={t('fs_backward') || 'Back'}
          rightLabel={t('fs_forward') || 'Forward'}
          axisName={t('fs_pitch') || 'Pitch'}
        />
        <BalanceBar
          leftPercent={balance.yaw.leftPercent}
          rightPercent={balance.yaw.rightPercent}
          leftLabel={t('fs_left') || 'Left'}
          rightLabel={t('fs_right') || 'Right'}
          axisName={t('fs_yaw') || 'Yaw'}
        />
      </div>

      {/* ── Trick Counts ── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('fs_trick_breakdown') || 'Trick Breakdown'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <TrickCard type="roll" leftCount={ts.rollLeft} rightCount={ts.rollRight}
            leftLabel={t('fs_left') || 'L'} rightLabel={t('fs_right') || 'R'} />
          <TrickCard type="flip" leftCount={ts.flipBackward} rightCount={ts.flipForward}
            leftLabel={t('fs_backward') || 'Back'} rightLabel={t('fs_forward') || 'Fwd'} />
          <TrickCard type="splitS" leftCount={ts.splitSLeft} rightCount={ts.splitSRight}
            leftLabel={t('fs_left') || 'L'} rightLabel={t('fs_right') || 'R'} />
          <TrickCard type="powerloop" leftCount={ts.powerloopLeft} rightCount={ts.powerloopRight}
            leftLabel={t('fs_left') || 'L'} rightLabel={t('fs_right') || 'R'} />
          <TrickCard type="inverted" leftCount={ts.invertedLeft} rightCount={ts.invertedRight}
            leftLabel={t('fs_left') || 'L'} rightLabel={t('fs_right') || 'R'} />
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="mb-6">
        <TrickTimeline timeline={timeline} flightDuration={flightDuration} />
      </div>

      {/* ── Recommendations ── */}
      {recommendations && recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('fs_recommendations') || 'Training Recommendations'}</h3>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                <span>{t(rec.key) || rec.fallback}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

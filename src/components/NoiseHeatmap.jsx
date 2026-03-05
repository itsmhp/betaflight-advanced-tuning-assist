import { useRef, useEffect, useMemo, useState } from 'react';

const getColor = (value) => {
  if (value < 64) return `rgb(0, ${value * 2}, ${128 + value})`;
  if (value < 128) return `rgb(${(value - 64) * 4}, 200, 0)`;
  if (value < 192) return `rgb(255, ${255 - (value - 128) * 4}, 0)`;
  return `rgb(255, 0, ${Math.min(255, (value - 192) * 4)})`;
};

export default function NoiseHeatmap({ heatmapData, width = 600, height = 380, showRPMLines = true }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const padding = useMemo(() => ({ top: 20, right: 20, bottom: 40, left: 55 }), []);

  useEffect(() => {
    if (!heatmapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { grid, throttleBuckets, freqBuckets, rpmHarmonics, freqMax } = heatmapData;

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const cellW = plotW / freqBuckets;
    const cellH = plotH / throttleBuckets;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    for (let t = 0; t < throttleBuckets; t++) {
      for (let f = 0; f < freqBuckets; f++) {
        const value = grid[t][f];
        ctx.fillStyle = getColor(value);
        const x = padding.left + f * cellW;
        const y = padding.top + (throttleBuckets - 1 - t) * cellH;
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
      }
    }

    if (showRPMLines && rpmHarmonics?.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      rpmHarmonics.forEach((hz, i) => {
        if (hz > freqMax) return;
        const x = padding.left + (hz / freqMax) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotH);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '10px monospace';
        ctx.fillText(`H${i + 1}`, x + 2, padding.top + 12);
      });

      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px monospace';

    ctx.textAlign = 'center';
    [0, 100, 200, 300, 400, 500].forEach((hz) => {
      const x = padding.left + (hz / freqMax) * plotW;
      ctx.fillText(`${hz}Hz`, x, height - 10);
    });
    ctx.fillText('Frequency', width / 2, height - 2);

    ctx.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach((pct) => {
      const y = padding.top + plotH - (pct / 100) * plotH;
      ctx.fillText(`${pct}%`, padding.left - 6, y + 4);
    });
  }, [heatmapData, width, height, showRPMLines, padding]);

  const handleMouseMove = (e) => {
    if (!heatmapData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const fIdx = Math.floor(((x - padding.left) / plotW) * heatmapData.freqBuckets);
    const tIdx = heatmapData.throttleBuckets - 1 - Math.floor(((y - padding.top) / plotH) * heatmapData.throttleBuckets);

    if (fIdx >= 0 && fIdx < heatmapData.freqBuckets && tIdx >= 0 && tIdx < heatmapData.throttleBuckets) {
      const noise = heatmapData.grid[tIdx][fIdx];
      const freqLow = fIdx * 10;
      const throttleLow = tIdx * 5;
      setTooltip({
        x,
        y,
        text: `${throttleLow}-${throttleLow + 5}% | ${freqLow}-${freqLow + 10}Hz | noise ${noise}`,
      });
    } else {
      setTooltip(null);
    }
  };

  if (!heatmapData) {
    return (
      <div className="bg-gray-900/70 border border-gray-700/50 rounded-lg flex items-center justify-center text-xs text-gray-500" style={{ width, height }}>
        Upload blackbox log to see noise heatmap
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span>Noise Score: <span className="text-emerald-400 font-semibold">{heatmapData.overallNoiseScore}/100</span></span>
        <span>Worst throttle: <span className="text-amber-300 font-semibold">{heatmapData.worstThrottleRange.percentLow}-{heatmapData.worstThrottleRange.percentHigh}%</span></span>
        <span>Peak noise: <span className="text-orange-300 font-semibold">{heatmapData.worstFreqRange.hzLow}-{heatmapData.worstFreqRange.hzHigh}Hz</span></span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          className="rounded-md border border-gray-700/50"
        />
        {tooltip && (
          <div
            className="absolute text-[10px] bg-gray-900/90 border border-gray-700/70 text-gray-200 px-2 py-1 rounded-md pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span>Quiet</span>
        <div className="h-2 w-28 rounded" style={{ background: 'linear-gradient(to right, #003070, #00c800, #ffff00, #ff8000, #ff0000)' }} />
        <span>Loud</span>
      </div>
    </div>
  );
}

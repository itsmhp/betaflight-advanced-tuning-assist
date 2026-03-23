import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Scissors, Wand2, RotateCcw } from 'lucide-react';
import { autoDetectTrim, getThrottleProfile, frameToTime, frameDuration } from '../../lib/flightTrimmer';
import { useLang } from '../../i18n/LangContext';

/**
 * Dual-handle range slider over a mini throttle chart.
 * Lets users trim takeoff/landing data from BBL logs.
 */
export default function FlightTrimControl({ bbParsed, trimRange, onTrimChange }) {
  const { t } = useLang();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | null
  const dragRef = useRef(null);

  const totalFrames = bbParsed?.data?.length ?? 0;

  // Throttle profile for the mini chart (memoized)
  const profile = useMemo(() => getThrottleProfile(bbParsed, 300), [bbParsed]);

  // Current trim values (default: full range)
  const startIdx = trimRange?.startIdx ?? 0;
  const endIdx = trimRange?.endIdx ?? (totalFrames - 1);

  // Auto-detect handler
  const handleAutoDetect = useCallback(() => {
    if (!bbParsed?.data?.length) return;
    const detected = autoDetectTrim(bbParsed);
    onTrimChange?.(detected.startIdx, detected.endIdx);
  }, [bbParsed, onTrimChange]);

  // Reset to full range
  const handleReset = useCallback(() => {
    onTrimChange?.(0, totalFrames - 1);
  }, [totalFrames, onTrimChange]);

  // Draw the throttle chart with trim overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !profile.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    const W = container ? container.clientWidth : 560;
    const H = 60;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    // Find min/max for scaling
    let minVal = Infinity, maxVal = -Infinity;
    for (const p of profile) {
      if (p.value < minVal) minVal = p.value;
      if (p.value > maxVal) maxVal = p.value;
    }
    const range = maxVal - minVal || 1;

    // Draw dimmed regions (trimmed out)
    const startPct = startIdx / Math.max(1, totalFrames - 1);
    const endPct = endIdx / Math.max(1, totalFrames - 1);
    const startX = startPct * W;
    const endX = endPct * W;

    // Dimmed before start
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, startX, H);
    // Dimmed after end
    ctx.fillRect(endX, 0, W - endX, H);

    // Draw throttle line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < profile.length; i++) {
      const x = (profile[i].idx / Math.max(1, totalFrames - 1)) * W;
      const y = H - ((profile[i].value - minVal) / range) * (H - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under the curve in active region
    ctx.lineTo(endX, H);
    ctx.lineTo(startX, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.fill();

    // Trim handle lines
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
    ctx.lineWidth = 2;
    // Start handle
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, H);
    ctx.stroke();
    // End handle
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, H);
    ctx.stroke();

    // Handle grips (small triangles)
    ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
    // Start grip
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + 8, 0);
    ctx.lineTo(startX, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(startX, H);
    ctx.lineTo(startX + 8, H);
    ctx.lineTo(startX, H - 8);
    ctx.closePath();
    ctx.fill();
    // End grip
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX - 8, 0);
    ctx.lineTo(endX, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(endX, H);
    ctx.lineTo(endX - 8, H);
    ctx.lineTo(endX, H - 8);
    ctx.closePath();
    ctx.fill();

  }, [profile, startIdx, endIdx, totalFrames]);

  // Mouse/touch handlers for dragging
  const getFrameFromX = useCallback((clientX) => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * (totalFrames - 1));
  }, [totalFrames]);

  const handlePointerDown = useCallback((e) => {
    const frame = getFrameFromX(e.clientX);
    const distToStart = Math.abs(frame - startIdx);
    const distToEnd = Math.abs(frame - endIdx);

    // Pick the closer handle
    const handle = distToStart <= distToEnd ? 'start' : 'end';
    setDragging(handle);
    dragRef.current = handle;
    e.preventDefault();
  }, [getFrameFromX, startIdx, endIdx]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const frame = getFrameFromX(e.clientX);

    if (dragRef.current === 'start') {
      const newStart = Math.min(frame, endIdx - 50);
      onTrimChange?.(Math.max(0, newStart), endIdx);
    } else {
      const newEnd = Math.max(frame, startIdx + 50);
      onTrimChange?.(startIdx, Math.min(totalFrames - 1, newEnd));
    }
  }, [getFrameFromX, startIdx, endIdx, totalFrames, onTrimChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    dragRef.current = null;
  }, []);

  // Global mouse listeners for drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  if (!bbParsed?.data?.length) return null;

  const isTrimmed = startIdx > 0 || endIdx < totalFrames - 1;
  const trimmedFrames = endIdx - startIdx + 1;
  const trimmedPct = ((trimmedFrames / totalFrames) * 100).toFixed(0);

  return (
    <div className="card border border-violet-900/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-gray-200">{t('trimTitle')}</span>
          {isTrimmed && (
            <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded-full">
              {trimmedPct}% {t('trimActive')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDetect}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-violet-800/30 text-violet-300 border border-violet-700/30 hover:bg-violet-700/30 transition-colors"
          >
            <Wand2 size={11} />
            {t('trimAutoDetect')}
          </button>
          {isTrimmed && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-700/30 transition-colors"
            >
              <RotateCcw size={11} />
              {t('trimReset')}
            </button>
          )}
        </div>
      </div>

      <div className="text-[10px] text-gray-500 mb-2">
        {t('trimHint')}
      </div>

      {/* Mini throttle chart with draggable handles */}
      <div
        ref={containerRef}
        className="relative select-none"
        style={{ cursor: dragging ? 'col-resize' : 'default' }}
        onMouseDown={handlePointerDown}
      >
        <canvas
          ref={canvasRef}
          className="w-full rounded bg-gray-900/60 border border-gray-800/50"
          style={{ height: '60px' }}
        />
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
        <div className="flex gap-3">
          <span>{t('trimStart')}: <span className="text-emerald-400 font-mono">{frameToTime(bbParsed, startIdx)}</span></span>
          <span>{t('trimEnd')}: <span className="text-emerald-400 font-mono">{frameToTime(bbParsed, endIdx)}</span></span>
        </div>
        <div className="flex gap-3">
          <span>{t('trimDuration')}: <span className="text-gray-300 font-mono">{frameDuration(bbParsed, startIdx, endIdx)}</span></span>
          <span>{trimmedFrames.toLocaleString()} / {totalFrames.toLocaleString()} {t('trimFrames')}</span>
        </div>
      </div>
    </div>
  );
}

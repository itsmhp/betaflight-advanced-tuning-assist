/**
 * EvidenceChart.jsx — Canvas-based chart for blackbox data visualization
 * Supports multiple datasets, annotations, and configurable layout.
 */
import { useRef, useEffect } from 'react';

export default function EvidenceChart({
  title,
  datasets,           // [{ label, data: number[], color, lineWidth? }]
  xLabel = 'Time',
  yLabel = 'Value',
  annotations = [],   // [{ type: 'vline'|'hline'|'text', value, color, label }]
  height = 200,
  showLegend = true,
  xUnit = '',
  yUnit = '',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !datasets?.length || !container) return;

    // Responsive width
    const W = Math.min(container.clientWidth * 2, 1200); // 2x for retina
    const H = height * 2;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const PAD = { top: 48, right: 32, bottom: 72, left: 104 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, W, H);

    // Calculate data range
    const allData = datasets.flatMap(d => d.data || []).filter(v => isFinite(v));
    if (allData.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data', W / 2, H / 2);
      return;
    }

    const yMin = Math.min(...allData);
    const yMax = Math.max(...allData);
    const yRange = yMax - yMin || 1;
    const xCount = Math.max(...datasets.map(d => d.data?.length || 0));

    const toX = (i) => PAD.left + (i / Math.max(1, xCount - 1)) * plotW;
    const toY = (v) => PAD.top + plotH - ((v - yMin) / yRange) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();

      const val = yMax - (i / 4) * yRange;
      ctx.fillStyle = '#555';
      ctx.font = '20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1) + yUnit, PAD.left - 8, y + 6);
    }

    // X axis labels
    ctx.fillStyle = '#555';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const x = PAD.left + (i / 5) * plotW;
      const idx = Math.floor((i / 5) * Math.max(1, xCount - 1));
      ctx.fillText(idx + xUnit, x, PAD.top + plotH + 28);
    }

    // Axis labels
    ctx.fillStyle = '#444';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, PAD.left + plotW / 2, H - 10);

    ctx.save();
    ctx.translate(16, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Annotations (draw before data lines)
    annotations.forEach(ann => {
      ctx.strokeStyle = ann.color || 'rgba(255,100,100,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      if (ann.type === 'hline') {
        const y = toY(ann.value);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + plotW, y);
        ctx.stroke();
        if (ann.label) {
          ctx.fillStyle = ann.color || '#ff6464';
          ctx.font = '18px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(ann.label, PAD.left + 8, y - 6);
        }
      } else if (ann.type === 'vline') {
        const x = toX(ann.value);
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + plotH);
        ctx.stroke();
        if (ann.label) {
          ctx.fillStyle = ann.color || '#ff6464';
          ctx.font = '18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(ann.label, x, PAD.top - 6);
        }
      }
      ctx.setLineDash([]);
    });

    // Data lines
    datasets.forEach(ds => {
      if (!ds.data?.length) return;
      ctx.strokeStyle = ds.color || '#6366f1';
      ctx.lineWidth = (ds.lineWidth || 1.5) * 2; // retina
      ctx.beginPath();
      let started = false;
      ds.data.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = toX(i);
        const y = toY(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Title
    if (title) {
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(title, PAD.left, 30);
    }

    // Legend
    if (showLegend && datasets.length > 1) {
      let lx = PAD.left;
      datasets.forEach((ds) => {
        ctx.fillStyle = ds.color || '#6366f1';
        ctx.fillRect(lx, H - 40, 24, 4);
        ctx.fillStyle = '#888';
        ctx.font = '18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label || '', lx + 30, H - 34);
        lx += ctx.measureText(ds.label || '').width + 60;
      });
    }
  }, [datasets, annotations, title, height, xLabel, yLabel, xUnit, yUnit, showLegend]);

  return (
    <div ref={containerRef} className="mb-4">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, borderRadius: 6, display: 'block' }}
      />
    </div>
  );
}

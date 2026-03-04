// ─── 9. I-Term Build-Up Visualizer ───

export function analyzeITermBuildup(blackboxData) {
  const axes = ['roll', 'pitch', 'yaw'];
  const results = {};

  for (const axis of axes) {
    const values = blackboxData.data.map(r => r[`${axis}-iterm`]).filter(v => v !== undefined);
    if (!values.length) { results[axis] = null; continue; }

    const pctHigh = (values.filter(v => Math.abs(v) > 75).length / values.length) * 100;
    const maxVal = values.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

    let health, color;
    if (pctHigh < 10) { health = 'Good'; color = 'text-green-400'; }
    else if (pctHigh < 20) { health = 'Fair'; color = 'text-yellow-400'; }
    else { health = 'Poor'; color = 'text-red-400'; }

    // Additional stats
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const absValues = values.map(Math.abs);
    absValues.sort((a, b) => a - b);
    const p95 = absValues[Math.floor(absValues.length * 0.95)] ?? 0;

    results[axis] = {
      pctHigh: Math.round(pctHigh * 10) / 10,
      maxVal: Math.round(maxVal),
      health,
      color,
      mean: Math.round(mean * 10) / 10,
      p95: Math.round(p95),
      sampleCount: values.length,
      chartData: values.filter((_, i) => i % Math.max(1, Math.floor(values.length / 1000)) === 0)
    };
  }

  // Recommendations
  const recommendations = [];
  for (const axis of axes) {
    if (!results[axis]) continue;
    if (results[axis].health === 'Poor') {
      recommendations.push(`${axis.charAt(0).toUpperCase() + axis.slice(1)}: I-term buildup is excessive (${results[axis].pctHigh}% above threshold). Consider increasing iterm_relax_cutoff or reducing I gain.`);
    } else if (results[axis].health === 'Fair') {
      recommendations.push(`${axis.charAt(0).toUpperCase() + axis.slice(1)}: I-term showing moderate buildup. Monitor for drift correction issues.`);
    }
  }

  return { axes: results, recommendations };
}

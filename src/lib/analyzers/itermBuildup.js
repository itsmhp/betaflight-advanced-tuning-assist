// ─── 9. I-Term Build-Up Visualizer ───
import { clamp } from '../utils.js';

export function analyzeITermBuildup(blackboxData, cliParams) {
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

  // CLI recommendations with exact values
  const cliChanges = {};
  const recommendations = [];

  // Read current I gains from CLI params
  const currentIGains = {
    roll: cliParams?.pid?.roll?.i ?? 80,
    pitch: cliParams?.pid?.pitch?.i ?? 80,
    yaw: cliParams?.pid?.yaw?.i ?? 45,
  };
  const currentItermRelaxCutoff = cliParams?.itermRelax?.cutoff ?? 15;
  const currentItermRelaxType = cliParams?.itermRelax?.type ?? 'GYRO';

  for (const axis of axes) {
    if (!results[axis]) continue;
    const r = results[axis];

    if (r.health === 'Poor') {
      // Compute reduction proportional to buildup severity
      const severity = clamp((r.pctHigh - 20) / 30, 0, 1);
      const reductionFactor = 1 - (0.10 + 0.15 * severity); // 10-25% reduction
      const currentI = currentIGains[axis];
      const suggestedI = clamp(Math.round(currentI * reductionFactor), 10, 200);

      if (suggestedI !== currentI) {
        cliChanges[`i_${axis}`] = suggestedI;
        recommendations.push({
          message: `${axis}: I-term buildup at ${r.pctHigh}% (P95: ${r.p95}, max: ${r.maxVal}). Reduce I from ${currentI} → ${suggestedI}.`,
          param: `i_${axis}`,
          currentValue: currentI,
          suggestedValue: suggestedI,
          command: `set i_${axis} = ${suggestedI}`,
          severity: 'warning',
        });
      }

      // Also suggest raising iterm_relax_cutoff if it's low
      if (currentItermRelaxCutoff < 20 && r.p95 > 100) {
        const suggestedCutoff = clamp(Math.round(currentItermRelaxCutoff + 5 + severity * 10), 10, 40);
        cliChanges.iterm_relax_cutoff = suggestedCutoff;
        recommendations.push({
          message: `iterm_relax_cutoff ${currentItermRelaxCutoff} → ${suggestedCutoff}. Higher cutoff allows faster I-term recovery.`,
          param: 'iterm_relax_cutoff',
          currentValue: currentItermRelaxCutoff,
          suggestedValue: suggestedCutoff,
          command: `set iterm_relax_cutoff = ${suggestedCutoff}`,
          severity: 'info',
        });
      }
    } else if (r.health === 'Fair') {
      const currentI = currentIGains[axis];
      const suggestedI = clamp(Math.round(currentI * 0.95), 10, 200); // mild 5% reduction
      if (suggestedI !== currentI) {
        cliChanges[`i_${axis}`] = suggestedI;
        recommendations.push({
          message: `${axis}: Moderate I-term buildup at ${r.pctHigh}% (P95: ${r.p95}). Minor reduction I from ${currentI} → ${suggestedI}.`,
          param: `i_${axis}`,
          currentValue: currentI,
          suggestedValue: suggestedI,
          command: `set i_${axis} = ${suggestedI}`,
          severity: 'info',
        });
      }
    }
  }

  return { axes: results, recommendations, cliChanges };
}

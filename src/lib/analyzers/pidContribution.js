// ─── 4. PID Contribution Analyzer ───
import { mean, clamp } from '../utils.js';

export function analyzePIDContribution(blackboxData, cliParams) {
  const axes = ['roll', 'pitch', 'yaw'];
  const results = {};

  for (const axis of axes) {
    const pTerm = blackboxData.data.map(r => r[`${axis}-pterm`] ?? 0);
    const dTerm = blackboxData.data.map(r => r[`${axis}-dterm`] ?? 0);
    const fTerm = blackboxData.data.map(r => r[`${axis}-fterm`] ?? 0);
    const iTerm = blackboxData.data.map(r => r[`${axis}-iterm`] ?? 0);

    const sumAbsP = pTerm.reduce((s, v) => s + Math.abs(v), 0);
    const sumAbsD = dTerm.reduce((s, v) => s + Math.abs(v), 0);
    const sumAbsF = fTerm.reduce((s, v) => s + Math.abs(v), 0);
    const sumAbsI = iTerm.reduce((s, v) => s + Math.abs(v), 0);

    const totalPDF = sumAbsP + sumAbsD + sumAbsF || 1;

    const pRatio = Math.round(sumAbsP / totalPDF * 1000) / 10;
    const dRatio = Math.round(sumAbsD / totalPDF * 1000) / 10;
    const fRatio = Math.round(sumAbsF / totalPDF * 1000) / 10;

    // D-term highlight
    let dHighlight = 'normal';
    if (dRatio > 40) dHighlight = 'critical';
    else if (dRatio > 30) dHighlight = 'warning';

    // I-term separate metric
    const avgITerm = mean(iTerm.map(v => Math.abs(v)));

    results[axis] = {
      pRatio, dRatio, fRatio,
      iTerm: Math.round(avgITerm * 10) / 10,
      dHighlight,
      sumP: Math.round(sumAbsP),
      sumD: Math.round(sumAbsD),
      sumF: Math.round(sumAbsF),
      sumI: Math.round(sumAbsI)
    };
  }

  // Overall diagnostics with exact CLI values
  const allDRatios = axes.map(a => results[a]?.dRatio ?? 0);
  const maxDRatio = Math.max(...allDRatios);
  
  let status = 'Healthy';
  const recommendations = [];
  const cliChanges = {};

  if (maxDRatio > 30) {
    status = maxDRatio > 40 ? 'D-Heavy' : 'D-Elevated';

    for (const axis of axes) {
      const r = results[axis];
      if (!r || r.dRatio <= 30) continue;

      const currentD = cliParams?.pid?.[axis]?.d ?? 35;
      // Compute target D ratio ≈ 25%. Scale reduction proportional to excess.
      const excess = r.dRatio - 25;
      const reductionFactor = 1 - clamp(excess / 100, 0.05, 0.30); // 5-30% reduction
      const suggestedD = clamp(Math.round(currentD * reductionFactor), 10, 120);

      if (suggestedD !== currentD) {
        cliChanges[`d_${axis}`] = suggestedD;
        recommendations.push({
          message: `${axis}: D-term contribution ${r.dRatio}% (target < 25%). Reduce D from ${currentD} → ${suggestedD}.`,
          param: `d_${axis}`,
          currentValue: currentD,
          suggestedValue: suggestedD,
          command: `set d_${axis} = ${suggestedD}`,
          severity: r.dRatio > 40 ? 'warning' : 'info',
        });
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      message: `PID contribution ratios are balanced (D max: ${maxDRatio}%).`,
      severity: 'info',
    });
  }

  return { axes: results, status, recommendations, cliChanges };
}

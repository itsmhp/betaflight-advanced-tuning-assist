// ─── 4. PID Contribution Analyzer ───
import { mean } from '../utils.js';

export function analyzePIDContribution(blackboxData) {
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

  // Overall diagnostics
  const allDRatios = axes.map(a => results[a]?.dRatio ?? 0);
  const maxDRatio = Math.max(...allDRatios);
  
  let status = 'Healthy';
  let recommendation = 'PID contribution ratios look balanced.';
  if (maxDRatio > 40) {
    status = 'D-Heavy';
    recommendation = 'D-term contribution is very high. Consider reducing D gains or adding more filtering.';
  } else if (maxDRatio > 30) {
    status = 'D-Elevated';
    recommendation = 'D-term is elevated. Monitor for noise amplification on motors.';
  }

  return { axes: results, status, recommendation };
}

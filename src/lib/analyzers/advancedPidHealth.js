// ─── 12. Advanced PID Health Check ───
import { rms, mean, stddev, percentile, clamp, pearsonCorrelation } from '../utils.js';

export function analyzeAdvancedPidHealth(blackboxData, cliParams) {
  const data = blackboxData.data;
  const sampleRate = blackboxData.sampleRate || 2000;

  const axes = ['roll', 'pitch', 'yaw'];
  const axisResults = {};

  for (const axis of axes) {
    const pTerm = data.map(r => r[`${axis}-P`] ?? r[`axisP-${axis}`] ?? 0);
    const iTerm = data.map(r => r[`${axis}-I`] ?? r[`axisI-${axis}`] ?? 0);
    const dTerm = data.map(r => r[`${axis}-D`] ?? r[`axisD-${axis}`] ?? 0);
    const gyro = data.map(r => r[`${axis}-gyro`] ?? r[`gyroADC-${axis}`] ?? 0);
    const setpoint = data.map(r => r[`${axis}-setpoint`] ?? r[`setpoint-${axis}`] ?? 0);

    // Error = setpoint - gyro
    const error = setpoint.map((s, i) => s - gyro[i]);

    // PID saturation analysis
    const pSaturation = pTerm.filter(v => Math.abs(v) > 400).length / (pTerm.length || 1);
    const iSaturation = iTerm.filter(v => Math.abs(v) > 300).length / (iTerm.length || 1);
    const dSaturation = dTerm.filter(v => Math.abs(v) > 350).length / (dTerm.length || 1);

    // PID balance ratio
    const pRms = rms(pTerm);
    const iRms = rms(iTerm);
    const dRms = rms(dTerm);
    const totalPid = pRms + iRms + dRms || 1;
    const pRatio = pRms / totalPid;
    const iRatio = iRms / totalPid;
    const dRatio = dRms / totalPid;

    // Error tracking
    const errorRms = rms(error);
    const errorMean = mean(error);
    const errorP95 = percentile(error.map(Math.abs), 95);

    // Response quality: correlation between setpoint changes and gyro response
    const spDelta = setpoint.slice(1).map((v, i) => v - setpoint[i]);
    const gyroDelta = gyro.slice(1).map((v, i) => v - gyro[i]);
    const dsSpDelta = spDelta.filter((_, i) => i % 10 === 0);
    const dsGyroDelta = gyroDelta.filter((_, i) => i % 10 === 0);
    const responseCorrelation = pearsonCorrelation(dsSpDelta, dsGyroDelta);

    // Oscillation detection: count zero-crossings of error
    let zeroCrossings = 0;
    for (let i = 1; i < error.length; i++) {
      if ((error[i] > 0) !== (error[i - 1] > 0)) zeroCrossings++;
    }
    const oscillationRate = zeroCrossings / (error.length / sampleRate); // crossings per second

    // D-term noise
    const dNoise = stddev(dTerm);

    // PID loop latency estimate (cross-correlation peak offset)
    let bestLag = 0, bestCorr = 0;
    const maxLag = Math.min(Math.round(sampleRate * 0.01), 20); // up to 10ms
    for (let lag = 0; lag <= maxLag; lag++) {
      const dsA = spDelta.filter((_, i) => i % 5 === 0);
      const dsB = gyroDelta.slice(lag).filter((_, i) => i % 5 === 0);
      const n = Math.min(dsA.length, dsB.length);
      if (n < 10) continue;
      const corr = pearsonCorrelation(dsA.slice(0, n), dsB.slice(0, n));
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    const latencyMs = (bestLag / sampleRate) * 1000;

    // Axis health score
    const saturationPenalty = clamp((pSaturation + iSaturation + dSaturation) * 100, 0, 30);
    const errorPenalty = clamp(errorRms / 5, 0, 25);
    const oscPenalty = clamp(oscillationRate / 500, 0, 20);
    const responsePenalty = clamp((1 - responseCorrelation) * 15, 0, 15);
    const noisePenalty = clamp(dNoise / 50, 0, 10);

    const healthScore = clamp(100 - saturationPenalty - errorPenalty - oscPenalty - responsePenalty - noisePenalty, 0, 100);

    axisResults[axis] = {
      healthScore: Math.round(healthScore),
      pRms: Math.round(pRms * 10) / 10,
      iRms: Math.round(iRms * 10) / 10,
      dRms: Math.round(dRms * 10) / 10,
      pRatio: Math.round(pRatio * 100),
      iRatio: Math.round(iRatio * 100),
      dRatio: Math.round(dRatio * 100),
      pSaturation: Math.round(pSaturation * 1000) / 10,
      iSaturation: Math.round(iSaturation * 1000) / 10,
      dSaturation: Math.round(dSaturation * 1000) / 10,
      errorRms: Math.round(errorRms * 10) / 10,
      errorMean: Math.round(errorMean * 10) / 10,
      errorP95: Math.round(errorP95 * 10) / 10,
      responseCorrelation: Math.round(responseCorrelation * 100) / 100,
      oscillationRate: Math.round(oscillationRate),
      dNoise: Math.round(dNoise * 10) / 10,
      latencyMs: Math.round(latencyMs * 10) / 10
    };
  }

  // Overall health
  const overallScore = Math.round(mean(axes.map(a => axisResults[a].healthScore)));
  let healthLevel;
  if (overallScore >= 85) healthLevel = 'Excellent';
  else if (overallScore >= 70) healthLevel = 'Good';
  else if (overallScore >= 50) healthLevel = 'Fair';
  else healthLevel = 'Poor';

  // Recommendations
  const recommendations = [];

  for (const axis of axes) {
    const r = axisResults[axis];
    if (r.pSaturation > 5) {
      recommendations.push(`${axis}: P-term saturation at ${r.pSaturation}% — consider reducing ${axis}_p_gain by 10-15%.`);
    }
    if (r.oscillationRate > 400) {
      recommendations.push(`${axis}: High oscillation rate (${r.oscillationRate}/s) — reduce P or increase D for damping.`);
    }
    if (r.responseCorrelation < 0.5) {
      recommendations.push(`${axis}: Poor tracking response (${r.responseCorrelation}) — increase P gain or check mechanical issues.`);
    }
    if (r.dNoise > 80) {
      recommendations.push(`${axis}: High D-term noise (${r.dNoise}) — lower D or tighten D-term LPF.`);
    }
    if (r.latencyMs > 3) {
      recommendations.push(`${axis}: PID latency ~${r.latencyMs}ms — check loop rate, filter delays.`);
    }
    if (r.iRatio > 45) {
      recommendations.push(`${axis}: I-term dominant (${r.iRatio}%) — possible slow response, consider increasing P.`);
    }
  }

  // CLI suggestions — use correct BF CLI key names: p_roll, i_roll, d_roll, etc.
  const cliChanges = {};
  for (const axis of axes) {
    const r = axisResults[axis];
    if (r.oscillationRate > 400 && r.pRatio > 40) {
      const currentP = cliParams?.pid?.[axis]?.p ?? 50;
      cliChanges[`p_${axis}`] = Math.round(currentP * 0.88);
    }
    if (r.dNoise > 80) {
      const currentD = cliParams?.pid?.[axis]?.d ?? 30;
      cliChanges[`d_${axis}`] = Math.round(currentD * 0.85);
    }
  }

  return {
    overallScore,
    healthLevel,
    axes: axisResults,
    recommendations,
    cliChanges,
    sampleRate
  };
}

// ─── 12. Advanced PID Health Check ───
import { rms, mean, stddev, percentile, clamp, pearsonCorrelation } from '../utils.js';

export function analyzeAdvancedPidHealth(blackboxData, cliParams) {
  const data = blackboxData.data;
  const sampleRate = blackboxData.sampleRate || 2000;

  const axes = ['roll', 'pitch', 'yaw'];
  const axisResults = {};

  for (let ai = 0; ai < axes.length; ai++) {
    const axis = axes[ai];
    const pTerm = data.map(r => r[`${axis}-pterm`] ?? r[`axisP[${ai}]`] ?? 0);
    const iTerm = data.map(r => r[`${axis}-iterm`] ?? r[`axisI[${ai}]`] ?? 0);
    const dTerm = data.map(r => r[`${axis}-dterm`] ?? r[`axisD[${ai}]`] ?? 0);
    const gyro = data.map(r => r[`${axis}-gyro`] ?? r[`gyroADC[${ai}]`] ?? 0);
    const setpoint = data.map(r => r[`${axis}-setpoint`] ?? r[`setpoint[${ai}]`] ?? 0);

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

  const addRecommendation = ({ message, param, currentValue, suggestedValue, command, severity = 'warning' }) => {
    recommendations.push({ message, param, currentValue, suggestedValue, command, severity });
  };

  for (const axis of axes) {
    const r = axisResults[axis];
    if (r.pSaturation > 5) {
      addRecommendation({
        message: `${axis}: P-term saturation at ${r.pSaturation}% (P RMS: ${r.pRms}, threshold: 400). Reduce P gain to lower saturation.`,
        severity: 'warning',
      });
    }
    if (r.oscillationRate > 400) {
      addRecommendation({
        message: `${axis}: Oscillation rate ${r.oscillationRate}/s (error zero-crossings). P/D ratio: ${r.pRatio}%/${r.dRatio}%.`,
        severity: 'warning',
      });
    }
    if (r.responseCorrelation < 0.5) {
      addRecommendation({
        message: `${axis}: Tracking response correlation ${r.responseCorrelation} (target > 0.7). Error RMS: ${r.errorRms}, P95: ${r.errorP95}.`,
        severity: 'warning',
      });
    }
    if (r.dNoise > 80) {
      addRecommendation({
        message: `${axis}: D-term noise stddev ${r.dNoise} (threshold: 80). D contribution: ${r.dRatio}%.`,
        severity: 'warning',
      });
    }
    if (r.latencyMs > 3) {
      addRecommendation({
        message: `${axis}: PID loop latency ${r.latencyMs}ms (measured via cross-correlation). Check gyro rate and filter group delay.`,
        severity: 'info',
      });
    }
    if (r.iRatio > 45) {
      addRecommendation({
        message: `${axis}: I-term dominant at ${r.iRatio}% of total PID (I RMS: ${r.iRms}). Response correlation: ${r.responseCorrelation}.`,
        severity: 'info',
      });
    }
  }

  // CLI suggestions — compute exact PID values from measured oscillation/noise data
  const cliChanges = {};
  for (const axis of axes) {
    const r = axisResults[axis];
    const currentP = cliParams?.pid?.[axis]?.p ?? 50;
    const currentI = cliParams?.pid?.[axis]?.i ?? 50;
    const currentD = cliParams?.pid?.[axis]?.d ?? 30;

    // P gain adjustment based on oscillation severity
    if (r.oscillationRate > 400 && r.pRatio > 40) {
      // Scale reduction proportional to oscillation severity (400→mild, 800+→severe)
      const oscSeverity = clamp((r.oscillationRate - 400) / 600, 0, 1);
      const reductionFactor = 1 - (0.08 + 0.15 * oscSeverity); // 8-23% reduction
      const suggestedP = clamp(Math.round(currentP * reductionFactor), 15, 200);
      if (suggestedP !== currentP) {
        cliChanges[`p_${axis}`] = suggestedP;
        addRecommendation({
          message: `${axis}: Oscillation rate ${r.oscillationRate}/s → reduce P from ${currentP} to ${suggestedP} (${Math.round((1 - reductionFactor) * 100)}% reduction based on severity).`,
          param: `p_${axis}`,
          currentValue: currentP,
          suggestedValue: suggestedP,
          command: `set p_${axis} = ${suggestedP}`,
          severity: 'warning',
        });
      }
    } else if (r.responseCorrelation < 0.5 && r.oscillationRate < 200) {
      // Poor tracking with no oscillation → safe to increase P
      const trackingDeficit = clamp((0.5 - r.responseCorrelation) / 0.4, 0, 1);
      const increaseFactor = 1 + (0.05 + 0.12 * trackingDeficit); // 5-17% increase
      const suggestedP = clamp(Math.round(currentP * increaseFactor), 15, 200);
      if (suggestedP !== currentP) {
        cliChanges[`p_${axis}`] = suggestedP;
        addRecommendation({
          message: `${axis}: Tracking correlation ${r.responseCorrelation} → increase P from ${currentP} to ${suggestedP} for better response.`,
          param: `p_${axis}`,
          currentValue: currentP,
          suggestedValue: suggestedP,
          command: `set p_${axis} = ${suggestedP}`,
          severity: 'info',
        });
      }
    }

    // D gain adjustment based on D-term noise magnitude
    if (r.dNoise > 80) {
      // Scale reduction proportional to noise level (80→mild, 200+→severe)
      const noiseSeverity = clamp((r.dNoise - 80) / 150, 0, 1);
      const reductionFactor = 1 - (0.10 + 0.20 * noiseSeverity); // 10-30% reduction
      const suggestedD = clamp(Math.round(currentD * reductionFactor), 10, 150);
      if (suggestedD !== currentD) {
        cliChanges[`d_${axis}`] = suggestedD;
        addRecommendation({
          message: `${axis}: D-term noise RMS ${r.dNoise} → reduce D from ${currentD} to ${suggestedD} (${Math.round((1 - reductionFactor) * 100)}% reduction).`,
          param: `d_${axis}`,
          currentValue: currentD,
          suggestedValue: suggestedD,
          command: `set d_${axis} = ${suggestedD}`,
          severity: 'warning',
        });
      }
    }

    // I gain adjustment based on I-term dominance
    if (r.iRatio > 45 && r.responseCorrelation < 0.6) {
      const iExcess = clamp((r.iRatio - 45) / 20, 0, 1);
      const reductionFactor = 1 - (0.05 + 0.10 * iExcess);
      const suggestedI = clamp(Math.round(currentI * reductionFactor), 10, 200);
      if (suggestedI !== currentI) {
        cliChanges[`i_${axis}`] = suggestedI;
        addRecommendation({
          message: `${axis}: I-term dominant at ${r.iRatio}% with poor tracking → reduce I from ${currentI} to ${suggestedI}.`,
          param: `i_${axis}`,
          currentValue: currentI,
          suggestedValue: suggestedI,
          command: `set i_${axis} = ${suggestedI}`,
          severity: 'info',
        });
      }
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

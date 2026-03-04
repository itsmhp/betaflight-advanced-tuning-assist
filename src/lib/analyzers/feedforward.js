// ─── 7. FeedForward Tuning Assistant ───
import { mean, clamp } from '../utils.js';

export function analyzeFeedforward(blackboxData, cliParams) {
  const axes = ['roll', 'pitch', 'yaw'];
  const results = {};
  const WINDOW = 10;

  for (const axis of axes) {
    const setpoint = blackboxData.data.map(r => r[`${axis}-setpoint`] ?? 0);
    const gyro = blackboxData.data.map(r => r[`${axis}-gyro`] ?? 0);

    if (setpoint.length < WINDOW * 3) continue;

    // Get current FF value
    const currentFF = cliParams?.pid?.[axis]?.f ?? 100;

    // Maneuver detection
    const maneuvers = [];
    for (let i = 0; i < setpoint.length - WINDOW; i += WINDOW) {
      const spWindow = setpoint.slice(i, i + WINDOW);
      const gyroWindow = gyro.slice(i, i + WINDOW);

      const spRange = Math.max(...spWindow) - Math.min(...spWindow);
      if (spRange < 5) continue;

      // Cross-correlation for lag
      let bestCorr = -Infinity, bestLag = 0;
      for (let offset = -5; offset <= 5; offset++) {
        let corr = 0;
        for (let j = 0; j < WINDOW; j++) {
          const gIdx = j + offset;
          if (gIdx >= 0 && gIdx < WINDOW) {
            corr += spWindow[j] * gyroWindow[gIdx];
          }
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = offset; }
      }

      // Metrics
      const maxSetpointRate = spRange / (WINDOW / (blackboxData.sampleRate || 2000));
      const errors = spWindow.map((sp, j) => Math.abs(sp - gyroWindow[j]));
      const avgError = mean(errors);
      const spMag = mean(spWindow.map(Math.abs)) || 1;
      const trackingRatio = clamp(1 - avgError / spMag, 0.1, 1.0);
      const errorPercent = (avgError / spMag) * 100;

      // Overshoot/undershoot
      let overshoot = 0, undershoot = 0;
      for (let j = 0; j < WINDOW; j++) {
        const diff = gyroWindow[j] - spWindow[j];
        if (Math.sign(spWindow[j]) === Math.sign(diff) && Math.abs(diff) > 5) overshoot += Math.abs(diff);
        if (Math.sign(spWindow[j]) !== Math.sign(diff) && Math.abs(diff) > 5) undershoot += Math.abs(diff);
      }
      overshoot /= WINDOW;
      undershoot /= WINDOW;

      // Settling time (samples until error < 10% of range)
      let settlingTime = WINDOW;
      for (let j = WINDOW - 1; j >= 0; j--) {
        if (Math.abs(spWindow[j] - gyroWindow[j]) > spRange * 0.1) {
          settlingTime = WINDOW - j;
          break;
        }
      }

      // FF diagnosis
      let diagnosis = 'FF_OK';
      if (errorPercent > 35 && Math.abs(bestLag) > 0.5) diagnosis = 'FF_TOO_LOW';
      else if (overshoot > 5) diagnosis = 'FF_TOO_HIGH';

      // Speed band
      let speedBand = 'Slow';
      if (maxSetpointRate >= 500) speedBand = 'Fast';
      else if (maxSetpointRate >= 200) speedBand = 'Medium';

      maneuvers.push({
        startSample: i,
        axis,
        spRange: Math.round(spRange),
        maxSetpointRate: Math.round(maxSetpointRate),
        avgError: Math.round(avgError * 10) / 10,
        trackingRatio: Math.round(trackingRatio * 100) / 100,
        errorPercent: Math.round(errorPercent * 10) / 10,
        lag: bestLag,
        overshoot: Math.round(overshoot * 10) / 10,
        undershoot: Math.round(undershoot * 10) / 10,
        settlingTime,
        diagnosis,
        speedBand
      });
    }

    // Sort by worst tracking - top 50
    maneuvers.sort((a, b) => b.errorPercent - a.errorPercent);
    const worst50 = maneuvers.slice(0, 50);

    // Aggregate per axis
    const avgTrackingRatio = mean(worst50.map(m => m.trackingRatio));
    const avgErrorPercent = mean(worst50.map(m => m.errorPercent));
    const avgLag = mean(worst50.map(m => Math.abs(m.lag)));
    const avgOvershoot = mean(worst50.map(m => m.overshoot));
    const avgUndershoot = mean(worst50.map(m => m.undershoot));
    const avgSettlingTime = mean(worst50.map(m => m.settlingTime));

    // Health score
    let baseScore;
    if (avgErrorPercent <= 20) baseScore = 100;
    else if (avgErrorPercent <= 25) baseScore = 100 - (avgErrorPercent - 20) * 1;
    else if (avgErrorPercent < 100) baseScore = 95 * (1 - (avgErrorPercent - 25) / 75);
    else baseScore = 0;

    const lagPenalty = Math.max(0, avgLag - 0.3) * 3;
    const overshootPenalty = (avgOvershoot / 30) * 25;
    const undershootPenalty = (avgUndershoot / 40) * 15;
    const settlingPenalty = (avgSettlingTime / 100) * 10;
    const healthScore = clamp(Math.round(baseScore - lagPenalty - overshootPenalty - undershootPenalty - settlingPenalty), 0, 100);

    // Majority vote diagnosis
    const tooHighCount = worst50.filter(m => m.diagnosis === 'FF_TOO_HIGH').length;
    const tooLowCount = worst50.filter(m => m.diagnosis === 'FF_TOO_LOW').length;
    const okCount = worst50.filter(m => m.diagnosis === 'FF_OK').length;

    let primaryDiagnosis = 'FF_OK';
    if (tooHighCount > tooLowCount && tooHighCount > okCount) primaryDiagnosis = 'FF_TOO_HIGH';
    else if (tooLowCount > tooHighCount && tooLowCount > okCount) primaryDiagnosis = 'FF_TOO_LOW';

    // Suggested FF
    let suggestedFF = currentFF;
    if (primaryDiagnosis === 'FF_TOO_HIGH') {
      const reduction = clamp(15 + avgOvershoot * 0.5 + avgSettlingTime * 0.2, 15, 40);
      suggestedFF = Math.round(currentFF - reduction);
    } else if (primaryDiagnosis === 'FF_TOO_LOW') {
      const increase = clamp(15 + avgLag * 5 + avgUndershoot * 0.3, 15, 40);
      suggestedFF = Math.round(currentFF + increase);
    }
    if (avgTrackingRatio < 0.7) suggestedFF += 20;
    if (avgTrackingRatio > 0.95) suggestedFF -= 10;
    suggestedFF = clamp(suggestedFF, 0, 200);

    // Recommendation text
    let recommendation;
    if (primaryDiagnosis === 'FF_TOO_HIGH') {
      recommendation = `REDUCE feedforward — ${tooHighCount}/${worst50.length} maneuvers show overshoot. Reduce by ${currentFF - suggestedFF}.`;
    } else if (primaryDiagnosis === 'FF_TOO_LOW') {
      recommendation = `INCREASE feedforward — ${tooLowCount}/${worst50.length} maneuvers show lag/undershoot. Increase by ${suggestedFF - currentFF}.`;
    } else {
      recommendation = `FeedForward is well-tuned. ${okCount}/${worst50.length} maneuvers tracking well.`;
    }

    // Speed band breakdown
    const speedBands = {
      Slow: worst50.filter(m => m.speedBand === 'Slow'),
      Medium: worst50.filter(m => m.speedBand === 'Medium'),
      Fast: worst50.filter(m => m.speedBand === 'Fast')
    };

    results[axis] = {
      maneuverCount: maneuvers.length,
      worst50Count: worst50.length,
      avgTrackingRatio: Math.round(avgTrackingRatio * 100) / 100,
      avgErrorPercent: Math.round(avgErrorPercent * 10) / 10,
      avgLag: Math.round(avgLag * 10) / 10,
      avgOvershoot: Math.round(avgOvershoot * 10) / 10,
      avgUndershoot: Math.round(avgUndershoot * 10) / 10,
      avgSettlingTime: Math.round(avgSettlingTime * 10) / 10,
      healthScore,
      primaryDiagnosis,
      currentFF,
      suggestedFF,
      recommendation,
      tooHighCount,
      tooLowCount,
      okCount,
      speedBands: {
        Slow: speedBands.Slow.length,
        Medium: speedBands.Medium.length,
        Fast: speedBands.Fast.length
      }
    };
  }

  // Axis imbalance detection
  const scores = axes.map(a => results[a]?.healthScore ?? 100);
  const imbalance = Math.max(...scores) - Math.min(...scores);
  const axisImbalance = imbalance > 20 ? `Health score imbalance of ${imbalance} points detected between axes.` : null;

  // Generate CLI
  const cliChanges = {};
  for (const axis of axes) {
    if (results[axis] && results[axis].suggestedFF !== results[axis].currentFF) {
      cliChanges[`f_${axis}`] = results[axis].suggestedFF;
    }
  }

  return { axes: results, axisImbalance, cliChanges };
}

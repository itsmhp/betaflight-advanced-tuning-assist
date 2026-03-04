// ─── 6. Thrust Linearization Analyzer ───
import { mean, median, mad, linearRegression, clamp } from '../utils.js';

export function analyzeThrustLinearization(blackboxData, cliParams) {
  const throttle = blackboxData.data.map(r => r.throttle ?? 0);
  const motors = [0, 1, 2, 3].map(i =>
    blackboxData.data.map(r => r[`motor${i}`] ?? 0)
  );
  const gyroRoll = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
  const gyroPitch = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
  const gyroYaw = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);

  const minThrottle = cliParams?.motor?.minThrottle ?? 1070;
  const maxThrottle = cliParams?.motor?.maxThrottle ?? 2000;
  const throttleRange = maxThrottle - minThrottle || 1;

  // Average motor output
  const avgMotor = throttle.map((_, i) =>
    mean(motors.map(m => m[i]))
  );

  // Normalize - build (throttlePct, avgMotorPct) pairs, filter valid
  const pairs = [];
  for (let i = 0; i < throttle.length; i++) {
    const tPct = (throttle[i] - minThrottle) / throttleRange * 100;
    if (tPct >= 0 && tPct <= 100 && avgMotor[i] > 0) {
      pairs.push({ tPct, motorPct: avgMotor[i] });
    }
  }

  if (pairs.length < 50) {
    return { error: 'Insufficient data for thrust linearization analysis' };
  }

  // Sort by throttle
  pairs.sort((a, b) => a.tPct - b.tPct);

  // Baseline linear regression on bottom 30%
  const bottom30Idx = Math.floor(pairs.length * 0.3);
  const baselineX = pairs.slice(0, bottom30Idx).map(p => p.tPct);
  const baselineY = pairs.slice(0, bottom30Idx).map(p => p.motorPct);
  const baseline = linearRegression(baselineX, baselineY);

  // MAPE
  const mapeValues = pairs.map(p => {
    const predicted = baseline.predict(p.tPct);
    return predicted !== 0 ? 100 * Math.abs(p.motorPct - predicted) / Math.abs(predicted) : 0;
  });
  const mape = mean(mapeValues);

  // MAD of baseline residuals
  const baselineResiduals = pairs.slice(0, bottom30Idx).map(p => p.motorPct - baseline.predict(p.tPct));
  const baselineMAD = mad(baselineResiduals);

  // Non-linear onset detection
  // Method 1: Residual threshold
  let onset1 = 100;
  for (let i = 0; i < pairs.length; i++) {
    const residual = Math.abs(pairs[i].motorPct - baseline.predict(pairs[i].tPct));
    if (residual > 2.5 * baselineMAD) {
      onset1 = pairs[i].tPct;
      break;
    }
  }

  // Method 2: Slope deviation
  let onset2 = 100;
  const slopes = [];
  for (let i = 5; i < pairs.length - 5; i++) {
    const localSlope = (pairs[i + 5].motorPct - pairs[i - 5].motorPct) / (pairs[i + 5].tPct - pairs[i - 5].tPct || 1);
    slopes.push({ tPct: pairs[i].tPct, slope: localSlope });
  }
  const baseSlopeMAD = mad(slopes.slice(0, Math.floor(slopes.length * 0.3)).map(s => s.slope));
  for (const s of slopes) {
    if (s.slope > 1.6 * baseSlopeMAD && baseSlopeMAD > 0) {
      onset2 = s.tPct;
      break;
    }
  }
  const nonLinearOnset = Math.min(onset1, onset2);

  // PID effort regression
  const pidSum = blackboxData.data.map(r => {
    const pR = r['roll-pterm'] ?? 0, pP = r['pitch-pterm'] ?? 0;
    const dR = r['roll-dterm'] ?? 0, dP = r['pitch-dterm'] ?? 0;
    const iR = r['roll-iterm'] ?? 0, iP = r['pitch-iterm'] ?? 0;
    return Math.abs(pR) + Math.abs(pP) + Math.abs(dR) + Math.abs(dP) + Math.abs(iR) + Math.abs(iP);
  });

  const validMotorPid = [];
  for (let i = 0; i < Math.min(pidSum.length, avgMotor.length); i++) {
    if (avgMotor[i] > 0) validMotorPid.push({ motor: avgMotor[i], pid: pidSum[i] });
  }
  const pidEffortReg = validMotorPid.length > 10 ?
    linearRegression(validMotorPid.map(p => p.motor), validMotorPid.map(p => p.pid)) :
    { slope: 0 };

  // Hover detection
  let hoverThrottlePct = null;
  const calmPeriods = [];
  for (let i = 0; i < throttle.length; i++) {
    if (Math.abs(gyroRoll[i]) < 40 && Math.abs(gyroPitch[i]) < 40 && Math.abs(gyroYaw[i]) < 40) {
      const tPct = (throttle[i] - minThrottle) / throttleRange * 100;
      if (tPct > 10 && tPct < 80) calmPeriods.push(tPct);
    }
  }
  if (calmPeriods.length > 20) {
    // Histogram binning
    const bins = new Array(20).fill(0);
    for (const t of calmPeriods) bins[Math.min(19, Math.floor(t / 5))]++;
    const maxBinIdx = bins.indexOf(Math.max(...bins));
    hoverThrottlePct = Math.round(maxBinIdx * 5 + 2.5);
  }

  // Diagnosis
  let diagnosis, severity;
  if (mape < 3) { diagnosis = 'Thrust curve is effectively linear. No strong need for thrust_linear.'; severity = 'good'; }
  else if (mape < 8) { diagnosis = 'Mild non-linearity. Monitor high-throttle; light thrust_linear may help.'; severity = 'fair'; }
  else if (mape < 15) { diagnosis = 'Noticeable non-linearity. High-throttle region likely inflating P/D gains.'; severity = 'warning'; }
  else { diagnosis = 'Severe non-linearity. Controller operating on exaggerated thrust response.'; severity = 'critical'; }

  let pidDiagnosis;
  if (pidEffortReg.slope > 0.03) pidDiagnosis = 'Strong upward PID effort escalation → classic TPA reliance';
  else if (pidEffortReg.slope > 0.015) pidDiagnosis = 'Moderate PID escalation; partial TPA likely sufficient';
  else pidDiagnosis = 'Low PID escalation; may reduce/remove TPA after linearization';

  let recommendation;
  if (mape >= 8) recommendation = 'Apply thrust_linear first to flatten; then retune P/D mid-band and reassess TPA.';
  else if (mape >= 3) recommendation = 'Optional mild thrust_linear if chasing consistent feel; otherwise leave as-is.';
  else recommendation = 'Skip thrust_linear; focus on conventional PID optimization.';

  // Suggest thrust_linear value
  let suggestedThrustLinear = 0;
  if (mape >= 8) suggestedThrustLinear = clamp(Math.round(mape * 2.5), 20, 65);
  else if (mape >= 3) suggestedThrustLinear = clamp(Math.round(mape * 1.5), 10, 30);

  const cliChanges = {};
  if (suggestedThrustLinear > 0) {
    cliChanges.thrust_linear = suggestedThrustLinear;
  }

  return {
    mape: Math.round(mape * 10) / 10,
    nonLinearOnset: Math.round(nonLinearOnset),
    pidEffortSlope: Math.round(pidEffortReg.slope * 10000) / 10000,
    hoverThrottlePct,
    diagnosis,
    severity,
    pidDiagnosis,
    recommendation,
    suggestedThrustLinear,
    cliChanges,
    chartData: {
      pairs: pairs.filter((_, i) => i % Math.max(1, Math.floor(pairs.length / 500)) === 0),
      baseline: { slope: baseline.slope, intercept: baseline.intercept }
    }
  };
}

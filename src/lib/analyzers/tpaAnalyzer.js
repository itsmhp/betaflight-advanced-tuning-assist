// ─── 8. TPA Analyzer ───
import { mean, median, mad, rms, percentile, clamp, movingAvg } from '../utils.js';

export function analyzeTPA(blackboxData, cliParams) {
  const throttle = blackboxData.data.map(r => r.throttle ?? 0);
  const hasDterm = blackboxData.available.has('roll-dterm');

  // D-term magnitude
  let dtermMag;
  if (hasDterm) {
    dtermMag = blackboxData.data.map(r => {
      const d0 = r['roll-dterm'] ?? 0;
      const d1 = r['pitch-dterm'] ?? 0;
      const d2 = r['yaw-dterm'] ?? 0;
      return Math.sqrt((d0 ** 2 + d1 ** 2 + d2 ** 2) / 3);
    });
  } else {
    // Gyro derivative proxy
    const gyroR = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
    const gyroP = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
    const gyroY = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);
    dtermMag = [0];
    for (let i = 1; i < gyroR.length; i++) {
      const dR = gyroR[i] - gyroR[i - 1];
      const dP = gyroP[i] - gyroP[i - 1];
      const dY = gyroY[i] - gyroY[i - 1];
      dtermMag.push(Math.sqrt(dR ** 2 + dP ** 2 + dY ** 2));
    }
  }

  // Normalize throttle
  const minT = Math.min(...throttle);
  const maxT = Math.max(...throttle);
  const tRange = maxT - minT || 1;
  const normThrottle = throttle.map(t => (t - minT) / tRange);

  // Smoothing
  const smoothed = Array.from(movingAvg(dtermMag, 25));

  // Bucketing (40 bins)
  const BINS = 40;
  const buckets = Array.from({ length: BINS }, () => ({ sum: 0, count: 0 }));
  for (let i = 0; i < normThrottle.length; i++) {
    const idx = Math.min(BINS - 1, Math.floor(normThrottle[i] * BINS));
    buckets[idx].sum += smoothed[i];
    buckets[idx].count++;
  }
  const bucketAvg = buckets.map(b => b.count > 0 ? b.sum / b.count : 0);

  // Baseline noise floor (low throttle region)
  const baselineBuckets = bucketAvg.slice(
    Math.floor(0.1 * BINS),
    Math.floor(0.25 * BINS)
  ).filter(v => v > 0);
  const baselineMedian = baselineBuckets.length ? median(baselineBuckets) : 0;
  const baselineMAD = baselineBuckets.length ? mad(baselineBuckets) : 1;
  const threshold = baselineMedian + 3 * baselineMAD;

  // Breakpoint detection (4 methods)
  const candidates = [];

  // Method 1: Threshold crossing
  for (let i = Math.floor(0.15 * BINS); i < BINS; i++) {
    if (bucketAvg[i] > threshold && buckets[i].count > 5) {
      candidates.push({ bin: i, method: 'threshold', magnitude: bucketAvg[i], riseRatio: 1 });
      break;
    }
  }

  // Method 2: Gradient knee (max second derivative)
  let maxSecondDeriv = 0, maxSecondDerivBin = -1;
  for (let i = 2; i < BINS; i++) {
    const sd = bucketAvg[i] - 2 * bucketAvg[i - 1] + bucketAvg[i - 2];
    if (sd > maxSecondDeriv) {
      maxSecondDeriv = sd;
      maxSecondDerivBin = i;
    }
  }
  if (maxSecondDerivBin > 0) {
    candidates.push({ bin: maxSecondDerivBin, method: 'gradient', magnitude: bucketAvg[maxSecondDerivBin], riseRatio: 0.9 });
  }

  // Method 3: Rise ratio
  for (let i = Math.floor(0.15 * BINS); i < BINS; i++) {
    if (bucketAvg[i - 1] > 0 && bucketAvg[i] / bucketAvg[i - 1] >= 1.6) {
      candidates.push({ bin: i, method: 'rise-ratio', magnitude: bucketAvg[i], riseRatio: bucketAvg[i] / bucketAvg[i - 1] });
      break;
    }
  }

  // Method 4: Piecewise SSE
  let bestSSE = Infinity, bestSSEBin = -1;
  for (let split = Math.floor(0.15 * BINS); split < Math.floor(0.85 * BINS); split++) {
    const leftVals = bucketAvg.slice(0, split + 1).filter(v => v > 0);
    const rightVals = bucketAvg.slice(split + 1).filter(v => v > 0);
    if (!leftVals.length || !rightVals.length) continue;
    const leftMean = mean(leftVals);
    const rightMean = mean(rightVals);
    if (rightMean <= 1.15 * leftMean) continue;
    const sse = leftVals.reduce((s, v) => s + (v - leftMean) ** 2, 0) +
                rightVals.reduce((s, v) => s + (v - rightMean) ** 2, 0);
    if (sse < bestSSE) { bestSSE = sse; bestSSEBin = split; }
  }
  if (bestSSEBin > 0) {
    candidates.push({ bin: bestSSEBin, method: 'SSE', magnitude: bucketAvg[bestSSEBin], riseRatio: 0.85 });
  }

  // Score candidates
  const maxMag = Math.max(...candidates.map(c => c.magnitude), 1);
  const methodBonus = { 'threshold': 1.0, 'gradient': 0.9, 'SSE': 0.85, 'rise-ratio': 0.8 };
  for (const c of candidates) {
    const magScore = c.magnitude / maxMag;
    const riseScore = Math.min(2, c.riseRatio) / 2;
    c.score = (0.45 * magScore + 0.45 * riseScore) * (methodBonus[c.method] ?? 0.8);
  }
  candidates.sort((a, b) => b.score - a.score);

  const bestCandidate = candidates[0];
  const breakpointPct = bestCandidate ? (bestCandidate.bin / BINS * 100) : 50;
  const breakpointRaw = 1000 + Math.round(breakpointPct * 10);

  // TPA rate from D-term ratio
  const lowThrottleVals = [];
  const highThrottleVals = [];
  for (let i = 0; i < normThrottle.length; i++) {
    if (normThrottle[i] <= 0.35) lowThrottleVals.push(smoothed[i]);
    if (normThrottle[i] >= 0.65) highThrottleVals.push(smoothed[i]);
  }

  const lowRms = rms(lowThrottleVals);
  const highRms = rms(highThrottleVals);
  const dtermRmsRatio = lowRms > 0 ? highRms / lowRms : 1;

  let suggestedTpaRate = 0;
  if (dtermRmsRatio > 1) {
    const lowP95 = percentile(lowThrottleVals, 95) || 1;
    const highP95 = percentile(highThrottleVals, 95);
    const rawRate = 1 - 1 / (0.6 * dtermRmsRatio + 0.4 * (highP95 / lowP95));
    suggestedTpaRate = clamp(Math.round(200 * rawRate), 5, 100);
  }

  // CLI changes
  const currentTpa = cliParams?.tpa ?? {};
  const cliChanges = {};
  if (Math.abs(breakpointRaw - (currentTpa.breakpoint ?? 1350)) > 20) {
    cliChanges.tpa_breakpoint = breakpointRaw;
  }
  if (Math.abs(suggestedTpaRate - (currentTpa.rate ?? 65)) > 5) {
    cliChanges.tpa_rate = suggestedTpaRate;
  }

  return {
    breakpointPct: Math.round(breakpointPct),
    breakpointRaw,
    suggestedTpaRate,
    dtermRmsRatio: Math.round(dtermRmsRatio * 100) / 100,
    lowRms: Math.round(lowRms * 10) / 10,
    highRms: Math.round(highRms * 10) / 10,
    hasDterm,
    candidates: candidates.slice(0, 4),
    bucketAvg,
    cliChanges,
    chartData: {
      bucketAvg,
      breakpointBin: bestCandidate?.bin ?? 20,
      threshold
    }
  };
}

// ─── 10. Throttle & Axis Manager ───
import { mean, stddev, median } from '../utils.js';

export function analyzeThrottleAxis(blackboxData) {
  const throttle = blackboxData.data.map(r => r.throttle ?? 0);
  const gyroR = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
  const gyroP = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
  const gyroY = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);
  const accZ = blackboxData.data.map(r => r.accZ ?? r['accSmooth[2]'] ?? null);
  const hasAcc = accZ.some(v => v !== null && v !== 0);

  // Basic throttle stats
  const peakMax = Math.max(...throttle);
  const minThrottle = Math.min(...throttle.filter(t => t > 900));

  const sorted = [...throttle].sort((a, b) => a - b);
  const top10Pct = sorted.slice(Math.floor(sorted.length * 0.9));
  const bottom10Pct = sorted.slice(0, Math.floor(sorted.length * 0.1));
  const averageMax = mean(top10Pct);

  const pctConvert = (raw) => ((raw - 1000) / 1000 * 100).toFixed(1);

  // Full throttle time
  const fullThrottleSamples = throttle.filter(t => t >= 1900).length;
  const timeAtFullThrottle = (fullThrottleSamples / throttle.length * 100).toFixed(1);

  // Hover detection
  let hoverPoint = null, floatPoint = null, detectionMethod = 'Statistical Mode';

  if (hasAcc) {
    // Method 1: Sensor Fusion
    const calmIndices = [];
    for (let i = 0; i < throttle.length; i += 10) {
      if (Math.abs(gyroR[i]) + Math.abs(gyroP[i]) + Math.abs(gyroY[i]) < 20) {
        calmIndices.push(i);
      }
    }

    if (calmIndices.length > 10) {
      const calmAccZ = calmIndices.map(i => accZ[i]).filter(v => v !== null).sort((a, b) => a - b);
      const gravityRef = calmAccZ.length ? calmAccZ[Math.floor(calmAccZ.length / 2)] : 1;

      const hoverSamples = [];
      for (let i = 0; i < throttle.length; i++) {
        if (throttle[i] > 1050 &&
            Math.abs(gyroR[i]) + Math.abs(gyroP[i]) + Math.abs(gyroY[i]) < 20 &&
            accZ[i] !== null && Math.abs(1 - accZ[i] / gravityRef) < 0.15) {
          hoverSamples.push(throttle[i]);
        }
      }

      if (hoverSamples.length > 10) {
        const bins = {};
        for (const t of hoverSamples) {
          const bin = Math.floor(t / 10) * 10;
          bins[bin] = (bins[bin] || 0) + 1;
        }
        const maxBin = Object.entries(bins).sort((a, b) => b[1] - a[1])[0];
        hoverPoint = parseInt(maxBin[0]) + 5;
        detectionMethod = 'Sensor Fusion (High Accuracy)';
      }
    }
  }

  if (!hoverPoint) {
    // Method 2: Statistical mode
    const validThrottle = throttle.filter(t => t > 1050);
    if (validThrottle.length > 20) {
      const bins = {};
      for (const t of validThrottle) {
        const bin = Math.floor(t / 20) * 20;
        bins[bin] = (bins[bin] || 0) + 1;
      }

      const binEntries = Object.entries(bins).sort((a, b) => b[1] - a[1]);
      const maxCount = binEntries[0][1];
      const peaks = binEntries.filter(b => b[1] > maxCount * 0.15);

      // Find first local max from 1060 upward
      const binKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);
      let found = false;
      for (let j = 1; j < binKeys.length - 1; j++) {
        if (binKeys[j] >= 1060 && bins[binKeys[j]] > bins[binKeys[j - 1]] && bins[binKeys[j]] > bins[binKeys[j + 1]]) {
          hoverPoint = binKeys[j] + 10;
          found = true;
          break;
        }
      }
      if (!found) hoverPoint = parseInt(binEntries[0][0]) + 10;
    }
    detectionMethod = 'Statistical Mode';
  }

  // Float point (lowest sustained throttle)
  floatPoint = Math.round(mean(bottom10Pct.filter(v => v > 1000)));

  // Hover consistency
  let throttleConsistency = null;
  if (hoverPoint) {
    const nearHover = throttle.filter(t => Math.abs(t - hoverPoint) < 50);
    throttleConsistency = nearHover.length > 5 ? Math.round(stddev(nearHover) * 10) / 10 : null;
  }

  // Axis analysis
  const rcRoll = blackboxData.data.map(r => r['roll-rc'] ?? 0);
  const rcPitch = blackboxData.data.map(r => r['pitch-rc'] ?? 0);
  const rcYaw = blackboxData.data.map(r => r['yaw-rc'] ?? 0);

  const analyzeAxisUsage = (values) => {
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const center = (minV + maxV) / 2;
    let positive = 0, negative = 0;
    for (const v of values) {
      if (v > center) positive += v - center;
      else negative += Math.abs(v - center);
    }
    const total = positive + negative || 1;
    return {
      positive: Math.round(positive),
      negative: Math.round(negative),
      total: Math.round(total),
      center: Math.round(center),
      percentagePositive: Math.round(positive / total * 100),
      percentageNegative: Math.round(negative / total * 100)
    };
  };

  const rollAnalysis = analyzeAxisUsage(rcRoll);
  const pitchAnalysis = analyzeAxisUsage(rcPitch);
  const yawAnalysis = analyzeAxisUsage(rcYaw);

  const grandTotal = rollAnalysis.total + pitchAnalysis.total + yawAnalysis.total || 1;
  rollAnalysis.percentageOfTotalControl = Math.round(rollAnalysis.total / grandTotal * 100);
  pitchAnalysis.percentageOfTotalControl = Math.round(pitchAnalysis.total / grandTotal * 100);
  yawAnalysis.percentageOfTotalControl = Math.round(yawAnalysis.total / grandTotal * 100);

  // Flight style
  const rT = rollAnalysis.total, pT = pitchAnalysis.total, yT = yawAnalysis.total;
  let flightStyle = 'Balanced Multi-Axis Flight';
  if (pT > 1.5 * rT && pT > yT) flightStyle = 'Forward/Backward Flight Dominant';
  else if (rT > 1.5 * pT && rT > yT) flightStyle = 'Lateral/Rolling Flight Dominant';
  else if (yT > 1.5 * rT && yT > pT) flightStyle = 'Spinning/Yaw Flight Dominant';
  else if (pitchAnalysis.positive > 2 * pitchAnalysis.negative) flightStyle = 'Primarily Forward Flight';
  else if (rollAnalysis.positive > 2 * rollAnalysis.negative) flightStyle = 'Primarily Right Rolling';

  return {
    peakMax, peakMaxPerc: pctConvert(peakMax),
    averageMax: Math.round(averageMax), averageMaxPerc: pctConvert(averageMax),
    minThrottle, minThrottlePerc: pctConvert(minThrottle),
    timeAtFullThrottle,
    floatPoint, floatPointPerc: floatPoint ? pctConvert(floatPoint) : null,
    hoverPoint, hoverPointPerc: hoverPoint ? pctConvert(hoverPoint) : null,
    detectionMethod,
    throttleConsistency,
    flightStyle,
    analysis: { roll: rollAnalysis, pitch: pitchAnalysis, yaw: yawAnalysis },
    chartData: {
      throttle: throttle.filter((_, i) => i % 10 === 0)
    }
  };
}

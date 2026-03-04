// ─── 2. Stick Movement Analyzer ───
import { mean, clamp } from '../utils.js';

export function analyzeStickMovement(blackboxData) {
  const axes = ['roll', 'pitch', 'yaw'];
  const rcNames = { roll: 'roll-rc', pitch: 'pitch-rc', yaw: 'yaw-rc' };

  const results = {};

  for (const axis of axes) {
    const raw = blackboxData.data.map(r => r[rcNames[axis]] ?? 0);
    if (!raw.length) continue;

    const minV = Math.min(...raw);
    const maxV = Math.max(...raw);
    const range = maxV - minV || 1;
    const normalized = raw.map(v => (v - minV) / range * 2 - 1);

    // Smoothness via RMS velocity
    const deltas = [];
    for (let i = 1; i < normalized.length; i++) {
      deltas.push(normalized[i] - normalized[i - 1]);
    }
    const rmsVelocity = Math.sqrt(mean(deltas.map(d => d * d)));
    const smoothness = clamp(100 - 9 * rmsVelocity * 100, 0, 100);

    // Symmetry
    const posCount = normalized.filter(v => v > 0.05).length;
    const negCount = normalized.filter(v => v < -0.05).length;
    const total = posCount + negCount || 1;
    const symmetryScore = Math.round((1 - Math.abs(posCount - negCount) / total) * 100);

    // Bounceback detection
    let crossings = 0;
    let bouncebacks = 0;
    for (let i = 1; i < normalized.length; i++) {
      if ((normalized[i] >= 0 && normalized[i - 1] < 0) || (normalized[i] < 0 && normalized[i - 1] >= 0)) {
        crossings++;
        // Check for direction reversal within 10 frames
        for (let j = i + 1; j < Math.min(i + 10, normalized.length - 1); j++) {
          if ((normalized[j + 1] - normalized[j]) * (normalized[j] - normalized[j - 1]) < 0) {
            bouncebacks++;
            break;
          }
        }
      }
    }
    const bouncebackScore = crossings > 0 ? Math.round(bouncebacks / crossings * 100) : 0;

    // Pot jitter detection
    const centerThreshold = 0.1;
    const centerDeltas = [];
    for (let i = 1; i < normalized.length; i++) {
      if (Math.abs(normalized[i]) < centerThreshold && Math.abs(normalized[i - 1]) < centerThreshold) {
        centerDeltas.push(Math.abs(normalized[i] - normalized[i - 1]));
      }
    }
    const jitterScore = centerDeltas.length > 0 ? Math.round(50 * Math.sqrt(mean(centerDeltas.map(d => d * d))) * 100) : 0;

    // Center usage detection  
    const centerUsage = Math.round(normalized.filter(v => Math.abs(v) < 0.3).length / normalized.length * 100);

    // Expo suggestions
    let expoSuggestion = null;
    if (centerUsage >= 50) expoSuggestion = { action: 'Increase expo by +0.10', reason: 'High center usage detected' };
    else if (centerUsage <= 22) expoSuggestion = { action: 'Decrease expo by -0.05', reason: 'Low center usage — already precise' };

    // FF suggestion from bounceback
    let ffSuggestion = null;
    if (bouncebackScore >= 20) ffSuggestion = 'Lower Feedforward — bounceback detected';

    results[axis] = {
      smoothness: Math.round(smoothness),
      symmetryScore,
      bouncebackScore,
      jitterScore: Math.min(100, jitterScore),
      centerUsage,
      expoSuggestion,
      ffSuggestion,
      posCount,
      negCount,
      crossings,
      rmsVelocity: Math.round(rmsVelocity * 1000) / 1000
    };
  }

  // Flight style classification
  const rollTotal = Math.abs(results.roll?.posCount ?? 0) + Math.abs(results.roll?.negCount ?? 0);
  const pitchTotal = Math.abs(results.pitch?.posCount ?? 0) + Math.abs(results.pitch?.negCount ?? 0);
  const yawTotal = Math.abs(results.yaw?.posCount ?? 0) + Math.abs(results.yaw?.negCount ?? 0);

  let flightStyle = 'Balanced';
  if (rollTotal > 1.5 * pitchTotal && rollTotal > yawTotal) flightStyle = 'Roll Dominant (Freestyle/Acro)';
  else if (pitchTotal > 1.5 * rollTotal && pitchTotal > yawTotal) flightStyle = 'Pitch Dominant (Racing/Forward)';
  else if (yawTotal > 1.5 * rollTotal && yawTotal > pitchTotal) flightStyle = 'Yaw Dominant (Spinning/Cinematic)';

  return { axes: results, flightStyle };
}

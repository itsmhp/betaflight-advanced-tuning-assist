// ─── 1. Anti-Gravity Analyzer ───
import { mean, clamp } from '../utils.js';

export function analyzeAntiGravity(blackboxData, cliParams) {
  const throttle = blackboxData.data.map(r => r.throttle ?? r['rcCommand[3]'] ?? 0);
  const gyroRoll = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
  const gyroPitch = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
  const gyroYaw = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);

  const minT = Math.min(...throttle);
  const maxT = Math.max(...throttle);
  const throttleRange = maxT - minT;
  if (throttleRange < 50) {
    return { events: [], status: 'No Data', message: 'Insufficient throttle range in log' };
  }

  const punchUpThreshold = 0.35 * throttleRange;
  const punchDownThreshold = 0.25 * throttleRange;

  // Detect punch events
  const events = [];
  let inPunch = false;
  let punchStart = 0;
  let punchType = null;

  for (let i = 1; i < throttle.length; i++) {
    const delta = throttle[i] - throttle[i - 1];
    const isPunchUp = delta > punchUpThreshold;
    const isPunchDown = delta < -punchDownThreshold;

    if (!inPunch && (isPunchUp || isPunchDown)) {
      inPunch = true;
      punchStart = i;
      punchType = isPunchUp ? 'up' : 'down';
    } else if (inPunch && !isPunchUp && !isPunchDown) {
      // End of punch event
      const window = { start: punchStart, end: i, type: punchType };
      const rollDrifts = [];
      const pitchDrifts = [];
      for (let j = window.start; j <= Math.min(window.end, throttle.length - 1); j++) {
        rollDrifts.push(Math.abs(gyroRoll[j]));
        pitchDrifts.push(Math.abs(gyroPitch[j]));
      }
      const avgRollDrift = mean(rollDrifts);
      const avgPitchDrift = mean(pitchDrifts);
      const driftMagnitude = Math.sqrt(avgRollDrift ** 2 + avgPitchDrift ** 2);

      let severity = 'Good';
      let recommendation = 'No change needed';
      if (driftMagnitude > 50) {
        severity = 'Critical';
        recommendation = 'Increase Anti-Gravity gain 20–30%';
      } else if (driftMagnitude > 25) {
        severity = 'Warning';
        recommendation = 'Increase Anti-Gravity gain 10–15%';
      }

      const axisBias = avgRollDrift > 1.5 * avgPitchDrift ? 'Roll biased' :
                       avgPitchDrift > 1.5 * avgRollDrift ? 'Pitch biased' : 'Balanced';

      events.push({
        index: events.length,
        startSample: punchStart,
        endSample: i,
        type: punchType,
        avgRollDrift: Math.round(avgRollDrift * 10) / 10,
        avgPitchDrift: Math.round(avgPitchDrift * 10) / 10,
        driftMagnitude: Math.round(driftMagnitude * 10) / 10,
        severity,
        recommendation,
        axisBias
      });

      inPunch = false;
    }
  }

  // Overall assessment
  const avgDrift = events.length ? mean(events.map(e => e.driftMagnitude)) : 0;
  let status = 'Excellent';
  if (avgDrift >= 35) status = 'Poor';
  else if (avgDrift >= 15) status = 'Good';

  const criticalCount = events.filter(e => e.severity === 'Critical').length;
  const warningCount = events.filter(e => e.severity === 'Warning').length;

  // Generate CLI suggestions
  const currentGain = cliParams?.antiGravity?.gain ?? 80;
  let suggestedGain = currentGain;
  if (avgDrift > 50) suggestedGain = Math.round(currentGain * 1.25);
  else if (avgDrift > 25) suggestedGain = Math.round(currentGain * 1.12);
  suggestedGain = clamp(suggestedGain, 20, 250);

  const cliChanges = {};
  if (suggestedGain !== currentGain) {
    cliChanges.anti_gravity_gain = suggestedGain;
  }

  // Structured recommendations with before/after values
  const recommendations = [];
  if (suggestedGain !== currentGain) {
    const dir = suggestedGain > currentGain ? 'Increase' : 'Reduce';
    recommendations.push({
      message: `${dir} anti_gravity_gain: ${criticalCount} critical / ${warningCount} warning punch events detected. Drift avg = ${Math.round(avgDrift * 10) / 10} °/s.`,
      param: 'anti_gravity_gain',
      currentValue: currentGain,
      suggestedValue: suggestedGain,
      command: `set anti_gravity_gain = ${suggestedGain}`,
      severity: criticalCount > 0 ? 'critical' : 'warning',
    });
  } else if (avgDrift < 15) {
    recommendations.push({
      message: `Anti-Gravity gain is well-configured. Avg drift ${Math.round(avgDrift * 10) / 10} °/s — no change needed.`,
      param: 'anti_gravity_gain',
      currentValue: currentGain,
      suggestedValue: null,
      command: null,
      severity: 'info',
    });
  }

  return {
    events,
    status,
    avgDrift: Math.round(avgDrift * 10) / 10,
    criticalCount,
    warningCount,
    goodCount: events.length - criticalCount - warningCount,
    totalEvents: events.length,
    currentGain,
    suggestedGain,
    cliChanges,
    recommendations,
    chartData: {
      throttle: throttle.filter((_, i) => i % 10 === 0),
      gyroRoll: gyroRoll.filter((_, i) => i % 10 === 0),
      gyroPitch: gyroPitch.filter((_, i) => i % 10 === 0)
    }
  };
}

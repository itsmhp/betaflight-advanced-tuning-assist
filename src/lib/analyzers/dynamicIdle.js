// ─── 15. Dynamic Idle Analyzer ───
import { mean, stddev, rms, percentile, clamp, pearsonCorrelation } from '../utils.js';

export function analyzeDynamicIdle(blackboxData, cliParams) {
  const data = blackboxData.data;
  const sampleRate = blackboxData.sampleRate || 2000;

  const motors = [0, 1, 2, 3].map(i => data.map(r => r[`motor${i}`] ?? r[`motor-${i}`] ?? 0));
  const throttle = data.map(r => r.throttle ?? r['rcCommand-3'] ?? 0);
  const gyroR = data.map(r => r['roll-gyro'] ?? r['gyroADC-roll'] ?? 0);
  const gyroP = data.map(r => r['pitch-gyro'] ?? r['gyroADC-pitch'] ?? 0);
  const gyroY = data.map(r => r['yaw-gyro'] ?? r['gyroADC-yaw'] ?? 0);

  // eRPM data if available
  const erpm = [0, 1, 2, 3].map(i => data.map(r => r[`eRPM-${i}`] ?? r[`eRPM${i}`] ?? null));
  const hasErpm = erpm[0][0] !== null;

  // CLI-based dynamic idle config
  // dynamicIdle.minRpm is already scaled to actual RPM (dyn_idle_min_rpm * 100)
  const di = cliParams?.dynamicIdle;
  const dynIdleConfig = {
    minRpm:      di?.minRpm      ?? 0,
    pGain:       di?.pGain       ?? 50,
    iGain:       di?.iGain       ?? 50,
    dGain:       di?.dGain       ?? 50,
    maxIncrease: di?.maxIncrease ?? 150,
    enabled:     (di?.minRpm     ?? 0) > 0
  };

  // Detect idle/low-throttle segments
  const idleThreshold = 1100; // motor command level for "idle"
  const idleSegments = [];
  let segStart = null;

  for (let i = 0; i < throttle.length; i++) {
    const avgMotor = mean(motors.map(m => m[i]));
    const isIdle = avgMotor < idleThreshold || throttle[i] < 1050;
    
    if (isIdle && segStart === null) segStart = i;
    else if (!isIdle && segStart !== null) {
      if (i - segStart > sampleRate * 0.1) { // at least 100ms
        idleSegments.push({ start: segStart, end: i - 1 });
      }
      segStart = null;
    }
  }

  // Analyze idle segments
  const idleAnalysis = idleSegments.map(seg => {
    const motorSlices = motors.map(m => m.slice(seg.start, seg.end + 1));
    const motorMeans = motorSlices.map(s => mean(s));
    const motorStddevs = motorSlices.map(s => stddev(s));
    const gyroRms = rms(gyroR.slice(seg.start, seg.end + 1).concat(gyroP.slice(seg.start, seg.end + 1)));
    const duration = (seg.end - seg.start) / sampleRate;

    let erpmMeans = null;
    if (hasErpm) {
      erpmMeans = erpm.map(e => mean(e.slice(seg.start, seg.end + 1).filter(v => v !== null)));
    }

    return {
      startTime: Math.round((seg.start / sampleRate) * 100) / 100,
      duration: Math.round(duration * 100) / 100,
      motorMeans: motorMeans.map(v => Math.round(v)),
      motorStddevs: motorStddevs.map(v => Math.round(v * 10) / 10),
      gyroRms: Math.round(gyroRms * 10) / 10,
      erpmMeans: erpmMeans?.map(v => Math.round(v)) ?? null
    };
  });

  // Overall idle stability
  const allIdleMotorStddevs = idleAnalysis.flatMap(a => a.motorStddevs);
  const avgIdleStability = allIdleMotorStddevs.length > 0 ? mean(allIdleMotorStddevs) : 0;

  // Idle-to-flight transition analysis
  const transitions = [];
  for (const seg of idleSegments) {
    const transitionEnd = Math.min(seg.end + Math.round(sampleRate * 0.5), data.length - 1); // 500ms after idle
    if (transitionEnd <= seg.end) continue;

    const transMotors = motors.map(m => m.slice(seg.end, transitionEnd));
    const transGyro = gyroR.slice(seg.end, transitionEnd);
    const transThrottle = throttle.slice(seg.end, transitionEnd);

    // Response time: how quickly motors reach new throttle level
    const targetMotor = mean(transMotors[0].slice(-Math.round(sampleRate * 0.1)));
    const startMotor = transMotors[0][0] || 1000;
    const threshold63 = startMotor + (targetMotor - startMotor) * 0.63;
    let responseTime = null;
    for (let i = 0; i < transMotors[0].length; i++) {
      if (transMotors[0][i] >= threshold63) {
        responseTime = (i / sampleRate) * 1000; // ms
        break;
      }
    }

    // Gyro spike during transition
    const gyroSpike = Math.max(...transGyro.map(Math.abs));

    transitions.push({
      time: Math.round((seg.end / sampleRate) * 100) / 100,
      responseMs: responseTime !== null ? Math.round(responseTime * 10) / 10 : null,
      gyroSpike: Math.round(gyroSpike * 10) / 10,
      motorDelta: Math.round(targetMotor - startMotor)
    });
  }

  // Motor desync detection at idle
  let desyncEvents = 0;
  for (const seg of idleSegments) {
    for (let i = seg.start; i < seg.end; i++) {
      const vals = motors.map(m => m[i]);
      const maxDiff = Math.max(...vals) - Math.min(...vals);
      if (maxDiff > 200) desyncEvents++;
    }
  }
  const totalIdleSamples = idleSegments.reduce((s, seg) => s + (seg.end - seg.start), 0);
  const desyncRate = totalIdleSamples > 0 ? (desyncEvents / totalIdleSamples) * 100 : 0;

  // eRPM analysis if available
  let erpmAnalysis = null;
  if (hasErpm) {
    const allErpm = erpm.flatMap(e => e.filter(v => v !== null && v > 0));
    const minErpm = allErpm.length > 0 ? Math.min(...allErpm.slice(0, 10000)) : 0;
    // Betaflight: mechanical RPM = eRPM * 2 / motor_poles  (ref: blackbox-log-viewer)
    // Prefer CLI param; fall back to BBL parsedMeta; default 14 (7 pole-pairs)
    const poles = cliParams?.motor?.poles ?? blackboxData?.parsedMeta?.motor_poles ?? 14;
    const actualMinRpm = (minErpm * 2) / poles;
    erpmAnalysis = {
      minErpm: Math.round(minErpm),
      minRpm: Math.round(actualMinRpm),
      configuredMinRpm: dynIdleConfig.minRpm,
      headroom: Math.round(actualMinRpm - dynIdleConfig.minRpm)
    };
  }

  // Health score
  let healthScore = 100;
  healthScore -= clamp(avgIdleStability * 2, 0, 25);
  healthScore -= clamp(desyncRate * 5, 0, 25);
  if (transitions.length > 0) {
    const avgResponse = mean(transitions.filter(t => t.responseMs !== null).map(t => t.responseMs));
    healthScore -= clamp((avgResponse - 20) * 0.5, 0, 15);
    const avgSpike = mean(transitions.map(t => t.gyroSpike));
    healthScore -= clamp(avgSpike / 10, 0, 15);
  }
  if (!dynIdleConfig.enabled) healthScore -= 10;
  healthScore = Math.round(clamp(healthScore, 0, 100));

  let healthLevel;
  if (healthScore >= 85) healthLevel = 'Excellent';
  else if (healthScore >= 70) healthLevel = 'Good';
  else if (healthScore >= 50) healthLevel = 'Fair';
  else healthLevel = 'Poor';

  // Recommendations with exact values
  const recommendations = [];
  if (!dynIdleConfig.enabled) {
    recommendations.push({
      message: 'Dynamic Idle is disabled (min_rpm = 0). Enable with dyn_idle_min_rpm = 30 for idle stability and desync protection.',
      param: 'dyn_idle_min_rpm',
      currentValue: 0,
      suggestedValue: 30,
      command: 'set dyn_idle_min_rpm = 30',
      severity: 'warning',
    });
  }
  if (desyncRate > 5) {
    const currentMinRpm = dynIdleConfig.minRpm;
    // Scale increase proportional to desync rate
    const desyncSeverity = clamp((desyncRate - 5) / 20, 0, 1);
    const increase = Math.round(5 + 15 * desyncSeverity); // 5-20 RPM units
    const suggestedMinRpm = clamp(currentMinRpm + increase, 20, 80);
    recommendations.push({
      message: `Motor desync at ${desyncRate.toFixed(1)}% of idle time. Increase dyn_idle_min_rpm from ${currentMinRpm} → ${suggestedMinRpm}.`,
      param: 'dyn_idle_min_rpm',
      currentValue: currentMinRpm,
      suggestedValue: suggestedMinRpm,
      command: `set dyn_idle_min_rpm = ${suggestedMinRpm}`,
      severity: 'warning',
    });
  }
  if (avgIdleStability > 30) {
    const currentPGain = dynIdleConfig.pGain;
    const stabSeverity = clamp((avgIdleStability - 30) / 40, 0, 1);
    const increase = Math.round(10 + 20 * stabSeverity);
    const suggestedPGain = clamp(currentPGain + increase, 30, 100);
    recommendations.push({
      message: `High idle motor variance (stddev: ${avgIdleStability.toFixed(1)}). Increase dyn_idle_p_gain from ${currentPGain} → ${suggestedPGain}.`,
      param: 'dyn_idle_p_gain',
      currentValue: currentPGain,
      suggestedValue: suggestedPGain,
      command: `set dyn_idle_p_gain = ${suggestedPGain}`,
      severity: 'info',
    });
  }
  if (transitions.length > 0) {
    const avgResponse = mean(transitions.filter(t => t.responseMs).map(t => t.responseMs));
    if (avgResponse > 50) {
      const currentMaxIncrease = dynIdleConfig.maxIncrease;
      const responseSeverity = clamp((avgResponse - 50) / 100, 0, 1);
      const increase = Math.round(20 + 30 * responseSeverity);
      const suggestedMaxIncrease = clamp(currentMaxIncrease + increase, 100, 250);
      recommendations.push({
        message: `Slow idle-to-flight transition (avg ${Math.round(avgResponse)}ms). Increase dyn_idle_max_increase from ${currentMaxIncrease} → ${suggestedMaxIncrease}.`,
        param: 'dyn_idle_max_increase',
        currentValue: currentMaxIncrease,
        suggestedValue: suggestedMaxIncrease,
        command: `set dyn_idle_max_increase = ${suggestedMaxIncrease}`,
        severity: 'info',
      });
    }
  }
  if (erpmAnalysis && erpmAnalysis.headroom < 500) {
    const currentMinRpm = dynIdleConfig.minRpm;
    const headroomDeficit = 500 - erpmAnalysis.headroom;
    const rpmIncrease = Math.round(headroomDeficit / 100); // each unit = ~100 RPM
    const suggestedMinRpm = clamp(currentMinRpm + rpmIncrease, 20, 80);
    recommendations.push({
      message: `Low RPM headroom (${erpmAnalysis.headroom} RPM, min eRPM: ${erpmAnalysis.minErpm}). Increase dyn_idle_min_rpm from ${currentMinRpm} → ${suggestedMinRpm}.`,
      param: 'dyn_idle_min_rpm',
      currentValue: currentMinRpm,
      suggestedValue: suggestedMinRpm,
      command: `set dyn_idle_min_rpm = ${suggestedMinRpm}`,
      severity: 'warning',
    });
  }

  // CLI recommendations — aggregate from structured recommendations
  const cliChanges = {};
  for (const rec of recommendations) {
    if (rec.param && rec.suggestedValue != null) {
      cliChanges[rec.param] = rec.suggestedValue;
    }
  }

  return {
    healthScore,
    healthLevel,
    dynIdleConfig,
    idleSegmentCount: idleSegments.length,
    idleAnalysis: idleAnalysis.slice(0, 10),
    avgIdleStability: Math.round(avgIdleStability * 10) / 10,
    transitions: transitions.slice(0, 10),
    desyncRate: Math.round(desyncRate * 10) / 10,
    erpmAnalysis,
    hasErpm,
    recommendations,
    cliChanges,
    sampleRate
  };
}

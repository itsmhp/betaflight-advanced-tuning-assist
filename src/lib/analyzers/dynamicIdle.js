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

  // Recommendations
  const recommendations = [];
  if (!dynIdleConfig.enabled) {
    recommendations.push('Dynamic Idle is disabled (min_rpm = 0). Enable it for better idle stability and desync protection.');
  }
  if (desyncRate > 5) {
    recommendations.push(`Motor desync detected at ${desyncRate.toFixed(1)}% of idle time. Increase dyn_idle_min_rpm by 500-1000.`);
  }
  if (avgIdleStability > 30) {
    recommendations.push('High idle motor variance. Increase dyn_idle_p_gain for tighter RPM control.');
  }
  if (transitions.length > 0) {
    const avgResponse = mean(transitions.filter(t => t.responseMs).map(t => t.responseMs));
    if (avgResponse > 50) {
      recommendations.push('Slow idle-to-flight transition. Increase dyn_idle_max_increase for faster response.');
    }
  }
  if (erpmAnalysis && erpmAnalysis.headroom < 500) {
    recommendations.push(`Low RPM headroom (${erpmAnalysis.headroom}). Increase dyn_idle_min_rpm for desync protection.`);
  }

  // CLI recommendations
  const cliChanges = {};
  if (!dynIdleConfig.enabled) {
    cliChanges.dyn_idle_min_rpm = 30;
  }
  if (desyncRate > 5 && dynIdleConfig.minRpm < 40) {
    cliChanges.dyn_idle_min_rpm = Math.min(dynIdleConfig.minRpm + 10, 60);
  }
  if (avgIdleStability > 30 && dynIdleConfig.pGain < 80) {
    cliChanges.dyn_idle_p_gain = Math.min(dynIdleConfig.pGain + 15, 100);
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

// ─── 13. Motor Doctor ───
import { rms, mean, stddev, percentile, clamp, pearsonCorrelation, magnitudeSpectrum, hanning, toDb } from '../utils.js';

export function analyzeMotors(blackboxData) {
  const data = blackboxData.data;
  const sampleRate = blackboxData.sampleRate || 2000;

  const motorCount = 4;
  const motors = [];
  for (let i = 0; i < motorCount; i++) {
    const values = data.map(r => r[`motor${i}`] ?? r[`motor-${i}`] ?? 0);
    motors.push(values);
  }

  const gyroR = data.map(r => r['roll-gyro'] ?? r['gyroADC-roll'] ?? 0);
  const gyroP = data.map(r => r['pitch-gyro'] ?? r['gyroADC-pitch'] ?? 0);
  const throttle = data.map(r => r.throttle ?? r['rcCommand-3'] ?? 0);

  // Per-motor statistics
  const motorStats = motors.map((m, idx) => {
    const rmVal = rms(m);
    const avg = mean(m);
    const sd = stddev(m);
    const p5 = percentile(m, 5);
    const p95 = percentile(m, 95);
    const range = p95 - p5;

    // Saturation — how often motor is at min or max
    const minSat = m.filter(v => v < 1050).length / (m.length || 1);
    const maxSat = m.filter(v => v > 1950).length / (m.length || 1);

    // Noise via std of derivative
    const deriv = m.slice(1).map((v, i) => v - m[i]);
    const noise = stddev(deriv);

    // Motor-gyro correlation
    const dsMotor = m.filter((_, i) => i % 10 === 0);
    const dsGyroR = gyroR.filter((_, i) => i % 10 === 0);
    const dsGyroP = gyroP.filter((_, i) => i % 10 === 0);
    const corrRoll = pearsonCorrelation(dsMotor, dsGyroR);
    const corrPitch = pearsonCorrelation(dsMotor, dsGyroP);

    return {
      motor: idx + 1,
      mean: Math.round(avg),
      rms: Math.round(rmVal),
      stddev: Math.round(sd),
      p5: Math.round(p5),
      p95: Math.round(p95),
      range: Math.round(range),
      minSaturation: Math.round(minSat * 1000) / 10,
      maxSaturation: Math.round(maxSat * 1000) / 10,
      noise: Math.round(noise * 10) / 10,
      corrRoll: Math.round(corrRoll * 100) / 100,
      corrPitch: Math.round(corrPitch * 100) / 100
    };
  });

  // Motor balance analysis — compare means
  const motorMeans = motorStats.map(s => s.mean);
  const avgMean = mean(motorMeans);
  const balanceDeviation = stddev(motorMeans);
  const balancePercent = avgMean > 0 ? (balanceDeviation / avgMean) * 100 : 0;

  // Identify imbalanced motor pairs
  const frontBack = Math.abs((motorMeans[0] + motorMeans[1]) / 2 - (motorMeans[2] + motorMeans[3]) / 2);
  const leftRight = Math.abs((motorMeans[0] + motorMeans[3]) / 2 - (motorMeans[1] + motorMeans[2]) / 2);
  const diagonal = Math.abs((motorMeans[0] + motorMeans[2]) / 2 - (motorMeans[1] + motorMeans[3]) / 2);

  // CG offset estimation
  let cgOffsetDirection = 'Centered';
  if (frontBack > leftRight && frontBack > 20) cgOffsetDirection = frontBack > 0 ? 'Rear-heavy' : 'Front-heavy';
  else if (leftRight > frontBack && leftRight > 20) cgOffsetDirection = leftRight > 0 ? 'Left-heavy' : 'Right-heavy';

  // Motor FFT analysis for vibration signature
  const motorFFT = motors.map((m, idx) => {
    const chunk = m.slice(0, Math.min(m.length, 4096));
    const mag = magnitudeSpectrum(chunk, hanning);
    const freqRes = sampleRate / (mag.length * 2);
    const magDb = Array.from(mag).map(v => toDb(v));

    const sorted = [...magDb].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.5)];

    const peaks = [];
    for (let i = 2; i < magDb.length - 2; i++) {
      const freq = i * freqRes;
      if (freq < 20 || freq > sampleRate / 2) continue;
      if (magDb[i] > magDb[i - 1] && magDb[i] > magDb[i + 1] && magDb[i] > noiseFloor + 8) {
        peaks.push({ frequency: Math.round(freq), magnitude: Math.round(magDb[i] * 10) / 10 });
      }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    return { motor: idx + 1, peaks: peaks.slice(0, 5), noiseFloor: Math.round(noiseFloor * 10) / 10 };
  });

  // Throttle response analysis
  const dsThrottle = throttle.filter((_, i) => i % 10 === 0);
  const motorResponsiveness = motors.map((m, idx) => {
    const dsM = m.filter((_, i) => i % 10 === 0);
    return { motor: idx + 1, throttleCorr: Math.round(pearsonCorrelation(dsThrottle, dsM) * 100) / 100 };
  });

  // Health per motor
  const motorHealth = motorStats.map((s, idx) => {
    let score = 100;
    score -= clamp(balancePercent * 5, 0, 20);
    score -= clamp(s.maxSaturation * 2, 0, 15);
    score -= clamp(s.minSaturation * 1, 0, 10);
    score -= clamp(s.noise / 10, 0, 15);
    score -= clamp(Math.abs(s.corrRoll) > 0.5 ? (Math.abs(s.corrRoll) - 0.5) * 40 : 0, 0, 20);
    score -= clamp(Math.abs(s.corrPitch) > 0.5 ? (Math.abs(s.corrPitch) - 0.5) * 40 : 0, 0, 20);
    return { motor: idx + 1, score: Math.round(clamp(score, 0, 100)) };
  });

  const overallScore = Math.round(mean(motorHealth.map(h => h.score)));
  let healthLevel;
  if (overallScore >= 85) healthLevel = 'Excellent';
  else if (overallScore >= 70) healthLevel = 'Good';
  else if (overallScore >= 50) healthLevel = 'Fair';
  else healthLevel = 'Poor';

  // Recommendations with exact measured data
  const recommendations = [];
  if (balancePercent > 5) {
    recommendations.push({
      message: `Motor balance deviation: ${balancePercent.toFixed(1)}% (motor means: ${motorMeans.join(', ')}). F/B diff: ${frontBack}, L/R diff: ${leftRight}. Check prop balance, CG position.`,
      severity: 'warning',
    });
  }
  if (cgOffsetDirection !== 'Centered') {
    recommendations.push({
      message: `CG offset: ${cgOffsetDirection} (F/B: ${frontBack}, L/R: ${leftRight}, Diag: ${diagonal}). Adjust battery position.`,
      severity: 'info',
    });
  }
  for (const s of motorStats) {
    if (s.maxSaturation > 5) {
      recommendations.push({
        message: `Motor ${s.motor}: ${s.maxSaturation}% at max output (mean: ${s.mean}, P95: ${s.p95}). Consider larger props or higher KV.`,
        severity: 'warning',
      });
    }
    if (s.noise > 50) {
      recommendations.push({
        message: `Motor ${s.motor}: Command noise ${s.noise} (threshold: 50, stddev of derivative). Possible ESC issue or bearing wear.`,
        severity: 'warning',
      });
    }
  }
  for (const fft of motorFFT) {
    if (fft.peaks.length > 3) {
      const peakStr = fft.peaks.slice(0, 3).map(p => `${p.frequency}Hz (${p.magnitude}dB)`).join(', ');
      recommendations.push({
        message: `Motor ${fft.motor}: ${fft.peaks.length} vibration peaks detected (${peakStr}). Inspect prop and motor.`,
        severity: 'info',
      });
    }
  }

  return {
    overallScore,
    healthLevel,
    motorStats,
    motorHealth,
    motorFFT,
    motorResponsiveness,
    balancePercent: Math.round(balancePercent * 10) / 10,
    cgOffsetDirection,
    frontBackDiff: Math.round(frontBack),
    leftRightDiff: Math.round(leftRight),
    diagonalDiff: Math.round(diagonal),
    recommendations,
    sampleRate
  };
}

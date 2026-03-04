// ─── 11. Prop Wash Detection Tool ───
import { rms, mean, pearsonCorrelation, magnitudeSpectrum, hamming, clamp } from '../utils.js';

export function analyzePropWash(blackboxData) {
  const sampleRate = blackboxData.sampleRate || 2000;
  const gyroR = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
  const gyroP = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
  const gyroY = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);
  const motors = [0, 1, 2, 3].map(i => blackboxData.data.map(r => r[`motor${i}`] ?? 0));

  // FFT for frequency band classification
  const analyzeFreqBands = (signal) => {
    const chunk = signal.slice(0, Math.min(signal.length, 8192));
    const mag = magnitudeSpectrum(chunk, hamming);
    const freqRes = sampleRate / (mag.length * 2);

    let pilotInput = 0, propWash = 0, resonance = 0, motorNoise = 0, total = 0;
    for (let i = 0; i < mag.length; i++) {
      const freq = i * freqRes;
      const energy = mag[i] ** 2;
      total += energy;
      if (freq < 20) pilotInput += energy;
      else if (freq <= 100) propWash += energy;
      else if (freq <= 250) resonance += energy;
      else motorNoise += energy;
    }
    total = total || 1;
    return {
      pilotInput: pilotInput / total,
      propWash: propWash / total,
      resonance: resonance / total,
      motorNoise: motorNoise / total
    };
  };

  const rollBands = analyzeFreqBands(gyroR);
  const pitchBands = analyzeFreqBands(gyroP);

  // FIR bandpass filter (20-100 Hz approximation via simple difference)
  const bandpass = (signal) => {
    // Simple approach: subtract low-freq trend and high-freq noise
    const result = new Float64Array(signal.length);
    const lpWindow = Math.round(sampleRate / 20); // 20 Hz low cut
    const hpWindow = Math.round(sampleRate / 100); // 100 Hz high cut
    for (let i = 0; i < signal.length; i++) {
      // Low-pass at 100 Hz
      let lpSum = 0, lpCount = 0;
      for (let j = Math.max(0, i - hpWindow); j <= Math.min(signal.length - 1, i + hpWindow); j++) {
        lpSum += signal[j]; lpCount++;
      }
      const lp = lpSum / lpCount;

      // High-pass at 20 Hz (subtract moving average)  
      let hpSum = 0, hpCount = 0;
      for (let j = Math.max(0, i - lpWindow); j <= Math.min(signal.length - 1, i + lpWindow); j++) {
        hpSum += signal[j]; hpCount++;
      }
      const hp = hpSum / hpCount;

      result[i] = lp - hp;
    }
    return result;
  };

  // Prop wash event detection via windowed RMS
  const windowSize = Math.round(sampleRate * 0.1);
  const hopSize = Math.round(windowSize * 0.5);
  const filteredR = bandpass(gyroR);
  const filteredP = bandpass(gyroP);

  const events = [];
  let totalWindows = 0;

  for (let start = 0; start + windowSize < gyroR.length; start += hopSize) {
    totalWindows++;
    const windowR = Array.from(filteredR.slice(start, start + windowSize));
    const windowP = Array.from(filteredP.slice(start, start + windowSize));
    const avgRMS = (rms(windowR) + rms(windowP)) / 2;

    // Motor activity
    let motorActivity = 0;
    for (const m of motors) {
      const chunk = m.slice(start, start + windowSize);
      const mRange = Math.max(...chunk) - Math.min(...chunk);
      motorActivity += mRange;
    }
    motorActivity /= motors.length;

    if (avgRMS > 15 && motorActivity > 1000) {
      const severity = Math.min(1, avgRMS / 50);
      events.push({ startSample: start, avgRMS: Math.round(avgRMS * 10) / 10, motorActivity: Math.round(motorActivity), severity });
    }
  }

  // Motor-gyro correlation
  const correlations = [];
  const dsStep = 10;
  const dsGyroR = gyroR.filter((_, i) => i % dsStep === 0);
  const dsGyroP = gyroP.filter((_, i) => i % dsStep === 0);
  const dsGyroY = gyroY.filter((_, i) => i % dsStep === 0);
  for (let m = 0; m < motors.length; m++) {
    const dsMotor = motors[m].filter((_, i) => i % dsStep === 0);
    correlations.push({ motor: m, roll: pearsonCorrelation(dsMotor, dsGyroR) });
    correlations.push({ motor: m, pitch: pearsonCorrelation(dsMotor, dsGyroP) });
    correlations.push({ motor: m, yaw: pearsonCorrelation(dsMotor, dsGyroY) });
  }
  const maxCorrelation = Math.max(...correlations.map(c => Math.abs(c.roll || c.pitch || c.yaw || 0)));

  // Overall severity score
  const eventRatio = totalWindows > 0 ? events.length / totalWindows : 0;
  const avgSeverity = events.length > 0 ? mean(events.map(e => e.severity)) : 0;
  const frequencyScore = (rollBands.propWash + pitchBands.propWash) / 2;
  const correlationScore = maxCorrelation;

  const severityScore = clamp(
    0.4 * eventRatio + 0.3 * avgSeverity + 0.2 * frequencyScore + 0.1 * correlationScore,
    0, 1
  );

  let severityLevel;
  if (severityScore > 0.8) severityLevel = 'Severe';
  else if (severityScore > 0.6) severityLevel = 'Moderate';
  else if (severityScore > 0.3) severityLevel = 'Mild';
  else severityLevel = 'Minimal';

  // Recommendations
  const recommendations = [];
  if (severityLevel === 'Severe') {
    recommendations.push('Check props for damage, balance, and wear.');
    recommendations.push('Inspect motors for bearing play or debris.');
    recommendations.push('Verify frame integrity — check for cracks or loose screws.');
    recommendations.push('Review ESC settings (motor timing, PWM frequency).');
  } else if (severityLevel === 'Moderate') {
    recommendations.push('Balance props to reduce vibrations.');
    recommendations.push('Add FC soft mounting or vibration isolation.');
    recommendations.push('Consider dampening frame flex points.');
  } else if (severityLevel === 'Mild') {
    recommendations.push('Monitor for worsening. Minor prop/mount adjustments may help.');
  }

  const maxGyroRMS = rms(gyroR);
  if (maxGyroRMS > 30) {
    recommendations.push('⚠ High Vibration Levels: Gyro RMS > 30 °/s — address mechanical issues.');
  }
  if (maxCorrelation > 0.6) {
    recommendations.push('⚠ Motor-Gyro Interference: High correlation detected — isolate FC from motors.');
  }

  return {
    severityScore: Math.round(severityScore * 100) / 100,
    severityLevel,
    eventCount: events.length,
    totalWindows,
    eventRatio: Math.round(eventRatio * 100),
    avgSeverity: Math.round(avgSeverity * 100) / 100,
    frequencyBands: { roll: rollBands, pitch: pitchBands },
    maxCorrelation: Math.round(maxCorrelation * 100) / 100,
    recommendations,
    events: events.slice(0, 50),
    correlations
  };
}

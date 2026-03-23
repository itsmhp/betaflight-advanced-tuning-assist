// ─── 11. Prop Wash Detection Tool ───
import { rms, mean, pearsonCorrelation, magnitudeSpectrum, hamming, clamp } from '../utils.js';

export function analyzePropWash(blackboxData, cliParams) {
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

  // Recommendations with exact CLI values
  const recommendations = [];
  const cliChanges = {};

  // Read current settings
  const currentDMin = {
    roll: cliParams?.pid?.roll?.dMin ?? 20,
    pitch: cliParams?.pid?.pitch?.dMin ?? 22,
  };
  const currentD = {
    roll: cliParams?.pid?.roll?.d ?? 35,
    pitch: cliParams?.pid?.pitch?.d ?? 38,
  };

  if (severityLevel === 'Severe' || severityLevel === 'Moderate') {
    // Increase D gain proportional to prop wash severity to add damping
    const severityFactor = severityLevel === 'Severe' ? 0.20 : 0.10;
    for (const axis of ['roll', 'pitch']) {
      const dIncrease = Math.round(currentD[axis] * severityFactor);
      const suggestedD = clamp(currentD[axis] + dIncrease, 15, 120);
      const dMinIncrease = Math.round(currentDMin[axis] * severityFactor);
      const suggestedDMin = clamp(currentDMin[axis] + dMinIncrease, 10, 80);

      if (suggestedD !== currentD[axis]) {
        cliChanges[`d_${axis}`] = suggestedD;
        recommendations.push({
          message: `${axis}: Prop wash detected (severity: ${severityScore}). Increase D from ${currentD[axis]} → ${suggestedD} for damping.`,
          param: `d_${axis}`,
          currentValue: currentD[axis],
          suggestedValue: suggestedD,
          command: `set d_${axis} = ${suggestedD}`,
          severity: 'warning',
        });
      }
      if (suggestedDMin !== currentDMin[axis]) {
        cliChanges[`d_min_${axis}`] = suggestedDMin;
        recommendations.push({
          message: `${axis}: Raise d_min from ${currentDMin[axis]} → ${suggestedDMin} to maintain damping at low setpoints.`,
          param: `d_min_${axis}`,
          currentValue: currentDMin[axis],
          suggestedValue: suggestedDMin,
          command: `set d_min_${axis} = ${suggestedDMin}`,
          severity: 'info',
        });
      }
    }

    // Suggest dynamic notch tuning if frequency analysis shows prop wash peaks
    const pwBandEnergy = (rollBands.propWash + pitchBands.propWash) / 2;
    if (pwBandEnergy > 0.15) {
      const suggestedDynNotchMin = 40; // Typical prop wash is 20-100Hz, notch should reach down
      const currentDynNotchMin = cliParams?.dynNotch?.minHz ?? 150;
      if (currentDynNotchMin > 60) {
        cliChanges.dyn_notch_min_hz = suggestedDynNotchMin;
        recommendations.push({
          message: `Prop wash band energy ${Math.round(pwBandEnergy * 100)}%. Lower dyn_notch_min_hz from ${currentDynNotchMin} → ${suggestedDynNotchMin} to capture prop wash frequencies.`,
          param: 'dyn_notch_min_hz',
          currentValue: currentDynNotchMin,
          suggestedValue: suggestedDynNotchMin,
          command: `set dyn_notch_min_hz = ${suggestedDynNotchMin}`,
          severity: 'info',
        });
      }
    }
  }

  if (severityLevel === 'Severe') {
    recommendations.push({
      message: `Severe prop wash (${events.length} events in ${totalWindows} windows). Check props for damage, motor bearings, and frame integrity.`,
      severity: 'warning',
    });
  }

  const maxGyroRMS = rms(gyroR);
  if (maxGyroRMS > 30) {
    recommendations.push({
      message: `High vibration: Gyro RMS ${Math.round(maxGyroRMS)} °/s (threshold: 30). Address mechanical issues.`,
      severity: 'warning',
    });
  }
  if (maxCorrelation > 0.6) {
    recommendations.push({
      message: `Motor-Gyro correlation ${Math.round(maxCorrelation * 100)}% — isolate FC from motor vibration.`,
      severity: 'warning',
    });
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
    cliChanges,
    events: events.slice(0, 50),
    correlations
  };
}

// ─── 5. Filter Analyzer / Noise Profile ───
import { magnitudeSpectrum, hanning, toDb, mean, pearsonCorrelation, clamp } from '../utils.js';

export function analyzeFilters(blackboxData, cliParams) {
  const sampleRate = blackboxData.sampleRate || 2000;
  const gyroRoll = blackboxData.data.map(r => r['roll-gyro'] ?? 0);
  const gyroPitch = blackboxData.data.map(r => r['pitch-gyro'] ?? 0);
  const gyroYaw = blackboxData.data.map(r => r['yaw-gyro'] ?? 0);
  const throttle = blackboxData.data.map(r => r.throttle ?? 0);

  // FFT analysis per axis
  const analyzeAxis = (signal, axisName) => {
    // Take a reasonable chunk (up to 8192 samples)
    const chunk = signal.slice(0, Math.min(signal.length, 8192));
    const mag = magnitudeSpectrum(chunk, hanning);
    const freqResolution = sampleRate / (mag.length * 2);

    // Convert to dB
    const magDb = Array.from(mag).map(v => toDb(v));

    // Noise floor (median of bottom 50%)
    const sorted = [...magDb].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.5)];

    // Peak detection (> 6 dB above noise floor)
    const peaks = [];
    for (let i = 2; i < magDb.length - 2; i++) {
      const freq = i * freqResolution;
      if (freq < 10 || freq > sampleRate / 2) continue;
      if (magDb[i] > magDb[i - 1] && magDb[i] > magDb[i + 1] && magDb[i] > noiseFloor + 6) {
        peaks.push({ frequency: Math.round(freq), magnitude: Math.round(magDb[i] * 10) / 10, index: i });
      }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    // SNR calculation
    const signalPower = mean(magDb.filter(v => v > noiseFloor + 3));
    const snr = Math.round((signalPower - noiseFloor) * 10) / 10;

    return {
      axis: axisName,
      peaks: peaks.slice(0, 10),
      noiseFloor: Math.round(noiseFloor * 10) / 10,
      snr,
      freqResolution,
      magDb: magDb.filter((_, i) => i * freqResolution <= 1000) // up to 1kHz
    };
  };

  const rollFFT = analyzeAxis(gyroRoll, 'Roll');
  const pitchFFT = analyzeAxis(gyroPitch, 'Pitch');
  const yawFFT = analyzeAxis(gyroYaw, 'Yaw');

  // Overall SNR (worst axis)
  const worstSNR = Math.min(rollFFT.snr, pitchFFT.snr, yawFFT.snr);

  // Filter recommendations based on SNR
  let filterCategory, gyroLpfRec, dtermLpfRec;
  if (worstSNR > -3) {
    filterCategory = 'Aggressive (Noisy)';
    gyroLpfRec = 140;
    dtermLpfRec = 115;
  } else if (worstSNR > -10) {
    filterCategory = 'Moderate';
    gyroLpfRec = 200;
    dtermLpfRec = 150;
  } else {
    filterCategory = 'Relaxed (Clean)';
    gyroLpfRec = 280;
    dtermLpfRec = 200;
  }

  // Throttle-noise correlation
  const noiseAmplitude = gyroRoll.map((r, i) =>
    Math.sqrt(r ** 2 + (gyroPitch[i] ?? 0) ** 2 + (gyroYaw[i] ?? 0) ** 2)
  );
  // Downsample for correlation
  const dsThrottle = throttle.filter((_, i) => i % 20 === 0);
  const dsNoise = noiseAmplitude.filter((_, i) => i % 20 === 0);
  const throttleCorrelation = pearsonCorrelation(dsThrottle, dsNoise);

  if (Math.abs(throttleCorrelation) >= 0.25) {
    gyroLpfRec = Math.min(gyroLpfRec, 230);
  }

  // RPM filter adjustment
  const hasRpmFilter = cliParams?.rpmFilter?.harmonics > 0 && cliParams?.motor?.dshotBidir === 'ON';
  if (hasRpmFilter) {
    gyroLpfRec = Math.round(gyroLpfRec * 1.15);
    dtermLpfRec = Math.round(dtermLpfRec * 1.05);
  }

  // Dynamic notch recommendations
  const allPeaks = [...rollFFT.peaks, ...pitchFFT.peaks, ...yawFFT.peaks];
  const peakFreqs = allPeaks.map(p => p.frequency).filter(f => f > 50 && f < 500);

  let dynNotchMinHz = 150, dynNotchMaxHz = 600;
  if (peakFreqs.length > 0) {
    dynNotchMinHz = Math.max(50, Math.min(...peakFreqs) - 30);
    dynNotchMaxHz = Math.min(800, Math.max(...peakFreqs) + 50);
  }

  // Static notch for prominent peaks
  const staticNotches = [];
  const prominentPeaks = allPeaks.filter(p => p.magnitude > (rollFFT.noiseFloor + 12));
  for (const peak of prominentPeaks.slice(0, 2)) {
    const q = clamp(Math.round(peak.frequency / 25), 3, 15);
    staticNotches.push({ frequency: peak.frequency, q });
  }

  // Generate CLI changes
  const cliChanges = {};
  const current = cliParams || {};

  if (gyroLpfRec !== (current.gyroLpf2?.staticHz ?? 0)) {
    cliChanges.gyro_lpf2_static_hz = gyroLpfRec;
  }
  if (dtermLpfRec !== (current.dtermLpf1?.staticHz ?? 0)) {
    cliChanges.dterm_lpf1_static_hz = dtermLpfRec;
    cliChanges.dterm_lpf1_dyn_min_hz = dtermLpfRec;
    cliChanges.dterm_lpf1_dyn_max_hz = dtermLpfRec * 2;
  }
  if (dynNotchMinHz !== (current.dynNotch?.minHz ?? 150)) {
    cliChanges.dyn_notch_min_hz = dynNotchMinHz;
  }
  if (dynNotchMaxHz !== (current.dynNotch?.maxHz ?? 600)) {
    cliChanges.dyn_notch_max_hz = dynNotchMaxHz;
  }

  return {
    rollFFT, pitchFFT, yawFFT,
    worstSNR,
    filterCategory,
    gyroLpfRec,
    dtermLpfRec,
    throttleCorrelation: Math.round(throttleCorrelation * 100) / 100,
    hasRpmFilter,
    dynNotchMinHz,
    dynNotchMaxHz,
    staticNotches,
    cliChanges,
    sampleRate
  };
}

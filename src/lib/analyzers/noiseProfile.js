// ─── 14. Noise Profile Tool ───
import { magnitudeSpectrum, hanning, hamming, toDb, mean, rms, stddev, clamp, pearsonCorrelation, nextPow2 } from '../utils.js';

export function analyzeNoiseProfile(blackboxData) {
  const data = blackboxData.data;
  const sampleRate = blackboxData.sampleRate || 2000;

  const gyroR = data.map(r => r['roll-gyro'] ?? r['gyroADC-roll'] ?? 0);
  const gyroP = data.map(r => r['pitch-gyro'] ?? r['gyroADC-pitch'] ?? 0);
  const gyroY = data.map(r => r['yaw-gyro'] ?? r['gyroADC-yaw'] ?? 0);
  const throttle = data.map(r => r.throttle ?? r['rcCommand-3'] ?? 0);

  // Unfiltered gyro if available
  const gyroUnfiltR = data.map(r => r['gyroUnfilt-roll'] ?? r['gyroUnfilt-0'] ?? null);
  const gyroUnfiltP = data.map(r => r['gyroUnfilt-pitch'] ?? r['gyroUnfilt-1'] ?? null);
  const hasUnfiltered = gyroUnfiltR[0] !== null;

  const analyzeNoise = (signal, label) => {
    const chunkSize = Math.min(signal.length, 8192);
    const chunk = signal.slice(0, chunkSize);
    const mag = magnitudeSpectrum(chunk, hanning);
    const freqRes = sampleRate / (mag.length * 2);
    const magDb = Array.from(mag).map(v => toDb(v));

    // Frequency band energy analysis
    const bands = {
      pilotInput: { min: 0, max: 20, energy: 0, label: 'Pilot Input (0-20Hz)' },
      propWash: { min: 20, max: 100, energy: 0, label: 'Prop Wash (20-100Hz)' },
      mechanical: { min: 100, max: 250, energy: 0, label: 'Mechanical (100-250Hz)' },
      electrical: { min: 250, max: 500, energy: 0, label: 'Electrical (250-500Hz)' },
      highFreq: { min: 500, max: sampleRate / 2, energy: 0, label: `High Freq (500-${Math.round(sampleRate / 2)}Hz)` }
    };

    let totalEnergy = 0;
    for (let i = 0; i < mag.length; i++) {
      const freq = i * freqRes;
      const energy = mag[i] ** 2;
      totalEnergy += energy;
      for (const band of Object.values(bands)) {
        if (freq >= band.min && freq < band.max) band.energy += energy;
      }
    }
    totalEnergy = totalEnergy || 1;

    for (const band of Object.values(bands)) {
      band.percent = Math.round((band.energy / totalEnergy) * 1000) / 10;
    }

    // Noise floor (bottom 40th percentile of magnitudes)
    const sorted = [...magDb].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.4)];

    // Peak detection
    const peaks = [];
    for (let i = 3; i < magDb.length - 3; i++) {
      const freq = i * freqRes;
      if (freq < 10 || freq > sampleRate / 2) continue;
      if (magDb[i] > magDb[i - 1] && magDb[i] > magDb[i + 1] &&
          magDb[i] > magDb[i - 2] && magDb[i] > magDb[i + 2] &&
          magDb[i] > noiseFloor + 6) {
        peaks.push({ frequency: Math.round(freq), magnitude: Math.round(magDb[i] * 10) / 10 });
      }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    // Noise amplitude
    const noiseRms = rms(signal);

    return {
      label,
      bands,
      noiseFloor: Math.round(noiseFloor * 10) / 10,
      peaks: peaks.slice(0, 8),
      noiseRms: Math.round(noiseRms * 10) / 10,
      freqRes,
      spectrum: magDb.filter((_, i) => i * freqRes <= 1000)
    };
  };

  const rollProfile = analyzeNoise(gyroR, 'Roll');
  const pitchProfile = analyzeNoise(gyroP, 'Pitch');
  const yawProfile = analyzeNoise(gyroY, 'Yaw');

  // Unfiltered vs filtered comparison
  let filterEffectiveness = null;
  if (hasUnfiltered) {
    const unfiltRms = rms(gyroUnfiltR.filter(v => v !== null));
    const filtRms = rms(gyroR);
    const reduction = unfiltRms > 0 ? ((unfiltRms - filtRms) / unfiltRms) * 100 : 0;
    filterEffectiveness = {
      unfilteredRms: Math.round(unfiltRms * 10) / 10,
      filteredRms: Math.round(filtRms * 10) / 10,
      reductionPercent: Math.round(reduction * 10) / 10
    };
  }

  // Throttle-dependent noise analysis (segment into throttle bands)
  const throttleBands = [
    { min: 0, max: 25, label: 'Idle (0-25%)' },
    { min: 25, max: 50, label: 'Cruise (25-50%)' },
    { min: 50, max: 75, label: 'Mid (50-75%)' },
    { min: 75, max: 100, label: 'Full (75-100%)' }
  ];

  const throttleNoise = throttleBands.map(band => {
    const indices = [];
    for (let i = 0; i < throttle.length; i++) {
      const pct = ((throttle[i] - 1000) / 1000) * 100;
      if (pct >= band.min && pct < band.max) indices.push(i);
    }
    if (indices.length < 100) return { ...band, rollRms: null, pitchRms: null, samples: indices.length };

    const rollSeg = indices.map(i => gyroR[i]);
    const pitchSeg = indices.map(i => gyroP[i]);
    return {
      ...band,
      rollRms: Math.round(rms(rollSeg) * 10) / 10,
      pitchRms: Math.round(rms(pitchSeg) * 10) / 10,
      samples: indices.length
    };
  });

  // Noise source identification
  const noiseSources = [];
  const allProfiles = [rollProfile, pitchProfile, yawProfile];
  
  for (const profile of allProfiles) {
    if (profile.bands.propWash.percent > 25) {
      noiseSources.push({ source: 'Prop Wash', axis: profile.label, severity: 'High', detail: `${profile.bands.propWash.percent}% energy in 20-100Hz band` });
    }
    if (profile.bands.mechanical.percent > 20) {
      noiseSources.push({ source: 'Mechanical Vibration', axis: profile.label, severity: 'Medium', detail: `${profile.bands.mechanical.percent}% energy in 100-250Hz band` });
    }
    if (profile.bands.electrical.percent > 15) {
      noiseSources.push({ source: 'Electrical Noise', axis: profile.label, severity: 'Medium', detail: `${profile.bands.electrical.percent}% energy in 250-500Hz band` });
    }
    if (profile.bands.highFreq.percent > 10) {
      noiseSources.push({ source: 'High-Freq Noise', axis: profile.label, severity: 'Low', detail: `${profile.bands.highFreq.percent}% energy above 500Hz` });
    }
  }

  // Overall noise score (lower is better)
  const avgNoiseRms = mean([rollProfile.noiseRms, pitchProfile.noiseRms, yawProfile.noiseRms]);
  let noiseLevel;
  if (avgNoiseRms < 10) noiseLevel = 'Very Clean';
  else if (avgNoiseRms < 25) noiseLevel = 'Clean';
  else if (avgNoiseRms < 50) noiseLevel = 'Moderate';
  else noiseLevel = 'Noisy';

  const healthScore = clamp(Math.round(100 - avgNoiseRms * 1.5), 0, 100);

  // Recommendations
  const recommendations = [];
  if (noiseLevel === 'Noisy') {
    recommendations.push('Significant noise detected. Check props, motor bearings, and frame integrity.');
    recommendations.push('Enable or tune RPM filtering if using bidirectional DShot.');
    recommendations.push('Consider lowering gyro LPF and D-term LPF cutoff frequencies.');
  } else if (noiseLevel === 'Moderate') {
    recommendations.push('Moderate noise profile. Fine-tune dynamic notch and LPF settings.');
  }
  if (noiseSources.some(s => s.source === 'Electrical Noise')) {
    recommendations.push('Electrical noise detected. Check ESC shielding and power filtering.');
  }
  if (filterEffectiveness && filterEffectiveness.reductionPercent < 30) {
    recommendations.push('Filter effectiveness is low — filters may be too relaxed or noise sources are in-band.');
  }

  return {
    rollProfile,
    pitchProfile,
    yawProfile,
    filterEffectiveness,
    throttleNoise,
    noiseSources,
    noiseLevel,
    healthScore,
    avgNoiseRms: Math.round(avgNoiseRms * 10) / 10,
    recommendations,
    sampleRate
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Noise Heatmap (Throttle vs Frequency)
// ─────────────────────────────────────────────────────────────────────────────

const normalizeThrottle = (val, min, max) => {
  if (max <= min) return 0;
  return clamp((val - min) / (max - min), 0, 1);
};

const findWorstThrottleRange = (grid) => {
  const rowAverages = grid.map(row => row.reduce((a, b) => a + b, 0) / row.length);
  const worstIdx = rowAverages.indexOf(Math.max(...rowAverages));
  return { bucket: worstIdx, percentLow: worstIdx * 5, percentHigh: (worstIdx + 1) * 5 };
};

const findWorstFreqRange = (grid) => {
  const colTotals = Array(grid[0].length).fill(0);
  grid.forEach(row => row.forEach((val, j) => { colTotals[j] += val; }));
  const worstIdx = colTotals.indexOf(Math.max(...colTotals));
  return { bucket: worstIdx, hzLow: worstIdx * 10, hzHigh: (worstIdx + 1) * 10 };
};

const calculateNoiseScore = (grid) => {
  const total = grid.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  const cells = grid.length * grid[0].length;
  const avg = total / Math.max(1, cells);
  return Math.max(0, 100 - Math.round(avg / 2.55));
};

export const generateNoiseHeatmap = (blackboxData) => {
  const data = blackboxData?.data || [];
  if (data.length < 128) return null;

  const sampleRate = blackboxData.sampleRate || 2000;
  const gyro = data.map(r => r['roll-gyro'] ?? r['gyroADC-roll'] ?? 0);
  const throttle = data.map(r => r.throttle ?? r['rcCommand-3'] ?? 0);

  const minThrottle = Math.min(...throttle);
  const maxThrottle = Math.max(...throttle);

  const THROTTLE_BUCKETS = 20;
  const FREQ_BUCKETS = 50;
  const FREQ_MAX = 500;

  const accumulator = Array.from({ length: THROTTLE_BUCKETS }, () =>
    Array.from({ length: FREQ_BUCKETS }, () => ({ sum: 0, count: 0 }))
  );

  // Auto-scaling FFT window — pick largest window that fits at least 2× in the data
  const FFT_WINDOW = [512, 256, 128, 64].find(w => gyro.length >= w * 2) || 64;
  const STEP = Math.floor(FFT_WINDOW / 2);
  const totalFrames = gyro.length;

  for (let i = 0; i + FFT_WINDOW <= totalFrames; i += STEP) {
    const throttleSlice = throttle.slice(i, i + FFT_WINDOW);
    const avgThrottle = throttleSlice.reduce((a, b) => a + b, 0) / FFT_WINDOW;
    const throttleNorm = normalizeThrottle(avgThrottle, minThrottle, maxThrottle);
    const throttleBucket = Math.min(THROTTLE_BUCKETS - 1, Math.floor(throttleNorm * THROTTLE_BUCKETS));

    const gyroSlice = gyro.slice(i, i + FFT_WINDOW);
    const mag = magnitudeSpectrum(gyroSlice, hanning);
    const freqRes = sampleRate / (mag.length * 2);

    for (let bin = 0; bin < mag.length; bin++) {
      const freq = bin * freqRes;
      if (freq > FREQ_MAX) break;
      const freqBucket = Math.min(FREQ_BUCKETS - 1, Math.floor(freq / 10));
      const magnitude = mag[bin];
      accumulator[throttleBucket][freqBucket].sum += magnitude;
      accumulator[throttleBucket][freqBucket].count += 1;
    }
  }

  let maxVal = 0;
  const rawGrid = accumulator.map(row =>
    row.map(cell => {
      const val = cell.count > 0 ? cell.sum / cell.count : 0;
      maxVal = Math.max(maxVal, val);
      return val;
    })
  );

  const normalizedGrid = rawGrid.map(row =>
    row.map(val => maxVal > 0 ? Math.round((val / maxVal) * 255) : 0)
  );

  return {
    grid: normalizedGrid,
    throttleBuckets: THROTTLE_BUCKETS,
    freqBuckets: FREQ_BUCKETS,
    freqMax: FREQ_MAX,
    rpmHarmonics: [],
    maxRawValue: maxVal,
    worstThrottleRange: findWorstThrottleRange(normalizedGrid),
    worstFreqRange: findWorstFreqRange(normalizedGrid),
    overallNoiseScore: calculateNoiseScore(normalizedGrid),
  };
};

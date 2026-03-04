// ─── Shared math utilities (matching FPV Nexus internals) ───

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const mean = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
};

export const rms = (arr) => {
  if (!arr.length) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
};

export const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const mad = (arr) => {
  const med = median(arr);
  return median(arr.map(v => Math.abs(v - med)));
};

export const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

export const stddev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

export const pearsonCorrelation = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
};

// Linear regression: returns { slope, intercept, predict(x) }
export const linearRegression = (xs, ys) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: 0, predict: () => 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i];
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept, predict: (x) => slope * x + intercept };
};

// Hanning window
export const hanning = (n, N) => 0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1)));

// Hamming window
export const hamming = (n, N) => 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));

// Next power of 2
export const nextPow2 = (n) => 1 << Math.ceil(Math.log2(Math.max(1, n)));

// dB conversion
export const toDb = (amplitude) => 20 * Math.log10(Math.max(1e-12, amplitude));

// Cooley-Tukey FFT (in-place, returns complex array)
export function fft(re, im) {
  const N = re.length;
  if (N <= 1) return;
  if (N & (N - 1)) throw new Error('FFT size must be power of 2');

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= N; len *= 2) {
    const half = len / 2;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < half; j++) {
        const tRe = curRe * re[i + j + half] - curIm * im[i + j + half];
        const tIm = curRe * im[i + j + half] + curIm * re[i + j + half];
        re[i + j + half] = re[i + j] - tRe;
        im[i + j + half] = im[i + j] - tIm;
        re[i + j] += tRe;
        im[i + j] += tIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

// Get magnitude spectrum from real signal
export function magnitudeSpectrum(signal, windowFn = hanning) {
  const N = nextPow2(signal.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) {
    re[i] = signal[i] * windowFn(i, signal.length);
  }
  fft(re, im);
  const mag = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (N / 2);
  }
  return mag;
}

// Moving average
export const movingAvg = (arr, window) => {
  const result = new Float64Array(arr.length);
  const half = Math.floor(window / 2);
  for (let i = 0; i < arr.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += arr[j];
    result[i] = sum / (hi - lo + 1);
  }
  return result;
};

// Health color helper
export const healthColor = (status) => {
  if (status === 'Good' || status === 'Excellent') return '#22c55e';
  if (status === 'Fair' || status === 'Warning') return '#eab308';
  return '#ef4444';
};

export const healthBadge = (status) => {
  if (status === 'Good' || status === 'Excellent') return 'badge-green';
  if (status === 'Fair' || status === 'Warning') return 'badge-yellow';
  return 'badge-red';
};

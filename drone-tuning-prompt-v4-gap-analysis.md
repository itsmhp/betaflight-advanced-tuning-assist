# Analisis Gap & Prompt Improvement — Berdasarkan Review Kodebase Aktual

## STATUS JUJUR: Seberapa Dekat ke "Terbaik"?

Berdasarkan review kodebase aktual vs kompetitor yang ada:

```
KATEGORI                    APP KAMU    KOMPETITOR TERBAIK    GAP
─────────────────────────────────────────────────────────────────
Sequential workflow         ⚠️ WIP      ❌ Tidak ada          ✅ Unggul (setelah v2 selesai)
Blackbox analysis (15 tool) ✅ Ada       ✅ PIDtoolbox          ≈ Setara
WebSerial CLI               ✅ Ada       ❌ Tidak ada          ✅ Unggul
Multi-language              ✅ Ada       ❌ Tidak ada          ✅ Unggul
Noise heatmap               ❌ Tidak ada ✅ PIDtoolbox          ❌ Gap besar
Log comparison              ❌ Tidak ada ❌ Tidak ada*         ✅ Bisa jadi first
AI interpretation           ❌ Tidak ada ⚠️ FPVtune (bayar)    ✅ Bisa gratis
Free & browser-based        ✅ Ada       ❌ PIDtoolbox paywall  ✅ Unggul
Rates calculator            ❌ Tidak ada ✅ ada di mana-mana   ❌ Gap kecil
OSD preview                 ❌ Tidak ada ❌ Tidak ada          🔵 Bonus
```

*Blackbox Explorer punya overlay tapi bukan comparison dengan scoring

### Kesimpulan: 3 Gap Kritikal yang harus ditutup dulu

1. **Noise Heatmap** (throttle vs frequency) — ini yang paling sering di-screenshot komunitas
2. **Log Comparison** (before/after dengan delta scoring) — bukti nyata tuning berhasil
3. **AI Interpretation** — diferensiasi dari semua kompetitor berbayar

Setelah 3 ini selesai + sequential pipeline (v2), app ini akan menjadi yang terbaik secara objektif.

---

# PROMPT 4: Tiga Gap Kritikal

## Konteks Kodebase

Stack: React 18 + Vite, JavaScript (bukan TypeScript), no backend, localStorage.

File yang relevan:
- `src/lib/analyzers/noiseProfile.js` — sudah ada, akan diextend untuk heatmap
- `src/lib/analyzeAll.js` — orchestrator, akan dipanggil dua kali untuk comparison
- `src/context/DataContext.jsx` — akan ditambah state untuk second log
- `src/pages/Dashboard.jsx` — akan ditambah entry point comparison
- `src/lib/bblDecoder.js` + `src/lib/blackboxParser.js` — sudah ada, dipakai ulang

---

## GAP 1: Noise Heatmap (Throttle vs Frequency)

### Kenapa ini kritis
PIDtoolbox punya ini dan ini adalah fitur yang paling sering di-screenshot dan di-share di forum FPV.
Visualisasi ini langsung menunjukkan di throttle berapa noise muncul dan di frekuensi mana.
Ini adalah "hero feature" yang secara visual membedakan tool serius dari tool biasa.

### Implementasi

**Step 1: Tambah fungsi di `src/lib/analyzers/noiseProfile.js`**

```javascript
// Tambah export baru — jangan ubah fungsi yang sudah ada

export const generateNoiseHeatmap = (blackboxData) => {
  const { flightData } = blackboxData;
  const { gyro, throttle, timestamp } = flightData;
  
  // Konfigurasi grid
  const THROTTLE_BUCKETS = 20;    // 0-5%, 5-10%, ..., 95-100%
  const FREQ_BUCKETS = 50;        // 0-500Hz, resolusi 10Hz/bucket
  const SAMPLE_RATE = flightData.frameRate || 1000; // Hz, dari header BBL
  
  // Inisialisasi accumulator
  // heatmap[throttle_bucket][freq_bucket] = { sum: 0, count: 0 }
  const accumulator = Array.from({ length: THROTTLE_BUCKETS }, () =>
    Array.from({ length: FREQ_BUCKETS }, () => ({ sum: 0, count: 0 }))
  );
  
  // Ukuran window FFT — gunakan power of 2 terdekat untuk ~100ms window
  const FFT_WINDOW = 256; // ~100ms pada 2500Hz sample rate blackbox tipical
  const STEP = Math.floor(FFT_WINDOW / 2); // 50% overlap
  
  // Loop semua frame dengan sliding window
  const totalFrames = timestamp.length;
  
  for (let i = 0; i + FFT_WINDOW < totalFrames; i += STEP) {
    // Hitung throttle rata-rata di window ini
    const throttleSlice = throttle.slice(i, i + FFT_WINDOW);
    const avgThrottle = throttleSlice.reduce((a, b) => a + b, 0) / FFT_WINDOW;
    
    // Map throttle (biasanya 1000-2000 atau 0-100%) ke bucket
    // Normalize ke 0-1 terlebih dahulu
    const throttleNorm = Math.min(1, Math.max(0, (avgThrottle - 1000) / 1000));
    const throttleBucket = Math.min(THROTTLE_BUCKETS - 1, Math.floor(throttleNorm * THROTTLE_BUCKETS));
    
    // Run FFT pada gyro roll untuk window ini
    // Gunakan implementasi FFT sederhana (tidak perlu library external)
    const gyroSlice = gyro.roll.slice(i, i + FFT_WINDOW);
    const fftResult = computeFFT(applyHannWindow(gyroSlice));
    
    // Magnitude per frekuensi bucket
    const freqResolution = SAMPLE_RATE / FFT_WINDOW; // Hz per bin
    
    for (let bin = 0; bin < FFT_WINDOW / 2; bin++) {
      const freq = bin * freqResolution;
      if (freq > 500) break; // Hanya up to 500Hz
      
      const freqBucket = Math.min(FREQ_BUCKETS - 1, Math.floor(freq / 10));
      const magnitude = Math.sqrt(fftResult.real[bin] ** 2 + fftResult.imag[bin] ** 2);
      
      accumulator[throttleBucket][freqBucket].sum += magnitude;
      accumulator[throttleBucket][freqBucket].count += 1;
    }
  }
  
  // Normalize ke 0-255 untuk rendering
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
  
  // Deteksi motor noise bands (rpm harmonics) untuk overlay
  // Jika ada rpm data di header, hitung frekuensi harmonik
  const motorRPM = blackboxData.header?.motorRPM || null;
  const rpmHarmonics = motorRPM ? calculateRPMHarmonics(motorRPM) : [];
  
  return {
    grid: normalizedGrid,           // 20×50 array, nilai 0-255
    throttleBuckets: THROTTLE_BUCKETS,
    freqBuckets: FREQ_BUCKETS,
    freqMax: 500,                   // Hz
    rpmHarmonics,                   // array of Hz values untuk overlay lines
    maxRawValue: maxVal,
    // Summary stats
    worstThrottleRange: findWorstThrottleRange(normalizedGrid),
    worstFreqRange: findWorstFreqRange(normalizedGrid),
    overallNoiseScore: calculateNoiseScore(normalizedGrid), // 0-100, lower = better
  };
};

// Helper: simple FFT (Cooley-Tukey, power-of-2 input)
const computeFFT = (signal) => {
  const N = signal.length;
  // ... implementasi FFT atau gunakan yang sudah ada di utils.js jika ada
  // Kalau analyzeAll.js sudah punya FFT helper, import dari sana
  // Return: { real: Float32Array, imag: Float32Array }
};

// Helper: Hann window untuk mengurangi spectral leakage
const applyHannWindow = (signal) => {
  const N = signal.length;
  return signal.map((val, i) => val * 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1))));
};

// Helper: hitung frekuensi RPM harmonik
const calculateRPMHarmonics = (rpm) => {
  const fundamentalHz = rpm / 60;
  return [1, 2, 3, 4].map(h => fundamentalHz * h); // 4 harmonik
};

const findWorstThrottleRange = (grid) => {
  // Return throttle bucket dengan rata-rata noise tertinggi
  const rowAverages = grid.map(row => row.reduce((a, b) => a + b, 0) / row.length);
  const worstIdx = rowAverages.indexOf(Math.max(...rowAverages));
  return { bucket: worstIdx, percentLow: worstIdx * 5, percentHigh: (worstIdx + 1) * 5 };
};

const findWorstFreqRange = (grid) => {
  // Return freq bucket dengan total noise tertinggi
  const colTotals = Array(grid[0].length).fill(0);
  grid.forEach(row => row.forEach((val, j) => colTotals[j] += val));
  const worstIdx = colTotals.indexOf(Math.max(...colTotals));
  return { bucket: worstIdx, hzLow: worstIdx * 10, hzHigh: (worstIdx + 1) * 10 };
};

const calculateNoiseScore = (grid) => {
  const total = grid.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  const cells = grid.length * grid[0].length;
  const avg = total / cells;
  return Math.max(0, 100 - Math.round(avg / 2.55));
};
```

**Step 2: Buat `src/components/NoiseHeatmap.jsx`**

```javascript
// Komponen Canvas-based heatmap renderer

import { useRef, useEffect, useMemo } from 'react';

const NoiseHeatmap = ({ heatmapData, width = 600, height = 400, showRPMLines = true }) => {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Color scale: biru gelap (quiet) → kuning → merah (loud)
  // Mirip dengan PIDtoolbox color scheme yang familiar di komunitas
  const getColor = (value) => {
    // value: 0-255
    if (value < 64)  return `rgb(0, ${value * 2}, ${128 + value})`;        // biru
    if (value < 128) return `rgb(${(value - 64) * 4}, 200, 0)`;             // hijau-kuning
    if (value < 192) return `rgb(255, ${255 - (value - 128) * 4}, 0)`;      // kuning-oranye
    return `rgb(255, 0, ${(value - 192) * 4})`;                              // merah
  };
  
  useEffect(() => {
    if (!heatmapData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { grid, throttleBuckets, freqBuckets, rpmHarmonics, freqMax } = heatmapData;
    
    // Padding untuk axes
    const PADDING = { top: 20, right: 20, bottom: 40, left: 55 };
    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    
    const cellW = plotW / freqBuckets;
    const cellH = plotH / throttleBuckets;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw heatmap cells
    // grid[throttle][freq] — throttle 0 = bottom (0%), throttle 19 = top (100%)
    for (let t = 0; t < throttleBuckets; t++) {
      for (let f = 0; f < freqBuckets; f++) {
        const value = grid[t][f];
        ctx.fillStyle = getColor(value);
        
        // Flip Y: throttle 0 di bawah, 100% di atas
        const x = PADDING.left + f * cellW;
        const y = PADDING.top + (throttleBuckets - 1 - t) * cellH;
        
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5); // +0.5 untuk anti-gap
      }
    }
    
    // Draw RPM harmonic lines (jika showRPMLines dan ada data)
    if (showRPMLines && rpmHarmonics?.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      
      rpmHarmonics.forEach((hz, i) => {
        if (hz > freqMax) return;
        const x = PADDING.left + (hz / freqMax) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, PADDING.top + plotH);
        ctx.stroke();
        
        // Label harmonik
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '10px monospace';
        ctx.fillText(`H${i + 1}`, x + 2, PADDING.top + 12);
      });
      
      ctx.setLineDash([]);
    }
    
    // Draw axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    
    // X axis — Frequency
    ctx.textAlign = 'center';
    [0, 100, 200, 300, 400, 500].forEach(hz => {
      const x = PADDING.left + (hz / freqMax) * plotW;
      ctx.fillText(`${hz}Hz`, x, height - 10);
    });
    ctx.fillText('Frequency', width / 2, height - 0);
    
    // Y axis — Throttle
    ctx.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach(pct => {
      const y = PADDING.top + plotH - (pct / 100) * plotH;
      ctx.fillText(`${pct}%`, PADDING.left - 5, y + 4);
    });
    
  }, [heatmapData, width, height, showRPMLines]);
  
  // Tooltip on hover
  const handleMouseMove = (e) => {
    if (!heatmapData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const PADDING = { top: 20, right: 20, bottom: 40, left: 55 };
    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    
    const fIdx = Math.floor(((x - PADDING.left) / plotW) * heatmapData.freqBuckets);
    const tIdx = heatmapData.throttleBuckets - 1 - Math.floor(((y - PADDING.top) / plotH) * heatmapData.throttleBuckets);
    
    if (fIdx >= 0 && fIdx < heatmapData.freqBuckets && tIdx >= 0 && tIdx < heatmapData.throttleBuckets) {
      const noise = heatmapData.grid[tIdx][fIdx];
      const freqLow = fIdx * 10;
      const throttleLow = tIdx * 5;
      // Update tooltip state — pass ke parent atau manage sendiri
    }
  };
  
  if (!heatmapData) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#666', borderRadius: 8 }}>
        Upload blackbox log to see noise heatmap
      </div>
    );
  }
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Summary stats di atas heatmap */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13 }}>
        <span>Noise Score: <strong style={{ color: heatmapData.overallNoiseScore > 70 ? '#4caf50' : '#ff9800' }}>{heatmapData.overallNoiseScore}/100</strong></span>
        <span>Worst throttle: <strong>{heatmapData.worstThrottleRange.percentLow}-{heatmapData.worstThrottleRange.percentHigh}%</strong></span>
        <span>Peak noise: <strong>{heatmapData.worstFreqRange.hzLow}-{heatmapData.worstFreqRange.hzHigh}Hz</strong></span>
      </div>
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        style={{ borderRadius: 4, cursor: 'crosshair' }}
      />
      
      {/* Color scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11 }}>
        <span style={{ color: '#555' }}>Quiet</span>
        <div style={{
          width: 120, height: 10, borderRadius: 2,
          background: 'linear-gradient(to right, #004080, #00c800, #ffff00, #ff8000, #ff0000)'
        }} />
        <span style={{ color: '#555' }}>Loud</span>
      </div>
    </div>
  );
};

export default NoiseHeatmap;
```

**Step 3: Integrasi ke halaman**

- Tambah `NoiseHeatmap` ke `src/pages/FilterAnalyzerPage.jsx` (paling relevan secara konteks)
- Juga tampilkan di Noise stage pada tuning pipeline
- Tambah "Noise Heatmap" sebagai salah satu visualisasi di Dashboard overview

---

## GAP 2: Log Comparison (Before/After)

### Kenapa ini kritis
Pilot perlu **bukti** bahwa tuning mereka berhasil. Saat ini tidak ada cara untuk compare dua log.
Ini adalah fitur yang akan mendorong pilot untuk upload log baru setelah setiap sesi tuning —
yang juga berarti lebih banyak engagement dengan app.

### Implementasi

**Step 1: Update `src/context/DataContext.jsx`**

```javascript
// Tambah state untuk comparison log — jangan ubah state yang sudah ada

const [comparisonBlackboxData, setComparisonBlackboxData] = useState(null);
const [comparisonAnalysisResults, setComparisonAnalysisResults] = useState(null);
const [comparisonLabel, setComparisonLabel] = useState('After Tune');
const [baselineLabel, setBaselineLabel] = useState('Before Tune');

// Expose ke context value
const value = {
  // ...existing values...
  comparisonBlackboxData,
  setComparisonBlackboxData,
  comparisonAnalysisResults,
  setComparisonAnalysisResults,
  comparisonLabel,
  setComparisonLabel,
  baselineLabel,
  setBaselineLabel,
};
```

**Step 2: Buat `src/pages/LogComparisonPage.jsx`**

```javascript
// Layout halaman:
//
// ┌─────────────────────────────────────────────────────────────┐
// │  📊 LOG COMPARISON                                          │
// │                                                             │
// │  ┌──────────────────────┐    ┌──────────────────────┐      │
// │  │ 📁 BASELINE LOG      │    │ 📁 COMPARISON LOG    │      │
// │  │ "Before Tune"        │    │ "After Tune"         │      │
// │  │ [Rename]             │    │ [Rename]             │      │
// │  │ Status: ✅ Loaded    │    │ Status: ⬆ Upload     │      │
// │  │ [Use current data]   │    │ [Upload .bbl file]   │      │
// │  └──────────────────────┘    └──────────────────────┘      │
// │                                                             │
// │  [▶ Run Comparison Analysis]  ← button, enabled jika 2 log │
// │                                                             │
// │  COMPARISON RESULTS:                                        │
// │  ┌─────────────────────────────────────────────────────┐   │
// │  │ METRIC              BEFORE  AFTER   DELTA   STATUS  │   │
// │  │ Noise Score         45      78      +33     ✅ +73% │   │
// │  │ Step Response (ms)  22      14      -8ms    ✅ -36% │   │
// │  │ Overshoot %         12%     4%      -8%     ✅ -66% │   │
// │  │ D-term Noise        HIGH    LOW     ↓       ✅ Better│  │
// │  │ Motor Balance       72      85      +13     ✅ +18% │   │
// │  │ Propwash Energy     HIGH    MEDIUM  ↓       ⚠️ Partial│  │
// │  └─────────────────────────────────────────────────────┘   │
// │                                                             │
// │  OVERLAY CHARTS: [Gyro Roll] [Gyro Pitch] [Motor Output]   │
// │  ┌─────────────────────────────────────────────────────┐   │
// │  │  [Chart dengan dua trace: baseline=grey, after=blue]│   │
// │  └─────────────────────────────────────────────────────┘   │
// │                                                             │
// │  [📋 Export Comparison Report]                             │
// └─────────────────────────────────────────────────────────────┘

const LogComparisonPage = () => {
  const { blackboxData, analysisResults, comparisonBlackboxData, setComparisonBlackboxData, comparisonAnalysisResults, setComparisonAnalysisResults } = useContext(DataContext);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const runComparison = async () => {
    setIsAnalyzing(true);
    // Jalankan analyzeAll() pada comparisonBlackboxData
    // analyzeAll sudah ada dan bisa dipanggil ulang
    const results = await analyzeAll(comparisonBlackboxData);
    setComparisonAnalysisResults(results);
    setIsAnalyzing(false);
  };
  
  // Hitung delta antara dua set results
  const comparisonMetrics = useMemo(() => {
    if (!analysisResults || !comparisonAnalysisResults) return null;
    return calculateComparisonDeltas(analysisResults, comparisonAnalysisResults);
  }, [analysisResults, comparisonAnalysisResults]);
  
  // ...render
};

// Helper: hitung delta semua metrics
const calculateComparisonDeltas = (baseline, comparison) => {
  const metrics = [];
  
  // List metrics yang akan dicompare — ambil dari keys yang sama di kedua results
  const metricMap = [
    { key: 'noiseProfile.overallNoiseScore', label: 'Noise Score', higherIsBetter: true, unit: 'pts' },
    { key: 'stepResponse.responseTime_ms', label: 'Step Response', higherIsBetter: false, unit: 'ms' },
    { key: 'stepResponse.overshoot_percent', label: 'Overshoot', higherIsBetter: false, unit: '%' },
    { key: 'motorHealth.health_score', label: 'Motor Balance', higherIsBetter: true, unit: 'pts' },
    { key: 'propWash.health_score', label: 'Propwash Score', higherIsBetter: true, unit: 'pts' },
    { key: 'filterAnalyzer.health_score', label: 'Filter Health', higherIsBetter: true, unit: 'pts' },
    { key: 'feedforward.health_score', label: 'Feedforward Health', higherIsBetter: true, unit: 'pts' },
  ];
  
  metricMap.forEach(({ key, label, higherIsBetter, unit }) => {
    const getNestedValue = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
    
    const before = getNestedValue(baseline, key);
    const after = getNestedValue(comparison, key);
    
    if (before == null || after == null) return;
    
    const delta = after - before;
    const deltaPct = before !== 0 ? ((delta / Math.abs(before)) * 100).toFixed(1) : null;
    const improved = higherIsBetter ? delta > 0 : delta < 0;
    const regressed = higherIsBetter ? delta < 0 : delta > 0;
    
    metrics.push({
      label,
      before: before.toFixed(1),
      after: after.toFixed(1),
      delta: delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1),
      deltaPct: deltaPct ? (delta > 0 ? `+${deltaPct}%` : `${deltaPct}%`) : null,
      status: improved ? 'improved' : regressed ? 'regressed' : 'unchanged',
      unit,
    });
  });
  
  return metrics;
};
```

**Step 3: Tambah ke navigasi**

Di `Sidebar.jsx`, tambah nav item "Compare Logs" dengan ikon `⚖️`.
Di `App.jsx`, tambah route `/compare`.

---

## GAP 3: AI-Powered Interpretation

### Kenapa ini kritis
FPVtune charge $9.90-$20 per analisis hanya untuk ini.
App kamu bisa memberikan ini **gratis**, dengan konteks yang lebih kaya karena punya hardware profile + CLI + blackbox sekaligus.

### Implementasi

**Buat `src/lib/aiInterpreter.js`**

```javascript
// src/lib/aiInterpreter.js
// Tidak ada dependency baru — hanya fetch ke Anthropic API

const AI_CACHE_KEY = 'aiInsightCache';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 jam

// Load cache dari localStorage
const loadCache = () => {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

// Generate cache key dari data (hash sederhana)
const getCacheKey = (stageId, metrics) => {
  const str = stageId + JSON.stringify(metrics);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `ai_${stageId}_${Math.abs(hash)}`;
};

export const getAIInsight = async (stageId, analysisData, droneProfile, cliData, language = 'en') => {
  // Cek cache dulu
  const cache = loadCache();
  const cacheKey = getCacheKey(stageId, analysisData?.metrics);
  const cached = cache[cacheKey];
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { text: cached.text, fromCache: true };
  }
  
  // Build prompt yang kaya konteks
  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(stageId, analysisData, droneProfile, cliData);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    const text = data.content?.[0]?.text || 'No insight available.';
    
    // Simpan ke cache
    const newCache = { ...loadCache(), [cacheKey]: { text, timestamp: Date.now() } };
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(newCache));
    
    return { text, fromCache: false };
    
  } catch (error) {
    console.error('AI insight error:', error);
    // Fallback ke rule-based insight dari analysisData.recommendations
    const fallback = analysisData?.recommendations?.slice(0, 3).join(' ') || 'Analysis complete. Check recommendations above.';
    return { text: fallback, fromCache: false, error: true };
  }
};

const buildSystemPrompt = (language) => {
  const langInstruction = {
    en: 'Respond in English.',
    id: 'Respond in Bahasa Indonesia.',
    es: 'Respond in Spanish.',
    de: 'Respond in German.',
  }[language] || 'Respond in English.';
  
  return `You are an expert FPV drone tuning engineer with 10+ years of experience with Betaflight.
You analyze blackbox flight data and provide specific, actionable recommendations.
${langInstruction}

Rules:
- Always explain WHY a change is needed, not just WHAT to change
- Reference specific values from the data provided
- Be concise but technical — max 4 short paragraphs
- If data looks good, say so briefly and move on
- Consider the specific hardware when making recommendations (a 2206 motor tunes differently than a 2306)
- Never give generic advice; always tie recommendations to the specific numbers in the data`;
};

const buildUserPrompt = (stageId, analysisData, droneProfile, cliData) => {
  const hardware = droneProfile ? `
Hardware context:
- Frame: ${droneProfile.frame_size}
- Motor: ${droneProfile.motor?.kv}KV, ${droneProfile.motor?.amperage}A (${droneProfile.motor?.brand || 'unknown brand'})
- Props: ${droneProfile.propeller?.diameter}" (${droneProfile.propeller?.pitch || 'unknown pitch'})
- Battery: ${droneProfile.battery?.cells}S ${droneProfile.battery?.mah}mAh
- ESC Protocol: ${droneProfile.esc?.protocol}
- FC: ${droneProfile.fc?.model} on Betaflight ${droneProfile.fc?.betaflight_version}
- Weight: ${droneProfile.weight}g` : 'Hardware: unknown';

  const metrics = analysisData?.metrics
    ? Object.entries(analysisData.metrics).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : 'No metrics available';

  const score = analysisData?.health_score;
  const status = analysisData?.status;

  // Stage-specific context
  const stageContext = {
    noise: 'Focus on: motor noise sources, ESC protocol suitability, RPM filter necessity, vibration causes.',
    filters: 'Focus on: filter cutoff appropriateness for this motor/prop combo, over vs under-filtering, phase delay tradeoffs.',
    pids: 'Focus on: P/D ratio balance, I-term windup risk, axis asymmetry between roll and pitch, D-term noise amplification.',
    feedforward: 'Focus on: stick feel implications, center feel for freestyle vs racing, overshoot risk.',
    tpa: 'Focus on: full throttle oscillation risk, appropriate breakpoint for this battery/motor combo.',
    antiGravity: 'Focus on: throttle punch recovery, appropriate gain for the weight/power ratio.',
    verification: 'Provide a brief final assessment. What was fixed? What might still need attention after test flight?',
  }[stageId] || '';

  return `${hardware}

Stage: ${stageId.toUpperCase()} Analysis
Health Score: ${score ?? 'N/A'}/100 (${status ?? 'N/A'})
${stageContext}

Metrics from blackbox analysis:
${metrics}

Please interpret these results for this specific build and tell the pilot what it means and what to do.`;
};
```

**Integrasi ke StageCard / Pipeline**

Di setiap stage yang ACTIVE di `TuneWorkflowPage.jsx`:

```javascript
// Tambah state per stage
const [aiInsight, setAiInsight] = useState(null);
const [aiLoading, setAiLoading] = useState(false);

const handleGetAIInsight = async () => {
  setAiLoading(true);
  const { droneProfile } = useContext(DroneProfileContext);
  const { cliData } = useContext(DataContext);
  const stageAnalysis = analysisResults?.[stage.analyzerKey];
  const { language } = useContext(LangContext); // language yang sudah dipilih user
  
  const result = await getAIInsight(stage.id, stageAnalysis, droneProfile, cliData, language);
  setAiInsight(result);
  setAiLoading(false);
};

// UI:
// Tombol "🤖 Get AI Insight" — tampilkan di bawah manual recommendations
// Response tampil sebagai card dengan border biru, label "AI Analysis"
// Disclaimer kecil: "AI-generated interpretation — verify before applying"
// Jika fromCache: tampilkan "(cached)" di sudut kanan
// Jika error: tampilkan fallback dengan note "AI unavailable, showing basic recommendations"
```

---

## Urutan Implementasi

```
WEEK 1: Noise Heatmap
├── Extend noiseProfile.js dengan generateNoiseHeatmap()
├── Buat NoiseHeatmap.jsx (Canvas renderer)
└── Integrate ke FilterAnalyzerPage dan Noise stage pipeline

WEEK 2: Log Comparison
├── Update DataContext dengan comparison state
├── Buat LogComparisonPage.jsx
├── Buat calculateComparisonDeltas helper
└── Tambah route + sidebar nav

WEEK 3: AI Interpretation
├── Buat aiInterpreter.js dengan caching
├── Integrate tombol ke StageCard di pipeline
└── Handle error/fallback gracefully

WEEK 4: Polish
├── Tambah semua teks baru ke translations.js (4 bahasa)
├── Test di mobile (pilot sering pakai HP di lapangan)
└── Performance audit — heatmap FFT bisa berat, pertimbangkan Web Worker
```

---

## Catatan Performa untuk Heatmap

FFT pada data blackbox bisa berat (bisa 50.000+ frames). Pertimbangkan:

```javascript
// Option A: Web Worker (recommended untuk file besar)
// Buat src/lib/workers/heatmapWorker.js
// Jalankan generateNoiseHeatmap di background thread
// Gunakan useEffect + postMessage pattern

// Option B: Chunked processing dengan requestAnimationFrame
// Process 1000 frames per frame, update progress bar
// Lebih simple, masih main thread tapi tidak freeze UI

// Mulai dengan Option B dulu — lebih mudah, optimize ke Worker kalau perlu
```

---

## Setelah 3 Gap Ini Selesai

App akan memiliki:
- ✅ Sequential pipeline (v2) — satu-satunya yang ada
- ✅ WebSerial direct to FC — satu-satunya yang ada  
- ✅ Noise heatmap di browser — sebelumnya hanya PIDtoolbox (paywall + MATLAB)
- ✅ Log comparison with delta scoring — tidak ada kompetitor yang punya
- ✅ AI interpretation gratis — FPVtune charge $20 untuk ini
- ✅ Multi-language — tidak ada kompetitor yang punya
- ✅ Free, browser-based, no install — PIDtoolbox butuh MATLAB 2GB

Ini bukan sekedar "salah satu tool terbaik" — ini akan menjadi **satu-satunya free browser-based tool** dengan semua fitur tersebut sekaligus.
```

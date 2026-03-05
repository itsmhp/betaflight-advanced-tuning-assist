# GitHub Copilot Prompt: Feature Gaps — Menjadi Aplikasi Tuning Betaflight Terbaik

## Konteks

Aplikasi ini sudah memiliki:
✅ 15 blackbox analyzer tools  
✅ 36 preset (9 frame × 4 skill level)  
✅ Smart preset adjustment dari blackbox  
✅ WebSerial CLI Terminal (langsung ke FC via USB)  
✅ Multi-language (EN, ID, ES, DE)  
✅ Sequential tuning pipeline (Noise → Filters → PIDs → FF → TPA → AG → Verify)  

## Analisis Kompetitor (Landscape Saat Ini)

| Tool | Kelebihan | Kelemahan |
|------|-----------|-----------|
| **Blackbox Explorer** (official) | Visualisasi detail, resmi | Tidak ada rekomendasi sama sekali |
| **PIDtoolbox** | Spektral + step response terbaik | Paywall sejak 2024, butuh MATLAB 2GB |
| **PIDscope** | Free, fork PIDtoolbox | CLI Octave, tidak ada GUI modern |
| **FPVtune** | Neural network, hasil bagus | Bayar $9.90-$20, tidak ada workflow, tidak ada WebSerial |
| **Betaflight CM** | Android, in-field tuning | Hanya UI sederhana, tidak ada analisis |

## Gap yang Harus Diisi untuk Jadi yang Terbaik

---

## FITUR 1: Log Comparison (Before/After)

### Mengapa Ini Kritis
Semua kompetitor lemah di sini. Pilot perlu membandingkan blackbox sebelum dan sesudah apply tune.
Saat ini tidak ada tool browser-based yang bisa compare dua log sekaligus secara visual.

### Yang Harus Dibangun

**Di `DataContext.jsx`, tambahkan:**
```javascript
// Tambah state untuk second log
const [comparisonBlackboxData, setComparisonBlackboxData] = useState(null);
const [comparisonLabel, setComparisonLabel] = useState('After');
const [baselineLabel, setBaselineLabel] = useState('Before');
```

**Buat komponen `LogComparisonPanel.jsx`:**

Layout:
```
┌─────────────────────────────────────────────────────────────┐
│  📊 LOG COMPARISON                                          │
│                                                             │
│  [Baseline Log]          vs          [Comparison Log]       │
│  "Before Tune" ←rename             "After Tune" ←rename    │
│  [Upload New] [Use Current]         [Upload] [Clear]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ METRIC              BEFORE    AFTER     CHANGE      │   │
│  │ Gyro Noise RMS      24.3      11.2      -53.9% ✅   │   │
│  │ D-term Noise        18.7      9.4       -49.7% ✅   │   │
│  │ Motor Temp Est.     HIGH      MEDIUM    ↓ Better ✅  │   │
│  │ Step Response (ms)  22ms      14ms      -36.4% ✅   │   │
│  │ Overshoot %         12%       4%        -66.7% ✅   │   │
│  │ Propwash Energy     HIGH      LOW       ↓ Better ✅  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [📈 Overlay Charts] [📋 Export Comparison Report]         │
└─────────────────────────────────────────────────────────────┘
```

**Overlay Chart:**
- Tampilkan gyro trace dari kedua log dalam satu chart
- Warna berbeda: Baseline = abu-abu/merah, Comparison = biru/hijau
- Semua 15 analyzer dijalankan untuk kedua log
- Delta dihitung: `((after - before) / before) * 100`
- Perubahan positif (improvement) = hijau dengan ✅
- Perubahan negatif (regression) = merah dengan ⚠️

**Cara Akses:**
- Tambah tab "Compare Logs" di sidebar
- Atau accessible dari Verification Stage di tuning pipeline
- After completing a full tuning session, prompt: "Upload your post-tune log to see improvement"

---

## FITUR 2: AI-Powered Interpretation via Anthropic API

### Mengapa Ini Kritis
FPVtune ($9.90-$20) hanya melakukan ini dengan "neural network" tapi tidak memberikan penjelasan kontekstual. 
App kamu bisa memberikan **AI explanation gratis** menggunakan Anthropic API langsung dari browser,
dengan konteks yang lebih kaya (hardware profile + CLI + blackbox sekaligus).

### Yang Harus Dibangun

**Buat `src/lib/aiInterpreter.js`:**

```javascript
// src/lib/aiInterpreter.js

export const generateAIInsight = async (stageId, analysisData, droneProfile, cliData) => {
  // Build context prompt dari semua data yang ada
  const systemPrompt = `You are an expert FPV drone tuning assistant with deep knowledge of Betaflight.
You analyze blackbox flight data and provide specific, actionable recommendations.
Always explain WHY a change is needed, not just WHAT to change.
Be concise but technical. Target audience: intermediate to advanced FPV pilots.
Always output in the same language as the user's app language setting.`;

  const userPrompt = buildStagePrompt(stageId, analysisData, droneProfile, cliData);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
};

const buildStagePrompt = (stageId, analysisData, droneProfile, cliData) => {
  // Build konteks dari hardware profile drone
  const hardwareContext = `
Drone Hardware:
- Frame: ${droneProfile.frame_size}
- Motor: ${droneProfile.motor.kv}KV, ${droneProfile.motor.amperage}A
- Props: ${droneProfile.propeller.diameter}" ${droneProfile.propeller.pitch}
- Battery: ${droneProfile.battery.cells}S ${droneProfile.battery.mah}mAh
- ESC Protocol: ${droneProfile.esc.protocol}
- FC: ${droneProfile.fc.model} (BF ${droneProfile.fc.betaflight_version})
- Weight: ${droneProfile.weight}g
  `.trim();

  // Build konteks dari analysis results
  const analysisContext = formatAnalysisForAI(stageId, analysisData);

  // Build konteks dari CLI (nilai parameter saat ini)
  const cliContext = formatCLIForAI(stageId, cliData);

  return `
${hardwareContext}

Current ${stageId.toUpperCase()} Analysis Results:
${analysisContext}

Current Betaflight Settings (from CLI dump):
${cliContext}

Please analyze this data and provide:
1. What the main issue is and WHY it matters for this specific build
2. Specific recommended changes with exact values
3. What the pilot should expect to feel/hear after applying changes
4. Any risks or things to watch out for

Be specific to this drone's hardware — a ${droneProfile.motor.kv}KV motor on a ${droneProfile.frame_size} frame has different tuning requirements than a generic build.
  `.trim();
};

// Format analysis results menjadi teks yang mudah dibaca AI
const formatAnalysisForAI = (stageId, analysisData) => {
  if (!analysisData) return 'No analysis data available';
  
  return Object.entries(analysisData.metrics || {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
};

// Extract CLI params yang relevan per stage
const formatCLIForAI = (stageId, cliData) => {
  if (!cliData) return 'No CLI data available';
  
  const relevantParams = {
    noise: ['gyro_lowpass_hz', 'gyro_lowpass2_hz', 'motor_pwm_protocol', 'dshot_idle_value', 'rpm_filter_harmonics'],
    filters: ['gyro_lowpass_hz', 'gyro_lowpass2_hz', 'dterm_lowpass_hz', 'dterm_lowpass2_hz', 'dyn_notch_count', 'dyn_notch_min_hz', 'dyn_notch_max_hz'],
    pids: ['p_roll', 'i_roll', 'd_roll', 'f_roll', 'p_pitch', 'i_pitch', 'd_pitch', 'f_pitch', 'p_yaw', 'i_yaw', 'd_yaw'],
    feedforward: ['feedforward_transition', 'feedforward_averaging', 'feedforward_smooth_factor', 'f_roll', 'f_pitch'],
    tpa: ['tpa_rate', 'tpa_breakpoint', 'tpa_mode'],
    antiGravity: ['anti_gravity_gain', 'anti_gravity_mode', 'anti_gravity_cutoff_hz'],
  };
  
  const params = relevantParams[stageId] || [];
  return params
    .map(p => `${p} = ${cliData[p] || 'not set'}`)
    .join('\n');
};
```

**Integrasi ke `StageCard.jsx`:**
```javascript
// Di setiap StageCard yang ACTIVE, tambahkan tombol:
<button onClick={handleGetAIInsight} disabled={aiLoading}>
  {aiLoading ? '🤔 Analyzing...' : '🤖 Get AI Insight'}
</button>

// AI insight ditampilkan sebagai expandable panel di bawah analisis data
// dengan label "AI Interpretation" dan disclaimer bahwa ini AI suggestion
```

**Catatan Penting:**
- AI insight bersifat **opsional** (tombol, bukan otomatis) agar tidak ada biaya yang tidak perlu
- Response di-cache per session di localStorage dengan key berdasarkan hash dari analysisData
- Jika API error, fallback ke rekomendasi rule-based yang sudah ada
- Tambahkan spinner dan loading state yang jelas

---

## FITUR 3: Tuning Notes & Session Journal

### Mengapa Ini Kritis
Tidak ada kompetitor yang punya ini. Pilot sering lupa apa yang sudah mereka ubah dan mengapa.
Ini adalah fitur yang sangat diminta di komunitas FPV.

### Yang Harus Dibangun

**Buat `src/lib/tuningJournal.js`:**
```javascript
// Structure untuk satu sesi tuning
const sessionStructure = {
  id: 'session_timestamp',
  droneName: 'My 5-inch',
  droneProfileSnapshot: {...},  // copy profil saat sesi dimulai
  startedAt: 'ISO string',
  completedAt: 'ISO string',
  stages: {
    noise: { notes: '', changesApplied: [], logFilename: '' },
    filters: { notes: '', changesApplied: [], logFilename: '' },
    // ... per stage
  },
  overallNotes: '',
  scoreBeforeTuning: null,
  scoreAfterTuning: null,
  tags: ['freestyle', '5inch', 'noise-fix'],  // user-defined tags
};

// Simpan di localStorage dengan key 'tuningJournal'
// Max 20 sessions, auto-delete oldest
```

**UI: Tambah Tab "Journal" di sidebar:**
```
┌─────────────────────────────────────────────┐
│ 📓 TUNING JOURNAL                           │
│                                             │
│ [+ New Session]    [🔍 Search]              │
│                                             │
│ Session History:                            │
│ ┌─────────────────────────────────────────┐ │
│ │ 📅 Mar 5, 2026 — "My 5-inch"           │ │
│ │ Stages: 7/7 ✅  Score: 45 → 82 (+37)   │ │
│ │ Tags: freestyle, noise-fix              │ │
│ │ [View] [Continue] [Export PDF]          │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 📅 Feb 28, 2026 — "Race Quad"          │ │
│ │ Stages: 3/7 🔄  Incomplete             │ │
│ │ [Resume] [Delete]                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Di setiap Stage Card, tambahkan:**
- Text area kecil "Notes for this stage" (auto-saved to journal)
- Field "Log filename" untuk track file yang dipakai
- Checkboxes sudah ada, tinggal link ke journal

---

## FITUR 4: Betaflight 2025.12 (v4.6) Compatibility Update

### Mengapa Ini Kritis
Betaflight 2025.12 menambahkan Chirp Signal Generator, sebuah tuning tool baru yang mengirim stepped input signals ke satu axis sekaligus untuk menghasilkan blackbox data yang konsisten untuk analisis PID. App yang support fitur baru ini akan langsung relevan.

### Yang Harus Dibangun

**Update `src/lib/cliParser.js` — tambah params baru BF 2025.12:**
```javascript
// Parameter baru di Betaflight 2025.12 yang harus di-parse:
const BF_2025_PARAMS = [
  // Chirp Signal Generator
  'chirp_amplitude',
  'chirp_frequency_start_hz',
  'chirp_frequency_end_hz',
  
  // TPA airspeed mode (untuk fixed-wing, tapi bisa muncul di log)
  'tpa_mode',  // sudah ada, tapi sekarang ada mode baru
  
  // GPS-related (untuk builds dengan GPS)
  'gps_rescue_alt_mode',
  'altitude_hold_deadband',
  
  // Dynamic idle improvements
  'dyn_idle_p_gain',
  'dyn_idle_i_gain',
  'dyn_idle_d_gain',
  
  // S-term (baru di 2025.12)
  's_roll',
  's_pitch',
  's_yaw',
];
```

**Tambah deteksi Betaflight version di `blackboxParser.js`:**
```javascript
// Di header parsing, extract firmware version
// Jika versi >= 2025.12 (atau >= 4.6):
// - Parse chirp signal data jika ada
// - Enable S-term display jika ada di log
// - Tampilkan badge "BF 2025.12 Compatible" di UI
```

**Tambah S-term ke PID Analyzer Stage:**
- S-term adalah parameter baru untuk smoother flight di 2025.12
- Jika terdeteksi di CLI, tambahkan ke PID stage rekomendasi
- Penjelasan: "S-term reduces stick-to-motor latency by [penjelasan]"

---

## FITUR 5: Export & Sharing

### Mengapa Ini Kritis
Pilot sering ingin share tune mereka ke komunitas, atau minta review dari expert.
Tidak ada kompetitor yang punya fitur sharing yang baik.

### Yang Harus Dibangun

**A. Export Tuning Report (PDF/HTML)**

Buat `src/lib/reportGenerator.js`:
```javascript
export const generateHTMLReport = (pipelineState, droneProfile, analysisResults) => {
  // Generate HTML yang bisa di-print atau di-save sebagai PDF
  // via browser print dialog (window.print())
  
  // Content:
  // - Header: drone name, date, operator
  // - Hardware summary
  // - Per-stage summary: issues found, changes applied
  // - Before/after comparison (jika ada comparison log)
  // - Full CLI command list (semua perubahan)
  // - Test flight checklist
  
  return htmlString;
};

// Trigger dengan: 
// 1. Buka HTML di new window
// 2. window.print() untuk PDF
// Tidak butuh library PDF external
```

**B. Share Tune (Shareable Link via URL Encoding)**

```javascript
// Encode semua recommended CLI commands ke URL parameter
// Format: #tune=base64encodedCLICommands
// 
// Contoh: https://app.com/#tune=eyJwX3JvbGwiOjQ1...
//
// Saat buka link ini, app akan:
// 1. Decode parameter
// 2. Tampilkan "Shared Tune" viewer
// 3. Pilot bisa langsung copy CLI commands atau apply via WebSerial
//
// CATATAN: Tidak perlu backend, semua di URL hash
```

**C. Betaflight Preset Export**

```javascript
// Export ke format Betaflight Presets (JSON)
// yang bisa di-import langsung ke Betaflight Configurator
// via Presets tab → Import Custom Preset
export const exportAsBetaflightPreset = (pipelineState, droneProfile) => {
  return {
    description: `${droneProfile.drone_name} - Tuned ${new Date().toLocaleDateString()}`,
    author: 'BF Tuning Assist',
    discussion: '',
    include: [],
    options: [],
    settings: generateCLISettings(pipelineState)
  };
};
```

---

## FITUR 6: Motor Health Heatmap (Visual Differentiator)

### Mengapa Ini Kritis
PIDtoolbox punya noise heatmap (throttle vs frequency) yang sangat populer di komunitas.
Ini adalah visualisasi yang paling sering di-screenshot dan di-share.
Membuat versi ini di browser akan menjadi differentiator visual yang kuat.

### Yang Harus Dibangun

**Update `src/lib/analyzers/noiseProfile.js` — tambah heatmap data:**
```javascript
// Fungsi baru: generateNoiseHeatmap(blackboxData)
// Output: 2D array [throttle_bucket][frequency_bucket] = intensity
// 
// Throttle: bagi jadi 20 bucket (0-5%, 5-10%, ..., 95-100%)
// Frequency: bagi jadi 50 bucket (0-500Hz dengan resolusi 10Hz)
// Intensity: RMS gyro noise di throttle range dan freq range tersebut
//
// Algoritma:
// 1. Loop semua frames blackbox
// 2. Group frames by throttle percentage
// 3. Untuk setiap group, run FFT
// 4. Normalize intensity ke 0-255
// 5. Return 2D grid
```

**Buat `src/components/NoiseHeatmap.jsx`:**
```javascript
// Render heatmap menggunakan Canvas API (sudah ada di app)
// Color scale: biru (clean) → kuning → merah (noisy)
// X axis: Frequency (Hz) 0-500Hz
// Y axis: Throttle (%) 0-100%
// 
// Interaktif:
// - Hover = tooltip dengan nilai noise di frekuensi & throttle itu
// - Click = filter blackbox view ke throttle range itu
// - Overlay: tandai frekuensi RPM filter yang aktif sebagai vertical lines
```

---

## URUTAN IMPLEMENTASI

Berdasarkan impact vs effort:

```
PRIORITY 1 (High Impact, Relatif Mudah):
├── Fitur 4: BF 2025.12 compatibility — update parser, tambah S-term
└── Fitur 5C: Export preset ke format Betaflight — satu fungsi JS

PRIORITY 2 (High Impact, Medium Effort):
├── Fitur 1: Log Comparison — pakai analyzeAll dua kali, buat diff view
└── Fitur 3: Tuning Journal — localStorage CRUD + UI

PRIORITY 3 (Highest Impact, Butuh Perhatian):
├── Fitur 2: AI Interpretation — Anthropic API integration
└── Fitur 6: Noise Heatmap — Canvas rendering + FFT per throttle bucket

PRIORITY 4 (Nice to Have):
└── Fitur 5A+5B: Report export + shareable link
```

---

## Catatan untuk Copilot

- Stack: React 18 + Vite, JavaScript (bukan TypeScript), localStorage untuk persistence
- Jangan buat backend — semua client-side
- Jangan tambah library baru kecuali benar-benar perlu (Canvas API sudah ada)
- Pertahankan semua fitur yang sudah ada (WebSerial, multi-language, 36 presets, dll)
- Untuk AI feature, gunakan fetch ke Anthropic API langsung dari browser — sudah didukung CORS
- Semua teks baru harus ditambahkan ke `translations.js` untuk keempat bahasa
- Priority utama: Fitur 1 (Log Comparison) dan Fitur 2 (AI) adalah yang paling membedakan dari kompetitor

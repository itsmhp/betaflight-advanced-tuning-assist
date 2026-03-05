# GitHub Copilot Prompt: Refactor Tuning Workflow — Sequential Gate-Locked Pipeline

## Konteks Aplikasi yang Sudah Ada

Aplikasi ini adalah **Betaflight Advanced Tuning Assist** — React 18 + Vite, pure frontend (no backend),
JavaScript/JSX (bukan TypeScript), menggunakan React Context untuk state management, dan localStorage untuk persistence.

### File-file yang relevan dengan perubahan ini:

```
src/
├── pages/
│   └── TuneWorkflowPage.jsx        ← FILE UTAMA YANG AKAN DIREFACTOR
├── lib/
│   ├── analyzeAll.js               ← orchestrator 15 analysis tools (sudah ada)
│   ├── analyzers/
│   │   ├── noiseProfile.js         ← sudah ada (akan dipakai di Stage 1)
│   │   ├── filterAnalyzer.js       ← sudah ada (akan dipakai di Stage 2)
│   │   ├── stepResponseAnalyzer.js ← sudah ada (akan dipakai di Stage 3)
│   │   ├── feedforwardAnalyzer.js  ← sudah ada (akan dipakai di Stage 4)
│   │   ├── tpaAnalyzer.js          ← sudah ada (akan dipakai di Stage 5)
│   │   ├── antiGravityAnalyzer.js  ← sudah ada (akan dipakai di Stage 6)
│   │   └── motorHealthAnalyzer.js  ← sudah ada (input ke semua stage)
│   ├── blackboxParser.js           ← sudah ada
│   └── cliParser.js                ← sudah ada
├── context/
│   ├── DroneProfileContext.jsx     ← sudah ada (drone hardware info)
│   └── DataContext.jsx             ← sudah ada (flight data state)
└── components/
    └── shared/
        └── UIComponents.jsx        ← sudah ada (reuse buttons, cards, dll)
```

### State yang sudah ada di DataContext.jsx (jangan duplikasi):
```javascript
// DataContext sudah menyimpan:
blackboxData       // parsed .bbl data
cliData            // parsed CLI dump
analysisResults    // hasil analyzeAll()
```

### State yang sudah ada di DroneProfileContext.jsx (jangan duplikasi):
```javascript
// DroneProfileContext sudah menyimpan:
droneProfile = {
  frame_size,       // "5-inch", "3-inch", dll
  motor: { kv, amperage, brand },
  propeller: { diameter, pitch, brand },
  battery: { cells, mah },
  esc: { amperage, protocol },   // protocol: "DShot600", "DShot300", dll
  fc: { model, betaflight_version },
  weight
}
```

---

## Masalah yang Harus Diselesaikan

`TuneWorkflowPage.jsx` saat ini memiliki **8-step wizard** yang flownya:
Profile Drone → Upload Logs → Select Preset → Review Preset → Analyze Flight → View Findings → Apply Changes → Test & Log

**Masalahnya:** Semua rekomendasi tuning (PID, filter, feedforward, TPA, dll) muncul **sekaligus** tanpa urutan prioritas. User bisa langsung loncat ke PID tanpa memperbaiki noise dulu. Ini secara teknis salah — hasilnya tuning yang suboptimal.

---

## Yang Harus Dibangun

### Filosofi Utama (WAJIB DIPERTAHANKAN):
> Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification
>
> User **tidak bisa lanjut ke stage berikutnya** sampai stage saat ini di-confirm.
> Setiap stage harus selesai sebelum membuka stage selanjutnya.
> Ini bukan preferensi UI — ini urutan teknis yang benar.

---

## Implementasi Detail

### 1. Buat File Baru: `src/lib/tuningPipeline.js`

File ini adalah **state machine** untuk pipeline tuning. Tidak ada UI di sini.

```javascript
// src/lib/tuningPipeline.js

export const TUNING_STAGES = [
  {
    id: 'noise',
    index: 0,
    title: 'Noise Analysis',
    icon: '🔊',
    description: 'Identify motor/ESC noise sources before anything else. Noisy motors make PID tuning impossible.',
    analyzerKey: 'noiseProfile',    // key di analysisResults dari analyzeAll.js
    requiredData: ['blackbox'],     // data apa yang harus sudah diupload
  },
  {
    id: 'filters',
    index: 1,
    title: 'Filter Tuning',
    icon: '🎛️',
    description: 'Set gyro/D-term lowpass and RPM filters. Filters must be correct before PIDs are touched.',
    analyzerKey: 'filterAnalyzer',
    requiredData: ['blackbox', 'cli'],
  },
  {
    id: 'pids',
    index: 2,
    title: 'PID Tuning',
    icon: '⚙️',
    description: 'Tune P, I, D gains per axis. Only accurate after noise and filters are resolved.',
    analyzerKey: 'stepResponse',
    requiredData: ['blackbox', 'cli'],
  },
  {
    id: 'feedforward',
    index: 3,
    title: 'Feedforward',
    icon: '🎯',
    description: 'Tune stick response and feedforward transition for the desired feel.',
    analyzerKey: 'feedforward',
    requiredData: ['blackbox'],
  },
  {
    id: 'tpa',
    index: 4,
    title: 'TPA',
    icon: '📈',
    description: 'Throttle PID Attenuation — prevent oscillation at full throttle.',
    analyzerKey: 'tpa',
    requiredData: ['blackbox'],
  },
  {
    id: 'antiGravity',
    index: 5,
    title: 'Anti-Gravity',
    icon: '🚀',
    description: 'Compensate for I-term drop during quick throttle punches.',
    analyzerKey: 'antiGravity',
    requiredData: ['blackbox'],
  },
  {
    id: 'verification',
    index: 6,
    title: 'Verification',
    icon: '✅',
    description: 'Final review — compare all before/after values and generate CLI output.',
    analyzerKey: null,              // verification tidak pakai single analyzer
    requiredData: ['blackbox', 'cli'],
  },
];

// Status setiap stage
export const STAGE_STATUS = {
  LOCKED: 'locked',           // belum bisa diakses
  ACTIVE: 'active',           // sedang dikerjakan
  PENDING_CONFIRM: 'pending', // user sudah lihat issues, perlu confirm
  COMPLETED: 'completed',     // selesai, stage berikutnya terbuka
};

// Inisialisasi state pipeline
export const createInitialPipelineState = () => ({
  stages: TUNING_STAGES.map((stage, i) => ({
    ...stage,
    status: i === 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.LOCKED,
    userConfirmed: false,
    appliedRecommendations: [],   // CLI commands yang sudah di-apply user
    skippedWithWarning: false,
    completedAt: null,
  })),
  activeStageIndex: 0,
  sessionStarted: new Date().toISOString(),
  allCompleted: false,
});

// Reducer untuk pipeline state
export const pipelineReducer = (state, action) => {
  switch (action.type) {
    
    case 'CONFIRM_STAGE': {
      // User mengkonfirmasi mereka sudah apply rekomendasi stage ini
      const { stageIndex } = action.payload;
      const newStages = [...state.stages];
      
      // Tandai stage saat ini completed
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        status: STAGE_STATUS.COMPLETED,
        userConfirmed: true,
        completedAt: new Date().toISOString(),
      };
      
      // Buka stage berikutnya (jika ada)
      if (stageIndex + 1 < newStages.length) {
        newStages[stageIndex + 1] = {
          ...newStages[stageIndex + 1],
          status: STAGE_STATUS.ACTIVE,
        };
      }
      
      const nextIndex = stageIndex + 1 < newStages.length ? stageIndex + 1 : stageIndex;
      const allCompleted = newStages.every(s => s.status === STAGE_STATUS.COMPLETED);
      
      return {
        ...state,
        stages: newStages,
        activeStageIndex: nextIndex,
        allCompleted,
      };
    }
    
    case 'SKIP_STAGE_WITH_WARNING': {
      // User memilih skip (dengan modal warning)
      const { stageIndex } = action.payload;
      const newStages = [...state.stages];
      
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        status: STAGE_STATUS.COMPLETED,
        skippedWithWarning: true,
        completedAt: new Date().toISOString(),
      };
      
      if (stageIndex + 1 < newStages.length) {
        newStages[stageIndex + 1] = {
          ...newStages[stageIndex + 1],
          status: STAGE_STATUS.ACTIVE,
        };
      }
      
      return {
        ...state,
        stages: newStages,
        activeStageIndex: stageIndex + 1,
      };
    }
    
    case 'MARK_RECOMMENDATION_APPLIED': {
      // User menandai satu CLI command sudah di-apply
      const { stageIndex, command } = action.payload;
      const newStages = [...state.stages];
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        appliedRecommendations: [...newStages[stageIndex].appliedRecommendations, command],
      };
      return { ...state, stages: newStages };
    }
    
    case 'RESET_FROM_STAGE': {
      // Reset semua stage dari index tertentu (misal setelah re-upload data)
      const { fromIndex } = action.payload;
      const newStages = state.stages.map((stage, i) => {
        if (i < fromIndex) return stage; // stage sebelumnya tidak berubah
        if (i === fromIndex) return { ...stage, status: STAGE_STATUS.ACTIVE, userConfirmed: false, appliedRecommendations: [], skippedWithWarning: false, completedAt: null };
        return { ...stage, status: STAGE_STATUS.LOCKED, userConfirmed: false, appliedRecommendations: [], skippedWithWarning: false, completedAt: null };
      });
      return { ...state, stages: newStages, activeStageIndex: fromIndex, allCompleted: false };
    }
    
    default:
      return state;
  }
};

// Helper: ambil rekomendasi CLI dari analysisResults untuk stage tertentu
export const getStageRecommendations = (stage, analysisResults, droneProfile) => {
  if (!analysisResults || !stage.analyzerKey) return [];
  
  const result = analysisResults[stage.analyzerKey];
  if (!result) return [];
  
  // Setiap analyzer sudah return { recommendations: [...] }
  // Kita transform ke format yang lebih kaya untuk UI
  return (result.recommendations || []).map((rec, i) => ({
    id: `${stage.id}-rec-${i}`,
    message: typeof rec === 'string' ? rec : rec.message,
    cliCommand: typeof rec === 'object' ? rec.command : null,
    severity: typeof rec === 'object' ? rec.severity : 'info',
    param: typeof rec === 'object' ? rec.param : null,
    currentValue: typeof rec === 'object' ? rec.currentValue : null,
    suggestedValue: typeof rec === 'object' ? rec.suggestedValue : null,
  }));
};

// Helper: cek apakah data yang dibutuhkan stage sudah ada
export const stageDataReady = (stage, blackboxData, cliData) => {
  if (stage.requiredData.includes('blackbox') && !blackboxData) return false;
  if (stage.requiredData.includes('cli') && !cliData) return false;
  return true;
};
```

---

### 2. Refactor `TuneWorkflowPage.jsx`

Ganti total flow 8-step yang ada dengan pipeline 7-stage baru. Pertahankan file yang sama, ganti isinya.

**Struktur komponen yang harus dibuat dalam file ini:**

#### 2a. Hook utama
```javascript
// Di dalam TuneWorkflowPage.jsx
import { useReducer, useCallback, useState } from 'react';
import { useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { DroneProfileContext } from '../context/DroneProfileContext';
import { createInitialPipelineState, pipelineReducer, getStageRecommendations, stageDataReady, STAGE_STATUS } from '../lib/tuningPipeline';

const TuneWorkflowPage = () => {
  const { blackboxData, cliData, analysisResults } = useContext(DataContext);
  const { droneProfile } = useContext(DroneProfileContext);
  
  const [pipeline, dispatch] = useReducer(pipelineReducer, createInitialPipelineState());
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [pendingSkipIndex, setPendingSkipIndex] = useState(null);
  
  // Persist pipeline state ke localStorage (agar bisa resume session)
  // Key: 'tuningPipeline'
  // Load on mount, save on every dispatch
  
  // ... render
};
```

#### 2b. Layout utama halaman
```
TuneWorkflowPage
├── Header section
│   ├── Judul: "Sequential Tuning Pipeline"
│   ├── Subtitle: "Complete each stage in order for best results"
│   └── Progress bar: "X/7 stages complete" (visual bar)
│
├── Data Status Banner (PENTING!)
│   ├── Jika blackbox belum diupload: warning banner merah
│   │   "⚠️ No blackbox data. Upload a .bbl file to enable analysis."
│   │   [Upload Now button → navigate ke Dashboard/upload section]
│   └── Jika CLI belum diupload: warning banner kuning
│       "⚠️ No CLI dump. Some recommendations may be incomplete."
│
└── Stage Pipeline (vertical list)
    ├── StageCard (noise)
    ├── StageCard (filters)
    ├── StageCard (pids)
    ├── StageCard (feedforward)
    ├── StageCard (tpa)
    ├── StageCard (antiGravity)
    └── StageCard (verification)
```

#### 2c. Komponen `StageCard`

Buat sebagai sub-komponen di dalam `TuneWorkflowPage.jsx` (atau file terpisah `src/components/StageCard.jsx`).

```javascript
// StageCard harus memiliki 3 visual state:

// STATE 1: LOCKED
// Tampilan: card abu-abu, opacity 50%, ikon kunci 🔒
// Content: hanya judul + "Complete previous stages to unlock"
// Tidak ada interaksi

// STATE 2: ACTIVE (stage yang sedang dikerjakan)
// Tampilan: card highlighted, border warna accent
// Content:
//   ├── Header: nomor, ikon, judul, status badge "Active ▶"
//   ├── Description: penjelasan kenapa stage ini penting
//   ├── Data readiness check:
//   │   └── Jika data kurang: inline warning + link upload
//   ├── Analysis Results section:
//   │   ├── Health score dari analyzerKey (gauge atau number besar)
//   │   ├── Issues list (color-coded: 🔴 Critical, 🟡 Warning, 🟢 OK)
//   │   └── Setiap issue harus ada PENJELASAN KENAPA, bukan hanya "nilai X terlalu tinggi"
//   ├── Recommendations section:
//   │   ├── Setiap rekomendasi sebagai card kecil:
//   │   │   ├── Penjelasan dalam bahasa manusia
//   │   │   ├── CLI command (jika ada) dengan tombol copy 📋
//   │   │   ├── Before/After value (jika ada)
//   │   │   └── Checkbox "I've applied this" (update appliedRecommendations)
//   │   └── "Copy All Commands" button
//   └── Action buttons (bawah):
//       ├── [✅ I've Applied These Changes — Continue to Next Stage] (primary, biru/hijau)
//       └── [⚠️ Skip This Stage] (secondary, abu-abu) → trigger modal warning

// STATE 3: COMPLETED
// Tampilan: card collapsed, border hijau, checkmark ✅
// Content:
//   ├── Header: nomor, ikon, judul, badge "Completed ✅"
//   ├── Summary satu baris: berapa rekomendasi yang di-apply, score-nya berapa
//   ├── Jika skipped: badge "Skipped ⚠️" dengan catatan
//   └── [Expand] toggle untuk lihat detail kembali
```

#### 2d. Stage Verification (Stage 7) — SPECIAL CASE

Stage terakhir tidak pakai analyzer biasa, tapi generate laporan lengkap:

```javascript
// Konten VerificationStage:
// 1. Summary tabel semua stage:
//    | Stage | Status | Issues Found | Applied | Skipped |
//    | Noise | ✅ Done | 2 issues | 2/2 | - |
//    | Filters | ✅ Done | 1 issue | 1/1 | - |
//    | ... | ... | ... | ... | ... |

// 2. Diff CLI commands — tampilkan semua perintah dari semua stage
//    yang user sudah centang "I've applied this"
//    Format: textarea besar siap di-copy, atau tombol export .txt

// 3. Test flight checklist (interactive checkboxes):
//    □ Hover test — periksa apakah ada oscillasi saat hover
//    □ Slow roll — periksa P oscillation
//    □ Fast roll — periksa I washout  
//    □ Hard stop — periksa D overshoot
//    □ Full throttle punch — periksa TPA + anti-gravity
//    □ Inverted hover — periksa propwash

// 4. "Start New Tuning Session" button → reset pipeline
// 5. "Export Full Report" button → generate ringkasan semua perubahan
```

#### 2e. Skip Warning Modal

```javascript
// Modal muncul saat user klik "Skip This Stage"
// Konten modal:
// 
// Judul: "⚠️ Skip [Stage Name]?"
// 
// Pesan (sesuaikan per stage):
// - Skip Noise: "Skipping noise analysis means your PIDs and filters will be tuned
//   on top of unresolved noise. This often leads to motor heating, oscillations,
//   and incorrect PID values that feel 'off'. Strongly not recommended."
// - Skip Filters: "Filters must be correct before PID values mean anything.
//   PIDs tuned without proper filtering are unreliable."
// - (dst per stage)
//
// Buttons:
// [Go Back — I'll Complete This Stage] (primary)
// [Skip Anyway — I Know What I'm Doing] (danger/red, secondary)
```

---

### 3. Update `analyzeAll.js` — Pastikan keys match

Pastikan `analyzeAll.js` me-return object dengan keys yang match `analyzerKey` di `TUNING_STAGES`:

```javascript
// analyzeAll.js harus return:
{
  noiseProfile: { health_score, status, recommendations, chart_data, metrics },
  filterAnalyzer: { health_score, status, recommendations, chart_data, metrics },
  stepResponse: { health_score, status, recommendations, chart_data, metrics },
  feedforward: { health_score, status, recommendations, chart_data, metrics },
  tpa: { health_score, status, recommendations, chart_data, metrics },
  antiGravity: { health_score, status, recommendations, chart_data, metrics },
  // ... (15 tools lainnya tetap ada, tidak dihapus)
}

// PENTING: Jika key sudah ada tapi namanya berbeda (misal 'noiseAnalyzer' bukan 'noiseProfile'),
// update TUNING_STAGES analyzerKey agar match dengan key yang sudah ada.
// JANGAN rename key yang sudah ada di analyzeAll.js karena bisa break halaman lain.
```

---

### 4. Update Sidebar / Navigasi

Di `Sidebar.jsx`, update tab "Tune Your Quad" agar menampilkan mini progress:

```javascript
// Di sidebar item "Tune Your Quad":
// Tampilkan: "Tune Your Quad  [3/7 ✅]"
// Ambil pipeline state dari localStorage untuk tampilkan progress
// tanpa perlu pass props panjang
```

---

### 5. Re-upload Data — Reset Logic

Di dalam `TuneWorkflowPage.jsx`, tambahkan `useEffect` yang watch `blackboxData` dan `cliData`:

```javascript
useEffect(() => {
  // Jika data baru diupload setelah pipeline sudah berjalan
  if (pipeline.activeStageIndex > 0 && blackboxData) {
    // Tampilkan banner: "New data detected. Reset pipeline from Stage 1?"
    // Dengan 2 opsi:
    // [Reset from Stage 1 — Re-analyze Everything]
    // [Keep Progress — Continue from Stage X]
  }
}, [blackboxData, cliData]);
```

---

## Hal yang TIDAK Boleh Diubah

1. **Jangan hapus** halaman lain (PresetsPage, DroneProfilePage, SerialCLIPage, dll)
2. **Jangan ubah** struktur DataContext atau DroneProfileContext
3. **Jangan ubah** 15 analyzer yang sudah ada di `src/lib/analyzers/`
4. **Jangan ubah** `analyzeAll.js` kecuali untuk memastikan keys match
5. **Jangan ubah** routing di `App.jsx` kecuali menambah path jika perlu
6. **Jangan hapus** 36 presets yang sudah ada
7. **Jangan hapus** WebSerial CLI Terminal
8. **Pertahankan** multi-language support (i18n) — tambahkan translation keys untuk teks baru di `translations.js`

---

## Urutan Implementasi yang Disarankan

```
Step 1: Buat src/lib/tuningPipeline.js (state machine, no UI)
         → Test: import dan instantiate, pastikan reducer berjalan
         
Step 2: Refactor TuneWorkflowPage.jsx — skeleton dulu
         → Tampilkan 7 stage cards statis tanpa logic
         → Pastikan locked/active/completed state terlihat berbeda secara visual
         
Step 3: Sambungkan ke analysisResults dari DataContext
         → Untuk setiap stage, pull data dari analyzerKey yang sesuai
         → Tampilkan health score dan recommendations

Step 4: Implementasi gate-lock logic
         → Tombol "Confirm & Continue" berfungsi
         → Stage berikutnya terbuka setelah confirm
         
Step 5: Implementasi Skip Warning Modal
         
Step 6: Implementasi Verification Stage (Stage 7)

Step 7: Persist state ke localStorage

Step 8: Re-upload reset logic

Step 9: Update translations.js untuk semua teks baru
```

---

## Catatan Teknis Penting

- **Tidak ada TypeScript** — gunakan JSDoc comment untuk type hints jika perlu
- **Tidak ada library baru** — gunakan React hooks dan patterns yang sudah ada
- **CSS** — gunakan class yang sudah ada di `index.css` atau inline styles sesuai style existing app
- **Performance** — `analysisResults` bisa besar, gunakan `useMemo` untuk derive stage-specific data
- **Error handling** — jika analyzer return null/undefined (data belum ada), tampilkan placeholder "Upload blackbox to see analysis" bukan error crash
- **Mobile** — pertimbangkan layout responsif, pilot sering buka di HP di lapangan

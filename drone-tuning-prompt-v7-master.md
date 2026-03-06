# MASTER PROMPT v7 — Betaflight Advanced Tuning Assist
# Semua Perbaikan Terbaru — Berdasarkan Screenshot + Feedback User

---

## KONTEKS APLIKASI (STATE SAAT INI)

Stack: **React 18 + Vite, JavaScript (bukan TypeScript), no backend, localStorage.**
Semua fitur dari prompt v2–v6 sudah diimplementasikan sebagian.

---

## ══════════════════════════════════════════
## BUG FIX 1: PID HEALTH ERROR
## ══════════════════════════════════════════

**Error:** `Objects are not valid as a React child (found: object with keys {message, param, currentValue, suggestedValue, command, severity})`

**Root Cause:** Di salah satu file analyzer (kemungkinan `noiseProfile.js`, `filterAnalyzer.js`, atau di `analyzeAll.js`), array `recommendations` berisi **object** bukan **string**. React tidak bisa render object langsung.

**Cari semua file yang memiliki pattern ini:**
```javascript
// DI src/lib/analyzers/*.js
// CARI: recommendations yang return array of objects
return {
  recommendations: [
    { message: '...', param: '...', ... }  // ← INI YANG MENYEBABKAN ERROR
  ]
}
```

**Fix di SETIAP analyzer — pisahkan recommendations (string) dari cliCommands (object):**
```javascript
// PATTERN YANG BENAR:
return {
  health_score: score,
  status: status,
  metrics: { ... },

  // recommendations HARUS array of STRING (untuk display teks)
  recommendations: [
    'Significant noise detected. Check props, motor bearings, and frame integrity.',
    'Enable or tune RPM filtering if using bidirectional DShot.',
    'Consider lowering gyro LPF and D-term LPF cutoff frequencies.',
  ],

  // cliCommands adalah array of OBJECT (untuk CLICommandsPanel)
  cliCommands: [
    {
      id: 'rpm_filter',
      comment: 'Enable RPM Filter',
      param: 'rpm_filter_harmonics',
      currentValue: '0',
      recommendedValue: '3',
      command: 'set rpm_filter_harmonics = 3',
      reason: 'Noise analysis shows harmonic peaks at motor frequencies.',
      severity: 'critical',
    },
  ],

  chart_data: { ... },
};
```

**Juga cek di `analyzeAll.js`:** Jika ada transformasi recommendations sebelum diteruskan ke UI, pastikan hasilnya selalu string array.

**Cek di semua komponen yang me-render recommendations:**
```javascript
// Di manapun recommendations dirender:
// SALAH:
{analysis.recommendations.map(rec => <div>{rec}</div>)}
// Jika rec adalah object, ini akan crash.

// BENAR — defensive rendering:
{analysis.recommendations.map((rec, i) => (
  <div key={i}>
    {typeof rec === 'string' ? rec : rec.message || rec.text || JSON.stringify(rec)}
  </div>
))}
```

---

## ══════════════════════════════════════════
## BUG FIX 2: QUAD CONDITION CARD LAYOUT
## ══════════════════════════════════════════

**Problem:** Dari screenshot, kartu Quad Condition berantakan — teks overflow, lebar tidak konsisten, kartu "Worn/Used" terpotong.

**Fix di `QuadConditionSelector.jsx` (atau di mana komponen ini berada):**

```javascript
// Ganti style kartu dengan ini — FIXED HEIGHT + PROPER OVERFLOW:
const cardStyle = (isSelected) => ({
  // WAJIB: fixed dimensions
  width: '22%',           // 4 kartu dalam satu row dengan gap
  minWidth: 120,
  minHeight: 180,
  padding: '16px 12px',
  
  // Layout internal
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  
  // Visual
  background: isSelected ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)',
  border: `2px solid ${isSelected ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  
  // CRITICAL: prevent text overflow
  overflow: 'hidden',
  wordBreak: 'break-word',
  hyphens: 'auto',
  
  // Hover
  ':hover': { borderColor: 'rgba(6,182,212,0.4)' },
});

// Container kartu:
const containerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',  // 4 kolom equal width
  gap: 12,
  width: '100%',
};

// Icon — ukuran fixed:
const iconStyle = {
  fontSize: 28,
  lineHeight: 1,
  flexShrink: 0,  // PENTING: jangan shrink
};

// Label — max 2 baris:
const labelStyle = (isSelected) => ({
  fontSize: 13,
  fontWeight: 700,
  color: isSelected ? '#06b6d4' : '#e2e8f0',
  textAlign: 'center',
  lineHeight: 1.3,
  // Max 2 baris
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

// Description — max 4 baris:
const descStyle = {
  fontSize: 11,
  color: '#64748b',
  textAlign: 'center',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// Responsive: di layar kecil, 2 kolom
// Tambahkan di index.css:
// @media (max-width: 480px) {
//   .quad-condition-grid { grid-template-columns: repeat(2, 1fr) !important; }
// }
```

**Ganti juga icon "Juicy" (🍊) dengan icon kotak jus (🧃):**
```javascript
// SEBELUM:
{ id: 'juicy', icon: '🍊', label: 'Juicy', ... }

// SESUDAH:
{ id: 'juicy', icon: '🧃', label: 'Juicy', ... }

// Cari SEMUA tempat di codebase yang menggunakan icon 🍊 untuk style juicy dan ganti ke 🧃
```

---

## ══════════════════════════════════════════
## FITUR 1: RATE PROFILES — PERBAIKAN LENGKAP
## ══════════════════════════════════════════

### 1A. Urutan Tampilan — My Rates Dulu, Community Rates Sesudah

```javascript
// Di RatesPage.jsx, ubah urutan render:
// SEBELUM: Community Rates → My Rates
// SESUDAH: My Rates → Community Rates

// Layout:
// ── MY RATES ──────────────────────────────── [+ New Rate]
// [kartu user rates]
//
// ── COMMUNITY RATES ──────────────────────────────────────
// [filter + search bar]
// [kartu community rates]
```

### 1B. Layout Rate Values — ROWS bukan COLUMNS

Di semua tempat yang menampilkan rate values (form editor, preview card, popup detail, comparison), ubah dari layout kolom (Roll | Pitch | Yaw sebagai kolom) menjadi **baris** (Roll, Pitch, Yaw sebagai baris):

```javascript
// SEBELUM (kolom — JANGAN):
//          ROLL    PITCH    YAW
// RC Rate  1.00    1.00    1.00
// Rate     0.70    0.70    0.50
// Expo     0.00    0.00    0.00

// SESUDAH (baris — HARUS):
//        RC Rate   Rate    Expo    Peak
// Roll    1.00     0.70    0.00    670°/s
// Pitch   1.00     0.70    0.00    670°/s
// Yaw     1.00     0.50    0.00    360°/s

// Implementasi sebagai HTML table:
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
  <thead>
    <tr>
      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Axis</th>
      <th style={{ textAlign: 'right', padding: '6px 10px', color: '#64748b', fontSize: 11 }}>RC Rate</th>
      <th style={{ textAlign: 'right', padding: '6px 10px', color: '#64748b', fontSize: 11 }}>Rate</th>
      <th style={{ textAlign: 'right', padding: '6px 10px', color: '#64748b', fontSize: 11 }}>Expo</th>
      <th style={{ textAlign: 'right', padding: '6px 10px', color: '#64748b', fontSize: 11 }}>Peak</th>
    </tr>
  </thead>
  <tbody>
    {['roll', 'pitch', 'yaw'].map(axis => (
      <tr key={axis} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{axis}</td>
        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'monospace', fontSize: 13 }}>
          {profile[axis].rc_rate?.toFixed(2) || profile[axis].center_sensitivity}
        </td>
        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'monospace', fontSize: 13 }}>
          {profile[axis].rate?.toFixed(2) || profile[axis].max_rate}
        </td>
        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'monospace', fontSize: 13 }}>
          {(profile[axis].expo || 0).toFixed(2)}
        </td>
        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'monospace', color: '#22c55e', fontSize: 13 }}>
          {getPeakRate(profile, axis)}°/s
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 1C. Rate Detail Popup

Saat user klik rate card (community maupun custom), tampilkan **popup/modal** dengan detail lengkap:

```javascript
// Buat komponen RateDetailModal.jsx

const RateDetailModal = ({ rate, onClose, onCopy, onCompare, compareMode = false }) => {
  const [copiedCLI, setCopiedCLI] = useState(false);

  return (
    // Overlay + centered modal
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 24, maxWidth: 560, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{rate.name}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {rate.pilotName && `${rate.pilotName} · `}
              {rate.quadName && `${rate.quadName} · `}
              {rate.rateType?.toUpperCase()}
              {rate.createdAt && ` · ${new Date(rate.createdAt).toLocaleDateString()}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tags */}
        {rate.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {rate.tags.map(tag => (
              <span key={tag} style={{ padding: '2px 10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, fontSize: 11, color: '#a5b4fc' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {rate.notes && (
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
            💬 {rate.notes}
          </div>
        )}

        {/* Rate Values Table (rows layout) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Rate Values</div>
          {/* RateValuesTable component — row layout seperti di 1B */}
          <RateValuesTable profile={rate} />
        </div>

        {/* Rate Curve Preview (Canvas) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Curve Preview</div>
          <RateCurveChart profile={rate} height={150} />
        </div>

        {/* Throttle */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, fontSize: 13 }}>
          <span>Throttle Mid: <strong>{rate.thr_mid || 0.5}</strong></span>
          <span>Throttle Expo: <strong>{rate.thr_expo || 0.0}</strong></span>
        </div>

        {/* CLI Output */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>CLI Commands</div>
          <pre style={{ background: '#080814', padding: 12, borderRadius: 8, fontSize: 12, color: '#a0aec0', overflowX: 'auto', margin: 0 }}>
            {generateRateCLI(rate)}
          </pre>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { navigator.clipboard.writeText(generateRateCLI(rate)); setCopiedCLI(true); setTimeout(() => setCopiedCLI(false), 2000); }}
            style={{ flex: 1, padding: '10px 16px', background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 8, color: '#93c5fd', cursor: 'pointer', fontSize: 13 }}>
            {copiedCLI ? '✅ Copied!' : '📋 Copy CLI'}
          </button>
          <button onClick={() => onCompare(rate)}
            style={{ flex: 1, padding: '10px 16px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#a5b4fc', cursor: 'pointer', fontSize: 13 }}>
            ⚖️ {compareMode ? 'Compare with This' : 'Compare'}
          </button>
          {rate.source === 'custom' && (
            <button onClick={() => { /* open edit form */ }}
              style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 1D. Rate Comparison Feature

```javascript
// State di RatesPage:
const [compareList, setCompareList] = useState([]); // max 3 rates
const [showCompareModal, setShowCompareModal] = useState(false);

// Tambah/hapus dari compare list:
const toggleCompare = (rate) => {
  setCompareList(prev => {
    if (prev.find(r => r.id === rate.id)) return prev.filter(r => r.id !== rate.id);
    if (prev.length >= 3) return [...prev.slice(1), rate]; // replace yang paling lama
    return [...prev, rate];
  });
};

// Compare bar (muncul saat ada 2+ di compareList):
{compareList.length >= 2 && (
  <div style={{ position: 'sticky', bottom: 0, background: '#0f172a', borderTop: '1px solid #1e293b', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
    <span style={{ fontSize: 13, color: '#64748b' }}>Comparing: {compareList.map(r => r.name).join(' vs ')}</span>
    <button onClick={() => setShowCompareModal(true)} style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
      ⚖️ Compare Now
    </button>
    <button onClick={() => setCompareList([])} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
      Clear
    </button>
  </div>
)}

// RateCompareModal — tampilkan 2–3 rates side by side:
const RateCompareModal = ({ rates, onClose }) => (
  <div style={{ /* overlay */ }}>
    <div style={{ /* modal */ }}>
      <h2>Rate Comparison</h2>

      {/* Header: nama rates */}
      <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${rates.length}, 1fr)`, gap: 1 }}>
        <div /> {/* empty corner */}
        {rates.map(r => (
          <div key={r.id} style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.1)', textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
            {r.name}
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{r.pilotName}</div>
          </div>
        ))}

        {/* Rows per axis per param */}
        {['roll', 'pitch', 'yaw'].map(axis =>
          ['rc_rate', 'rate', 'expo'].map(param => (
            <React.Fragment key={`${axis}-${param}`}>
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                {axis} {param.replace('rc_rate', 'RC Rate').replace('rate', 'S.Rate')}
              </div>
              {rates.map(r => {
                const val = r[axis]?.[param] ?? '-';
                // Highlight min/max
                const allVals = rates.map(rr => rr[axis]?.[param] || 0);
                const isHighest = val === Math.max(...allVals);
                return (
                  <div key={r.id} style={{
                    padding: '8px 12px', textAlign: 'center',
                    fontFamily: 'monospace', fontSize: 13,
                    color: isHighest ? '#22c55e' : '#e2e8f0',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    {typeof val === 'number' ? val.toFixed(2) : val}
                  </div>
                );
              })}
            </React.Fragment>
          ))
        )}

        {/* Peak rates row */}
        <div style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Peak Roll</div>
        {rates.map(r => (
          <div key={r.id} style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#22c55e', fontWeight: 700, fontSize: 14 }}>
            {getPeakRate(r, 'roll')}°/s
          </div>
        ))}
      </div>

      {/* Overlay curve chart - semua rates dalam 1 chart */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Rate Curves Overlay</div>
        <RateCurveCompareChart rates={rates} height={200} />
      </div>

      <button onClick={onClose} style={{ marginTop: 16, padding: '10px 20px', background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
        Close
      </button>
    </div>
  </div>
);
```

### 1E. Filter & Search Community Rates

```javascript
// State:
const [searchQuery, setSearchQuery] = useState('');
const [filterStyle, setFilterStyle] = useState('all');
const [filterRateType, setFilterRateType] = useState('all');
const [filterPeakMin, setFilterPeakMin] = useState(0);
const [filterPeakMax, setFilterPeakMax] = useState(2000);

// Filter logic:
const filteredCommunityRates = COMMUNITY_RATES.filter(rate => {
  if (searchQuery && !rate.name.toLowerCase().includes(searchQuery.toLowerCase())
    && !rate.pilotName?.toLowerCase().includes(searchQuery.toLowerCase())
    && !rate.tags?.some(t => t.includes(searchQuery.toLowerCase()))) return false;
  if (filterStyle !== 'all' && rate.quadType !== filterStyle) return false;
  if (filterRateType !== 'all' && rate.rateType !== filterRateType) return false;
  const peak = getPeakRate(rate, 'roll');
  if (peak < filterPeakMin || peak > filterPeakMax) return false;
  return true;
});

// Filter UI:
<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
  <input
    type="text" placeholder="Search pilot, name, tag..."
    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
    style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13 }}
  />
  <select value={filterStyle} onChange={e => setFilterStyle(e.target.value)}
    style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13 }}>
    <option value="all">All Styles</option>
    <option value="freestyle">🎭 Freestyle</option>
    <option value="racing">🏁 Racing</option>
    <option value="cinematic">🎬 Cinematic</option>
    <option value="longrange">📡 Long Range</option>
    <option value="whoop">🤏 Whoop</option>
  </select>
  <select value={filterRateType} onChange={e => setFilterRateType(e.target.value)}
    style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 13 }}>
    <option value="all">All Rate Types</option>
    <option value="actual">Actual</option>
    <option value="betaflight">Betaflight</option>
    <option value="kiss">KISS</option>
    <option value="quick">QuickRates</option>
  </select>
</div>
```

### 1F. Community Rates Database (50+ Pilots)

Buat `src/lib/communityRates.js` dengan data berikut. Semua nilai ini adalah referensi nyata dari komunitas FPV:

```javascript
export const COMMUNITY_RATES = [
  // ── FREESTYLE PILOTS ───────────────────────────────────────────
  {
    id: 'oscarliang-thumbing',
    name: 'Freestyle Thumbing',
    pilotName: 'Oscar Liang',
    website: 'oscarliang.com',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['freestyle', 'thumbing', 'smooth', 'beginner-friendly'],
    notes: 'Great all-around freestyle rates. Smooth center, good max rate for tricks.',
    roll:  { center_sensitivity: 180, max_rate: 670, expo: 0.0 },
    pitch: { center_sensitivity: 180, max_rate: 670, expo: 0.0 },
    yaw:   { center_sensitivity: 120, max_rate: 500, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'oscarliang-pinching',
    name: 'Freestyle Pinching',
    pilotName: 'Oscar Liang',
    website: 'oscarliang.com',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['freestyle', 'pinching', 'precise'],
    notes: 'Higher center sensitivity for pinchers — more accurate fine movements.',
    roll:  { center_sensitivity: 220, max_rate: 670, expo: 0.0 },
    pitch: { center_sensitivity: 220, max_rate: 670, expo: 0.0 },
    yaw:   { center_sensitivity: 140, max_rate: 500, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'jbardwell-flow',
    name: 'Flow Rates',
    pilotName: 'Joshua Bardwell',
    website: 'youtube.com/@JoshuaBardwell',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['flow', 'smooth', 'medium', 'popular'],
    notes: 'Very popular rates. Smooth feel, good for learning freestyle.',
    roll:  { rc_rate: 1.0, rate: 0.7, expo: 0.15 },
    pitch: { rc_rate: 1.0, rate: 0.7, expo: 0.15 },
    yaw:   { rc_rate: 1.0, rate: 0.5, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'mrsteele-juicy',
    name: 'Juicy Rates',
    pilotName: 'Mr. Steele',
    website: 'youtube.com/@MrSteeleFPV',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['juicy', 'freestyle', 'snap', 'high-rate', 'advanced'],
    notes: 'High rate, snap feel. Classic Mr. Steele style for juicy freestyle.',
    roll:  { rc_rate: 1.2, rate: 0.73, expo: 0.0 },
    pitch: { rc_rate: 1.2, rate: 0.73, expo: 0.0 },
    yaw:   { rc_rate: 1.0, rate: 0.5, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'ledrib-flow',
    name: 'Flow Freestyle',
    pilotName: 'Le Drib',
    website: 'youtube.com/@LeDrib',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['flow', 'smooth', 'hangtime', 'buttery'],
    notes: 'Known for buttery smooth flow lines. Lower max rate, high expo.',
    roll:  { center_sensitivity: 160, max_rate: 620, expo: 0.15 },
    pitch: { center_sensitivity: 160, max_rate: 620, expo: 0.15 },
    yaw:   { center_sensitivity: 100, max_rate: 440, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.2,
  },
  {
    id: 'nytfury-sbang',
    name: 'Sbang Style',
    pilotName: 'Nytfury',
    website: 'youtube.com/@Nytfury',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['sbang', 'snap', 'high-rate', 'aggressive', 'advanced'],
    notes: 'Very high rate for sbang style. Full stick very fast — for experts only.',
    roll:  { rc_rate: 1.35, rate: 0.75, expo: 0.0 },
    pitch: { rc_rate: 1.35, rate: 0.75, expo: 0.0 },
    yaw:   { rc_rate: 1.0,  rate: 0.5,  expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'ummagawd-freestyle',
    name: 'Umma Rates',
    pilotName: 'Ummagawd',
    website: 'youtube.com/@ummagawd',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['freestyle', 'medium', 'versatile'],
    notes: 'Versatile rates good for both freestyle and casual flying.',
    roll:  { rc_rate: 1.1, rate: 0.68, expo: 0.1 },
    pitch: { rc_rate: 1.1, rate: 0.68, expo: 0.1 },
    yaw:   { rc_rate: 1.0, rate: 0.5,  expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'rotorriot-freestyle',
    name: 'Rotor Riot Freestyle',
    pilotName: 'Rotor Riot',
    website: 'youtube.com/@RotorRiot',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['freestyle', 'popular', 'beginner-friendly'],
    notes: 'Team Rotor Riot rates — great all-around starting point.',
    roll:  { rc_rate: 1.05, rate: 0.72, expo: 0.1 },
    pitch: { rc_rate: 1.05, rate: 0.72, expo: 0.1 },
    yaw:   { rc_rate: 1.0,  rate: 0.5,  expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'fpvknowitall-medium',
    name: 'Balanced Freestyle',
    pilotName: 'FPV Know It All',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['balanced', 'freestyle', 'medium'],
    notes: 'Balanced rates for general freestyle. Not too snappy, not too soft.',
    roll:  { center_sensitivity: 200, max_rate: 700, expo: 0.0 },
    pitch: { center_sensitivity: 200, max_rate: 700, expo: 0.0 },
    yaw:   { center_sensitivity: 130, max_rate: 470, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'shaggyfpv-flow',
    name: 'Flow Lines',
    pilotName: 'Shaggy FPV',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['flow', 'smooth', 'cinematic-ish'],
    notes: 'Shaggy flow style — smooth arcs, lower center sensitivity.',
    roll:  { rc_rate: 0.9, rate: 0.65, expo: 0.2 },
    pitch: { rc_rate: 0.9, rate: 0.65, expo: 0.2 },
    yaw:   { rc_rate: 0.9, rate: 0.45, expo: 0.1 },
    thr_mid: 0.5, thr_expo: 0.15,
  },
  {
    id: 'supafly-betaflight',
    name: 'SupaFly BF Rates',
    pilotName: 'SupaFly FPV',
    website: 'supaflyfpv.com',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['freestyle', 'classic', 'balanced'],
    notes: 'Classic Betaflight rates from SupaFly. High expo, no superrate.',
    roll:  { rc_rate: 2.2, rate: 0.0, expo: 0.75 },
    pitch: { rc_rate: 2.2, rate: 0.0, expo: 0.75 },
    yaw:   { rc_rate: 2.12, rate: 0.0, expo: 0.75 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  {
    id: 'supafly-kiss',
    name: 'SupaFly KISS Rates',
    pilotName: 'SupaFly FPV',
    website: 'supaflyfpv.com',
    quadType: 'freestyle',
    rateType: 'kiss',
    tags: ['kiss', 'freestyle', 'classic'],
    notes: 'KISS rates version from SupaFly community.',
    roll:  { rc_rate: 1.3, rate: 0.75, expo: 0.35 },
    pitch: { rc_rate: 1.3, rate: 0.75, expo: 0.35 },
    yaw:   { rc_rate: 1.3, rate: 0.65, expo: 0.35 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  // ── RACING PILOTS ──────────────────────────────────────────────
  {
    id: 'quadmovr-race',
    name: 'Race Rates',
    pilotName: 'QuadMovr',
    website: 'youtube.com/@QuadMovr',
    quadType: 'racing',
    rateType: 'actual',
    tags: ['racing', 'precise', 'low-expo', 'high-center'],
    notes: 'High center sensitivity for gate precision. Lower max rate than freestyle.',
    roll:  { center_sensitivity: 230, max_rate: 600, expo: 0.0 },
    pitch: { center_sensitivity: 230, max_rate: 600, expo: 0.0 },
    yaw:   { center_sensitivity: 160, max_rate: 450, expo: 0.0 },
    thr_mid: 0.45, thr_expo: 0.0,
  },
  {
    id: 'race-classic-low',
    name: 'Classic Race Low',
    pilotName: 'Generic Race',
    quadType: 'racing',
    rateType: 'actual',
    tags: ['racing', 'low-rate', 'precise', 'gates'],
    notes: 'Low max rate for precise gate flying. Standard race setup.',
    roll:  { center_sensitivity: 200, max_rate: 450, expo: 0.0 },
    pitch: { center_sensitivity: 200, max_rate: 450, expo: 0.0 },
    yaw:   { center_sensitivity: 140, max_rate: 360, expo: 0.0 },
    thr_mid: 0.45, thr_expo: 0.0,
  },
  {
    id: 'race-betaflight-standard',
    name: 'Race BF Standard',
    pilotName: 'Generic Race',
    quadType: 'racing',
    rateType: 'betaflight',
    tags: ['racing', 'betaflight', 'linear', 'standard'],
    notes: 'Standard Betaflight racing rates. Linear, predictable.',
    roll:  { rc_rate: 0.9, rate: 0.38, expo: 0.0 },
    pitch: { rc_rate: 0.9, rate: 0.38, expo: 0.0 },
    yaw:   { rc_rate: 0.9, rate: 0.3,  expo: 0.0 },
    thr_mid: 0.45, thr_expo: 0.0,
  },
  {
    id: 'drl-race-style',
    name: 'DRL Style',
    pilotName: 'DRL Generic',
    quadType: 'racing',
    rateType: 'actual',
    tags: ['racing', 'DRL', 'league-racing', 'precise'],
    notes: 'Drone Racing League-inspired setup. Low and precise.',
    roll:  { center_sensitivity: 180, max_rate: 500, expo: 0.0 },
    pitch: { center_sensitivity: 180, max_rate: 500, expo: 0.0 },
    yaw:   { center_sensitivity: 120, max_rate: 380, expo: 0.0 },
    thr_mid: 0.45, thr_expo: 0.0,
  },
  // ── CINEMATIC PILOTS ───────────────────────────────────────────
  {
    id: 'cinematic-slow',
    name: 'Cinematic Smooth',
    pilotName: 'Generic Cine',
    quadType: 'cinematic',
    rateType: 'actual',
    tags: ['cinematic', 'smooth', 'slow', 'ultra-smooth'],
    notes: 'Ultra smooth for cinematic shots. Very low center sensitivity.',
    roll:  { center_sensitivity: 100, max_rate: 400, expo: 0.4 },
    pitch: { center_sensitivity: 100, max_rate: 400, expo: 0.4 },
    yaw:   { center_sensitivity: 80,  max_rate: 300, expo: 0.3 },
    thr_mid: 0.5, thr_expo: 0.4,
  },
  {
    id: 'cinewhoop-smooth',
    name: 'Cinewhoop Rates',
    pilotName: 'Generic Cinewhoop',
    quadType: 'cinematic',
    rateType: 'actual',
    tags: ['cinewhoop', 'indoor', 'smooth', 'filming'],
    notes: 'Low rates for cinewhoop indoor flying. Very controlled.',
    roll:  { center_sensitivity: 120, max_rate: 380, expo: 0.3 },
    pitch: { center_sensitivity: 120, max_rate: 380, expo: 0.3 },
    yaw:   { center_sensitivity: 100, max_rate: 300, expo: 0.2 },
    thr_mid: 0.55, thr_expo: 0.3,
  },
  // ── WHOOP/MICRO ─────────────────────────────────────────────────
  {
    id: 'oscarliang-whoop',
    name: 'Tiny Whoop Indoor',
    pilotName: 'Oscar Liang',
    website: 'oscarliang.com',
    quadType: 'whoop',
    rateType: 'actual',
    tags: ['whoop', 'indoor', 'micro', 'tiny'],
    notes: 'Higher yaw rate for indoor whooping — lots of rapid turns needed.',
    roll:  { center_sensitivity: 150, max_rate: 550, expo: 0.0 },
    pitch: { center_sensitivity: 150, max_rate: 550, expo: 0.0 },
    yaw:   { center_sensitivity: 180, max_rate: 650, expo: 0.0 },
    thr_mid: 0.6, thr_expo: 0.3,
  },
  // ── BEGINNERS ────────────────────────────────────────────────────
  {
    id: 'beginner-safe',
    name: 'Beginner Safe',
    pilotName: 'iFlyQuad Recommended',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['beginner', 'safe', 'slow', 'learning'],
    notes: 'Low rates for beginners. Forgiving, slow, easy to control.',
    roll:  { center_sensitivity: 120, max_rate: 400, expo: 0.2 },
    pitch: { center_sensitivity: 120, max_rate: 400, expo: 0.2 },
    yaw:   { center_sensitivity: 90,  max_rate: 300, expo: 0.1 },
    thr_mid: 0.5, thr_expo: 0.2,
  },
  {
    id: 'intermediate-step',
    name: 'Intermediate Step',
    pilotName: 'iFlyQuad Recommended',
    quadType: 'freestyle',
    rateType: 'actual',
    tags: ['intermediate', 'progression', 'medium'],
    notes: 'Good step up from beginner rates. Learning flips and rolls.',
    roll:  { center_sensitivity: 160, max_rate: 540, expo: 0.1 },
    pitch: { center_sensitivity: 160, max_rate: 540, expo: 0.1 },
    yaw:   { center_sensitivity: 110, max_rate: 400, expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.1,
  },
  // ── LONG RANGE ───────────────────────────────────────────────────
  {
    id: 'longrange-cruising',
    name: 'Long Range Cruise',
    pilotName: 'Generic LR',
    quadType: 'longrange',
    rateType: 'actual',
    tags: ['longrange', 'cruising', 'stable', 'efficient'],
    notes: 'Stable and predictable for long range cruising. Low max rate.',
    roll:  { center_sensitivity: 130, max_rate: 420, expo: 0.2 },
    pitch: { center_sensitivity: 130, max_rate: 380, expo: 0.2 },
    yaw:   { center_sensitivity: 100, max_rate: 300, expo: 0.1 },
    thr_mid: 0.55, thr_expo: 0.2,
  },
  // ── SNAP/HIGH RATE ───────────────────────────────────────────────
  {
    id: 'snap-1080',
    name: '1080 Snap Style',
    pilotName: 'Generic Snap',
    quadType: 'freestyle',
    rateType: 'betaflight',
    tags: ['snap', 'high-rate', '1080', 'aggressive', 'expert'],
    notes: '1080 deg/s for ultra-fast snaps. Requires mastery.',
    roll:  { rc_rate: 1.35, rate: 0.75, expo: 0.0 },
    pitch: { rc_rate: 1.35, rate: 0.75, expo: 0.0 },
    yaw:   { rc_rate: 1.1,  rate: 0.6,  expo: 0.0 },
    thr_mid: 0.5, thr_expo: 0.0,
  },
  // tambahkan lebih banyak sesuai kebutuhan... target 50+ entries
];
```

---

## ══════════════════════════════════════════
## FITUR 2: DESKTOP APP (WINDOWS & MAC)
## ══════════════════════════════════════════

### Pendekatan: Electron (Recommended)

Electron adalah pilihan terbaik karena:
- ✅ User hanya double-klik → langsung jalan (no install Python, no terminal)
- ✅ Satu codebase dengan web app (React + Vite sudah ada)
- ✅ WebSerial API tersedia via Electron IPC
- ✅ Build `.exe` untuk Windows, `.dmg` untuk Mac
- ✅ Bisa offline penuh

### Setup Files yang Perlu Dibuat

**1. Install Electron:**
```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

**2. Buat `electron/main.js`:**
```javascript
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // PENTING: izinkan Web Serial API
      experimentalFeatures: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // Jangan tampil sampai siap
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Tampil saat sudah siap (menghindari flash putih)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Buka link eksternal di browser default
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Izinkan Serial Port access
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
```

**3. Buat `electron/preload.js`:**
```javascript
const { contextBridge } = require('electron');

// Expose versi app ke renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  version: require('../package.json').version,
});
```

**4. Update `package.json`:**
```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:all": "npm run build && electron-builder --win --mac"
  },
  "build": {
    "appId": "com.iflyfpv.tuning-assist",
    "productName": "iFlyQuad Tuning Assist",
    "copyright": "Copyright © 2026 Hanif Pratama",
    "icon": "public/icon",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "public/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "iFlyQuad Tuning Assist"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "public/icon.icns",
      "category": "public.app-category.utilities"
    },
    "dmg": {
      "title": "iFlyQuad Tuning Assist",
      "background": "public/dmg-background.png"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "public/icon.png"
    }
  }
}
```

**5. Update `vite.config.js` untuk Electron:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === 'true' ? './' : '/',  // Relative paths untuk Electron
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
});
```

**6. Buat icon files:**
```
public/
├── icon.png       (512x512 PNG)
├── icon.ico       (Windows ICO — buat dari PNG)
└── icon.icns      (macOS ICNS — buat dari PNG)
```

Untuk convert icon: gunakan online converter (convertio.co) atau pakai `electron-icon-builder`:
```bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=public/icon.png --output=public
```

**7. WebSerial di Electron:**

Web Serial API bekerja di Chromium terbaru yang digunakan Electron. Tambahkan flag di `main.js`:
```javascript
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
// Atau lebih specific:
app.commandLine.appendSwitch('enable-features', 'WebSerial');
```

### Hasil Build
```
release/
├── iFlyQuad Tuning Assist Setup 1.0.0.exe    ← Windows installer
├── iFlyQuad Tuning Assist 1.0.0 Portable.exe ← Windows portable (no install)
├── iFlyQuad Tuning Assist-1.0.0.dmg          ← macOS installer
└── iFlyQuad Tuning Assist-1.0.0-mac.zip      ← macOS zip
```

**User experience:**
- Windows: Double klik `.exe` → Next → Finish → Icon di desktop → Klik
- Mac: Open `.dmg` → Drag ke Applications → Double klik
- Portable: Double klik `.exe` langsung jalan tanpa install

---

## ══════════════════════════════════════════
## FITUR 3: UPDATE DETAILED_EXPLANATION.md & README.md
## ══════════════════════════════════════════

### `DETAILED_EXPLANATION.md` — Tambahkan:

1. **Header baru** di paling atas:
```markdown
# Betaflight Advanced Tuning Assist — Detailed Documentation

> **Last Updated:** March 2026  
> **Version:** 1.1.0  
> **Language:** English  
> **Author:** Hanif Pratama (mhp.hanif5@gmail.com)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| March 2026 | 1.1.0 | Multi-drone profiles, Rate Library, Sequential Tuning Pipeline, Noise Heatmap, CLI Commands Panel, Pre-flight Checklist, Log Comparison, Electron desktop app |
| March 2026 | 1.0.0 | Initial release — 15 analysis tools, 36 presets, WebSerial CLI, multi-language |
```

2. Semua konten dalam **English** (jika ada yang masih Bahasa Indonesia, terjemahkan)

3. Tambahkan section baru untuk fitur-fitur baru:
   - Sequential Tuning Pipeline
   - Rate Profiles Library
   - Multi-Drone Profile System
   - Desktop App (Electron)

### `README.md` — Tulis ulang dalam English:

```markdown
# iFlyQuad — Betaflight Advanced Tuning Assist

> **Last Updated:** March 2026 · **Version:** 1.1.0

The most comprehensive free browser-based Betaflight tuning assistant.
Upload your blackbox log and CLI dump — get guided, evidence-based recommendations
with ready-to-paste CLI commands.

## ✨ What Makes This Different

| Feature | iFlyQuad | PIDtoolbox | FPVtune | BF Explorer |
|---------|----------|------------|---------|-------------|
| Free | ✅ | ❌ (paywall) | ❌ ($9-20) | ✅ |
| Browser-based | ✅ | ❌ (MATLAB) | ✅ | ✅ |
| Sequential workflow | ✅ | ❌ | ❌ | ❌ |
| WebSerial CLI | ✅ | ❌ | ❌ | ❌ |
| Rate Library | ✅ | ❌ | ❌ | ❌ |
| Log Comparison | ✅ | ❌ | ❌ | ❌ |
| Desktop App | ✅ | ✅ | ❌ | ✅ |
| Multi-language | ✅ | ❌ | ❌ | ❌ |

## 🚀 Quick Start

### Web (Recommended)
Open the app in any Chrome-based browser. No installation required.

### Desktop App
Download the latest release for your platform:
- **Windows:** `iFlyQuad-Tuning-Assist-Setup.exe`
- **macOS:** `iFlyQuad-Tuning-Assist.dmg`

### Local Development
\`\`\`bash
git clone https://github.com/itsmhp/betaflight-advanced-tuning-assist
cd betaflight-advanced-tuning-assist
npm install
npm run dev
\`\`\`

## 📋 Features

### Sequential Tuning Pipeline
Guided 7-stage tuning in the correct order:
**Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification**

Each stage is gate-locked — you can't tune PIDs on noisy motors.

### Rate Profiles Library
50+ community rates from top pilots. Create and save your own. Visual curve preview and copy-ready CLI commands.

### 15 Blackbox Analysis Tools
[list...]

### WebSerial CLI Terminal
Direct connection to your flight controller — apply changes without opening Betaflight Configurator.

## 🗂️ Project Structure
[structure...]

## 🤝 Contributing
[...]

---
Made with ❤️ for the FPV community by Hanif Pratama
```

---

## ══════════════════════════════════════════
## URUTAN IMPLEMENTASI
## ══════════════════════════════════════════

```
HARI 1 — Critical Bug Fixes:
├── Fix PID Health React error (recommendations as strings, not objects)
├── Fix Quad Condition card layout (grid + overflow)
└── Ganti icon 🍊 → 🧃 untuk juicy

HARI 2 — Rate Profile UX:
├── My Rates sebelum Community Rates
├── Rate values: rows layout (bukan kolom)
├── Rate Detail popup/modal saat klik
└── Filter + search community rates

HARI 3 — Rate Comparison + Community Data:
├── Compare feature (max 3 rates side by side)
└── Tambah 50+ community rates ke communityRates.js

HARI 4 — Desktop App:
├── Setup Electron (main.js, preload.js)
├── Update package.json + vite.config.js
├── Buat/siapkan icon files
└── Test build Windows + Mac

HARI 5 — Documentation:
├── Tulis ulang DETAILED_EXPLANATION.md (English + Last Updated)
└── Tulis ulang README.md (English + feature comparison table)
```

---

## CATATAN PENTING UNTUK COPILOT

1. **Bug fix PID Health HARUS dikerjakan pertama** — error ini memblock semua user
2. **Electron tidak memerlukan perubahan pada React code** — hanya tambah file electron/ baru
3. **Rate values SELALU dalam baris** — Roll/Pitch/Yaw sebagai baris, parameter (RC Rate/Rate/Expo) sebagai kolom
4. **Rate comparison**: highlight nilai tertinggi dengan warna hijau dalam tabel perbandingan
5. **Community rates**: jangan hardcode lebih dari 100 entries dalam satu file — bagi ke beberapa file jika perlu (communityRates/freestyle.js, communityRates/racing.js, dll)
6. **Electron + WebSerial**: Chromium di Electron mendukung Web Serial API — pastikan flag `enable-experimental-web-platform-features` aktif di main.js
7. **Portable exe**: Pastikan ada opsi portable (no-install) untuk Windows — banyak pilot yang tidak mau install software di PC mereka

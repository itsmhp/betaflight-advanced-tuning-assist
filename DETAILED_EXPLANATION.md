# Betaflight Advanced Tuning Assist — Detailed Documentation

> **Last Updated:** March 2026
> **Version:** 1.1.0
> **Language:** English
> **Author:** Hanif Pratama (mhp.hanif5@gmail.com)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| March 2026 | 1.1.0 | Multi-drone profiles, Rate Library (50+ community rates), Sequential Tuning Pipeline, Noise Heatmap, CLI Commands Panel, Pre-flight Checklist, Log Comparison, Rate Comparison (max 3), Flying Style & Quad Condition selectors, Electron desktop app, 4-language i18n |
| March 2026 | 1.0.0 | Initial release — 15 analysis tools, 36 presets, WebSerial CLI, multi-language support |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Core Functions](#2-core-functions)
3. [Technology Stack](#3-technology-stack)
4. [Complete Feature List](#4-complete-feature-list)
5. [How to Use the App](#5-how-to-use-the-app)
6. [Technical Details per Feature](#6-technical-details-per-feature)
7. [Deep Dive: Technology](#7-deep-dive-technology)
8. [Use Cases & Scenarios](#8-use-cases--scenarios)
9. [App Strengths](#9-app-strengths)
10. [Development Guide](#10-development-guide)
11. [New in v1.1.0](#11-new-in-v110)

---

## 1. PURPOSE

This application helps **FPV drone pilots fine-tune their Betaflight flight controllers** with data-driven, evidence-based recommendations.

### Problems Before This App:
- Pilots had to read lengthy, complex Betaflight documentation
- Understanding `.bbl` (blackbox log) files requires specialized knowledge
- Manual data analysis is extremely time-consuming
- Finding the right tuning preset was trial-and-error
- Tuning results were often suboptimal

### How This App Solves It:
- **Fully automated, guided process** — step by step
- Suitable for beginners through experts
- Recommendations are **based on your actual hardware** and **real flight data**
- User-friendly interface — no expert knowledge required
- Saves time and produces better tuning results

---

## 2. CORE FUNCTIONS

The app has 7 core functions:

### A. Personal Drone Profile
- Enter your drone hardware details (frame, motors, propellers, battery, etc.)
- Recommendations are **personalized** to your specific build
- Data is stored in your browser only — never sent to any server (privacy-first)
- Support for multiple drone profiles

### B. Smart Preset Engine
- **36 tuning presets** (9 frame sizes × 4 skill levels)
- Presets **auto-adjust** based on your drone profile
- **Skill levels:**
  - Beginner (stable, safe)
  - Intermediate (balanced, smooth)
  - Advanced (aggressive, responsive)
  - Expert (maximum performance, risky)

### C. Blackbox Analysis
- Upload `.bbl` flight log files
- The app runs **15 analysis tools** on your flight data
- Provides recommendations **based on real data**, not just theory
- Detects: propwash, noise, motor imbalance, oscillation, and more

### D. Guided Workflow (Step-by-Step)
- **8-step interactive guide:**
  1. Profile Drone
  2. Upload Logs
  3. Select Preset
  4. Review Preset
  5. Analyze Flight
  6. View Findings
  7. Apply Changes
  8. Test & Log
- Perfect for beginners who don't know where to start

### E. WebSerial CLI Terminal
- Connect your drone directly via USB
- Send Betaflight CLI commands from within the app
- No need to open Betaflight Configurator separately
- Real-time command execution and output display

### F. Rate Profiles Library (NEW in v1.1.0)
- **50+ community rate presets** from top FPV pilots
- Create, save, and manage your own custom rates
- Visual rate curve preview with Canvas 2D rendering
- Rate comparison — compare up to 3 profiles side by side
- Copy-ready CLI commands for instant application
- Filter by quad type, rate type, and search by pilot name

### G. Sequential Tuning Pipeline (NEW in v1.1.0)
- 7-stage guided tuning in the correct order:
  **Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification**
- Each stage is gate-locked — you can't tune PIDs on noisy motors
- Progress tracking with visual indicators

---

## 3. TECHNOLOGY STACK

### Frontend Stack:
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19+ | Interactive UI library |
| **Vite** | 6.4+ | Ultra-fast build tool |
| **Tailwind CSS** | 4.2+ | Utility-first CSS framework |
| **Lucide React** | 0.576+ | Icon library |
| **WebSerial API** | Native | USB communication with flight controllers |
| **Canvas 2D API** | Native | Rate curves, heatmaps, charts |
| **localStorage** | Native | Persistent data storage in browser |
| **Electron** | 40+ | Desktop app wrapper (Windows/Mac/Linux) |

### Backend:
- **No backend server** — Pure Frontend application
- All analysis runs in the user's browser (client-side)
- No data is ever sent to any server (privacy-first)
- Works fully offline

### Programming Languages:
- **JavaScript/JSX** (99%)
- **CSS** (1%)
- No TypeScript — chosen for flexibility and faster iteration

### Supported App Languages (i18n):
1. **English**
2. **Bahasa Indonesia**
3. **Español** (Spanish)
4. **Deutsch** (German)

---

## 4. COMPLETE FEATURE LIST

### A. Dashboard (Home Page)
**What it is:**
- The first page users see when opening the app
- Overview/summary of all analysis results

**Displays:**
- Overall drone health status
- PID health score (0-100)
- Quick summary from 15 analysis tools
- Key findings and recommendations
- Quick access to all tools

### B. Drone Profile Page
**What it is:**
- Comprehensive form for entering all drone hardware details

**Available fields:**
```
Hardware Details:
├── Drone Basic Info
│   ├── Drone name (custom)
│   ├── Frame size (250mm, 3", 5", 7", etc.)
│   └── Total weight (grams)
│
├── Motor Specs
│   ├── KV rating (1100KV, 2300KV, etc.)
│   ├── Amperage rating
│   └── Brand
│
├── Propeller Specs
│   ├── Diameter (5.1", 6", 7", etc.)
│   ├── Pitch (3-blade, 2-blade, etc.)
│   └── Brand
│
├── Battery Specs
│   ├── Cell count (3S, 4S, 5S, 6S)
│   ├── Capacity (mAh)
│   └── Brand
│
├── Electronics
│   ├── ESC amperage rating
│   ├── ESC protocol (OneShot, DShot, PWM)
│   ├── Flight controller model
│   └── Betaflight version
│
└── Performance Metrics
    ├── Estimated flight time (minutes)
    └── Weight category
```

**Why this matters:**
- Every hardware combination has unique characteristics
- Presets auto-adjust based on this data
- Analysis tools produce more accurate results with hardware context

### C. Presets Page
**What it is:**
- Grid of 36 ready-to-use tuning presets

**Structure:**
```
┌─────────────────────────────────────────────────┐
│           Betaflight Advanced Tuning Assist      │
│                    PRESETS GRID                  │
├─────────────────────────────────────────────────┤
│  Frame Size ↓                   Skill Level ↓  │
│                    Beginner │ Inter │ Adv │ Ex │
│  ┌──────────────────────────────────────────┐  │
│  │ 250mm   │  [PID] │ [PID] │ [PID] │ [PID] │  │
│  │ 3-inch  │  [PID] │ [PID] │ [PID] │ [PID] │  │
│  │ 5-inch  │  [PID] │ [PID] │ [PID] │ [PID] │  │
│  │ 7-inch  │  [PID] │ [PID] │ [PID] │ [PID] │  │
│  │ ...     │  [...] │ [...] │ [...] │ [...] │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Each preset contains:**
```
Roll PID:           Pitch PID:          Yaw PID:
├── P = XX.X        ├── P = XX.X        ├── P = XX.X
├── I = XX.X        ├── I = XX.X        ├── I = XX.X
└── D = XX.X        └── D = XX.X        └── D = XX.X

Filter Settings:
├── Lowpass: XX Hz
├── D-term Lowpass: XX Hz
└── Notch: XX Hz @ XX Hz

Advanced Settings:
├── TPA Rate: X.XXX
├── Anti-Gravity: X.X
└── Feedforward Gain: XX.X
```

**Smart Adjustment Engine:**
- User uploads blackbox log
- System analyzes the log
- Preset values **auto-adjust** based on:
  - Motor health
  - Propwash signature
  - Noise profile
  - Flight style
  - Current PID response

### D. Tune Your Quad Workflow (8 Steps)
**What it is:**
- Interactive guided tour for the complete tuning process
- Like a "wizard" that guides you from start to finish

**8-Step Workflow:**

| Step | Name | What it does |
|------|------|-------------|
| 1 | Profile Drone | Enter all hardware details |
| 2 | Upload Logs | Upload CLI dump + blackbox log (optional) |
| 3 | Select Preset | Pick frame size + skill level |
| 4 | Review Preset | Review PID values and settings |
| 5 | Analyze Flight | Run 15 analysis tools |
| 6 | View Findings | View charts, scores, recommendations |
| 7 | Apply Changes | Copy + paste CLI commands to FC |
| 8 | Test & Log | Fly and record new log |

**Interface Design:**
- Stepper component shows progress
- Next/Previous buttons for navigation
- Form validation at each step
- Summary in the final step

### E. PID Health Analyzer
**What it is:**
- Dashboard of 15 analysis tools
- Evaluates the quality of user's current tuning

**15 Analysis Tools:**

| # | Tool | What it analyzes | Output |
|----|------|-----------------|--------|
| 1 | **Step Response** | Response time per axis, overshoot %, damping ratio | Response time (ms), overshoot (%), Zeta damping |
| 2 | **Motor Health** | Motor balance, vibration detection | Motor balance score, cross-correlation |
| 3 | **TPA Analyzer** | Optimal TPA breakpoint | Breakpoint detection, TPA curve |
| 4 | **Propwash Detector** | Propwash detection, filter recommendations | Energy at 20-100Hz, recommended filter |
| 5 | **Dynamic Idle** | Idle mode detection, RPM relaxation | Idle window, relaxation curve |
| 6 | **Anti-Gravity** | Throttle punch drift detection | Drift detection, severity grading |
| 7 | **I-Term Buildup** | Excessive I-term accumulation | Accumulation rate, axis bias |
| 8 | **Feedforward Health** | Lag analysis, responsiveness check | FF lag (ms), response lag, health score |
| 9 | **Thrust Linearization** | PID effort slope analysis | MAPE score, dual onset detection |
| 10 | **Stick Movement** | Smoothness, jitter, bounce-back | Jitter (%), smoothness %, expo suggestions |
| 11 | **Throttle Axis** | Hover point detection, flight style | Hover point (%), axis usage histogram |
| 12 | **PID Contribution** | P/D/F ratio analysis | RMS ratios for P, D, F |
| 13 | **Noise Analyzer** | FFT spectrum, harmonic detection | Noise spectrum chart, RPM harmonics |
| 14 | **Filter Analyzer** | Lowpass/notch config validation | Filter audit, recommendations |
| 15 | **Motor Doctor** | Detailed vibration & health report | Vibration levels, health score |

**Output Format:**
- **Charts** — flight data visualization
- **Health Scores** — numeric 0-100
- **Recommendations** — actionable suggestions
- **Severity Codes** — OK, Warning, Critical

### F. Serial CLI Terminal
**What it is:**
- Interactive terminal for sending commands directly to the flight controller
- Built-in CLI integrated within the app

**Features:**
- **Connect via USB** — select COM port
- **Type Commands** — type CLI commands (e.g., `set p_roll = 50`)
- **Auto-complete** — suggestions while typing
- **Command History** — arrow up/down for history
- **Real-time Output** — see FC response instantly
- **Copy/Paste** — paste CLI dumps (from Configurator)
- **Save Commands** — save favorite commands
- **Baud Rate Selection** — 115200, 230400, etc.

**Typical Workflow:**
```bash
# Connect (manual in UI)
# Output: Connected to COM3 at 115200 baud

# User input
> feature

# FC Response
feature ANTI_GRAVITY
feature TELEMETRY
...

# User input
> set p_roll = 55

# FC Response
p_roll = 55

# User input
> save

# FC Response
Saving...
Done.
```

### G. File Upload & Export
**Upload Support:**
- **CLI Dump** (`.txt`) — output from `dump all` in Betaflight CLI
- **Blackbox Log** (`.bbl`) — flight log from SD card

**Upload UI:**
- Drag-and-drop area
- File picker button
- Validation (checks file format, size)
- Error messages for incorrect formats

**Export Features:**
- Export analysis results
- Copy CLI commands to clipboard
- Generate readable report

### H. Multi-Language UI
**Supported Languages:**
1. **English** — default/fallback
2. **Bahasa Indonesia** — native language support
3. **Español** — Spanish translations
4. **Deutsch** — German translations

**What's Translated:**
- All UI labels
- Button text
- Form field names
- Error messages
- Analysis tool descriptions
- Help text

**How to Use:**
- Language selector in sidebar (flag icons)
- Click flag to switch language
- Language preference saved in localStorage
- Default = browser language setting (if supported)

### I. Error Handling & User Feedback
**Error Boundary:**
- Catches unhandled errors
- Graceful fallback UI
- Error stack trace in console
- User-friendly error messages

**Upload Validation:**
- Checks file format (CLI dump or .bbl)
- Checks file size (not too large)
- Parse error handling
- Clear error messages in UI

**User Feedback:**
- Loading spinners for long operations
- Toast notifications for results
- Progress bars for file uploads
- Confirmation dialogs for destructive actions

---

## 5. HOW TO USE THE APP

### INITIAL SETUP (5 minutes)

#### **Step 1: Open the App**
```
Option A: Deployed online
→ Open URL in browser (will be provided)

Option B: Run locally
→ Clone repo
→ npm install
→ npm run dev
→ Open http://localhost:5173
```

#### **Step 2: Select Language**
```
→ Look at sidebar
→ Find language selector (flag icons)
→ Click flag for desired language
→ Page will refresh with new language
```

#### **Step 3: Fill In Drone Profile**
```
→ Click "My Drone" tab
→ Fill in all fields:
   - Drone name (custom)
   - Frame size (select from dropdown)
   - Motor KV, amperage
   - Propeller diameter, pitch
   - Battery cells, mAh
   - FC model, Betaflight version
   - Weight (estimated grams)
   - Flight time estimation
→ Click "Save Profile"
```

---

### TUNING WORKFLOW OPTION A: WITH BLACKBOX LOG (RECOMMENDED)

**Duration:** ~30 minutes (including test flight)

#### **Step 1: Prepare Files**
```
On your drone/FC beforehand:
1. Open Betaflight Configurator
2. Select CLI tab
3. Type: dump all
4. Press Enter
5. Click "Save to File" → save as .txt (this is the CLI dump)

From drone's SD card:
1. Copy .bbl file (blackbox log from last flight)
2. Note the file path
```

#### **Step 2: Upload to the App**
```
In the app:
1. Click "Dashboard" or "Tune Your Quad" tab
2. Find the "Upload Files" section
3. Drag-drop or browse for:
   - Select CLI dump file (.txt)
   - Select blackbox log file (.bbl)
4. Click "Upload" and wait for processing
5. The app will parse and analyze files
```

#### **Step 3: Select Preset**
```
In the app:
1. Click "Presets" tab
2. See grid of 9 frame sizes × 4 skill levels
3. Example: User has a 5-inch drone and "Advanced" skill
   → Find row "5-inch" and column "Advanced"
   → Click that cell
4. The system will:
   - Load base preset values
   - Auto-adjust based on blackbox data
   - Show "Adjusted Preset" with applied tweaks
```

#### **Step 4: Review Preset**
```
In the app:
1. See recommended PID values
   - Roll P/I/D
   - Pitch P/I/D
   - Yaw P/I/D
2. See filter settings
   - Lowpass frequency
   - Notch settings
   - D-term filter
3. See advanced settings
   - TPA rate
   - Anti-gravity
   - Feedforward
4. Click "Generate CLI Commands" to copy CLI dump
```

#### **Step 5: Analyze Flight Data**
```
In the app:
1. Click "PID Health" tab
2. See 15 analysis results from your blackbox log:
   - Step response charts
   - Motor health scores
   - TPA analysis
   - Propwash detection
   - Noise spectrum
   - etc...
3. Read recommendations
4. Note problematic areas
```

#### **Step 6: View Findings**
```
Analysis output:
1. Overall tuning score (0-100)
2. Health status per axis (OK, Warning, Critical)
3. Specific findings per analysis tool
4. Recommended PID adjustments
5. Charts and data visualization
```

#### **Step 7: Apply Changes (Option A: Click-through)**
```
Option A: Apply directly via CLI Terminal
1. Click "CLI Terminal" tab
2. Select drone COM port (connect via USB)
3. Paste CLI commands from the app
4. Press Enter
5. Wait for FC to acknowledge
6. Type: save
7. FC will restart

Option B: Manual copy-paste to Configurator
1. Copy from the app
2. Open Betaflight Configurator
3. Select CLI tab
4. Paste commands
5. Type: save
```

#### **Step 8: Test & Log**
```
1. Safety check: Arm drone, test stability
2. Short test flight (2-3 minutes)
3. Land and download blackbox log
4. Return to the app
5. Upload new log to analyze again
6. Repeat Steps 3-8 for further fine-tuning
```

---

### TUNING WORKFLOW OPTION B: WITHOUT BLACKBOX (QUICK START)

**Duration:** ~10 minutes

#### **Step 1: Fill In Drone Profile**
```
→ Click "My Drone"
→ Fill in all hardware fields
→ Save
```

#### **Step 2: Select Preset**
```
→ Click "Presets"
→ Select matching frame size + skill level
→ See recommended PID values
```

#### **Step 3: Review & Copy**
```
→ Review values
→ Click "Copy CLI Commands"
→ Paste into Betaflight CLI
→ Type: save
```

**Benefit:**
- Fast and simple
- Great for quick setup or troubleshooting
- No blackbox log required

**Limitation:**
- No data-driven adjustment
- Generic preset, not fully personalized

---

## 6. TECHNICAL DETAILS PER FEATURE

### A. Drone Profile Context
**React Context:**
```javascript
// DroneProfileContext.jsx
const DroneProfileContext = createContext();

// Data structure stored
{
  drone_name: "My 5-inch",
  frame_size: "5-inch",  // options: 250, 3", 5", 7", dll
  
  motor: {
    kv: 2300,
    amperage: 40,
    brand: "T-Motor"
  },
  
  propeller: {
    diameter: "5.1",
    pitch: "3-blade",
    brand: "HQ"
  },
  
  battery: {
    cells: 4,  // S rating
    mah: 1300,
    brand: "Tattu"
  },
  
  esc: {
    amperage: 40,
    protocol: "DShot600"
  },
  
  fc: {
    model: "Kakute F7 2.0",
    betaflight_version: "4.4"
  },
  
  weight: 250,  // grams
  estimated_flight_time: 4.5  // minutes
}
```

**Storage:**
- Stored in browser's `localStorage`
- Key: `droneProfiles` (object with array)
- Persist across sessions
- Not sent to any server

### B. Smart Presets Engine
**File:** `src/lib/presets.js` and `src/lib/smartPresets.js`

**Preset Structure:**
```javascript
const presets = {
  "250mm": {
    "Beginner": {
      roll: { p: 40, i: 30, d: 20 },
      pitch: { p: 40, i: 30, d: 20 },
      yaw: { p: 30, i: 20, d: 20 },
      filters: {
        lowpassFreq: 150,
        dTermFreq: 100,
        notchFreq: 200
      },
      tpa: 0.85,
      antiGravity: 3.5,
      feedforward: 50
    },
    "Intermediate": { /* ... */ },
    "Advanced": { /* ... */ },
    "Expert": { /* ... */ }
  },
  "5-inch": { /* ... */ },
  // ... 9 frame sizes total
}
```

**Smart Adjustment Process:**
```
Input:
├── Base preset values
├── Drone profile
└── Blackbox log (optional)

Processing:
├── Analyze blackbox metrics
│   ├── Motor health score
│   ├── Propwash signature
│   ├── Noise profile
│   ├── Flight style
│   └── Current PID response
└── Calculate adjustment multipliers
    ├── P multiplier
    ├── I multiplier
    └── D multiplier

Output:
└── Adjusted preset with tweaked PID values
    └── Each P, I, D adjusted by multiplier
```

**Adjustment Factors:**
```javascript
// Example adjustment algorithm
const motorHealthScore = analyzeMotorHealth(blackboxData);
const propwashDetected = analyzeropwash(blackboxData);
const noiseLevel = analyzeNoise(blackboxData);

// Calculate adjustment factors
const pMultiplier = motorHealthScore > 0.8 ? 1.1 : 0.9;  // Increase/decrease P
const iMultiplier = propwashDetected ? 0.95 : 1.0;  // Reduce I if propwash
const dMultiplier = noiseLevel > 0.6 ? 0.95 : 1.05;  // Reduce D if noisy

// Apply adjustments
adjustedPreset.roll.p = basePreset.roll.p * pMultiplier;
adjustedPreset.roll.i = basePreset.roll.i * iMultiplier;
adjustedPreset.roll.d = basePreset.roll.d * dMultiplier;
// ... repeat for pitch and yaw
```

### C. Blackbox Analysis
**File:** `src/lib/blackboxParser.js`

**Parsing Process:**
```
Input: .bbl file (binary format)
↓
1. Read file as ArrayBuffer
2. Parse header (firmware version, field definitions, size)
3. Parse frames (each frame contains sensor data)
4. Extract time-series data:
   - Gyro (gyroADC[3])
   - Accelerometer (accSmooth[3])
   - Motor PWM (motor[4])
   - Flight time
   - Throttle
   - Pitch/Roll/Yaw angles
   - ...more fields
↓
Output: Structured data for analysis tools
```

**Data Extracted:**
```javascript
{
  flightData: {
    timestamp: [0, 1, 2, 3, ...],  // ms
    gyro: { roll: [array], pitch: [array], yaw: [array] },
    accel: { x: [array], y: [array], z: [array] },
    motor: { m1: [array], m2: [array], m3: [array], m4: [array] },
    throttle: [array],
    pid_roll: [array], pid_pitch: [array], pid_yaw: [array],
    rcCommand: [array],
    frameRate: 32  // Hz (typical)
  },
  header: {
    firmwareVersion: "4.4.0",
    boardName: "KAKUTEF7",
    fieldCount: 45
  }
}
```

### D. Analysis Tools Implementation
**Base Structure per Tool:**

```javascript
// File: src/lib/analyzers/stepResponseAnalyzer.js

export const analyzeStepResponse = (blackboxData) => {
  // Extract pertinent data
  const { flightData } = blackboxData;
  const { throttle, motor, gyro } = flightData;
  
  // Run FFT/signal processing
  const fftResult = computeFFT(gyro.roll);
  
  // Analyze response characteristics
  const responseTime = findRiseTime(gyro.roll);
  const overshoot = calculateOvershoot(gyro.roll);
  const dampingRatio = estimateDamping(gyro.roll);
  
  // Generate output
  return {
    health_score: 75,  // 0-100
    status: "OK",  // OK, Warning, Critical
    metrics: {
      responseTime_ms: 15.2,
      overshoot_percent: 8.5,
      dampingRatio: 0.7
    },
    recommendations: [
      "Response time is good",
      "Slight overshoot detected, consider reducing P by 5-10%"
    ],
    chart_data: {
      labels: [...timestamps],
      datasets: [
        { label: "Gyro Roll", data: gyro.roll },
        { label: "Expected Response", data: expectedResponse }
      ]
    }
  };
};
```

**Analysis Output Format (Standard):**
```javascript
{
  health_score: 0-100,        // Numeric health indicator
  status: "OK|Warning|Critical",  // Severity level
  metrics: { /* key metrics */ },  // Analyzable numbers
  recommendations: [string],   // Actionable suggestions
  chart_data: {                // For visualization
    labels: array,
    datasets: [{ label, data, ... }]
  }
}
```

### E. User Interface Structure

**Page Hierarchy:**
```
App.jsx
├── Sidebar.jsx (Navigation)
│   ├── Tab: Tune Your Quad
│   ├── Tab: PID Health
│   ├── Tab: Presets
│   ├── Tab: My Drone
│   └── Tab: CLI Terminal
│
├── Dashboard.jsx
│   ├── Overview cards
│   ├── Quick stats
│   └── File upload section
│
├── TuneWorkflowPage.jsx
│   ├── Stepper (8 steps)
│   ├── Step content
│   └── Navigation buttons
│
├── PresetsPage.jsx
│   ├── Frame size selector
│   ├── Skill level selector
│   └── Preset grid
│
├── DroneProfilePage.jsx
│   ├── Profile form
│   └── Save button
│
├── SerialCLIPage.jsx
│   ├── Port selector
│   ├── Terminal output
│   └── Input field
│
└── DataContext & DroneProfileContext
```

**Component Composition:**
```
FileUpload:
├── Drag-drop area
├── File input
└── Upload button

PresetCard:
├── Frame size label
├── Preset name
├── PID values display
└── Select button

AnalysisChart:
├── Canvas element
├── Legend
└── Tooltip

CliTerminal:
├── Output area
├── Input field
├── History selector
└── Command buttons
```

---

## 7. DEEP DIVE: TECHNOLOGY

### React Hooks & Patterns
```javascript
// useState — manage component state
const [droneProfile, setDroneProfile] = useState({...});

// useContext — access shared data
const { profile } = useContext(DroneProfileContext);

// useEffect — side effects (fetch, subscribe, etc)
useEffect(() => {
  // Load profile on mount
  const saved = localStorage.getItem('droneProfile');
  if (saved) setDroneProfile(JSON.parse(saved));
}, []);

// useReducer — complex state logic
const [state, dispatch] = useReducer(analysisReducer, initialState);

// useMemo — memoize expensive calculations
const adjustedPreset = useMemo(() => {
  return applySmartAdjustments(basePreset, blackboxData);
}, [basePreset, blackboxData]);
```

### WebSerial API for USB Communication
```javascript
// Request port
const port = await navigator.serial.requestPort();

// Open connection
await port.open({ baudRate: 115200 });

// Get reader & writer
const reader = port.readable.getReader();
const writer = port.writable.getWriter();

// Send command
await writer.write(new TextEncoder().encode("dump all\n"));

// Read response
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  const text = new TextDecoder().decode(value);
  console.log(text);  // FC response
}

// Close connection
reader.releaseLock();
await port.close();
```

### localStorage for Persistence
```javascript
// Save profile
const profile = { name: "My 5-inch", ... };
localStorage.setItem('droneProfiles', JSON.stringify(profile));

// Load profile
const saved = localStorage.getItem('droneProfiles');
const profiles = saved ? JSON.parse(saved) : {};

// Update profile
const updated = { ...profiles, [newName]: newProfile };
localStorage.setItem('droneProfiles', JSON.stringify(updated));
```

### File Handling & Parsing
```javascript
// Read uploaded file
const handleFileUpload = async (file) => {
  const content = await file.text();  // For .txt (CLI dump)
  // OR
  const buffer = await file.arrayBuffer();  // For .bbl (binary)
  
  // Parse content
  const parsed = parseCliDump(content);  // Custom parser
  // OR
  const parsed = parseBlackbox(buffer);  // Custom parser
  
  // Store data
  setBlackboxData(parsed);
};
```

### Array Methods for Analysis
```javascript
// FFT (Fast Fourier Transform) — detect frequency content
const fftResult = computeFFT(gyroData);  // Get frequency spectrum
const dominantFreq = fftResult.frequencies[fftResult.magnitudes.indexOf(Math.max(...fftResult.magnitudes))];

// Moving average — smooth noisy data
const smoothed = movingAverage(rawData, windowSize = 10);

// Cross-correlation — detect pattern similarity
const correlation = crossCorrelate(motor1, motor2);
const delay = findPeakDelay(correlation);  // Motor sync lag

// Peak detection — find critical points
const peaks = findPeaks(data, threshold = 0.8);
const overshoot = Math.max(...peaks);
```

---

## 8. USE CASES & SCENARIOS

### Scenario 1: Beginner Just Bought a Drone (5 minutes)
**User Profile:** First-time FPV pilot

**Workflow:**
```
1. Open the app
2. "My Drone" → input frame size (skip detailed specs)
3. "Presets" → select "250mm Beginner"
4. Copy preset values
5. Apply via Betaflight Configurator or CLI Terminal
6. Fly and enjoy!
```

**Why Beginner Preset:**
- High stability
- Slow response (less aggressive)
- Safe for beginners
- Less likely to crash

---

### Scenario 2: Advanced Pilot Optimize Performance (45 minutes)
**User Profile:** Experienced pilot, wants max performance

**Workflow:**
```
1. Upload detailed profile (frame, motor KV, props, battery)
2. Previous flight → download blackbox log
3. Upload CLI dump + .bbl file
4. "Presets" → select "5-inch Advanced"
5. App auto-adjusts preset based on blackbox
6. "PID Health" → analyze 15 tools
7. Review recommendations
8. Fine-tune PID values based on insights
9. Apply via CLI Terminal
10. Short test flight & repeat for fine-tuning
```

**Why Advanced Preset + Blackbox Analysis:**
- Data-driven tuning = better results
- Auto-adjustment = save time
- 15 tools = comprehensive diagnostics
- Fine-tuning approach = peak performance

---

### Scenario 3: Troubleshooting Unstable Drone (20 minutes)
**User Profile:** Drone flying unstable, wobbly, or oscillating

**Workflow:**
```
1. Fly and record "bad flight" log
2. Download blackbox file
3. Upload to the app
4. Go to "PID Health"
5. Look for specific issues:
   - Motor vibration? → Motor Doctor
   - Oscillation? → Step Response
   - Noise/jitter? → Noise Analyzer
   - (etc)
6. Find root cause from analysis
7. Get specific recommendations
8. Apply targeted tuning changes
9. Test again with new log recording
```

**Where to Look for Common Issues:**

| Problem | Analysis Tool | Common Fix |
|---------|---------------|-----------|
| Wobbly/Oscsillating | Step Response | Reduce P gain |
| Jittery flight | Noise Analyzer | Lower D-term, increase filter frequency |
| Motor vibration | Motor Doctor | Mechanical issue or ESC problem |
| Propwash on flips | Propwash Detector | Lower lowpass filter |
| Unresponsive | Feedforward Health | Increase FF gain |
| Drifts on throttle punch | Anti-Gravity | Adjust AG slider |

---

### Scenario 4: Comparing Setups (30 minutes)
**User Profile:** Has 2 drones, wants to know which setup is better

**Workflow:**
```
1. Create 2 profiles (drone A & B)
2. Upload logs from each
3. Get presets for both drones
4. Run analysis for both
5. Compare tuning scores
6. Compare analysis results
7. Recommendation: Switch to better setup or hybrid tuning
```

---

## 9. APP STRENGTHS

✅ **Very user-friendly**
- Guided workflow, no CLI knowledge needed
- No expert knowledge needed to start tuning

✅ **Data-driven**
- Analyze real flight logs, not guessing
- Smart adjustment based on drone hardware

✅ **Personalized**
- Preset auto-adjusts to your hardware
- Recommendations based on drone profile

✅ **Offline first**
- All processing in browser, no server needed
- Privacy preserved, data not sent to cloud

✅ **Comprehensive**
- 15 analysis tools = thorough diagnostics
- Covers all major Betaflight tuning parameters

✅ **Real-time**
- WebSerial CLI = apply settings without leaving the app
- Instant feedback from FC

✅ **Multi-language**
- Supports 4 languages
- Accessible to the global FPV community

✅ **Open source**
- GitHub link available
- Can be forked, improved, and customized
- Community contributions welcome

✅ **Fast & responsive**
- Vite build = ultra-fast load time
- Smooth UI interactions
- No lag during analysis

✅ **Beautiful UI**
- Modern dark theme
- Intuitive navigation
- Clear information hierarchy
- Professional design

---

## 10. DEVELOPMENT GUIDE

### Local Install & Setup

#### **Prerequisites:**
```
- Node.js 16+ installed
- npm or yarn package manager
- Git installed
- Code editor (VS Code recommended)
```

#### **Clone & Install:**
```bash
# Clone repository
git clone https://github.com/itsmhp/betaflight-advanced-tuning-assist.git
cd betaflight-advanced-tuning-assist

# Install dependencies
npm install

# Verify installation
npm run build
```

#### **Run Development Server:**
```bash
# Start dev server with hot reload
npm run dev

# Output:
# VITE v4.x.x ready in XXX ms

# ➜ Local:   http://localhost:5173/
# ➜ Press h to show help

# Open browser → localhost:5173
```

#### **Build for Production:**
```bash
# Create optimized build
npm run build

# Output:
# dist/
# ├── index.html
# ├── assets/
# │   ├── index-XXXXX.js
# │   └── index-XXXXX.css
# └── ...

# dist/ folder ready for deployment
```

### Project Structure Detail

```
betaflight-advanced-tuning-assist/
│
├── src/                             # Source code
│   ├── pages/                       # Page components (8 main pages)
│   │   ├── TuneWorkflowPage.jsx    # 8-step guided workflow
│   │   ├── Dashboard.jsx            # Main dashboard/overview
│   │   ├── PresetsPage.jsx          # Preset grid & selection
│   │   ├── DroneProfilePage.jsx     # Profile form
│   │   ├── AdvancedPIDPage.jsx      # Advanced PID editor
│   │   ├── MotorDoctorPage.jsx      # Motor health analysis
│   │   ├── FilterAnalyzerPage.jsx   # Filter configuration
│   │   ├── SerialCLIPage.jsx        # WebSerial CLI terminal
│   │   └── ...other analyzer pages
│   │
│   ├── lib/                         # Analysis & utility logic
│   │   ├── analyzeAll.js            # Main analysis orchestrator
│   │   ├── presets.js               # Preset definitions (all 36)
│   │   ├── smartPresets.js          # Auto-adjustment engine
│   │   ├── blackboxParser.js        # .bbl file parser
│   │   ├── cliParser.js             # CLI dump parser
│   │   ├── bblDecoder.js            # BBL binary decoder
│   │   ├── utils.js                 # Helper functions
│   │   │
│   │   └── analyzers/               # 15 analysis tools
│   │       ├── stepResponseAnalyzer.js
│   │       ├── motorHealthAnalyzer.js
│   │       ├── tpaAnalyzer.js
│   │       ├── propWashAnalyzer.js
│   │       ├── dynamicIdleAnalyzer.js
│   │       ├── antiGravityAnalyzer.js
│   │       ├── itermBuildup.js
│   │       ├── feedforwardAnalyzer.js
│   │       ├── thrustLinearization.js
│   │       ├── stickAnalyzer.js
│   │       ├── throttleAxis.js
│   │       ├── pidContribution.js
│   │       ├── noiseProfile.js
│   │       ├── filterAnalyzer.js
│   │       └── masterMultiplier.js
│   │
│   ├── context/                     # React Contexts
│   │   ├── DroneProfileContext.jsx  # Drone profile state
│   │   └── DataContext.jsx          # Flight data state
│   │
│   ├── components/                  # Reusable UI components
│   │   ├── Sidebar.jsx              # Navigation sidebar
│   │   ├── ErrorBoundary.jsx        # Error handling
│   │   └── shared/
│   │       ├── UIComponents.jsx     # Buttons, cards, modals
│   │       ├── FileUpload.jsx       # File upload widget
│   │       └── CLIOutput.jsx        # CLI output display
│   │
│   ├── i18n/                        # Internationalization
│   │   ├── LangContext.jsx          # Language state
│   │   └── translations.js          # 4 language translations
│   │
│   ├── index.css                    # Global styles
│   ├── main.jsx                     # App entry point
│   └── App.jsx                      # Root component
│
├── public/                          # Static assets
│   └── vite.svg
│
├── index.html                       # HTML entry point
├── package.json                     # Dependencies & scripts
├── vite.config.js                   # Vite configuration
├── eslint.config.js                 # ESLint rules
│
├── DETAILED_EXPLANATION.md          # This file
├── README.md                        # Quick reference
└── .gitignore                       # Git ignore rules
```

### Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `App.jsx` | Root component, route setup |
| `TuneWorkflowPage.jsx` | 8-step guided workflow stepper |
| `Dashboard.jsx` | Overview dashboard with quick stats |
| `PresetsPage.jsx` | 9×4 preset grid interface |
| `DroneProfilePage.jsx` | Profile form editor |
| `SerialCLIPage.jsx` | WebSerial terminal interface |
| `analyzeAll.js` | Orchestrator for 15 analysis tools |
| `presets.js` | 36 preset definitions |
| `smartPresets.js` | Auto-adjustment algorithm |
| `*Analyzer.js` | Individual analysis tools |
| `DroneProfileContext.jsx` | Global drone profile state |
| `translations.js` | All language translations |

### Development Workflow

#### **Making Changes:**
```
1. Edit file in src/
2. Save file
3. Browser auto-refresh (HMR - Hot Module Reload)
4. Test changes immediately
```

#### **Adding New Feature (Example: New Analyzer):**
```bash
# 1. Create new analyzer file
touch src/lib/analyzers/newAnalyzer.js

# 2. Implement analysis logic
# File: src/lib/analyzers/newAnalyzer.js
export const analyzeXYZ = (blackboxData) => {
  // ... analysis code
  return {
    health_score: 75,
    status: "OK",
    metrics: { /* ... */ },
    recommendations: [ /* ... */ ],
    chart_data: { /* ... */ }
  };
};

# 3. Add to main analyzer
# File: src/lib/analyzeAll.js
import { analyzeXYZ } from './analyzers/newAnalyzer';
// In analyzeAll function:
results.xyz = analyzeXYZ(blackboxData);

# 4. Create display page
touch src/pages/NewAnalyzerPage.jsx

# 5. Add to routes
# File: src/App.jsx
import NewAnalyzerPage from './pages/NewAnalyzerPage';
<Route path="/new-analyzer" element={<NewAnalyzerPage />} />

# 6. Add to sidebar
# File: src/components/Sidebar.jsx
<NavLink to="/new-analyzer">New Analyzer</NavLink>

# 7. Test & commit
npm run build
git add .
git commit -m "feat: Add new analyzer XYZ"
```

#### **Testing Changes:**
```bash
# Check for build errors
npm run build

# Run development server
npm run dev

# Manual testing in browser
# 1. Open app
# 2. Try feature
# 3. Check browser console for errors
# 4. Check network tab for any issues
```

#### **Pushing Changes:**
```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "feat: Description of feature"

# Push to GitHub
git push origin master
```

### Expanding Analysis Tools

To add a 16th analysis tool:

```javascript
// 1. Create file: src/lib/analyzers/newAnalyzerTool.js

export const analyzeNewTool = (blackboxData) => {
  const { flightData, header } = blackboxData;
  
  // Step 1: Extract data
  const { gyro, motor, throttle } = flightData;
  
  // Step 2: Process data
  const metric = calculateMetric(gyro, motor, throttle);
  
  // Step 3: Generate scores
  const score = normalizeScore(metric);  // 0-100
  const status = getStatus(score);      // OK, Warning, Critical
  
  // Step 4: Generate recommendations
  const recommendations = generateRecommendations(metric);
  
  // Step 5: Prepare chart data
  const chartData = prepareChartData(metric);
  
  // Return standard output
  return {
    health_score: score,
    status: status,
    metrics: { label: value, ... },
    recommendations: recommendations,
    chart_data: chartData
  };
};
```

---

## 11. NEW IN v1.1.0

### Sequential Tuning Pipeline
- 7-stage gate-locked tuning workflow: Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification
- Each stage must pass before moving to the next
- Visual progress indicators and percentage completion
- Pre-flight checklist ensures readiness before flying

### Rate Profiles Library
- **50+ community rate presets** from well-known FPV pilots (Oscar Liang, Joshua Bardwell, Mr. Steele, Le Drib, JohnnyFPV, Skitzo, Nurk, etc.)
- 5 quad types: Freestyle, Racing, Cinematic, Long Range, Whoop
- 5 rate systems: Betaflight, Actual, KISS, QuickRates, Raceflight
- Create, edit, and delete custom rate profiles
- Visual rate curve rendering via Canvas 2D API
- Rate comparison — select up to 3 rates for side-by-side comparison
- Per-axis comparison tables with highest values highlighted
- Copy-ready CLI commands for instant application
- Filter by quad type, rate type; search by pilot name

### Flying Style & Quad Condition Selectors
- 6 flying style options: Smooth, Balanced, Responsive, Aggressive, Juicy, Send It
- 4 quad condition options: Brand New, Good Condition, Worn Out, Battle Damaged
- Selections influence tuning recommendations

### Multi-Drone Profile System
- Save multiple drone hardware profiles
- Switch between profiles easily
- Each profile stores independent analysis results

### Log Comparison
- Compare multiple blackbox log files
- Track tuning improvements over time
- Side-by-side metric comparison

### Desktop App (Electron)
- Windows (.exe installer + portable), macOS (.dmg), Linux (AppImage)
- Same React app wrapped in Electron
- WebSerial API enabled via Chromium flags
- Offline-capable — no internet required
- Double-click to launch — no terminal needed

### CLI Import
- Import existing Betaflight CLI dumps
- Auto-parse and extract current settings
- Use as baseline for tuning recommendations

---

## Conclusion

**Betaflight Advanced Tuning Assist** is a comprehensive app that makes drone tuning:
- ✅ **Easy** — user-friendly, guided workflow
- ✅ **Accurate** — data-driven recommendations
- ✅ **Fast** — real-time analysis and CLI integration
- ✅ **Accessible** — multi-language, no expert knowledge needed
- ✅ **Powerful** — 15 analysis tools, smart presets, offline-first

This app is a **must-have tool** for every FPV pilot serious about tuning their drone!

---

**Made with care for the FPV community by Hanif Pratama (mhp.hanif5@gmail.com)**

Last Updated: March 5, 2026

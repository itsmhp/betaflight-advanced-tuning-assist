

<div align="center">

# iFlyQuad — Betaflight Advanced Tuning Assist

**The most comprehensive free, open-source Betaflight tuning assistant.**  
Upload your blackbox log and CLI dump to get guided, evidence-based recommendations with ready-to-paste CLI commands.

[![React](https://img.shields.io/badge/React-19+-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.4+-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Electron](https://img.shields.io/badge/Desktop-Electron_40-9feaf9?logo=electron&logoColor=white)](https://electronjs.org)
[![Betaflight](https://img.shields.io/badge/Betaflight-4.x-orange)](https://betaflight.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-blueviolet)](package.json)

</div>

---

## Table of Contents

- [What Makes This Different](#what-makes-this-different)
- [Quick Start](#quick-start)
- [Running the App](#running-the-app)
- [Features Overview](#features-overview)
  - [16 Blackbox Analysis Tools](#15-blackbox-analysis-tools)
  - [Sequential Tuning Pipeline](#sequential-tuning-pipeline)
  - [Rate Profiles Library](#rate-profiles-library)
  - [Smart Presets System](#smart-presets-system)
  - [WebSerial CLI Terminal](#webserial-cli-terminal)
  - [Log Comparison](#log-comparison)
  - [Multi-Drone Profiles](#multi-drone-profiles)
  - [Pre-flight Checklist](#pre-flight-checklist)
  - [Multi-language Support](#multi-language-support)
- [Usage Workflow](#usage-workflow)
- [Architecture & Project Structure](#architecture--project-structure)
- [Analyzer Reference](#analyzer-reference)
- [Building Desktop App](#building-desktop-app)
- [Contributing](#contributing)
- [License](#license)

---

## What Makes This Different

| Feature | iFlyQuad | PIDtoolbox | FPVtune | BF Explorer |
|---------|:--------:|:----------:|:-------:|:-----------:|
| Free & open-source | ✅ | ❌ (paywall) | ❌ ($9–20) | ✅ |
| Browser-based | ✅ | ❌ (MATLAB) | ✅ | ✅ |
| Desktop app (Electron) | ✅ | ✅ | ❌ | ✅ |
| Sequential gate-locked workflow | ✅ | ❌ | ❌ | ❌ |
| 16 specialized analyzers | ✅ | ❌ | ❌ | ❌ |
| WebSerial CLI terminal | ✅ | ❌ | ❌ | ❌ |
| Rate library (50+ pilots) | ✅ | ❌ | ❌ | ❌ |
| Side-by-side rate comparison | ✅ | ❌ | ❌ | ❌ |
| Before/after log comparison | ✅ | ❌ | ❌ | ❌ |
| Smart blackbox-aware presets | ✅ | ❌ | ❌ | ❌ |
| Multi-drone profile management | ✅ | ❌ | ❌ | ❌ |
| Multi-language (EN/ID/ES/DE) | ✅ | ❌ | ❌ | ❌ |
| Pre-flight checklist | ✅ | ❌ | ❌ | ❌ |

---

## Quick Start

### Requirements

- **Node.js 18+** and **npm 9+**
- A Chrome-based browser (**Chrome 89+** or **Edge 89+**) for WebSerial features
- Betaflight CLI dump (`dump all`) and/or a blackbox log (`.bbl` or `.csv`)

### 1. Clone & Install

```bash
git clone https://github.com/itsmhp/betaflight-advanced-tuning-assist.git
cd betaflight-advanced-tuning-assist
npm install
```

---

## Running the App

### Option A — Web App (Browser)

Fastest way to get started. No desktop installation needed.

```bash
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

### Option B — Desktop App (Electron)

Opens a native desktop window with full access to the WebSerial API.

```bash
npm run electron:dev
```

> If a previous Electron/Vite process is still running, kill it first:
> ```bash
> pkill -f "Electron"; pkill -f "vite"
> ```

### Option C — Download a Release

Pre-built binaries are available on the [Releases page](https://github.com/itsmhp/betaflight-advanced-tuning-assist/releases):

| Platform | File |
|----------|------|
| Windows (installer) | `iFlyQuad-Tuning-Assist-Setup.exe` |
| Windows (portable) | `iFlyQuad-Tuning-Assist-Portable.exe` |
| macOS | `iFlyQuad-Tuning-Assist.dmg` |

---

## Features Overview

### 16 Blackbox Analysis Tools

Every tool outputs a **health score (0–100)**, a **severity level** (Excellent / Good / Warning / Critical), **actionable recommendations**, and **copy-ready CLI commands**.

| # | Tool | What It Analyzes |
|---|------|-----------------|
| 1 | **Advanced PID Health** | P/I/D balance ratios, oscillation rate, error RMS, PID latency, term saturation per axis |
| 2 | **Motor Doctor** | Motor balance, CG offset direction, vibration FFT peaks, saturation range (P5–P95) |
| 3 | **Noise Profile** | Frequency-band energy distribution, resonance peaks, filter effectiveness, throttle correlation |
| 4 | **Filter Analyzer** | FFT-based filter recommendations, SNR, noise floor, peak frequency detection |
| 5 | **TPA Analyzer** | Multi-method breakpoint detection, D-term noise vs throttle, confidence scoring |
| 6 | **Propwash Detector** | Propwash energy (20–100 Hz), motor-gyro correlation, event detection & severity |
| 7 | **Anti-Gravity** | Throttle punch drift per axis, current vs recommended `anti_gravity_gain` |
| 8 | **I-Term Buildup** | Accumulation rate, time above windup threshold, per-axis P95 values |
| 9 | **Feedforward Health** | FF lag per maneuver, speed-band scoring, current vs suggested FF values per axis |
| 10 | **Thrust Linearization** | MAPE motor linearity, non-linear onset detection, `thrust_linear` value suggestions |
| 11 | **Stick Analyzer** | Smoothness, symmetry, bounceback, jitter, flight style classification |
| 12 | **Throttle Axis** | Hover throttle detection, flight style inference, full-throttle time % |
| 13 | **PID Contribution** | P/I/D/F term ratios per axis, D-term dominance warnings |
| 14 | **PID Multiplier** | Scale all PID values by 0.1×–2.0× with live preview (no blackbox required) |
| 15 | **Dynamic Idle** | Idle segment detection, desync rate %, eRPM and transition analysis |
| 16 | **Freestyle Analysis** | Left/right balance, trick detection (rolls, flips, split-S, powerloops), training recommendations |

### Sequential Tuning Pipeline

The **Tune Quad** workflow enforces a gate-locked 7-stage sequence so you always tune in the right order:

```
Stage 1: Noise Assessment
    ↓ (gate opens when noise is characterized)
Stage 2: Filter Configuration
    ↓
Stage 3: PID Tuning
    ↓
Stage 4: Feedforward
    ↓
Stage 5: TPA Breakpoint
    ↓
Stage 6: Anti-Gravity
    ↓
Stage 7: Verification
```

- Each stage generates targeted CLI commands for that phase only.
- Progress is persisted to `localStorage` — resume anytime.
- Integrates flying style selector and quad condition assessment.
- Evidence chart per stage shows which metrics drove each recommendation.

### Rate Profiles Library

- **50+ community rate profiles** from top pilots: Oscar Liang, Joshua Bardwell, Mr. Steele, Le Drib, JohnnyFPV, Skitzo, Nurk, Chukyy, and more.
- Supports all Betaflight rate types: **Betaflight, RaceFlight, KISS, Actual, QuickRates**.
- Real-time rate curve canvas visualization.
- Side-by-side comparison of up to **3 profiles** simultaneously.
- Create and save your own custom profiles (stored in `localStorage`).
- One-click CLI command generation per profile.

### Smart Presets System

- **36 base presets**: 9 frame sizes × 4 aggression levels (Low / Medium / High / Ultra).
- Frame sizes covered: 65mm, 75mm, 3", 3" Cinewhoop, 4", 5", 5" Race, 6", 7".
- **Blackbox-aware adjustment engine** — if you have analyzed a log, preset values automatically adapt based on:
  - Noise levels → adjusts filter aggressiveness
  - Motor balance issues → tightens gyro filters
  - Propwash severity → raises D-term
  - TPA breakpoint → corrects TPA value
  - I-term buildup → adjusts `iterm_relax`
  - Anti-gravity events → tunes `anti_gravity_gain`
- Each smart adjustment includes a human-readable explanation.

### WebSerial CLI Terminal

- Direct connection to your flight controller via **Web Serial API** (Chrome/Edge 89+).
- Configurable baud rate.
- Command history with syntax highlighting.
- Multi-command batch paste support.
- Works only in Chrome/Edge — a compatibility warning is shown in other browsers.

### Log Comparison

Upload two blackbox logs (before/after a tuning change) and get:

- Side-by-side scores across all 16 analyzers.
- Delta indicators showing improvement or regression per tool.
- Aggregate improvement score.

### Multi-Drone Profiles

- Create unlimited named drone profiles.
- Each profile stores: craft name, frame size, motor stator, prop size, battery cells, ESC protocol, flying style.
- Switch between profiles instantly from the sidebar dropdown.
- Duplicate profiles for quick A/B comparisons.
- All analysis outputs are scoped to the active profile.

### Pre-flight Checklist

Structured checklist integrated into the tuning workflow to verify all settings before flying.

### Multi-language Support

The UI is fully translated into 4 languages — switch at any time from the sidebar:

| Code | Language |
|------|----------|
| `en` | English |
| `id` | Bahasa Indonesia |
| `es` | Español |
| `de` | Deutsch |

---

## Usage Workflow

```
1. Profile Your Drone
   → My Drone page: enter frame, motors, props, battery, ESC protocol

2. Load Data
   → Upload CLI dump (dump all) — extracts current PID/filter/rate settings
   → Upload blackbox log (.bbl or .csv) — enables all 16 analyzers

3. Run Analysis
   → Dashboard: runs all analyzers in parallel, shows overall health score

4. Sequential Tuning
   → Tune Quad: follow gate-locked 7-stage pipeline, apply CLI per stage

5. Choose a Preset
   → Presets: pick frame size + aggression; smart presets adjust to your log data

6. Browse Community Rates
   → Rates: compare 50+ pilot profiles, create your own, copy CLI

7. Apply via CLI
   → Serial CLI (desktop) or copy commands to Betaflight Configurator

8. Pre-flight Check
   → Run checklist before flying

9. Post-flight
   → Record new log, use Log Comparison to validate improvement
```

---

## Architecture & Project Structure

```
betaflight-advanced-tuning-assist/
├── electron/
│   ├── main.cjs          # Electron main process (BrowserWindow, Web Serial flags)
│   └── preload.cjs       # Context bridge (exposes platform info to renderer)
├── src/
│   ├── main.jsx          # App entry — React + Router
│   ├── App.jsx           # Route definitions
│   ├── index.css         # Global styles (Tailwind + custom gradients)
│   ├── pages/            # 23 page components (one per tool/feature)
│   ├── components/
│   │   ├── Sidebar.jsx           # Main navigation, drone switcher, lang selector
│   │   ├── CLICommandsPanel.jsx  # Renders CLI commands with severity badges
│   │   ├── ErrorBoundary.jsx     # React error boundary with reset
│   │   ├── EvidenceChart.jsx     # Per-stage analyzer evidence bars
│   │   ├── FlyingStyleSelector.jsx
│   │   ├── NoiseHeatmap.jsx      # Canvas-based throttle×frequency heatmap
│   │   ├── PreFlightChecklist.jsx
│   │   ├── QuadConditionSelector.jsx
│   │   ├── StageTabView.jsx      # Tabbed stage recommendations
│   │   └── shared/
│   │       ├── UIComponents.jsx  # ToolHeader, StatCard, HealthBadge, ProgressBar
│   │       ├── CLIOutput.jsx     # Syntax-highlighted CLI display + copy
│   │       └── FileUpload.jsx    # Drag-drop file handler
│   ├── context/
│   │   ├── DataContext.jsx        # Global CLI/blackbox data state
│   │   └── DroneProfileContext.jsx # Multi-drone profile management (v5)
│   ├── i18n/
│   │   ├── LangContext.jsx        # Language context + useLang() hook
│   │   └── translations.js        # EN / ID / ES / DE strings
│   └── lib/
│       ├── analyzeAll.js          # Orchestrates all 16 analyzers in parallel
│       ├── tuningPipeline.js      # 7-stage gate-locked state machine
│       ├── presets.js             # 36 base presets (9 sizes × 4 levels)
│       ├── smartPresets.js        # Blackbox-aware preset adjustment engine
│       ├── rateCalculator.js      # Rate curve math (BF/RF/KISS/Actual/Quick)
│       ├── communityRates.js      # 50+ built-in pilot rate profiles
│       ├── blackboxParser.js      # CSV blackbox parser + field normalization
│       ├── bblDecoder.js          # Binary .bbl decoder (variable-byte encoding)
│       ├── cliParser.js           # CLI `dump all` parser
│       ├── aiInterpreter.js       # LLM prompt builder for stage analysis
│       ├── utils.js               # Math & DSP utilities (FFT, statistics)
│       └── analyzers/
│           ├── advancedPidHealth.js
│           ├── motorDoctor.js
│           ├── noiseProfile.js
│           ├── filterAnalyzer.js
│           ├── tpaAnalyzer.js
│           ├── propWash.js
│           ├── antiGravity.js
│           ├── itermBuildup.js
│           ├── feedforward.js
│           ├── thrustLinearization.js
│           ├── stickAnalyzer.js
│           ├── throttleAxis.js
│           ├── pidContribution.js
│           ├── pidMultiplier.js
│           └── dynamicIdle.js
├── public/               # Static assets, app icons
├── index.html
├── vite.config.js        # Vite + Tailwind + Electron base path
├── eslint.config.js
└── package.json
```

### Data Flow

```
User Input (files / form)
        │
        ▼
DataContext / DroneProfileContext
        │
        ├──► blackboxParser.js / bblDecoder.js   → parsed blackbox rows
        └──► cliParser.js                         → extracted PID/filter params
                    │
                    ▼
            analyzeAll.js (parallel)
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   analyzer 1  analyzer 2  ... (×15)
         │
         ▼
   { score, level, recommendations[], cli[] }
         │
         ▼
   Dashboard → aggregated score, heatmap, CLI batch output
```

---

## Analyzer Reference

Each analyzer in `src/lib/analyzers/` follows this contract:

```js
// Input
{
  blackbox,    // parsed rows array
  tuning,      // extracted CLI params (PIDs, filters, rates)
  profile,     // active drone profile (frame size, props, etc.)
}

// Output
{
  score: Number,          // 0–100
  level: String,          // 'excellent' | 'good' | 'warning' | 'critical'
  recommendations: [],    // Array of { text, severity }
  cli: [],                // Array of 'set param=value' strings
  ...metrics              // Analyzer-specific data for visualization
}
```

Health score thresholds:

| Score | Level | Color |
|-------|-------|-------|
| 85–100 | Excellent | 🟢 Green |
| 65–84 | Good | 🟣 Violet |
| 40–64 | Warning | 🟡 Amber |
| 0–39 | Critical | 🔴 Red |

---

## Building Desktop App

> **macOS:** requires Xcode Command Line Tools.  
> **Windows:** run from a Windows machine or CI.

```bash
# macOS
npm run electron:build:mac

# Windows
npm run electron:build:win

# Both platforms
npm run electron:build:all
```

Output is written to the `release/` directory.

---

## Contributing

Pull requests are welcome! Some guidelines:

1. **Bugs / features:** Open an issue first to discuss the change.
2. **Analyzers:** Each analyzer must return `{ score, level, recommendations, cli }`.
3. **Translations:** Add new strings to all 4 language objects in `src/i18n/translations.js`.
4. **Style:** Follow existing Tailwind + lucide-react patterns; avoid external CSS.
5. **Tests:** Manual testing with real blackbox files is required before opening a PR.

```bash
# Lint
npm run lint

# Dev
npm run dev

# Electron dev
npm run electron:dev
```

---

## License

[MIT License](LICENSE) — free for personal and commercial use.

---

<div align="center">

Made with ❤️ for the FPV community by **Hanif Pratama**  
[mhp.hanif5@gmail.com](mailto:mhp.hanif5@gmail.com) · [GitHub](https://github.com/itsmhp)

</div>

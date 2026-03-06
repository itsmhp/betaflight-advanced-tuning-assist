

# iFlyQuad — Betaflight Advanced Tuning Assist

> **Last Updated:** March 2026 · **Version:** 1.1.0

The most comprehensive free browser-based Betaflight tuning assistant.
Upload your blackbox log and CLI dump — get guided, evidence-based recommendations
with ready-to-paste CLI commands.

![React](https://img.shields.io/badge/React-19+-61dafb)
![Vite](https://img.shields.io/badge/Vite-6.4+-646cff)
![Betaflight](https://img.shields.io/badge/Betaflight-4.x-orange)
![Presets](https://img.shields.io/badge/Presets-36-blueviolet)
![Rates](https://img.shields.io/badge/Community%20Rates-50%2B-blue)
![Languages](https://img.shields.io/badge/Languages-4-green)
![Desktop](https://img.shields.io/badge/Desktop-Electron-9feaf9)

---

## What Makes This Different

| Feature | iFlyQuad | PIDtoolbox | FPVtune | BF Explorer |
|---------|----------|------------|---------|-------------|
| Free | Yes | No (paywall) | No ($9-20) | Yes |
| Browser-based | Yes | No (MATLAB) | Yes | Yes |
| Sequential workflow | Yes | No | No | No |
| WebSerial CLI | Yes | No | No | No |
| Rate Library (50+) | Yes | No | No | No |
| Rate Comparison | Yes | No | No | No |
| Log Comparison | Yes | No | No | No |
| Desktop App | Yes | Yes | No | Yes |
| Multi-language | Yes | No | No | No |
| Pre-flight Checklist | Yes | No | No | No |

---

## Quick Start

### Web (Recommended)
Open the app in any Chrome-based browser. No installation required.

### Desktop App
Download the latest release for your platform:
- **Windows:** `iFlyQuad-Tuning-Assist-Setup.exe` (installer) or Portable `.exe`
- **macOS:** `iFlyQuad-Tuning-Assist.dmg`

### Local Development
```bash
git clone https://github.com/itsmhp/betaflight-advanced-tuning-assist
cd betaflight-advanced-tuning-assist
npm install
npm run dev
```

### Electron Development
```bash
npm run electron:dev
```

### Build Desktop App
```bash
npm run electron:build:win   # Windows
npm run electron:build:mac   # macOS
npm run electron:build:all   # Both
```

---

## Features

### Sequential Tuning Pipeline
Guided 7-stage tuning in the correct order:
**Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification**

Each stage is gate-locked — you can't tune PIDs on noisy motors.

### Rate Profiles Library
50+ community rates from top pilots (Oscar Liang, Joshua Bardwell, Mr. Steele, Le Drib, JohnnyFPV, Skitzo, Nurk, and more). Create and save your own. Visual curve preview, side-by-side comparison (max 3), and copy-ready CLI commands.

### 15 Blackbox Analysis Tools

| Tool | What it analyzes |
|------|-----------------|
| Step Response | Response time, overshoot, damping per axis |
| Motor Health | Balance, vibration, cross-correlation |
| TPA Analyzer | Optimal throttle PID attenuation breakpoint |
| Propwash Detector | Propwash energy 20-100Hz, filter recommendations |
| Dynamic Idle | Idle mode, RPM relaxation curve |
| Anti-Gravity | Throttle punch drift detection & severity |
| I-Term Buildup | Accumulation rate, axis bias |
| Feedforward Health | Lag analysis, responsiveness score |
| Thrust Linearization | PID effort slope, dual onset detection |
| Stick Movement | Jitter, smoothness, expo suggestions |
| Throttle Axis | Hover point, flight style analysis |
| PID Contribution | P/D/F ratio RMS analysis |
| Noise Analyzer | FFT spectrum, RPM harmonics |
| Filter Analyzer | Lowpass/notch config audit |
| Motor Doctor | Detailed vibration & health report |

### WebSerial CLI Terminal
Direct connection to your flight controller — apply changes without opening Betaflight Configurator.

### Smart Presets
36 tuning presets (9 frame sizes × 4 skill levels) that auto-adjust based on your drone profile and blackbox data.

### Pre-flight Checklist
Structured checklist before flying to ensure all settings are verified.

### Multi-language Support
English, Bahasa Indonesia, Español, Deutsch.

---

## Project Structure

```
betaflight-advanced-tuning-assist/
├── electron/          # Electron main process & preload
│   ├── main.js
│   └── preload.js
├── src/
│   ├── pages/         # Dashboard, TuneWorkflow, Presets, RatesPage, DroneProfile, CLI, LogComparison
│   ├── lib/           # 15 analyzers, presets, blackbox parsing, rate calculator, community rates
│   ├── context/       # React contexts (data, drone profile)
│   ├── components/    # Shared UI (FlyingStyleSelector, QuadConditionSelector, PreFlightChecklist, etc.)
│   └── i18n/          # Translations (EN/ID/ES/DE)
├── public/            # Static assets & icons
├── package.json
├── vite.config.js
└── README.md
```

---

## Usage Workflow

1. **Profile Your Drone:** Enter frame, motors, props, battery, and more
2. **Upload Blackbox Log:** (Optional) Get data-driven recommendations
3. **Select Preset:** Choose frame size & skill level for instant PID/filter settings
4. **Analyze:** View charts, health scores, and tuning advice
5. **Compare Rates:** Browse 50+ community rate profiles, compare up to 3 side by side
6. **Apply via CLI:** Use the built-in terminal to send commands to your FC
7. **Pre-flight Check:** Run the checklist before flying
8. **Test & Compare:** Fly, record new log, compare results

---

## Contributing

Pull requests are welcome! Please open issues for bugs, feature requests, or suggestions.
For major changes, discuss them first via issue.

---

## License

MIT License. See LICENSE for details.

---

Made with care for the FPV community by **Hanif Pratama** (mhp.hanif5@gmail.com)

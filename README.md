

# Betaflight Advanced Tuning Assist

Advanced FPV drone tuning for **Betaflight** firmware. Upload your drone profile and blackbox log—get smart, blackbox-aware recommendations, beautiful charts, and ready-to-paste CLI commands. Powered by a modern React web app.

![React](https://img.shields.io/badge/React-18+-61dafb)
![Vite](https://img.shields.io/badge/Vite-4+-646cff)
![Betaflight](https://img.shields.io/badge/Betaflight-4.x-orange)
![Presets](https://img.shields.io/badge/Presets-36-blueviolet)
![Languages](https://img.shields.io/badge/Languages-4-green)

---

## ✨ Features

### Guided Tuning Workflow

| Step | What you do |
|------|-------------|
| 1 | Enter drone hardware profile |
| 2 | Upload blackbox log (optional) |
| 3 | Select frame size & skill level |
| 4 | Get smart PID/filter presets |
| 5 | Analyze PID health, propwash, noise |
| 6 | Review tuning recommendations |
| 7 | Apply changes via built-in CLI terminal |
| 8 | Export/share your results |

### Smart Analysis Tools

- **PID Health Analyzer** — step response, overshoot, damping, axis balance
- **Propwash & Noise Detection** — spectrum charts, filter audit
- **Motor Doctor** — vibration, cross-correlation, health score
- **TPA, Feedforward, Anti-Gravity, I-Term, Thrust Linearization** — all major Betaflight tuning axes
- **Presets Engine** — 9 frame sizes × 4 skill levels, auto-adjusted for your quad and logs
- **Blackbox-Aware Recommendations** — upload `.bbl` log for data-driven tuning
- **WebSerial CLI Terminal** — direct Betaflight CLI access in browser
- **Multi-language UI** — English, Bahasa Indonesia, Español, Deutsch

---

## 🚀 Getting Started

1. **Install dependencies:**
	```bash
	npm install
	```
2. **Run locally:**
	```bash
	npm run dev
	```
3. **Build for production:**
	```bash
	npm run build
	```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗂️ Project Structure

```
betaflight-advanced-tuning-assist/
├── src/
│   ├── pages/         # Main app pages (Dashboard, TuneWorkflow, Presets, DroneProfile, CLI Terminal)
│   ├── lib/           # Analysis engines, presets, blackbox parsing
│   ├── context/       # React contexts for data and drone profile
│   ├── components/    # Shared UI components and error boundaries
│   └── i18n/          # Language support
├── public/            # Static assets
├── package.json       # Project metadata
├── vite.config.js     # Vite config
└── README.md
```

---

## 🛠️ Usage Workflow

1. **Profile Your Drone:** Enter frame, motors, props, battery, and more.
2. **Upload Blackbox Log:** (Optional) Get data-driven recommendations.
3. **Select Preset:** Choose frame size & skill level for instant PID/filter settings.
4. **Analyze:** View charts, health scores, and tuning advice.
5. **Apply via CLI:** Use the built-in terminal to send commands to your flight controller.
6. **Export/Share:** Save or share your results.

---

## 📊 Example Analysis Tools

| Tool | What it does |
|------|--------------|
| PID Health | Step response, overshoot, damping, axis balance |
| Propwash | Detects propwash, recommends filter changes |
| Motor Doctor | Finds vibration issues, motor health score |
| TPA Analyzer | Finds optimal throttle PID attenuation |
| Feedforward | Analyzes stick response, lag, health |
| Anti-Gravity | Detects throttle punch drift |
| I-Term Buildup | Finds axis bias, accumulation issues |
| Thrust Linearization | Analyzes PID effort slope |
| Noise Analyzer | FFT spectrum, filter audit |

---

## 🌍 Multi-language Support

- English
- Bahasa Indonesia
- Español
- Deutsch

---

## 🤝 Contributing

Pull requests are welcome! Please open issues for bugs, feature requests, or suggestions. For major changes, discuss them first via issue.

---

## 📄 License

MIT License. See LICENSE for details.

---

## 🙏 Credits

- Betaflight, Blackbox, and FPV community resources
- React, Vite, and open-source libraries

---

Made with care for the FPV community by Hanif Pratama (mhp.hanif5@gmail.com)

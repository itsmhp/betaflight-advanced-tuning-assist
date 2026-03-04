
# Betaflight Advanced Tuning Assist

An advanced web application to guide FPV drone pilots through the entire Betaflight tuning process, with smart presets, blackbox-aware recommendations, and a step-by-step workflow. Built with React and Vite.

## Features

- **Guided Tuning Workflow:** 8-step interactive process to tune your quad from start to finish.
- **Drone Profile Input:** Enter all hardware details (frame, motors, props, battery, etc.) for personalized recommendations.
- **Comprehensive Presets:** PID/filter presets for all frame sizes and skill levels, auto-adjusted for blackbox log analysis.
- **Blackbox-Aware Engine:** Smart recommendations based on your flight logs and detected issues.
- **PID Health Analyzer:** Visualize and diagnose PID performance, propwash, noise, and more.
- **Betaflight CLI Terminal:** Direct WebSerial CLI access for live configuration and commands.
- **Multi-language Support:** English, Indonesian, Spanish, German.
- **Modern UI:** Clean sidebar navigation, responsive design, error boundaries, and upload helpers.

## How It Works

1. **Profile Your Drone:** Fill in all hardware details for tailored tuning.
2. **Analyze Blackbox Logs:** Upload flight logs for smart, data-driven recommendations.
3. **Select Presets:** Choose from a grid of presets by size and skill level, auto-adjusted for your quad.
4. **Step-by-Step Tuning:** Follow the guided workflow to tune PID, filters, feedforward, anti-gravity, and more.
5. **Live CLI Access:** Use the built-in CLI terminal to apply changes directly to your flight controller.

## Getting Started

1. **Install dependencies:**
	```bash
	npm install
	```
2. **Run the app locally:**
	```bash
	npm run dev
	```
3. **Build for production:**
	```bash
	npm run build
	```

## Folder Structure

- `src/pages/` — Main app pages (Dashboard, TuneWorkflow, Presets, DroneProfile, CLI Terminal)
- `src/lib/` — Analysis engines, presets, blackbox parsing
- `src/context/` — React contexts for data and drone profile
- `src/components/` — Shared UI components and error boundaries
- `src/i18n/` — Language support

## Contributing

Pull requests are welcome! Please open issues for bugs, feature requests, or suggestions. For major changes, discuss them first via issue.

## License

MIT License. See LICENSE for details.

## Credits

- Betaflight, Blackbox, and FPV community resources
- React, Vite, and open-source libraries

---
Made by Hanif Pratama (mhp.hanif5@gmail.com)

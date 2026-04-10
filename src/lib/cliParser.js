// ─── Betaflight CLI Dump Parser ───
// Parses `dump all` output into structured data

export function parseCLIDump(text) {
  const result = {
    version: null,
    boardName: null,
    craftName: null,
    pilotName: null,
    mcuId: null,
    features: [],
    serial: [],
    mixer: null,
    aux: [],
    master: {},
    profiles: [{}, {}, {}, {}],
    rateProfiles: [{}, {}, {}, {}],
    activeProfile: 0,
    activeRateProfile: 0,
    raw: text
  };

  const lines = text.split('\n').map(l => l.trim());
  let currentSection = 'master';
  let currentProfile = -1;
  let currentRateProfile = -1;

  for (const line of lines) {
    // Skip comments and empty
    if (!line || line.startsWith('#')) {
      // Parse version from comment
      const versionMatch = line.match(/# Betaflight \/ (\S+) \((\S+)\) ([\d.]+)/);
      if (versionMatch) {
        result.version    = versionMatch[3];   // "4.5.3"
        result.fcTarget   = versionMatch[1];   // "STM32F405"
        result.fcShortName = versionMatch[2];  // "S405"
      }
      // Parse name
      const nameMatch = line.match(/# name: (.+)/);
      if (nameMatch) result.craftName = nameMatch[1].trim();
      continue;
    }

    // Board info
    if (line.startsWith('board_name ')) {
      result.boardName = line.split(' ')[1];
      continue;
    }
    if (line.startsWith('manufacturer_id ')) continue;
    if (line.startsWith('mcu_id ')) {
      result.mcuId = line.split(' ')[1];
      continue;
    }

    // Features
    if (line.startsWith('feature ')) {
      const feat = line.substring(8).trim();
      if (feat.startsWith('-')) {
        result.features = result.features.filter(f => f !== feat.substring(1));
      } else {
        if (!result.features.includes(feat)) result.features.push(feat);
      }
      continue;
    }

    // Serial
    if (line.startsWith('serial ')) {
      result.serial.push(line);
      continue;
    }

    // Mixer
    if (line.startsWith('mixer ')) {
      result.mixer = line.split(' ')[1];
      continue;
    }

    // Aux modes
    if (line.startsWith('aux ')) {
      result.aux.push(line);
      continue;
    }

    // Profile selection
    const profileMatch = line.match(/^profile (\d+)$/);
    if (profileMatch) {
      currentProfile = parseInt(profileMatch[1]);
      currentRateProfile = -1;
      currentSection = 'profile';
      continue;
    }
    const rateProfileMatch = line.match(/^rateprofile (\d+)$/);
    if (rateProfileMatch) {
      currentRateProfile = parseInt(rateProfileMatch[1]);
      currentProfile = -1;
      currentSection = 'rateprofile';
      continue;
    }

    // Set commands
    if (line.startsWith('set ')) {
      const setMatch = line.match(/^set\s+(\S+)\s*=\s*(.+)$/);
      if (setMatch) {
        const key = setMatch[1];
        let value = setMatch[2].trim();
        // Parse numeric
        if (/^-?\d+$/.test(value)) value = parseInt(value);
        else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);

        if (currentSection === 'profile' && currentProfile >= 0) {
          result.profiles[currentProfile][key] = value;
        } else if (currentSection === 'rateprofile' && currentRateProfile >= 0) {
          result.rateProfiles[currentRateProfile][key] = value;
        } else {
          result.master[key] = value;
        }
      }
      continue;
    }
  }

  // Detect active profile
  const apMatch = text.match(/# restore original profile selection\s*\nprofile (\d+)/);
  if (apMatch) result.activeProfile = parseInt(apMatch[1]);
  const arMatch = text.match(/# restore original rateprofile selection\s*\nrateprofile (\d+)/);
  if (arMatch) result.activeRateProfile = parseInt(arMatch[1]);

  // Add craft_name and pilot_name from master settings
  if (result.master.craft_name) result.craftName = result.craftName || result.master.craft_name;
  if (result.master.pilot_name) result.pilotName = result.master.pilot_name;

  return result;
}

// Extract key tuning parameters from parsed dump
export function extractTuningParams(parsed) {
  const p = parsed.activeProfile;
  const r = parsed.activeRateProfile;
  const prof = parsed.profiles[p] || {};
  const rate = parsed.rateProfiles[r] || {};
  const m = parsed.master;

  return {
    // PID values
    pid: {
      roll:  { p: prof.p_roll  ?? 45, i: prof.i_roll  ?? 80, d: prof.d_roll  ?? 40, f: prof.f_roll  ?? 120, dMin: prof.d_min_roll ?? 30 },
      pitch: { p: prof.p_pitch ?? 47, i: prof.i_pitch ?? 84, d: prof.d_pitch ?? 46, f: prof.f_pitch ?? 125, dMin: prof.d_min_pitch ?? 34 },
      yaw:   { p: prof.p_yaw   ?? 45, i: prof.i_yaw   ?? 80, d: prof.d_yaw   ?? 0,  f: prof.f_yaw   ?? 120, dMin: prof.d_min_yaw ?? 0 }
    },
    // D-term filters
    dtermLpf1: {
      dynMinHz: prof.dterm_lpf1_dyn_min_hz ?? 75,
      dynMaxHz: prof.dterm_lpf1_dyn_max_hz ?? 150,
      staticHz: prof.dterm_lpf1_static_hz ?? 75,
      type: prof.dterm_lpf1_type ?? 'PT1'
    },
    dtermLpf2: {
      staticHz: prof.dterm_lpf2_static_hz ?? 150,
      type: prof.dterm_lpf2_type ?? 'PT1'
    },
    // Gyro filters
    gyroLpf1: {
      staticHz: m.gyro_lpf1_static_hz ?? 0,
      dynMinHz: m.gyro_lpf1_dyn_min_hz ?? 0,
      dynMaxHz: m.gyro_lpf1_dyn_max_hz ?? 500,
      type: m.gyro_lpf1_type ?? 'PT1'
    },
    gyroLpf2: {
      staticHz: m.gyro_lpf2_static_hz ?? 675,
      type: m.gyro_lpf2_type ?? 'PT1'
    },
    dynNotch: {
      count: m.dyn_notch_count ?? 3,
      q: m.dyn_notch_q ?? 300,
      minHz: m.dyn_notch_min_hz ?? 150,
      maxHz: m.dyn_notch_max_hz ?? 600
    },
    // Anti-gravity
    antiGravity: {
      gain: prof.anti_gravity_gain ?? 80,
      cutoffHz: prof.anti_gravity_cutoff_hz ?? 5,
      pGain: prof.anti_gravity_p_gain ?? 100
    },
    // FeedForward
    feedforward: {
      transition: prof.feedforward_transition ?? 0,
      averaging: prof.feedforward_averaging ?? 'OFF',
      smoothFactor: prof.feedforward_smooth_factor ?? 25,
      jitterFactor: prof.feedforward_jitter_factor ?? 7,
      boost: prof.feedforward_boost ?? 15,
      maxRateLimit: prof.feedforward_max_rate_limit ?? 90
    },
    // TPA
    tpa: {
      mode: prof.tpa_mode ?? 'D',
      rate: prof.tpa_rate ?? 65,
      breakpoint: prof.tpa_breakpoint ?? 1350,
      lowRate: prof.tpa_low_rate ?? 20,
      lowBreakpoint: prof.tpa_low_breakpoint ?? 1050
    },
    // ITerm
    iterm: {
      relax: prof.iterm_relax ?? 'RP',
      relaxType: prof.iterm_relax_type ?? 'SETPOINT',
      relaxCutoff: prof.iterm_relax_cutoff ?? 15,
      windup: prof.iterm_windup ?? 85,
      limit: prof.iterm_limit ?? 400
    },
    // Motor
    motor: {
      protocol: m.motor_pwm_protocol ?? 'DSHOT300',
      poles: m.motor_poles ?? 14,
      kv: m.motor_kv ?? 0,
      dshotBidir: m.dshot_bidir ?? 'OFF',
      dshotIdleValue: m.dshot_idle_value ?? 550,
      minThrottle: m.min_throttle ?? 1070,
      maxThrottle: m.max_throttle ?? 2000
    },
    // Rates
    rates: {
      type: rate.rates_type ?? 'ACTUAL',
      roll:  { rcRate: rate.roll_rc_rate ?? 7, expo: rate.roll_expo ?? 0, sRate: rate.roll_srate ?? 67 },
      pitch: { rcRate: rate.pitch_rc_rate ?? 7, expo: rate.pitch_expo ?? 0, sRate: rate.pitch_srate ?? 67 },
      yaw:   { rcRate: rate.yaw_rc_rate ?? 7, expo: rate.yaw_expo ?? 0, sRate: rate.yaw_srate ?? 67 }
    },
    // RPM filter
    rpmFilter: {
      harmonics: m.rpm_filter_harmonics ?? 3,
      q: m.rpm_filter_q ?? 500,
      minHz: m.rpm_filter_min_hz ?? 100,
      lpfHz: m.rpm_filter_lpf_hz ?? 150
    },
    // Simplified tuning
    simplified: {
      mode: prof.simplified_pids_mode ?? 'RPY',
      masterMultiplier: prof.simplified_master_multiplier ?? 100,
      iGain: prof.simplified_i_gain ?? 100,
      dGain: prof.simplified_d_gain ?? 100,
      piGain: prof.simplified_pi_gain ?? 100,
      dmaxGain: prof.simplified_dmax_gain ?? 100,
      ffGain: prof.simplified_feedforward_gain ?? 100,
      pitchDGain: prof.simplified_pitch_d_gain ?? 100,
      pitchPiGain: prof.simplified_pitch_pi_gain ?? 100
    },
    // Throttle
    thrustLinear: prof.thrust_linear ?? 0,
    throttleBoost: prof.throttle_boost ?? 5,
    throttleBoostCutoff: prof.throttle_boost_cutoff ?? 15,
    // Dynamic Idle  (all dyn_idle_* are PROFILE_VALUE per BF firmware)
    // dyn_idle_min_rpm stores RPM/100:  actual_RPM = value * 100  (ref: mixer_init.c)
    dynamicIdle: {
      minRpm:        (prof.dyn_idle_min_rpm           ?? 0)   * 100,  // stored as RPM/100
      pGain:          prof.dyn_idle_p_gain             ?? 50,
      iGain:          prof.dyn_idle_i_gain             ?? 50,
      dGain:          prof.dyn_idle_d_gain             ?? 50,
      maxIncrease:    prof.dyn_idle_max_increase       ?? 150,
      startIncrease:  prof.dyn_idle_start_increase     ?? 50,
      enabled:       (prof.dyn_idle_min_rpm            ?? 0)   > 0
    }
  };
}

// Generate CLI commands from modifications
export function generateCLI(changes, profileNum = null) {
  const lines = ['# Betaflight Tuning Assist', `# Generated: ${new Date().toISOString()}`, '', 'batch start', ''];
  
  if (profileNum !== null && profileNum !== undefined) {
    lines.push(`profile ${profileNum}`, '');
  }

  for (const [key, value] of Object.entries(changes)) {
    lines.push(`set ${key} = ${value}`);
  }

  lines.push('', 'batch end', '', 'save');
  return lines.join('\n');
}

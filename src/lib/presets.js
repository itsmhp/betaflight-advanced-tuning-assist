/**
 * presets.js — Comprehensive Betaflight tuning presets for all quad sizes.
 *
 * Coverage: 65mm · 75mm · 3" toothpick · 3" cinewhoop · 4" · 5" freestyle ·
 *           5" race · 6" LR · 7" LR
 * Each size: 4 levels — low | medium | high | ultra
 *
 * Based on community tuning knowledge + iFlyQuad betaflight-advanced-tuning
 */

// ─────────────────────────────────────────────────────────────────────────────
// CLI Generator
// ─────────────────────────────────────────────────────────────────────────────
export function renderPresetCLI(preset, profileNum = 0, rateProfileNum = 0) {
  const lines = [
    `# ═══════════════════════════════════════════`,
    `# ${preset.frameSizeLabel} — ${preset.levelLabel}`,
    `# ${preset.subtitle}`,
    `# Betaflight Tuning Assist · BF 4.3+`,
    `# ${new Date().toISOString().slice(0, 10)}`,
    `# ═══════════════════════════════════════════`,
    `# Review before applying. Test at low throttle first.`,
    '',
    'batch start',
    '',
  ];

  const profile = preset.profileSettings ?? {};
  const master  = preset.masterSettings  ?? {};
  const rates   = preset.rateSettings    ?? {};

  if (Object.keys(profile).length) {
    lines.push(`profile ${profileNum}`, '');
    for (const [k, v] of Object.entries(profile)) lines.push(`set ${k} = ${v}`);
    lines.push('');
  }
  if (Object.keys(master).length) {
    lines.push('# Master / Gyro settings', '');
    for (const [k, v] of Object.entries(master)) lines.push(`set ${k} = ${v}`);
    lines.push('');
  }
  if (Object.keys(rates).length) {
    lines.push(`rateprofile ${rateProfileNum}`, '');
    for (const [k, v] of Object.entries(rates)) lines.push(`set ${k} = ${v}`);
    lines.push('');
  }

  lines.push('batch end', '', 'save');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL_META = {
  low:    { label: 'Low \u2014 Smooth',      badge: 'Smooth',     badgeColor: 'bg-blue-900/40 text-blue-300',    icon: '\uD83C\uDFAC' },
  medium: { label: 'Medium \u2014 Balanced', badge: 'Balanced',   badgeColor: 'bg-violet-900/40 text-violet-300', icon: '\u2696\uFE0F' },
  high:   { label: 'High \u2014 Aggressive', badge: 'Aggressive', badgeColor: 'bg-orange-900/40 text-orange-300', icon: '\uD83D\uDD25' },
  ultra:  { label: 'Ultra \u2014 Maximum',   badge: 'Maximum',    badgeColor: 'bg-red-900/40 text-red-300',       icon: '\u26A1' },
};

export const FRAME_SIZE_META = {
  '65mm':            { label: '65mm Tiny Whoop',       tags: ['Whoop', '1S/2S', 'Indoor'],           accentColor: 'from-cyan-600 to-blue-600' },
  '75mm':            { label: '75mm Tiny Whoop',       tags: ['Whoop', '2S', 'Indoor/Outdoor'],       accentColor: 'from-cyan-600 to-blue-600' },
  '3inch':           { label: '3" Toothpick / Micro',  tags: ['Toothpick', '3S/4S', 'Park'],          accentColor: 'from-emerald-600 to-teal-600' },
  '3inch_cinewhoop': { label: '3" CineWhoop',          tags: ['CineWhoop', 'Ducted', 'Filming'],       accentColor: 'from-blue-600 to-indigo-600' },
  '4inch':           { label: '4" Micro Freestyle',    tags: ['4S', 'Compact', 'Versatile'],           accentColor: 'from-teal-600 to-green-600' },
  '5inch':           { label: '5" Freestyle',          tags: ['4S/6S', 'Freestyle'],                   accentColor: 'from-violet-600 to-purple-600' },
  '5inch_race':      { label: '5" Racing',             tags: ['Gate Racing', 'Low Latency'],           accentColor: 'from-red-600 to-rose-600' },
  '6inch':           { label: '6" Long Range',         tags: ['LR', 'Efficient', 'Wind Stable'],       accentColor: 'from-amber-600 to-orange-600' },
  '7inch':           { label: '7" Long Range',         tags: ['LR', '6S', 'Long Cruise'],              accentColor: 'from-yellow-600 to-amber-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Preset Data
// ─────────────────────────────────────────────────────────────────────────────
const DB = {

  '65mm': {
    low: {
      subtitle: 'Gentle indoor whoop — smooth, cool motors',
      profileSettings: {
        p_roll:45,i_roll:100,d_roll:42,f_roll:0,d_min_roll:30,
        p_pitch:48,i_pitch:105,d_pitch:46,f_pitch:0,d_min_pitch:34,
        p_yaw:42,i_yaw:100,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:60,dterm_lpf1_dyn_min_hz:55,dterm_lpf1_dyn_max_hz:110,dterm_lpf2_static_hz:110,
        tpa_rate:15,tpa_breakpoint:1680,
        anti_gravity_gain:100,feedforward_smooth_factor:92,feedforward_jitter_factor:3,feedforward_boost:0,
        iterm_relax_cutoff:8,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:180,dyn_notch_count:3,dyn_notch_q:280,dyn_notch_min_hz:50,dyn_notch_max_hz:350},
      rateSettings:{roll_rc_rate:7,roll_expo:38,roll_srate:32,pitch_rc_rate:7,pitch_expo:38,pitch_srate:32,yaw_rc_rate:6,yaw_expo:28,yaw_srate:28},
    },
    medium: {
      subtitle: 'Standard whoop — mixed indoor/outdoor',
      profileSettings: {
        p_roll:65,i_roll:115,d_roll:50,f_roll:0,d_min_roll:38,
        p_pitch:68,i_pitch:120,d_pitch:55,f_pitch:0,d_min_pitch:42,
        p_yaw:62,i_yaw:112,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:65,dterm_lpf1_dyn_min_hz:62,dterm_lpf1_dyn_max_hz:125,dterm_lpf2_static_hz:125,
        tpa_rate:25,tpa_breakpoint:1570,
        anti_gravity_gain:88,feedforward_smooth_factor:72,feedforward_jitter_factor:5,feedforward_boost:5,
        iterm_relax_cutoff:10,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:240,dyn_notch_count:3,dyn_notch_q:300,dyn_notch_min_hz:60,dyn_notch_max_hz:400},
      rateSettings:{roll_rc_rate:12,roll_expo:30,roll_srate:48,pitch_rc_rate:12,pitch_expo:30,pitch_srate:48,yaw_rc_rate:10,yaw_expo:22,yaw_srate:44},
    },
    high: {
      subtitle: 'Snappy whoop for tricks and racing',
      profileSettings: {
        p_roll:82,i_roll:128,d_roll:60,f_roll:75,d_min_roll:46,
        p_pitch:86,i_pitch:132,d_pitch:65,f_pitch:80,d_min_pitch:50,
        p_yaw:78,i_yaw:122,d_yaw:0,f_yaw:58,
        dterm_lpf1_static_hz:70,dterm_lpf1_dyn_min_hz:68,dterm_lpf1_dyn_max_hz:138,dterm_lpf2_static_hz:138,
        tpa_rate:38,tpa_breakpoint:1460,
        anti_gravity_gain:78,feedforward_smooth_factor:48,feedforward_jitter_factor:8,feedforward_boost:10,
        iterm_relax_cutoff:12,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:300,dyn_notch_count:2,dyn_notch_q:350,dyn_notch_min_hz:70,dyn_notch_max_hz:450},
      rateSettings:{roll_rc_rate:16,roll_expo:25,roll_srate:58,pitch_rc_rate:16,pitch_expo:25,pitch_srate:58,yaw_rc_rate:13,yaw_expo:18,yaw_srate:52},
    },
    ultra: {
      subtitle: 'Max authority tiny whoop — racing class',
      profileSettings: {
        p_roll:95,i_roll:140,d_roll:70,f_roll:118,d_min_roll:54,
        p_pitch:100,i_pitch:145,d_pitch:75,f_pitch:122,d_min_pitch:58,
        p_yaw:90,i_yaw:135,d_yaw:0,f_yaw:88,
        dterm_lpf1_static_hz:76,dterm_lpf1_dyn_min_hz:74,dterm_lpf1_dyn_max_hz:150,dterm_lpf2_static_hz:150,
        tpa_rate:50,tpa_breakpoint:1370,
        anti_gravity_gain:68,feedforward_smooth_factor:28,feedforward_jitter_factor:10,feedforward_boost:15,
        iterm_relax_cutoff:14,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:360,dyn_notch_count:2,dyn_notch_q:400,dyn_notch_min_hz:80,dyn_notch_max_hz:510},
      rateSettings:{roll_rc_rate:20,roll_expo:20,roll_srate:66,pitch_rc_rate:20,pitch_expo:20,pitch_srate:66,yaw_rc_rate:17,yaw_expo:14,yaw_srate:60},
    },
  },

  '3inch': {
    low: {
      subtitle: 'Gentle 3" for park flying and learning',
      profileSettings: {
        p_roll:47,i_roll:84,d_roll:37,f_roll:78,d_min_roll:27,
        p_pitch:50,i_pitch:88,d_pitch:41,f_pitch:82,d_min_pitch:31,
        p_yaw:42,i_yaw:80,d_yaw:0,f_yaw:58,
        dterm_lpf1_static_hz:68,dterm_lpf1_dyn_min_hz:65,dterm_lpf1_dyn_max_hz:135,dterm_lpf2_static_hz:135,
        tpa_rate:28,tpa_breakpoint:1570,
        anti_gravity_gain:78,feedforward_smooth_factor:62,feedforward_jitter_factor:5,feedforward_boost:10,
        iterm_relax_cutoff:10,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:290,dyn_notch_count:2,dyn_notch_q:390,dyn_notch_min_hz:75,dyn_notch_max_hz:440},
      rateSettings:{roll_rc_rate:12,roll_expo:35,roll_srate:46,pitch_rc_rate:12,pitch_expo:35,pitch_srate:46,yaw_rc_rate:10,yaw_expo:25,yaw_srate:40},
    },
    medium: {
      subtitle: 'Balanced 3" freestyle',
      profileSettings: {
        p_roll:54,i_roll:90,d_roll:44,f_roll:98,d_min_roll:29,
        p_pitch:57,i_pitch:94,d_pitch:49,f_pitch:103,d_min_pitch:33,
        p_yaw:50,i_yaw:86,d_yaw:0,f_yaw:78,
        dterm_lpf1_static_hz:74,dterm_lpf1_dyn_min_hz:72,dterm_lpf1_dyn_max_hz:148,dterm_lpf2_static_hz:148,
        tpa_rate:38,tpa_breakpoint:1450,
        anti_gravity_gain:68,feedforward_smooth_factor:40,feedforward_jitter_factor:7,feedforward_boost:15,
        iterm_relax_cutoff:12,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:340,dyn_notch_count:2,dyn_notch_q:420,dyn_notch_min_hz:88,dyn_notch_max_hz:475},
      rateSettings:{roll_rc_rate:16,roll_expo:28,roll_srate:56,pitch_rc_rate:16,pitch_expo:28,pitch_srate:56,yaw_rc_rate:13,yaw_expo:20,yaw_srate:50},
    },
    high: {
      subtitle: 'Snappy 3" for tech freestyle',
      profileSettings: {
        p_roll:64,i_roll:100,d_roll:51,f_roll:128,d_min_roll:35,
        p_pitch:67,i_pitch:104,d_pitch:55,f_pitch:133,d_min_pitch:39,
        p_yaw:60,i_yaw:95,d_yaw:0,f_yaw:98,
        dterm_lpf1_static_hz:80,dterm_lpf1_dyn_min_hz:78,dterm_lpf1_dyn_max_hz:160,dterm_lpf2_static_hz:160,
        tpa_rate:50,tpa_breakpoint:1370,
        anti_gravity_gain:62,feedforward_smooth_factor:26,feedforward_jitter_factor:10,feedforward_boost:20,
        iterm_relax_cutoff:14,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:398,dyn_notch_count:2,dyn_notch_q:445,dyn_notch_min_hz:99,dyn_notch_max_hz:498},
      rateSettings:{roll_rc_rate:20,roll_expo:22,roll_srate:64,pitch_rc_rate:20,pitch_expo:22,pitch_srate:64,yaw_rc_rate:16,yaw_expo:16,yaw_srate:58},
    },
    ultra: {
      subtitle: 'Max 3" — clean build required',
      profileSettings: {
        p_roll:75,i_roll:110,d_roll:58,f_roll:158,d_min_roll:41,
        p_pitch:78,i_pitch:114,d_pitch:62,f_pitch:163,d_min_pitch:45,
        p_yaw:70,i_yaw:105,d_yaw:0,f_yaw:118,
        dterm_lpf1_static_hz:85,dterm_lpf1_dyn_min_hz:83,dterm_lpf1_dyn_max_hz:170,dterm_lpf2_static_hz:170,
        tpa_rate:60,tpa_breakpoint:1285,
        anti_gravity_gain:58,feedforward_smooth_factor:18,feedforward_jitter_factor:12,feedforward_boost:25,
        iterm_relax_cutoff:15,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:450,dyn_notch_count:1,dyn_notch_q:500,dyn_notch_min_hz:118,dyn_notch_max_hz:548},
      rateSettings:{roll_rc_rate:22,roll_expo:18,roll_srate:70,pitch_rc_rate:22,pitch_expo:18,pitch_srate:70,yaw_rc_rate:18,yaw_expo:12,yaw_srate:63},
    },
  },

  '3inch_cinewhoop': {
    low: {
      subtitle: 'Ultra smooth — indoor filming, zero prop wash',
      profileSettings: {
        p_roll:54,i_roll:93,d_roll:40,f_roll:0,d_min_roll:28,
        p_pitch:57,i_pitch:98,d_pitch:46,f_pitch:0,d_min_pitch:33,
        p_yaw:50,i_yaw:93,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:53,dterm_lpf1_dyn_min_hz:50,dterm_lpf1_dyn_max_hz:106,dterm_lpf2_static_hz:106,
        tpa_rate:18,tpa_breakpoint:1660,
        anti_gravity_gain:100,anti_gravity_cutoff_hz:4,
        feedforward_smooth_factor:96,feedforward_jitter_factor:3,feedforward_boost:0,feedforward_max_rate_limit:80,
        iterm_relax_cutoff:8,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:192,dyn_notch_count:3,dyn_notch_q:275,dyn_notch_min_hz:45,dyn_notch_max_hz:338},
      rateSettings:{roll_rc_rate:7,roll_expo:42,roll_srate:30,pitch_rc_rate:7,pitch_expo:42,pitch_srate:30,yaw_rc_rate:6,yaw_expo:32,yaw_srate:26},
    },
    medium: {
      subtitle: 'Balanced cinewhoop — smooth video and control',
      profileSettings: {
        p_roll:64,i_roll:100,d_roll:49,f_roll:0,d_min_roll:34,
        p_pitch:67,i_pitch:105,d_pitch:54,f_pitch:0,d_min_pitch:38,
        p_yaw:60,i_yaw:100,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:63,dterm_lpf1_dyn_min_hz:60,dterm_lpf1_dyn_max_hz:126,dterm_lpf2_static_hz:126,
        tpa_rate:24,tpa_breakpoint:1594,
        anti_gravity_gain:90,
        feedforward_smooth_factor:76,feedforward_jitter_factor:5,feedforward_boost:5,feedforward_max_rate_limit:84,
        iterm_relax_cutoff:10,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:244,dyn_notch_count:3,dyn_notch_q:296,dyn_notch_min_hz:58,dyn_notch_max_hz:395},
      rateSettings:{roll_rc_rate:10,roll_expo:37,roll_srate:40,pitch_rc_rate:10,pitch_expo:37,pitch_srate:40,yaw_rc_rate:8,yaw_expo:27,yaw_srate:35},
    },
    high: {
      subtitle: 'Responsive cinewhoop for fast proximity',
      profileSettings: {
        p_roll:74,i_roll:108,d_roll:56,f_roll:78,d_min_roll:39,
        p_pitch:77,i_pitch:113,d_pitch:61,f_pitch:83,d_min_pitch:43,
        p_yaw:69,i_yaw:104,d_yaw:0,f_yaw:58,
        dterm_lpf1_static_hz:70,dterm_lpf1_dyn_min_hz:68,dterm_lpf1_dyn_max_hz:140,dterm_lpf2_static_hz:140,
        tpa_rate:33,tpa_breakpoint:1490,
        anti_gravity_gain:80,
        feedforward_smooth_factor:53,feedforward_jitter_factor:7,feedforward_boost:10,
        iterm_relax_cutoff:12,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:292,dyn_notch_count:2,dyn_notch_q:342,dyn_notch_min_hz:67,dyn_notch_max_hz:428},
      rateSettings:{roll_rc_rate:13,roll_expo:31,roll_srate:50,pitch_rc_rate:13,pitch_expo:31,pitch_srate:50,yaw_rc_rate:11,yaw_expo:23,yaw_srate:44},
    },
    ultra: {
      subtitle: 'Max cinewhoop authority',
      profileSettings: {
        p_roll:84,i_roll:118,d_roll:63,f_roll:118,d_min_roll:44,
        p_pitch:87,i_pitch:123,d_pitch:68,f_pitch:122,d_min_pitch:48,
        p_yaw:78,i_yaw:108,d_yaw:0,f_yaw:88,
        dterm_lpf1_static_hz:76,dterm_lpf1_dyn_min_hz:74,dterm_lpf1_dyn_max_hz:152,dterm_lpf2_static_hz:152,
        tpa_rate:43,tpa_breakpoint:1406,
        anti_gravity_gain:70,
        feedforward_smooth_factor:32,feedforward_jitter_factor:10,feedforward_boost:15,
        iterm_relax_cutoff:14,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:342,dyn_notch_count:2,dyn_notch_q:395,dyn_notch_min_hz:77,dyn_notch_max_hz:472},
      rateSettings:{roll_rc_rate:16,roll_expo:25,roll_srate:58,pitch_rc_rate:16,pitch_expo:25,pitch_srate:58,yaw_rc_rate:13,yaw_expo:18,yaw_srate:52},
    },
  },

  '5inch': {
    low: {
      subtitle: 'Cinematic 5" — smooth footage, cool motors',
      profileSettings: {
        p_roll:38,i_roll:75,d_roll:32,f_roll:0,d_min_roll:24,
        p_pitch:40,i_pitch:78,d_pitch:36,f_pitch:0,d_min_pitch:28,
        p_yaw:35,i_yaw:75,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:58,dterm_lpf1_dyn_min_hz:55,dterm_lpf1_dyn_max_hz:118,dterm_lpf2_static_hz:118,
        tpa_rate:26,tpa_breakpoint:1590,
        anti_gravity_gain:86,anti_gravity_cutoff_hz:4,
        feedforward_smooth_factor:86,feedforward_jitter_factor:5,feedforward_boost:8,
        iterm_relax_cutoff:10,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:240,dyn_notch_count:3,dyn_notch_q:340,dyn_notch_min_hz:78,dyn_notch_max_hz:472},
      rateSettings:{roll_rc_rate:9,roll_expo:40,roll_srate:40,pitch_rc_rate:9,pitch_expo:40,pitch_srate:40,yaw_rc_rate:8,yaw_expo:30,yaw_srate:36},
    },
    medium: {
      subtitle: 'Everyday freestyle — balanced, prop wash resilient',
      profileSettings: {
        p_roll:45,i_roll:80,d_roll:40,f_roll:120,d_min_roll:30,
        p_pitch:47,i_pitch:84,d_pitch:46,f_pitch:125,d_min_pitch:34,
        p_yaw:45,i_yaw:80,d_yaw:0,f_yaw:120,
        dterm_lpf1_static_hz:74,dterm_lpf1_dyn_min_hz:72,dterm_lpf1_dyn_max_hz:148,dterm_lpf2_static_hz:148,
        tpa_rate:44,tpa_breakpoint:1454,
        anti_gravity_gain:70,
        feedforward_smooth_factor:36,feedforward_jitter_factor:7,feedforward_boost:15,
        iterm_relax_cutoff:12,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:345,dyn_notch_count:2,dyn_notch_q:398,dyn_notch_min_hz:98,dyn_notch_max_hz:496},
      rateSettings:{roll_rc_rate:14,roll_expo:33,roll_srate:52,pitch_rc_rate:14,pitch_expo:33,pitch_srate:52,yaw_rc_rate:12,yaw_expo:24,yaw_srate:46},
    },
    high: {
      subtitle: 'Aggressive 5" — snappy punch, higher P/D',
      profileSettings: {
        p_roll:55,i_roll:90,d_roll:48,f_roll:160,d_min_roll:36,
        p_pitch:58,i_pitch:95,d_pitch:52,f_pitch:165,d_min_pitch:40,
        p_yaw:55,i_yaw:90,d_yaw:0,f_yaw:140,
        dterm_lpf1_static_hz:84,dterm_lpf1_dyn_min_hz:82,dterm_lpf1_dyn_max_hz:168,dterm_lpf2_static_hz:168,
        tpa_rate:57,tpa_breakpoint:1382,
        anti_gravity_gain:64,
        feedforward_smooth_factor:23,feedforward_jitter_factor:10,feedforward_boost:20,
        iterm_relax_cutoff:14,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:415,dyn_notch_count:2,dyn_notch_q:445,dyn_notch_min_hz:118,dyn_notch_max_hz:528},
      rateSettings:{roll_rc_rate:18,roll_expo:28,roll_srate:61,pitch_rc_rate:18,pitch_expo:28,pitch_srate:61,yaw_rc_rate:15,yaw_expo:20,yaw_srate:55},
    },
    ultra: {
      subtitle: 'Max 5" authority — racing response, clean build required',
      profileSettings: {
        p_roll:65,i_roll:95,d_roll:52,f_roll:200,d_min_roll:40,
        p_pitch:68,i_pitch:100,d_pitch:56,f_pitch:210,d_min_pitch:44,
        p_yaw:60,i_yaw:95,d_yaw:0,f_yaw:160,
        dterm_lpf1_static_hz:94,dterm_lpf1_dyn_min_hz:90,dterm_lpf1_dyn_max_hz:184,dterm_lpf2_static_hz:184,
        tpa_rate:67,tpa_breakpoint:1302,
        anti_gravity_gain:58,
        feedforward_smooth_factor:17,feedforward_jitter_factor:12,feedforward_boost:25,
        iterm_relax_cutoff:15,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:476,dyn_notch_count:1,dyn_notch_q:498,dyn_notch_min_hz:148,dyn_notch_max_hz:576},
      rateSettings:{roll_rc_rate:22,roll_expo:22,roll_srate:70,pitch_rc_rate:22,pitch_expo:22,pitch_srate:70,yaw_rc_rate:18,yaw_expo:15,yaw_srate:63},
    },
  },

  '5inch_race': {
    low: {
      subtitle: 'Smooth race corners, lower filter latency',
      profileSettings: {
        p_roll:42,i_roll:70,d_roll:28,f_roll:130,d_min_roll:22,
        p_pitch:44,i_pitch:73,d_pitch:32,f_pitch:135,d_min_pitch:26,
        p_yaw:38,i_yaw:70,d_yaw:0,f_yaw:100,
        dterm_lpf1_static_hz:80,dterm_lpf1_dyn_min_hz:77,dterm_lpf1_dyn_max_hz:158,dterm_lpf2_static_hz:158,
        tpa_rate:54,tpa_breakpoint:1382,tpa_low_rate:20,tpa_low_breakpoint:1082,
        anti_gravity_gain:54,
        feedforward_smooth_factor:18,feedforward_jitter_factor:5,feedforward_boost:17,
        iterm_relax_cutoff:15,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:376,dyn_notch_count:1,dyn_notch_q:498,dyn_notch_min_hz:128,dyn_notch_max_hz:496},
      rateSettings:{roll_rc_rate:20,roll_expo:24,roll_srate:67,pitch_rc_rate:20,pitch_expo:24,pitch_srate:67,yaw_rc_rate:17,yaw_expo:18,yaw_srate:60},
    },
    medium: {
      subtitle: 'Balanced race — cornering plus straight-line speed',
      profileSettings: {
        p_roll:50,i_roll:70,d_roll:30,f_roll:150,d_min_roll:25,
        p_pitch:52,i_pitch:73,d_pitch:34,f_pitch:155,d_min_pitch:28,
        p_yaw:40,i_yaw:70,d_yaw:0,f_yaw:100,
        dterm_lpf1_static_hz:88,dterm_lpf1_dyn_min_hz:84,dterm_lpf1_dyn_max_hz:170,dterm_lpf2_static_hz:170,
        tpa_rate:65,tpa_breakpoint:1320,tpa_low_rate:25,tpa_low_breakpoint:1052,
        anti_gravity_gain:51,
        feedforward_smooth_factor:14,feedforward_jitter_factor:7,feedforward_boost:21,
        iterm_relax_cutoff:16,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:418,dyn_notch_count:1,dyn_notch_q:500,dyn_notch_min_hz:138,dyn_notch_max_hz:516},
      rateSettings:{roll_rc_rate:23,roll_expo:20,roll_srate:72,pitch_rc_rate:23,pitch_expo:20,pitch_srate:72,yaw_rc_rate:20,yaw_expo:15,yaw_srate:65},
    },
    high: {
      subtitle: 'Sharp race — snappy, requires clean build',
      profileSettings: {
        p_roll:58,i_roll:75,d_roll:35,f_roll:180,d_min_roll:28,
        p_pitch:60,i_pitch:78,d_pitch:38,f_pitch:185,d_min_pitch:32,
        p_yaw:50,i_yaw:75,d_yaw:0,f_yaw:130,
        dterm_lpf1_static_hz:95,dterm_lpf1_dyn_min_hz:90,dterm_lpf1_dyn_max_hz:184,dterm_lpf2_static_hz:184,
        tpa_rate:74,tpa_breakpoint:1278,tpa_low_rate:30,tpa_low_breakpoint:1042,
        anti_gravity_gain:49,
        feedforward_smooth_factor:11,feedforward_jitter_factor:9,feedforward_boost:26,
        iterm_relax_cutoff:17,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:448,dyn_notch_count:1,dyn_notch_q:548,dyn_notch_min_hz:148,dyn_notch_max_hz:548},
      rateSettings:{roll_rc_rate:26,roll_expo:17,roll_srate:77,pitch_rc_rate:26,pitch_expo:17,pitch_srate:77,yaw_rc_rate:22,yaw_expo:12,yaw_srate:69},
    },
    ultra: {
      subtitle: 'Absolute max race — ultra clean build required',
      profileSettings: {
        p_roll:68,i_roll:80,d_roll:40,f_roll:220,d_min_roll:32,
        p_pitch:70,i_pitch:84,d_pitch:44,f_pitch:225,d_min_pitch:36,
        p_yaw:55,i_yaw:80,d_yaw:0,f_yaw:160,
        dterm_lpf1_static_hz:100,dterm_lpf1_dyn_min_hz:100,dterm_lpf1_dyn_max_hz:200,dterm_lpf2_static_hz:200,
        tpa_rate:80,tpa_breakpoint:1250,tpa_low_rate:35,tpa_low_breakpoint:1030,
        anti_gravity_gain:47,
        feedforward_smooth_factor:9,feedforward_jitter_factor:11,feedforward_boost:29,
        iterm_relax_cutoff:18,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:498,dyn_notch_count:1,dyn_notch_q:598,dyn_notch_min_hz:158,dyn_notch_max_hz:598},
      rateSettings:{roll_rc_rate:28,roll_expo:14,roll_srate:82,pitch_rc_rate:28,pitch_expo:14,pitch_srate:82,yaw_rc_rate:24,yaw_expo:10,yaw_srate:74},
    },
  },

  '6inch': {
    low: {
      subtitle: 'Efficiency focus — smooth cruise, minimal D-noise',
      profileSettings: {
        p_roll:35,i_roll:70,d_roll:28,f_roll:0,d_min_roll:20,
        p_pitch:38,i_pitch:73,d_pitch:32,f_pitch:0,d_min_pitch:24,
        p_yaw:30,i_yaw:70,d_yaw:0,f_yaw:0,
        dterm_lpf1_static_hz:56,dterm_lpf1_dyn_min_hz:52,dterm_lpf1_dyn_max_hz:115,dterm_lpf2_static_hz:115,
        tpa_rate:28,tpa_breakpoint:1528,tpa_low_rate:11,tpa_low_breakpoint:1061,
        anti_gravity_gain:84,anti_gravity_cutoff_hz:3,
        feedforward_smooth_factor:88,feedforward_jitter_factor:3,feedforward_boost:0,
        iterm_relax_cutoff:9,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:218,dyn_notch_count:3,dyn_notch_q:316,dyn_notch_min_hz:68,dyn_notch_max_hz:415},
      rateSettings:{roll_rc_rate:8,roll_expo:42,roll_srate:36,pitch_rc_rate:8,pitch_expo:42,pitch_srate:36,yaw_rc_rate:7,yaw_expo:32,yaw_srate:32},
    },
    medium: {
      subtitle: 'Efficient cruising with decent freestyle',
      profileSettings: {
        p_roll:42,i_roll:78,d_roll:35,f_roll:80,d_min_roll:25,
        p_pitch:44,i_pitch:82,d_pitch:38,f_pitch:85,d_min_pitch:28,
        p_yaw:38,i_yaw:75,d_yaw:0,f_yaw:60,
        dterm_lpf1_static_hz:63,dterm_lpf1_dyn_min_hz:60,dterm_lpf1_dyn_max_hz:130,dterm_lpf2_static_hz:130,
        tpa_rate:36,tpa_breakpoint:1435,tpa_low_rate:14,tpa_low_breakpoint:1056,
        anti_gravity_gain:77,
        feedforward_smooth_factor:58,feedforward_jitter_factor:5,feedforward_boost:8,
        iterm_relax_cutoff:11,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:276,dyn_notch_count:2,dyn_notch_q:378,dyn_notch_min_hz:83,dyn_notch_max_hz:457},
      rateSettings:{roll_rc_rate:11,roll_expo:36,roll_srate:45,pitch_rc_rate:11,pitch_expo:36,pitch_srate:45,yaw_rc_rate:9,yaw_expo:26,yaw_srate:40},
    },
    high: {
      subtitle: 'Active LR — freestyle capability with efficiency',
      profileSettings: {
        p_roll:50,i_roll:85,d_roll:42,f_roll:120,d_min_roll:30,
        p_pitch:52,i_pitch:88,d_pitch:45,f_pitch:125,d_min_pitch:34,
        p_yaw:45,i_yaw:82,d_yaw:0,f_yaw:90,
        dterm_lpf1_static_hz:70,dterm_lpf1_dyn_min_hz:68,dterm_lpf1_dyn_max_hz:144,dterm_lpf2_static_hz:144,
        tpa_rate:47,tpa_breakpoint:1362,
        anti_gravity_gain:69,
        feedforward_smooth_factor:36,feedforward_jitter_factor:7,feedforward_boost:12,
        iterm_relax_cutoff:13,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:336,dyn_notch_count:2,dyn_notch_q:418,dyn_notch_min_hz:98,dyn_notch_max_hz:487},
      rateSettings:{roll_rc_rate:14,roll_expo:30,roll_srate:53,pitch_rc_rate:14,pitch_expo:30,pitch_srate:53,yaw_rc_rate:11,yaw_expo:22,yaw_srate:47},
    },
    ultra: {
      subtitle: 'Max LR authority — balance and prop balance essential',
      profileSettings: {
        p_roll:58,i_roll:92,d_roll:48,f_roll:148,d_min_roll:35,
        p_pitch:60,i_pitch:95,d_pitch:52,f_pitch:153,d_min_pitch:38,
        p_yaw:52,i_yaw:88,d_yaw:0,f_yaw:108,
        dterm_lpf1_static_hz:78,dterm_lpf1_dyn_min_hz:76,dterm_lpf1_dyn_max_hz:156,dterm_lpf2_static_hz:156,
        tpa_rate:53,tpa_breakpoint:1313,
        anti_gravity_gain:63,
        feedforward_smooth_factor:20,feedforward_jitter_factor:10,feedforward_boost:18,
        iterm_relax_cutoff:14,
      },
      masterSettings:{gyro_lpf1_static_hz:0,gyro_lpf2_static_hz:386,dyn_notch_count:2,dyn_notch_q:456,dyn_notch_min_hz:113,dyn_notch_max_hz:516},
      rateSettings:{roll_rc_rate:17,roll_expo:26,roll_srate:60,pitch_rc_rate:17,pitch_expo:26,pitch_srate:60,yaw_rc_rate:14,yaw_expo:18,yaw_srate:54},
    },
  },
};

// Aliases
DB['75mm']  = DB['65mm'];
DB['4inch'] = DB['3inch'];
DB['7inch'] = DB['6inch'];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Build a full preset object from frame size + level */
export function getPreset(frameSize, level) {
  const sizes     = DB[frameSize]          ?? DB['5inch'];
  const base      = sizes[level]           ?? sizes['medium'];
  const sizeMeta  = FRAME_SIZE_META[frameSize] ?? FRAME_SIZE_META['5inch'];
  const levelMeta = LEVEL_META[level]          ?? LEVEL_META['medium'];
  return {
    id: `${frameSize}_${level}`,
    frameSize,
    level,
    frameSizeLabel: sizeMeta.label,
    levelLabel:     levelMeta.label,
    subtitle:       base.subtitle,
    badge:          levelMeta.badge,
    badgeColor:     levelMeta.badgeColor,
    icon:           levelMeta.icon,
    accentColor:    sizeMeta.accentColor,
    tags:           sizeMeta.tags,
    highlight:      level === 'ultra' ? 'Very aggressive — review before flying' :
                    level === 'high'  ? 'Requires a reasonably clean build' : undefined,
    profileSettings: base.profileSettings ?? {},
    masterSettings:  base.masterSettings  ?? {},
    rateSettings:    base.rateSettings    ?? {},
  };
}

/** Get all 4 levels for a frame size */
export function getPresetsForSize(frameSize) {
  return ['low','medium','high','ultra'].map(l => getPreset(frameSize, l));
}

/** Get every preset across all sizes */
export function getAllPresets() {
  return Object.keys(FRAME_SIZE_META).flatMap(sz => getPresetsForSize(sz));
}

// Named flat array (for backward compatibility with PresetsPage)
export const PRESETS = getAllPresets();

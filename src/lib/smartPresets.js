/**
 * smartPresets.js — Blackbox-aware preset adjustment engine.
 *
 * Takes a base preset + analysis results and returns an adjusted preset
 * with an `adjustments[]` array explaining each change.
 *
 * Usage:
 *   import { applySmartAdjustments } from './smartPresets';
 *   const smart = applySmartAdjustments(getPreset('5inch', 'medium'), allResults);
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function scale(value, factor) {
  return Math.round(value * factor);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(factor) {
  const diff = Math.round((factor - 1) * 100);
  return diff >= 0 ? `+${diff}%` : `${diff}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule Checkers
// ─────────────────────────────────────────────────────────────────────────────

/** Noise — high motor temps / vibration → lower D-term and filter cutoffs */
function checkNoise(analysisResults, ps, adj) {
  const noise = analysisResults?.noise_profile;
  if (!noise || noise.noData || noise.isSkipped) return;

  const level = noise.level; // e.g. 'warning' | 'critical' | 'good'
  if (level === 'critical') {
    const f = 0.80;
    if (ps.d_roll)       ps.d_roll       = clamp(scale(ps.d_roll, f), 8, 120);
    if (ps.d_pitch)      ps.d_pitch      = clamp(scale(ps.d_pitch, f), 8, 120);
    if (ps.d_min_roll)   ps.d_min_roll   = clamp(scale(ps.d_min_roll, f), 6, 80);
    if (ps.d_min_pitch)  ps.d_min_pitch  = clamp(scale(ps.d_min_pitch, f), 6, 80);
    if (ps.dterm_lpf1_static_hz) ps.dterm_lpf1_static_hz = Math.max(40, Math.round(ps.dterm_lpf1_static_hz * 0.85));
    adj.push({ type: 'warning', topic: 'Noise (Critical)', desc: `D-term reduced ${pct(f)}, D-term filter tightened. Fix vibration source for best results.` });
  } else if (level === 'warning') {
    const f = 0.90;
    if (ps.d_roll)       ps.d_roll       = clamp(scale(ps.d_roll, f), 8, 120);
    if (ps.d_pitch)      ps.d_pitch      = clamp(scale(ps.d_pitch, f), 8, 120);
    adj.push({ type: 'info', topic: 'Noise (Elevated)', desc: `D-term eased ${pct(f)} — noise detected. Check motor balance and prop condition.` });
  }
}

/** Motor Doctor — imbalance → reduce I-term */
function checkMotorBalance(analysisResults, ps, adj) {
  const motor = analysisResults?.motor_doctor;
  if (!motor || motor.noData || motor.isSkipped) return;

  if (motor.level === 'critical') {
    const f = 0.85;
    if (ps.i_roll)  ps.i_roll  = clamp(scale(ps.i_roll, f), 20, 200);
    if (ps.i_pitch) ps.i_pitch = clamp(scale(ps.i_pitch, f), 20, 200);
    adj.push({ type: 'warning', topic: 'Motor Imbalance', desc: `I-term lowered ${pct(f)} — high motor imbalance found. Inspect/replace motors.` });
  }
}

/** Prop Wash — high propwash → raise D-term */
function checkPropWash(analysisResults, ps, adj) {
  const pw = analysisResults?.prop_wash;
  if (!pw || pw.noData || pw.isSkipped) return;

  if (pw.level === 'critical') {
    const f = 1.18;
    if (ps.d_roll)      ps.d_roll      = clamp(scale(ps.d_roll, f), 8, 120);
    if (ps.d_pitch)     ps.d_pitch     = clamp(scale(ps.d_pitch, f), 8, 120);
    if (ps.d_min_roll)  ps.d_min_roll  = clamp(scale(ps.d_min_roll, f), 6, 80);
    if (ps.d_min_pitch) ps.d_min_pitch = clamp(scale(ps.d_min_pitch, f), 6, 80);
    adj.push({ type: 'info', topic: 'Prop Wash', desc: `D-term raised ${pct(f)} to combat detected propwash.` });
  } else if (pw.level === 'warning') {
    const f = 1.08;
    if (ps.d_roll)  ps.d_roll  = clamp(scale(ps.d_roll, f), 8, 120);
    if (ps.d_pitch) ps.d_pitch = clamp(scale(ps.d_pitch, f), 8, 120);
    adj.push({ type: 'info', topic: 'Prop Wash (Mild)', desc: `D-term slightly raised ${pct(f)} for mild propwash.` });
  }
}

/** PID oscillation — overshoot/ringing → reduce P */
function checkOscillation(analysisResults, ps, adj) {
  const apid = analysisResults?.advanced_pid;
  if (!apid || apid.noData || apid.isSkipped) return;

  if (apid.level === 'critical') {
    const f = 0.82;
    if (ps.p_roll)  ps.p_roll  = clamp(scale(ps.p_roll, f), 10, 150);
    if (ps.p_pitch) ps.p_pitch = clamp(scale(ps.p_pitch, f), 10, 150);
    adj.push({ type: 'warning', topic: 'P Oscillation', desc: `P-term reduced ${pct(f)} — critical oscillation detected. Test at low throttle.` });
  } else if (apid.level === 'warning') {
    const f = 0.92;
    if (ps.p_roll)  ps.p_roll  = clamp(scale(ps.p_roll, f), 10, 150);
    if (ps.p_pitch) ps.p_pitch = clamp(scale(ps.p_pitch, f), 10, 150);
    adj.push({ type: 'info', topic: 'P Oscillation (Mild)', desc: `P-term eased ${pct(f)} — mild oscillation detected.` });
  }
}

/** TPA — suboptimal breakpoint → adjust */
function checkTPA(analysisResults, ps, adj) {
  const tpa = analysisResults?.tpa;
  if (!tpa || tpa.noData || tpa.isSkipped) return;

  if (tpa.suggestedBreakpoint && ps.tpa_breakpoint) {
    const suggested = tpa.suggestedBreakpoint;
    const current   = ps.tpa_breakpoint;
    if (Math.abs(suggested - current) > 80) {
      ps.tpa_breakpoint = suggested;
      adj.push({ type: 'info', topic: 'TPA Breakpoint', desc: `Breakpoint adjusted to ${suggested} based on your throttle profile.` });
    }
  }
}

/** Anti-Gravity — weak response → raise AG gain */
function checkAntiGravity(analysisResults, ps, adj) {
  const ag = analysisResults?.anti_gravity;
  if (!ag || ag.noData || ag.isSkipped) return;

  if (ag.level === 'warning' && ps.anti_gravity_gain) {
    const f = 1.12;
    ps.anti_gravity_gain = clamp(scale(ps.anti_gravity_gain, f), 50, 250);
    adj.push({ type: 'info', topic: 'Anti-Gravity', desc: `AG gain raised ${pct(f)} — throttle punch response was weak.` });
  }
}

/** Feedforward — jitter → raise smooth factor */
function checkFeedforward(analysisResults, ps, adj) {
  const ff = analysisResults?.feedforward;
  if (!ff || ff.noData || ff.isSkipped) return;

  if (ff.level === 'critical' && ps.feedforward_smooth_factor !== undefined) {
    const newVal = Math.min(ps.feedforward_smooth_factor + 20, 95);
    ps.feedforward_smooth_factor = newVal;
    adj.push({ type: 'info', topic: 'Feedforward Jitter', desc: `Smooth factor raised to ${newVal} — RC jitter detected.` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a copy of the preset with PIDs adjusted based on analysis results.
 * @param {object} preset - from getPreset()
 * @param {object} analysisResults - keyed by tool id, from analyzeAll
 * @returns {object} adjusted preset with `.adjustments` array and `.isAdjusted` flag
 */
export function applySmartAdjustments(preset, analysisResults) {
  if (!analysisResults || Object.keys(analysisResults).length === 0) {
    return { ...preset, adjustments: [], isAdjusted: false };
  }

  // Deep-clone profileSettings so we don't mutate the base preset
  const ps  = { ...(preset.profileSettings  ?? {}) };
  const adj = [];

  checkNoise(analysisResults, ps, adj);
  checkMotorBalance(analysisResults, ps, adj);
  checkPropWash(analysisResults, ps, adj);
  checkOscillation(analysisResults, ps, adj);
  checkTPA(analysisResults, ps, adj);
  checkAntiGravity(analysisResults, ps, adj);
  checkFeedforward(analysisResults, ps, adj);

  return {
    ...preset,
    profileSettings: ps,
    adjustments:     adj,
    isAdjusted:      adj.length > 0,
  };
}

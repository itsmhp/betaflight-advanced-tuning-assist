// ─── 3. PID Master Multiplier ───
import { clamp } from '../utils.js';

export function applyPIDMultiplier(tuningParams, multiplier) {
  const m = clamp(multiplier, 0.0, 2.0);
  const pid = tuningParams.pid;

  const scale = (v) => Math.round(v * m);

  const scaled = {
    roll:  { p: scale(pid.roll.p),  i: scale(pid.roll.i),  d: scale(pid.roll.d),  f: scale(pid.roll.f),  dMin: scale(pid.roll.dMin) },
    pitch: { p: scale(pid.pitch.p), i: scale(pid.pitch.i), d: scale(pid.pitch.d), f: scale(pid.pitch.f), dMin: scale(pid.pitch.dMin) },
    yaw:   { p: scale(pid.yaw.p),   i: scale(pid.yaw.i),   d: scale(pid.yaw.d),   f: scale(pid.yaw.f),   dMin: scale(pid.yaw.dMin) }
  };

  const pctChange = Math.round((m - 1) * 100);

  // Generate CLI
  const cliChanges = {
    p_roll: scaled.roll.p,
    i_roll: scaled.roll.i,
    d_roll: scaled.roll.d,
    f_roll: scaled.roll.f,
    d_min_roll: scaled.roll.dMin,
    p_pitch: scaled.pitch.p,
    i_pitch: scaled.pitch.i,
    d_pitch: scaled.pitch.d,
    f_pitch: scaled.pitch.f,
    d_min_pitch: scaled.pitch.dMin,
    p_yaw: scaled.yaw.p,
    i_yaw: scaled.yaw.i,
    d_yaw: scaled.yaw.d,
    f_yaw: scaled.yaw.f,
    d_min_yaw: scaled.yaw.dMin
  };

  return {
    original: pid,
    scaled,
    multiplier: m,
    pctChange,
    cliChanges
  };
}

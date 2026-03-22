// ─── Freestyle Analysis ───
// Detects left/right balance, freestyle tricks, and provides training recommendations
import { mean, clamp } from '../utils.js';

// ── Constants ──────────────────────────────────────────────────────────────────
const GYRO_DEADZONE   = 50;    // deg/s — ignore noise below this
const ROLL_THRESHOLD  = 300;   // deg/s — minimum for a roll/flip
const SPLIT_S_PITCH   = 200;   // deg/s — pitch threshold for split-S
const POWER_LOOP_PITCH = 250;  // deg/s — pitch threshold for powerloop
const TRICK_MIN_MS    = 120;   // minimum duration to count as a trick
const POWER_LOOP_MIN_MS = 350; // powerloops are longer
const INVERTED_MIN_MS = 180;   // minimum inverted hang duration
const COOLDOWN_MS     = 300;   // cooldown between trick detections
const DOWNSAMPLE      = 20;    // process every Nth sample (~100Hz at 2kHz)

// ── Main analyzer ──────────────────────────────────────────────────────────────
export function analyzeFreestyle(blackboxData) {
  const { data, sampleRate = 2000 } = blackboxData;
  if (!data || data.length < 100) {
    return { status: 'Insufficient Data', message: 'Not enough flight data for freestyle analysis.' };
  }

  const dtPerSample = 1000 / sampleRate; // ms per sample
  const step = Math.max(1, Math.round(DOWNSAMPLE * sampleRate / 2000)); // adapt to actual sample rate

  // ── Extract & downsample ───────────────────────────────────────────────────
  const samples = [];
  for (let i = 0; i < data.length; i += step) {
    const row = data[i];
    samples.push({
      rollGyro:  row['roll-gyro']  ?? 0,
      pitchGyro: row['pitch-gyro'] ?? 0,
      yawGyro:   row['yaw-gyro']   ?? 0,
      throttle:  row['throttle']   ?? 1500,
      accZ:      row['accZ']       ?? 0,
      time:      row['time']       ? row['time'] / 1000 : i * dtPerSample, // convert µs→ms
    });
  }

  const dtStep = step * dtPerSample; // ms between downsampled points
  const flightDuration = (samples[samples.length - 1].time - samples[0].time) / 1000; // seconds

  // ── 1. Left/Right Balance ──────────────────────────────────────────────────
  const balance = computeBalance(samples);

  // ── 2. Trick Detection ─────────────────────────────────────────────────────
  const tricks = detectTricks(samples, dtStep);

  // ── 3. Trick Summary ───────────────────────────────────────────────────────
  const trickSummary = summarizeTricks(tricks);

  // ── 4. Overall Score ───────────────────────────────────────────────────────
  const score = computeBalanceScore(balance, trickSummary);

  // ── 5. Health Level ────────────────────────────────────────────────────────
  let healthLevel = 'Excellent';
  if (score < 85) healthLevel = 'Good';
  if (score < 65) healthLevel = 'Fair';
  if (score < 40) healthLevel = 'Poor';

  // ── 6. Recommendations ─────────────────────────────────────────────────────
  const recommendations = generateRecommendations(balance, trickSummary, score);

  // ── 7. Timeline events ─────────────────────────────────────────────────────
  const timeline = tricks.map(t => ({
    time: t.startTime / 1000, // seconds from start
    type: t.type,
    direction: t.direction,
  }));

  return {
    score: Math.round(score),
    healthScore: Math.round(score),
    healthLevel,
    balance,
    tricks,
    trickSummary,
    totalTricks: tricks.length,
    flightDuration: Math.round(flightDuration),
    recommendations,
    timeline,
  };
}

// ── Balance computation ────────────────────────────────────────────────────────
function computeBalance(samples) {
  const axes = {
    roll:  { field: 'rollGyro',  leftLabel: 'left',     rightLabel: 'right' },
    pitch: { field: 'pitchGyro', leftLabel: 'backward',  rightLabel: 'forward' },
    yaw:   { field: 'yawGyro',   leftLabel: 'left',     rightLabel: 'right' },
  };

  const result = {};

  for (const [axis, cfg] of Object.entries(axes)) {
    let leftTime = 0, rightTime = 0;
    const leftMags = [], rightMags = [];

    for (const s of samples) {
      const v = s[cfg.field];
      if (Math.abs(v) < GYRO_DEADZONE) continue;
      if (v < 0) {
        leftTime++;
        leftMags.push(Math.abs(v));
      } else {
        rightTime++;
        rightMags.push(v);
      }
    }

    const total = leftTime + rightTime || 1;
    const leftPercent  = Math.round(leftTime / total * 100);
    const rightPercent = Math.round(rightTime / total * 100);

    result[axis] = {
      leftPercent,
      rightPercent,
      leftIntensity:  leftMags.length  > 0 ? Math.round(mean(leftMags))  : 0,
      rightIntensity: rightMags.length > 0 ? Math.round(mean(rightMags)) : 0,
      leftLabel:  cfg.leftLabel,
      rightLabel: cfg.rightLabel,
    };
  }

  return result;
}

// ── Trick detection (state machine) ────────────────────────────────────────────
function detectTricks(samples, dtStep) {
  const tricks = [];
  let lastTrickEnd = -Infinity;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const timeMs = s.time;

    // Cooldown check
    if (timeMs - lastTrickEnd < COOLDOWN_MS) continue;

    // Try each trick type
    const trick = tryDetectRoll(samples, i, dtStep)
      || tryDetectFlip(samples, i, dtStep)
      || tryDetectSplitS(samples, i, dtStep)
      || tryDetectPowerloop(samples, i, dtStep)
      || tryDetectInverted(samples, i, dtStep);

    if (trick) {
      tricks.push(trick);
      lastTrickEnd = trick.endTime;
      // Skip ahead past this trick
      const skipSamples = Math.ceil((trick.endTime - trick.startTime) / dtStep);
      i += Math.max(1, skipSamples);
    }
  }

  return tricks;
}

function tryDetectRoll(samples, startIdx, dtStep) {
  const s = samples[startIdx];
  if (Math.abs(s.rollGyro) < ROLL_THRESHOLD) return null;
  // Roll: dominant roll gyro, pitch/yaw relatively quiet
  if (Math.abs(s.pitchGyro) > Math.abs(s.rollGyro) * 0.6) return null;

  const direction = s.rollGyro < 0 ? 'left' : 'right';
  let peakGyro = Math.abs(s.rollGyro);
  let duration = 0;
  let i = startIdx;

  while (i < samples.length && Math.abs(samples[i].rollGyro) > ROLL_THRESHOLD * 0.5) {
    peakGyro = Math.max(peakGyro, Math.abs(samples[i].rollGyro));
    duration += dtStep;
    i++;
    if (duration > 2000) break; // safety cap
  }

  if (duration < TRICK_MIN_MS) return null;

  return {
    type: 'roll',
    direction,
    startTime: s.time,
    endTime: s.time + duration,
    peakGyro: Math.round(peakGyro),
  };
}

function tryDetectFlip(samples, startIdx, dtStep) {
  const s = samples[startIdx];
  if (Math.abs(s.pitchGyro) < ROLL_THRESHOLD) return null;
  if (Math.abs(s.rollGyro) > Math.abs(s.pitchGyro) * 0.6) return null;

  const direction = s.pitchGyro > 0 ? 'forward' : 'backward';
  let peakGyro = Math.abs(s.pitchGyro);
  let duration = 0;
  let i = startIdx;

  while (i < samples.length && Math.abs(samples[i].pitchGyro) > ROLL_THRESHOLD * 0.5) {
    peakGyro = Math.max(peakGyro, Math.abs(samples[i].pitchGyro));
    duration += dtStep;
    i++;
    if (duration > 2000) break;
  }

  if (duration < TRICK_MIN_MS) return null;

  return {
    type: 'flip',
    direction,
    startTime: s.time,
    endTime: s.time + duration,
    peakGyro: Math.round(peakGyro),
  };
}

function tryDetectSplitS(samples, startIdx, dtStep) {
  const s = samples[startIdx];
  // Split-S: nose down (negative pitch) + throttle drop
  if (s.pitchGyro > -SPLIT_S_PITCH) return null;
  if (s.throttle > 1600) return null; // throttle should be low during split-S entry

  let duration = 0;
  let foundRollRecovery = false;
  let rollDirection = null;
  let peakGyro = Math.abs(s.pitchGyro);
  let i = startIdx;

  while (i < samples.length && duration < 1500) {
    const cur = samples[i];
    peakGyro = Math.max(peakGyro, Math.abs(cur.pitchGyro), Math.abs(cur.rollGyro));
    duration += dtStep;

    // Look for roll recovery (half roll to level out)
    if (!foundRollRecovery && Math.abs(cur.rollGyro) > 200) {
      foundRollRecovery = true;
      rollDirection = cur.rollGyro < 0 ? 'left' : 'right';
    }

    // End when pitch gyro settles
    if (duration > 300 && Math.abs(cur.pitchGyro) < 100 && foundRollRecovery) break;
    i++;
  }

  if (!foundRollRecovery || duration < 200) return null;

  return {
    type: 'splitS',
    direction: rollDirection,
    startTime: s.time,
    endTime: s.time + duration,
    peakGyro: Math.round(peakGyro),
  };
}

function tryDetectPowerloop(samples, startIdx, dtStep) {
  const s = samples[startIdx];
  // Powerloop: sustained pitch pull (positive = pulling back) + high throttle
  if (s.pitchGyro < POWER_LOOP_PITCH) return null;
  if (s.throttle < 1400) return null;

  let duration = 0;
  let peakGyro = s.pitchGyro;
  let yawSum = 0;
  let i = startIdx;

  while (i < samples.length && duration < 3000) {
    const cur = samples[i];
    if (cur.pitchGyro < POWER_LOOP_PITCH * 0.4 && duration > 200) break;
    peakGyro = Math.max(peakGyro, cur.pitchGyro);
    yawSum += cur.yawGyro;
    duration += dtStep;
    i++;
  }

  if (duration < POWER_LOOP_MIN_MS) return null;

  return {
    type: 'powerloop',
    direction: yawSum < 0 ? 'left' : 'right',
    startTime: s.time,
    endTime: s.time + duration,
    peakGyro: Math.round(peakGyro),
  };
}

function tryDetectInverted(samples, startIdx, dtStep) {
  const s = samples[startIdx];
  // Inverted: AccZ goes negative (gravity inverted)
  if (s.accZ >= 0) return null;

  let duration = 0;
  let i = startIdx;

  while (i < samples.length && samples[i].accZ < 0) {
    duration += dtStep;
    i++;
    if (duration > 5000) break;
  }

  if (duration < INVERTED_MIN_MS) return null;

  // Determine direction from the roll that preceded the inversion
  const lookback = Math.min(startIdx, 10);
  let rollBias = 0;
  for (let j = startIdx - lookback; j < startIdx; j++) {
    if (j >= 0) rollBias += samples[j].rollGyro;
  }

  return {
    type: 'inverted',
    direction: rollBias < 0 ? 'left' : 'right',
    startTime: s.time,
    endTime: s.time + duration,
    peakGyro: 0,
  };
}

// ── Trick summary ──────────────────────────────────────────────────────────────
function summarizeTricks(tricks) {
  const summary = {
    rollLeft: 0, rollRight: 0,
    flipForward: 0, flipBackward: 0,
    splitSLeft: 0, splitSRight: 0,
    powerloopLeft: 0, powerloopRight: 0,
    invertedLeft: 0, invertedRight: 0,
  };

  for (const t of tricks) {
    switch (t.type) {
      case 'roll':
        if (t.direction === 'left') summary.rollLeft++;
        else summary.rollRight++;
        break;
      case 'flip':
        if (t.direction === 'forward') summary.flipForward++;
        else summary.flipBackward++;
        break;
      case 'splitS':
        if (t.direction === 'left') summary.splitSLeft++;
        else summary.splitSRight++;
        break;
      case 'powerloop':
        if (t.direction === 'left') summary.powerloopLeft++;
        else summary.powerloopRight++;
        break;
      case 'inverted':
        if (t.direction === 'left') summary.invertedLeft++;
        else summary.invertedRight++;
        break;
    }
  }

  return summary;
}

// ── Balance score ──────────────────────────────────────────────────────────────
function computeBalanceScore(balance, trickSummary) {
  // Per-axis score: 100 when perfectly balanced (50/50), 0 when fully one-sided
  const axisScore = (axis) => {
    const lp = axis.leftPercent;
    return 100 - Math.abs(lp - 50) * 2;
  };

  const rollScore  = axisScore(balance.roll);
  const pitchScore = axisScore(balance.pitch);
  const yawScore   = axisScore(balance.yaw);

  // Trick direction balance score
  const trickPairs = [
    [trickSummary.rollLeft, trickSummary.rollRight],
    [trickSummary.flipForward, trickSummary.flipBackward],
    [trickSummary.splitSLeft, trickSummary.splitSRight],
    [trickSummary.powerloopLeft, trickSummary.powerloopRight],
  ];

  let trickScore = 100;
  let pairsWithData = 0;
  for (const [l, r] of trickPairs) {
    const total = l + r;
    if (total === 0) continue;
    pairsWithData++;
    const pairBalance = 100 - Math.abs(l / total * 100 - 50) * 2;
    trickScore = Math.min(trickScore, pairBalance);
  }
  if (pairsWithData === 0) trickScore = 100;

  // Weighted aggregate
  return clamp(
    rollScore * 0.4 + pitchScore * 0.3 + yawScore * 0.2 + trickScore * 0.1,
    0, 100
  );
}

// ── Recommendations ────────────────────────────────────────────────────────────
function generateRecommendations(balance, trickSummary, score) {
  const recs = [];

  // Roll balance
  if (balance.roll.leftPercent < 40) {
    recs.push({ key: 'rec_practice_left_roll', fallback: `Your roll is ${balance.roll.rightPercent}% right-dominant. Practice left rolls and left split-S recoveries.` });
  } else if (balance.roll.rightPercent < 40) {
    recs.push({ key: 'rec_practice_right_roll', fallback: `Your roll is ${balance.roll.leftPercent}% left-dominant. Practice right rolls and right split-S recoveries.` });
  }

  // Pitch balance
  if (balance.pitch.leftPercent < 40) {
    recs.push({ key: 'rec_practice_backward', fallback: `Your pitch is ${balance.pitch.rightPercent}% forward-dominant. Practice backward flips and inverted maneuvers.` });
  } else if (balance.pitch.rightPercent < 40) {
    recs.push({ key: 'rec_practice_forward', fallback: `Your pitch is ${balance.pitch.leftPercent}% backward-dominant. Practice forward flips and split-S entries.` });
  }

  // Yaw balance
  if (balance.yaw.leftPercent < 40) {
    recs.push({ key: 'rec_practice_left_yaw', fallback: `Your yaw is ${balance.yaw.rightPercent}% right-dominant. Practice left yaw spins and left turns.` });
  } else if (balance.yaw.rightPercent < 40) {
    recs.push({ key: 'rec_practice_right_yaw', fallback: `Your yaw is ${balance.yaw.leftPercent}% left-dominant. Practice right yaw spins and right turns.` });
  }

  // Trick-specific
  const { rollLeft, rollRight, flipForward, flipBackward, splitSLeft, splitSRight } = trickSummary;

  if (rollLeft + rollRight > 0) {
    if (rollLeft > rollRight * 2) {
      recs.push({ key: 'rec_more_right_rolls', fallback: `You did ${rollLeft} left rolls but only ${rollRight} right rolls. Practice rolling right.` });
    } else if (rollRight > rollLeft * 2) {
      recs.push({ key: 'rec_more_left_rolls', fallback: `You did ${rollRight} right rolls but only ${rollLeft} left rolls. Practice rolling left.` });
    }
  }

  if (flipForward + flipBackward > 0) {
    if (flipForward > flipBackward * 2) {
      recs.push({ key: 'rec_more_back_flips', fallback: `You did ${flipForward} forward flips but only ${flipBackward} backward flips. Practice back flips.` });
    } else if (flipBackward > flipForward * 2) {
      recs.push({ key: 'rec_more_fwd_flips', fallback: `You did ${flipBackward} backward flips but only ${flipForward} forward flips. Practice forward flips.` });
    }
  }

  if (splitSLeft + splitSRight > 0 && (splitSLeft === 0 || splitSRight === 0)) {
    const missing = splitSLeft === 0 ? 'left' : 'right';
    recs.push({ key: `rec_splitS_${missing}`, fallback: `You only recover split-S to one side. Practice ${missing} recovery.` });
  }

  // Overall
  if (score >= 85) {
    recs.push({ key: 'rec_great_balance', fallback: 'Excellent balance! Your freestyle is well-rounded across both directions.' });
  } else if (score < 50) {
    recs.push({ key: 'rec_poor_balance', fallback: `Your balance score is ${Math.round(score)}%. Focus on practicing your weak side to build muscle memory.` });
  }

  return recs;
}

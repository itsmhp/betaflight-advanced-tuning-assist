/**
 * flightTrimmer.js
 * Auto-detect takeoff/landing boundaries and trim flight data.
 *
 * Takeoff detection: throttle rises from idle (~1000) to active (>1100) sustained
 * Landing detection: throttle drops to idle (<1050) sustained at the end
 */

const THROTTLE_IDLE = 1050;       // Below this = idle/ground
const THROTTLE_ACTIVE = 1150;     // Above this = clearly flying
const SUSTAIN_WINDOW = 50;        // Frames that must agree for state transition
const LANDING_SUSTAIN = 80;       // More conservative for landing detection

/**
 * Auto-detect the takeoff and landing frame indices.
 * Returns { startIdx, endIdx } — indices into bbParsed.data[]
 */
export function autoDetectTrim(bbParsed) {
  if (!bbParsed?.data?.length) return { startIdx: 0, endIdx: 0 };

  const data = bbParsed.data;
  const len = data.length;

  // Build throttle array for fast scanning
  const throttle = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    throttle[i] = data[i]?.throttle ?? data[i]?.['throttle'] ?? 0;
  }

  // --- Detect takeoff ---
  // Find first sustained region where throttle > THROTTLE_ACTIVE
  let startIdx = 0;
  for (let i = 0; i < len - SUSTAIN_WINDOW; i++) {
    let aboveCount = 0;
    for (let j = i; j < i + SUSTAIN_WINDOW && j < len; j++) {
      if (throttle[j] > THROTTLE_ACTIVE) aboveCount++;
    }
    if (aboveCount >= SUSTAIN_WINDOW * 0.8) {
      // Walk back a bit to capture the ramp-up
      startIdx = Math.max(0, i - 20);
      break;
    }
  }

  // --- Detect landing ---
  // Scan from end backwards, find last sustained region where throttle > THROTTLE_IDLE
  let endIdx = len - 1;
  for (let i = len - 1; i >= LANDING_SUSTAIN; i--) {
    let belowCount = 0;
    for (let j = i; j > i - LANDING_SUSTAIN && j >= 0; j--) {
      if (throttle[j] < THROTTLE_IDLE) belowCount++;
    }
    if (belowCount >= LANDING_SUSTAIN * 0.8) {
      // This is landing idle zone — keep looking backward for actual end of flight
      continue;
    } else {
      // Found active flight at frame i — add a small buffer
      endIdx = Math.min(len - 1, i + 20);
      break;
    }
  }

  // Safety: ensure start < end with minimum range
  if (endIdx <= startIdx + 100) {
    startIdx = 0;
    endIdx = len - 1;
  }

  return { startIdx, endIdx };
}

/**
 * Apply trim to bbParsed, returning a new object with trimmed data.
 * Original bbParsed is not mutated.
 */
export function applyTrim(bbParsed, startIdx, endIdx) {
  if (!bbParsed?.data?.length) return bbParsed;

  const s = Math.max(0, Math.min(startIdx, bbParsed.data.length - 1));
  const e = Math.max(s, Math.min(endIdx, bbParsed.data.length - 1));

  const trimmedData = bbParsed.data.slice(s, e + 1);

  return {
    ...bbParsed,
    data: trimmedData,
    rowCount: trimmedData.length,
    _trimRange: { startIdx: s, endIdx: e, originalLength: bbParsed.data.length },
  };
}

/**
 * Generate a downsampled throttle profile for the mini chart.
 * Returns array of { idx, value } with ~200 points.
 */
export function getThrottleProfile(bbParsed, numPoints = 200) {
  if (!bbParsed?.data?.length) return [];

  const data = bbParsed.data;
  const len = data.length;
  const step = Math.max(1, Math.floor(len / numPoints));
  const profile = [];

  for (let i = 0; i < len; i += step) {
    const val = data[i]?.throttle ?? 0;
    profile.push({ idx: i, value: val });
  }

  return profile;
}

/**
 * Format frame index as approximate time string (e.g., "12.3s")
 */
export function frameToTime(bbParsed, frameIdx) {
  if (!bbParsed?.data?.length || !bbParsed.sampleRate) return '?';
  const seconds = frameIdx / bbParsed.sampleRate;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Format duration between two frame indices
 */
export function frameDuration(bbParsed, startIdx, endIdx) {
  if (!bbParsed?.sampleRate) return '?';
  const seconds = (endIdx - startIdx) / bbParsed.sampleRate;
  return `${seconds.toFixed(1)}s`;
}

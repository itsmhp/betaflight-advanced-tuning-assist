// ─── Betaflight Blackbox (BBL) Decoder ────────────────────────────────────────
// Ported from the official Betaflight Blackbox Explorer v2025.12.1
// Reference: https://github.com/betaflight/blackbox-log-viewer
// Files: flightlog_parser.js, datastream.js, decoders.js, flightlog_fielddefs.js

// ── Constants (matching reference exactly) ────────────────────────────────────
const PRED_ZERO = 0;
const PRED_PREVIOUS = 1;
const PRED_STRAIGHT_LINE = 2;
const PRED_AVERAGE_2 = 3;
const PRED_MINTHROTTLE = 4;
const PRED_MOTOR_0 = 5;
const PRED_INC = 6;
// const PRED_HOME_COORD = 7; // GPS only
const PRED_1500 = 8;
const PRED_VBATREF = 9;
const PRED_LAST_MAIN_FRAME_TIME = 10;
const PRED_MINMOTOR = 11;

const ENC_SIGNED_VB = 0;
const ENC_UNSIGNED_VB = 1;
const ENC_NEG_14BIT = 3;
const ENC_TAG8_8SVB = 6;
const ENC_TAG2_3S32 = 7;
const ENC_TAG8_4S16 = 8;
const ENC_NULL = 9;
const ENC_TAG2_3SVARIABLE = 10;

const FLIGHT_LOG_MAX_FRAME_LENGTH = 256;
const MAX_TIME_JUMP = 10_000_000; // 10 seconds in µs
const MAX_ITER_JUMP = 5000;

const EOF = -1;

// ── Sign Extension Helpers ────────────────────────────────────────────────────
function signExtend2Bit(v)  { return (v & 0x02) ? (v | ~0x03) : (v & 0x03); }
function signExtend4Bit(v)  { return (v << 28) >> 28; }
function signExtend5Bit(v)  { return (v >= 16) ? v - 32 : v; }
function signExtend6Bit(v)  { return (v >= 32) ? v - 64 : v; }
function signExtend7Bit(v)  { return (v >= 64) ? v - 128 : v; }
function signExtend8Bit(v)  { return (v << 24) >> 24; }
function signExtend14Bit(v) { return (v >= 8192) ? v - 16384 : v; }
function signExtend16Bit(v) { return (v << 16) >> 16; }
function signExtend24Bit(v) { return (v >= 0x800000) ? v - 0x1000000 : v; }

// ── DataStream ────────────────────────────────────────────────────────────────
class DataStream {
  constructor(data, start, end) {
    this.data = data;
    this.pos = start || 0;
    this.start = this.pos;
    this.end = end || data.length;
    this.eof = false;
  }

  readByte() {
    if (this.pos < this.end) return this.data[this.pos++];
    this.eof = true;
    return EOF;
  }

  readChar() {
    if (this.pos < this.end) return String.fromCharCode(this.data[this.pos++]);
    this.eof = true;
    return EOF;
  }

  peekChar() {
    if (this.pos < this.end) return String.fromCharCode(this.data[this.pos]);
    this.eof = true;
    return EOF;
  }

  unreadChar() {
    this.pos--;
  }

  readUnsignedVB() {
    let result = 0, shift = 0;
    for (let i = 0; i < 5; i++) {
      const b = this.readByte();
      if (b === EOF) return 0;
      result = result | ((b & 0x7F) << shift);
      if (b < 128) return result >>> 0;
      shift += 7;
    }
    return 0; // VB too long
  }

  readSignedVB() {
    const u = this.readUnsignedVB();
    return (u >>> 1) ^ -(u & 1);
  }

  readS8() { return signExtend8Bit(this.readByte()); }

  readS16() {
    const b1 = this.readByte(), b2 = this.readByte();
    return signExtend16Bit(b1 | (b2 << 8));
  }

  readU32() {
    const b1 = this.readByte(), b2 = this.readByte();
    const b3 = this.readByte(), b4 = this.readByte();
    return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
  }

  readString(len) {
    let s = '';
    for (let i = 0; i < len; i++) {
      const c = this.readChar();
      if (c === EOF) break;
      s += c;
    }
    return s;
  }

  // ── TAG Decoders (ported from decoders.js) ────────────────────────────────

  readTag2_3S32(values) {
    const leadByte = this.readByte();
    switch (leadByte >> 6) {
      case 0: // 2-bit fields
        values[0] = signExtend2Bit((leadByte >> 4) & 0x03);
        values[1] = signExtend2Bit((leadByte >> 2) & 0x03);
        values[2] = signExtend2Bit(leadByte & 0x03);
        break;
      case 1: { // 4-bit fields
        values[0] = signExtend4Bit(leadByte & 0x0F);
        const b = this.readByte();
        values[1] = signExtend4Bit(b >> 4);
        values[2] = signExtend4Bit(b & 0x0F);
        break;
      }
      case 2: // 6-bit fields
        values[0] = signExtend6Bit(leadByte & 0x3F);
        values[1] = signExtend6Bit(this.readByte() & 0x3F);
        values[2] = signExtend6Bit(this.readByte() & 0x3F);
        break;
      case 3: { // 8/16/24/32-bit per-field selector
        let sel = leadByte;
        for (let i = 0; i < 3; i++) {
          switch (sel & 0x03) {
            case 0: values[i] = signExtend8Bit(this.readByte()); break;
            case 1: { const a = this.readByte(), b = this.readByte(); values[i] = signExtend16Bit(a | (b << 8)); break; }
            case 2: { const a = this.readByte(), b = this.readByte(), c = this.readByte(); values[i] = signExtend24Bit(a | (b << 8) | (c << 16)); break; }
            case 3: { const a = this.readByte(), b = this.readByte(), c = this.readByte(), d = this.readByte(); values[i] = a | (b << 8) | (c << 16) | (d << 24); break; }
          }
          sel >>= 2;
        }
        break;
      }
    }
  }

  readTag2_3SVariable(values) {
    const leadByte = this.readByte();
    switch (leadByte >> 6) {
      case 0: // 2-bit fields
        values[0] = signExtend2Bit((leadByte >> 4) & 0x03);
        values[1] = signExtend2Bit((leadByte >> 2) & 0x03);
        values[2] = signExtend2Bit(leadByte & 0x03);
        break;
      case 1: { // 5-5-4 bit layout
        values[0] = signExtend5Bit((leadByte & 0x3E) >> 1);
        const b2 = this.readByte();
        values[1] = signExtend5Bit(((leadByte & 0x01) << 4) | ((b2 & 0xF0) >> 4));
        values[2] = signExtend4Bit(b2 & 0x0F);
        break;
      }
      case 2: { // 8-7-7 bit layout
        const b2 = this.readByte();
        values[0] = signExtend8Bit(((leadByte & 0x3F) << 2) | ((b2 & 0xC0) >> 6));
        const b3 = this.readByte();
        values[1] = signExtend7Bit(((b2 & 0x3F) << 1) | ((b3 & 0x80) >> 7));
        values[2] = signExtend7Bit(b3 & 0x7F);
        break;
      }
      case 3: { // 8/16/24/32-bit per-field selector (same as TAG2_3S32 case 3)
        let sel = leadByte;
        for (let i = 0; i < 3; i++) {
          switch (sel & 0x03) {
            case 0: values[i] = signExtend8Bit(this.readByte()); break;
            case 1: { const a = this.readByte(), b = this.readByte(); values[i] = signExtend16Bit(a | (b << 8)); break; }
            case 2: { const a = this.readByte(), b = this.readByte(), c = this.readByte(); values[i] = signExtend24Bit(a | (b << 8) | (c << 16)); break; }
            case 3: { const a = this.readByte(), b = this.readByte(), c = this.readByte(), d = this.readByte(); values[i] = a | (b << 8) | (c << 16) | (d << 24); break; }
          }
          sel >>= 2;
        }
        break;
      }
    }
  }

  readTag8_4S16_v1(values) {
    let selector = this.readByte();
    for (let i = 0; i < 4; i++) {
      switch (selector & 0x03) {
        case 0: values[i] = 0; break;
        case 1: { // 4-bit pair: reads TWO fields from one byte
          const combined = this.readByte();
          values[i] = signExtend4Bit(combined & 0x0F);
          i++; selector >>= 2;
          values[i] = signExtend4Bit(combined >> 4);
          break;
        }
        case 2: values[i] = signExtend8Bit(this.readByte()); break;
        case 3: { const a = this.readByte(), b = this.readByte(); values[i] = signExtend16Bit(a | (b << 8)); break; }
      }
      selector >>= 2;
    }
  }

  readTag8_4S16_v2(values) {
    let selector = this.readByte();
    let nibbleIndex = 0, buffer = 0;
    for (let i = 0; i < 4; i++) {
      switch (selector & 0x03) {
        case 0: values[i] = 0; break;
        case 1: // 4-bit nibble
          if (nibbleIndex === 0) {
            buffer = this.readByte();
            values[i] = signExtend4Bit(buffer >> 4);
            nibbleIndex = 1;
          } else {
            values[i] = signExtend4Bit(buffer & 0x0F);
            nibbleIndex = 0;
          }
          break;
        case 2: // 8-bit
          if (nibbleIndex === 0) {
            values[i] = signExtend8Bit(this.readByte());
          } else {
            let c1 = (buffer & 0x0F) << 4;
            buffer = this.readByte();
            c1 |= buffer >> 4;
            values[i] = signExtend8Bit(c1);
          }
          break;
        case 3: // 16-bit
          if (nibbleIndex === 0) {
            const a = this.readByte(), b = this.readByte();
            values[i] = signExtend16Bit((a << 8) | b);
          } else {
            const a = this.readByte(), b = this.readByte();
            values[i] = signExtend16Bit(((buffer & 0x0F) << 12) | (a << 4) | (b >> 4));
            buffer = b;
          }
          break;
      }
      selector >>= 2;
    }
  }

  readTag8_8SVB(values, valueCount) {
    if (valueCount === 1) {
      values[0] = this.readSignedVB();
    } else {
      let header = this.readByte();
      for (let i = 0; i < 8; i++, header >>= 1) {
        values[i] = (header & 0x01) ? this.readSignedVB() : 0;
      }
    }
  }
}

// ── Field name normalization ──────────────────────────────────────────────────
const columnMap = {
  'axisP[0]': 'roll-pterm',   'axisP[1]': 'pitch-pterm',   'axisP[2]': 'yaw-pterm',
  'axisI[0]': 'roll-iterm',   'axisI[1]': 'pitch-iterm',   'axisI[2]': 'yaw-iterm',
  'axisD[0]': 'roll-dterm',   'axisD[1]': 'pitch-dterm',   'axisD[2]': 'yaw-dterm',
  'axisF[0]': 'roll-fterm',   'axisF[1]': 'pitch-fterm',   'axisF[2]': 'yaw-fterm',
  'rcCommand[0]': 'roll-rc',  'rcCommand[1]': 'pitch-rc',
  'rcCommand[2]': 'yaw-rc',   'rcCommand[3]': 'throttle',
  'gyroADC[0]': 'roll-gyro',  'gyroADC[1]': 'pitch-gyro',  'gyroADC[2]': 'yaw-gyro',
  'gyroUnfilt[0]': 'roll-gyro-unfiltered', 'gyroUnfilt[1]': 'pitch-gyro-unfiltered',
  'gyroUnfilt[2]': 'yaw-gyro-unfiltered',
  'motor[0]': 'motor0', 'motor[1]': 'motor1', 'motor[2]': 'motor2', 'motor[3]': 'motor3',
  'motor[4]': 'motor4', 'motor[5]': 'motor5', 'motor[6]': 'motor6', 'motor[7]': 'motor7',
  'setpoint[0]': 'roll-setpoint', 'setpoint[1]': 'pitch-setpoint',
  'setpoint[2]': 'yaw-setpoint',  'setpoint[3]': 'throttle-setpoint',
  'accSmooth[0]': 'accX', 'accSmooth[1]': 'accY', 'accSmooth[2]': 'accZ',
  'eRPM[0]': 'erpm0', 'eRPM[1]': 'erpm1', 'eRPM[2]': 'erpm2', 'eRPM[3]': 'erpm3',
  'debug[0]': 'debug0', 'debug[1]': 'debug1', 'debug[2]': 'debug2', 'debug[3]': 'debug3',
  'debug[4]': 'debug4', 'debug[5]': 'debug5', 'debug[6]': 'debug6', 'debug[7]': 'debug7',
};

function normalizeName(name) {
  return columnMap[name] || name;
}

// ── Main Decoder ──────────────────────────────────────────────────────────────

export function decodeBBL(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 20) throw new Error('BBL file too small');

  // ── Phase 1: Parse ALL headers (support multi-session) ────────────────────
  const headers = {};
  const fieldDefs = { I: {}, P: {}, S: {}, G: {}, H: {} };
  let dataStart = 0;

  // Scan headers line by line from the start
  {
    let i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0x48) { // 'H'
        let line = '';
        let j = i;
        while (j < bytes.length && bytes[j] !== 0x0A) {
          line += String.fromCharCode(bytes[j]);
          j++;
        }
        line = line.trim();
        if (line.startsWith('H ')) {
          const match = line.match(/^H\s+(.+?):(.*)/);
          if (match) {
            const key = match[1].trim();
            const val = match[2].trim();
            headers[key] = val;
            const fieldMatch = key.match(/^Field ([IPSGH]) (.+)/);
            if (fieldMatch) {
              const ft = fieldMatch[1];
              const prop = fieldMatch[2]; // name, predictor, encoding, signed
              fieldDefs[ft][prop] = val.split(',').map(s => s.trim());
            }
          }
          dataStart = j + 1;
          i = j + 1;
          continue;
        }
      }
      break; // Stop at first non-header byte
    }
  }

  // ── Build frame definitions ───────────────────────────────────────────────
  const iFieldNames = fieldDefs.I.name || [];
  const iFieldPredictor = (fieldDefs.I.predictor || []).map(Number);
  const iFieldEncoding = (fieldDefs.I.encoding || []).map(Number);
  const iFieldSigned = (fieldDefs.I.signed || []).map(Number);
  const iFieldCount = iFieldNames.length;

  // P-frame uses same field names as I-frame
  const pFieldPredictor = (fieldDefs.P.predictor || []).map(Number);
  const pFieldEncoding = (fieldDefs.P.encoding || []).map(Number);
  const pFieldCount = iFieldCount; // P has same field count as I

  const sFieldNames = fieldDefs.S.name || [];
  const sFieldEncoding = (fieldDefs.S.encoding || []).map(Number);
  const sFieldPredictor = (fieldDefs.S.predictor || new Array(sFieldNames.length).fill(0)).map(Number);
  const sFieldCount = sFieldNames.length;

  // Build nameToIndex for I-frame
  const iNameToIndex = {};
  for (let i = 0; i < iFieldCount; i++) iNameToIndex[iFieldNames[i]] = i;

  // Field indices for key fields
  const ITER_INDEX = iNameToIndex['loopIteration'] ?? 0;
  const TIME_INDEX = iNameToIndex['time'] ?? 1;
  const MOTOR0_INDEX = iNameToIndex['motor[0]'] ?? -1;

  // ── System config (for predictors) ────────────────────────────────────────
  const sysConfig = {
    minthrottle: parseInt(headers['minthrottle'] || '1150', 10),
    maxthrottle: parseInt(headers['maxthrottle'] || '1850', 10),
    vbatref: parseInt(headers['vbatref'] || '4095', 10),
    motorOutput: [null, null],
    frameIntervalI: parseInt(headers['I interval'] || '32', 10) || 32,
    frameIntervalPNum: 1,
    frameIntervalPDenom: 1,
  };
  sysConfig.motorOutput[0] = sysConfig.minthrottle;
  sysConfig.motorOutput[1] = sysConfig.maxthrottle;

  // Parse "P interval" which can be "1/2" or just "2"
  if (headers['P interval']) {
    const pMatch = headers['P interval'].match(/(\d+)\/(\d+)/);
    if (pMatch) {
      sysConfig.frameIntervalPNum = parseInt(pMatch[1], 10);
      sysConfig.frameIntervalPDenom = parseInt(pMatch[2], 10);
    } else {
      sysConfig.frameIntervalPDenom = parseInt(headers['P interval'], 10) || 1;
    }
  }

  // Parse motorOutput from header if available
  if (headers['motorOutput']) {
    const parts = headers['motorOutput'].split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length >= 2) {
      sysConfig.motorOutput[0] = parts[0];
      sysConfig.motorOutput[1] = parts[1];
    }
  }

  // Data version for TAG8_4S16 v1 vs v2
  const dataVersion = parseInt(headers['Data version'] || '2', 10);

  // ── History ring buffer (matching reference) ──────────────────────────────
  const mainHistoryRing = [
    new Array(iFieldCount).fill(0),
    new Array(iFieldCount).fill(0),
    new Array(iFieldCount).fill(0),
  ];
  let mainHistory = [mainHistoryRing[0], null, null]; // [current, previous, previous2]
  let mainStreamIsValid = false;
  let lastMainFrameIteration = -1;
  let lastMainFrameTime = -1;
  let lastSkippedFrames = 0;

  // Slow frame state
  const lastSlow = new Array(sFieldCount).fill(0);

  // Event state
  let lastEvent = null;

  // ── Helper: shouldHaveFrame ───────────────────────────────────────────────
  function shouldHaveFrame(frameIndex) {
    return ((frameIndex % sysConfig.frameIntervalI) + sysConfig.frameIntervalPNum - 1)
      % sysConfig.frameIntervalPDenom < sysConfig.frameIntervalPNum;
  }

  function countIntentionallySkippedFrames() {
    if (lastMainFrameIteration === -1) return 0;
    let count = 0;
    for (let fi = lastMainFrameIteration + 1; !shouldHaveFrame(fi); fi++) {
      count++;
      if (count > 1000) break; // safety
    }
    return count;
  }

  // ── Predictor ─────────────────────────────────────────────────────────────
  function applyPrediction(fieldIndex, predictor, value, current, previous, previous2) {
    switch (predictor) {
      case PRED_ZERO: break;
      case PRED_PREVIOUS:
        if (previous) value += previous[fieldIndex];
        break;
      case PRED_STRAIGHT_LINE:
        if (previous) value += 2 * previous[fieldIndex] - previous2[fieldIndex];
        break;
      case PRED_AVERAGE_2:
        if (previous) value += ~~((previous[fieldIndex] + previous2[fieldIndex]) / 2);
        break;
      case PRED_MINTHROTTLE:
        value = Math.trunc(value) + sysConfig.minthrottle;
        break;
      case PRED_MOTOR_0:
        if (MOTOR0_INDEX >= 0) value += current[MOTOR0_INDEX];
        break;
      // PRED_INC (6) is handled in parseFrame, not here
      case PRED_1500:
        value += 1500;
        break;
      case PRED_VBATREF:
        value += sysConfig.vbatref;
        break;
      case PRED_LAST_MAIN_FRAME_TIME:
        if (mainHistory[1]) value += mainHistory[1][TIME_INDEX];
        break;
      case PRED_MINMOTOR:
        value = Math.trunc(value) + Math.trunc(sysConfig.motorOutput[0] || sysConfig.minthrottle);
        break;
      default: break; // Unknown predictor — return raw value
    }
    return value;
  }

  // ── parseFrame (core field decoder) ───────────────────────────────────────
  function parseFrame(stream, fieldCount, encoding, predictor, current, previous, previous2, skippedFrames, raw) {
    const values = new Array(8);
    let i = 0;
    while (i < fieldCount) {
      if (predictor[i] === PRED_INC) {
        current[i] = skippedFrames + 1;
        if (previous) current[i] += previous[i];
        i++;
        continue;
      }

      let value;
      switch (encoding[i]) {
        case ENC_SIGNED_VB:
          value = stream.readSignedVB();
          break;
        case ENC_UNSIGNED_VB:
          value = stream.readUnsignedVB();
          break;
        case ENC_NEG_14BIT:
          value = -signExtend14Bit(stream.readUnsignedVB());
          break;

        case ENC_TAG8_4S16:
          if (dataVersion < 2) stream.readTag8_4S16_v1(values);
          else stream.readTag8_4S16_v2(values);
          for (let j = 0; j < 4; j++, i++) {
            current[i] = applyPrediction(i, raw ? PRED_ZERO : predictor[i], values[j], current, previous, previous2);
          }
          continue;

        case ENC_TAG2_3S32:
          stream.readTag2_3S32(values);
          for (let j = 0; j < 3; j++, i++) {
            current[i] = applyPrediction(i, raw ? PRED_ZERO : predictor[i], values[j], current, previous, previous2);
          }
          continue;

        case ENC_TAG2_3SVARIABLE:
          stream.readTag2_3SVariable(values);
          for (let j = 0; j < 3; j++, i++) {
            current[i] = applyPrediction(i, raw ? PRED_ZERO : predictor[i], values[j], current, previous, previous2);
          }
          continue;

        case ENC_TAG8_8SVB: {
          // Count consecutive fields with same encoding
          let j;
          for (j = i + 1; j < i + 8 && j < fieldCount; j++) {
            if (encoding[j] !== ENC_TAG8_8SVB) break;
          }
          const groupCount = j - i;
          stream.readTag8_8SVB(values, groupCount);
          for (let k = 0; k < groupCount; k++, i++) {
            current[i] = applyPrediction(i, raw ? PRED_ZERO : predictor[i], values[k], current, previous, previous2);
          }
          continue;
        }

        case ENC_NULL:
          value = 0;
          break;

        default:
          // Unknown encoding — read signed VB as best effort
          value = stream.readSignedVB();
          break;
      }

      current[i] = applyPrediction(i, raw ? PRED_ZERO : predictor[i], value, current, previous, previous2);
      i++;
    }
  }

  // ── Frame parsers ─────────────────────────────────────────────────────────
  function parseIntraframe(stream) {
    const current = mainHistory[0];
    const previous = mainHistory[1];
    parseFrame(stream, iFieldCount, iFieldEncoding, iFieldPredictor, current, previous, null, 0, false);
  }

  function parseInterframe(stream) {
    const current = mainHistory[0];
    const previous = mainHistory[1];
    const previous2 = mainHistory[2];
    lastSkippedFrames = countIntentionallySkippedFrames();
    parseFrame(stream, pFieldCount, pFieldEncoding, pFieldPredictor, current, previous, previous2, lastSkippedFrames, false);
  }

  function parseSlowFrame(stream) {
    parseFrame(stream, sFieldCount, sFieldEncoding, sFieldPredictor, lastSlow, null, null, 0, false);
  }

  function parseEventFrame(stream) {
    const eventType = stream.readByte();
    lastEvent = { event: eventType, data: {} };

    switch (eventType) {
      case 0: // SYNC_BEEP
        lastEvent.data.time = stream.readUnsignedVB();
        break;
      case 10: // AUTOTUNE_CYCLE_START
        lastEvent.data.phase = stream.readByte();
        { const cr = stream.readByte();
          lastEvent.data.cycle = cr & 0x7F;
          lastEvent.data.rising = (cr >> 7) & 0x01; }
        lastEvent.data.p = stream.readByte();
        lastEvent.data.i = stream.readByte();
        lastEvent.data.d = stream.readByte();
        break;
      case 11: // AUTOTUNE_CYCLE_RESULT
        lastEvent.data.overshot = stream.readByte();
        lastEvent.data.p = stream.readByte();
        lastEvent.data.i = stream.readByte();
        lastEvent.data.d = stream.readByte();
        break;
      case 12: // AUTOTUNE_TARGETS
        lastEvent.data.currentAngle = stream.readS16() / 10;
        lastEvent.data.targetAngle = stream.readS8();
        lastEvent.data.targetAngleAtPeak = stream.readS8();
        lastEvent.data.firstPeakAngle = stream.readS16() / 10;
        lastEvent.data.secondPeakAngle = stream.readS16() / 10;
        break;
      case 13: { // INFLIGHT_ADJUSTMENT
        const tmp = stream.readByte();
        lastEvent.data.func = tmp & 127;
        lastEvent.data.value = tmp < 128 ? stream.readSignedVB() : stream.readU32();
        break;
      }
      case 14: // LOGGING_RESUME
        lastEvent.data.logIteration = stream.readUnsignedVB();
        lastEvent.data.currentTime = stream.readUnsignedVB();
        break;
      case 15: // DISARM
        lastEvent.data.reason = stream.readUnsignedVB();
        break;
      case 20: // GTUNE_CYCLE_RESULT
        lastEvent.data.axis = stream.readByte();
        lastEvent.data.gyroAVG = stream.readSignedVB();
        lastEvent.data.newP = stream.readS16();
        break;
      case 30: // FLIGHT_MODE
        lastEvent.data.newFlags = stream.readUnsignedVB();
        lastEvent.data.lastFlags = stream.readUnsignedVB();
        break;
      case 40: { // TWITCH_TEST
        stream.readByte(); // stage
        stream.readU32();  // float value
        break;
      }
      case 255: { // LOG_END
        const endMsg = stream.readString(11); // "End of log\0"
        if (endMsg === "End of log\0") {
          stream.end = stream.pos; // Stop parsing this session
        } else {
          lastEvent = null; // Not a real end marker
        }
        break;
      }
      default:
        lastEvent = null;
        break;
    }
  }

  // ── Frame completion ──────────────────────────────────────────────────────
  function invalidateMainStream() {
    mainStreamIsValid = false;
  }

  function rotateHistoryForward() {
    // Advance current to next empty ring slot
    if (mainHistory[0] === mainHistoryRing[0]) mainHistory[0] = mainHistoryRing[1];
    else if (mainHistory[0] === mainHistoryRing[1]) mainHistory[0] = mainHistoryRing[2];
    else mainHistory[0] = mainHistoryRing[0];
  }

  function completeIntraframe() {
    let accept = true;
    if (lastMainFrameIteration !== -1) {
      const iter = mainHistory[0][ITER_INDEX];
      const time = mainHistory[0][TIME_INDEX];
      accept = iter >= lastMainFrameIteration
            && iter < lastMainFrameIteration + MAX_ITER_JUMP
            && time >= lastMainFrameTime
            && time < lastMainFrameTime + MAX_TIME_JUMP;
    }

    if (accept) {
      lastMainFrameIteration = mainHistory[0][ITER_INDEX];
      lastMainFrameTime = mainHistory[0][TIME_INDEX];
      mainStreamIsValid = true;
    } else {
      invalidateMainStream();
    }

    // Rotate: both prev slots become current I-frame (can't look past I-frame)
    mainHistory[1] = mainHistory[0];
    mainHistory[2] = mainHistory[0];
    rotateHistoryForward();
    return accept;
  }

  function completeInterframe() {
    if (mainStreamIsValid) {
      const time = mainHistory[0][TIME_INDEX];
      const iter = mainHistory[0][ITER_INDEX];
      if (time > lastMainFrameTime + MAX_TIME_JUMP || iter > lastMainFrameIteration + MAX_ITER_JUMP) {
        mainStreamIsValid = false;
      }
    }

    if (mainStreamIsValid) {
      lastMainFrameIteration = mainHistory[0][ITER_INDEX];
      lastMainFrameTime = mainHistory[0][TIME_INDEX];

      // Rotate
      mainHistory[2] = mainHistory[1];
      mainHistory[1] = mainHistory[0];
      rotateHistoryForward();
    }
    // P-frame cannot re-establish stream validity
    return mainStreamIsValid;
  }

  function completeEventFrame() {
    if (lastEvent && lastEvent.event === 14) { // LOGGING_RESUME
      lastMainFrameIteration = lastEvent.data.logIteration;
      lastMainFrameTime = lastEvent.data.currentTime;
    }
    return !!lastEvent;
  }

  function completeSlowFrame() {
    return true;
  }

  // ── Frame type registry ───────────────────────────────────────────────────
  const frameTypes = {
    'I': { parse: parseIntraframe,  complete: completeIntraframe },
    'P': { parse: parseInterframe,  complete: completeInterframe },
    'S': { parse: parseSlowFrame,   complete: completeSlowFrame },
    'E': { parse: parseEventFrame,  complete: completeEventFrame },
  };

  function getFrameType(ch) {
    return frameTypes[ch] || null;
  }

  // ── Normalized column names ───────────────────────────────────────────────
  const normalizedNames = iFieldNames.map(normalizeName);

  // ── Main parse loop (matching reference parseLogData) ─────────────────────
  const data = [];
  const stream = new DataStream(bytes, dataStart, bytes.length);
  let frameCount = 0;
  let errorCount = 0;
  let corruptCount = 0;

  let lastFrameType = null;
  let frameStart = 0;
  let prematureEof = false;

  function emitFrame(frameValues) {
    const row = {};
    for (let fi = 0; fi < iFieldCount; fi++) {
      const name = normalizedNames[fi];
      row[name] = frameValues[fi];
    }
    if (row.time !== undefined) row.time_seconds = row.time / 1e6;
    data.push(row);
    frameCount++;
  }

  while (true) {
    const command = stream.readChar();

    if (lastFrameType) {
      const lastFrameSize = stream.pos - frameStart;
      const looksLikeNewFrame = getFrameType(command) || (!prematureEof && command === EOF);

      if (lastFrameSize <= FLIGHT_LOG_MAX_FRAME_LENGTH && looksLikeNewFrame) {
        // Previous frame looks valid — complete it
        const accepted = lastFrameType.complete();
        if (accepted) {
          // Emit the frame data (use the values from BEFORE rotation, which is now in history[1] for I/P)
          if (lastFrameType === frameTypes['I'] || lastFrameType === frameTypes['P']) {
            if (mainStreamIsValid || lastFrameType === frameTypes['I']) {
              emitFrame(mainHistory[1]); // After rotation, the just-parsed frame is in history[1]
            }
          }
        } else {
          corruptCount++;
        }
      } else {
        // Previous frame was corrupt — resync
        mainStreamIsValid = false;
        corruptCount++;
        stream.pos = frameStart + 1;
        lastFrameType = null;
        prematureEof = false;
        stream.eof = false;
        continue;
      }
    }

    if (command === EOF) break;

    frameStart = stream.pos - 1;
    const ft = getFrameType(command);

    if (ft) {
      lastFrameType = ft;
      try {
        ft.parse(stream);
      } catch (e) {
        // Parse error — will be caught by frame boundary check on next iteration
        errorCount++;
      }
      if (stream.eof) prematureEof = true;
    } else {
      // Unknown frame type byte — invalidate and skip
      mainStreamIsValid = false;
      lastFrameType = null;
      errorCount++;
    }

    // Safety: limit max frames
    if (frameCount > 500000) break;
  }

  if (data.length === 0) {
    throw new Error('No data frames decoded from BBL file. File may be corrupted.');
  }

  // ── Estimate sample rate ──────────────────────────────────────────────────
  let sampleRate = 2000;
  if (data.length > 100) {
    const times = data.slice(0, 1000).map(r => r.time).filter(t => t !== undefined && t > 0);
    if (times.length > 10) {
      const deltas = [];
      for (let i = 1; i < times.length; i++) {
        const d = times[i] - times[i - 1];
        if (d > 0) deltas.push(d);
      }
      deltas.sort((a, b) => a - b);
      const medianDelta = deltas[Math.floor(deltas.length / 2)];
      if (medianDelta > 0) sampleRate = Math.round(1e6 / medianDelta);
    }
  }
  // Fallback from headers
  if (headers.looptime) {
    const lt = parseInt(headers.looptime, 10);
    const denom = parseInt(headers.pid_process_denom || '1', 10);
    if (lt > 0 && sampleRate <= 2000) sampleRate = Math.round(1e6 / (lt * denom));
  }

  const available = new Set();
  if (data.length > 0) Object.keys(data[0]).forEach(k => available.add(k));

  // ── Typed metadata ────────────────────────────────────────────────────────
  const INT_META_KEYS = [
    'motor_poles', 'looptime', 'pid_process_denom', 'gyro_sync_denom',
    'dyn_notch_count', 'dyn_notch_q', 'dyn_notch_min_hz', 'dyn_notch_max_hz',
    'rpm_filter_harmonics', 'rpm_filter_q', 'rpm_filter_min_hz', 'rpm_filter_lpf_hz',
    'gyro_lpf1_static_hz', 'gyro_lpf1_dyn_min_hz', 'gyro_lpf1_dyn_max_hz',
    'gyro_lpf2_static_hz', 'dterm_lpf1_static_hz', 'dterm_lpf1_dyn_min_hz',
    'dterm_lpf1_dyn_max_hz', 'dterm_lpf2_static_hz', 'minthrottle', 'maxthrottle',
    'dshot_idle_value', 'min_throttle', 'max_throttle', 'airmode_activate_throttle',
  ];
  const parsedMeta = {};
  for (const key of INT_META_KEYS) {
    if (headers[key] !== undefined) {
      const v = parseInt(headers[key], 10);
      if (!isNaN(v)) parsedMeta[key] = v;
    }
  }
  if (headers.dshot_bidir !== undefined)
    parsedMeta.dshot_bidir = headers.dshot_bidir === '1' || headers.dshot_bidir === 'true' || headers.dshot_bidir === 'ON';
  if (headers['Firmware revision']) parsedMeta.firmwareRevision = headers['Firmware revision'];
  if (headers['Firmware type'])     parsedMeta.firmwareType     = headers['Firmware type'];
  if (headers['Craft name'])        parsedMeta.craftName        = headers['Craft name'];

  return {
    data,
    headers: normalizedNames,
    columns: normalizedNames,
    metadata: headers,
    parsedMeta,
    sampleRate,
    available,
    rowCount: data.length,
    frameCount,
    errorCount: errorCount + corruptCount,
    source: 'bbl'
  };
}

// ── File type check ─────────────────────────────────────────────────────────
export function isBBLFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const header = String.fromCharCode(...bytes.slice(0, 30));
  return header.startsWith('H Product:Blackbox');
}

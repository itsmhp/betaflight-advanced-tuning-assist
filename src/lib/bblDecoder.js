// ─── BBL Binary Decoder ───
// Decodes Betaflight .bbl binary blackbox logs into structured data
// Implements variable-byte encoding, prediction, and frame parsing

export function decodeBBL(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  
  // Phase 1: Extract text headers
  const headers = {};
  const fieldDefs = { I: {}, P: {}, S: {} };
  let dataStart = 0;
  let headerText = '';
  
  // Scan headers line-by-line; stop at the first non-header byte
  // so we don't skip past data to headers in later log sessions.
  {
    let i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0x48) { // 'H' — potential header line
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

            const fieldMatch = key.match(/^Field ([IPS]) (.+)/);
            if (fieldMatch) {
              const frameType = fieldMatch[1];
              const prop = fieldMatch[2];
              fieldDefs[frameType][prop] = val.split(',').map(s => s.trim());
            }
          }
          dataStart = j + 1;
          i = j + 1;
          continue;
        }
      }
      // Non-header byte found — headers section is over
      break;
    }
  }

  // Parse I-frame field names
  const iFieldNames = fieldDefs.I.name || [];
  const iFieldSigned = (fieldDefs.I.signed || []).map(Number);
  const iFieldPredictor = (fieldDefs.I.predictor || []).map(Number);
  const iFieldEncoding = (fieldDefs.I.encoding || []).map(Number);
  const pFieldPredictor = (fieldDefs.P.predictor || []).map(Number);
  const pFieldEncoding = (fieldDefs.P.encoding || []).map(Number);
  const fieldCount = iFieldNames.length;

  if (fieldCount === 0) {
    throw new Error('No field definitions found in BBL file');
  }

  // Column name mapping
  const columnMap = {
    'axisP[0]': 'roll-pterm', 'axisP[1]': 'pitch-pterm', 'axisP[2]': 'yaw-pterm',
    'axisI[0]': 'roll-iterm', 'axisI[1]': 'pitch-iterm', 'axisI[2]': 'yaw-iterm',
    'axisD[0]': 'roll-dterm', 'axisD[1]': 'pitch-dterm', 'axisD[2]': 'yaw-dterm',
    'axisF[0]': 'roll-fterm', 'axisF[1]': 'pitch-fterm', 'axisF[2]': 'yaw-fterm',
    'rcCommand[0]': 'roll-rc', 'rcCommand[1]': 'pitch-rc', 'rcCommand[2]': 'yaw-rc', 'rcCommand[3]': 'throttle',
    'gyroADC[0]': 'roll-gyro', 'gyroADC[1]': 'pitch-gyro', 'gyroADC[2]': 'yaw-gyro',
    'gyroUnfilt[0]': 'roll-gyro-unfiltered', 'gyroUnfilt[1]': 'pitch-gyro-unfiltered', 'gyroUnfilt[2]': 'yaw-gyro-unfiltered',
    'motor[0]': 'motor0', 'motor[1]': 'motor1', 'motor[2]': 'motor2', 'motor[3]': 'motor3',
    'setpoint[0]': 'roll-setpoint', 'setpoint[1]': 'pitch-setpoint', 'setpoint[2]': 'yaw-setpoint', 'setpoint[3]': 'throttle-setpoint',
    'accSmooth[0]': 'accX', 'accSmooth[1]': 'accY', 'accSmooth[2]': 'accZ',
    'eRPM[0]': 'erpm0', 'eRPM[1]': 'erpm1', 'eRPM[2]': 'erpm2', 'eRPM[3]': 'erpm3',
    'debug[0]': 'debug0', 'debug[1]': 'debug1', 'debug[2]': 'debug2', 'debug[3]': 'debug3',
  };

  const normalizedNames = iFieldNames.map(n => columnMap[n] || n);

  // Binary reader
  let pos = dataStart;

  function readByte() {
    if (pos >= bytes.length) return -1;
    return bytes[pos++];
  }

  function readUnsignedVB() {
    let val = 0;
    let shift = 0;
    let b;
    do {
      b = readByte();
      if (b < 0) return 0;
      val |= (b & 0x7F) << shift;
      shift += 7;
    } while (b & 0x80);
    return val;
  }

  function readSignedVB() {
    const unsigned = readUnsignedVB();
    return (unsigned >>> 1) ^ -(unsigned & 1); // ZigZag decode
  }

  function readTag2_3S32() {
    const vals = [0, 0, 0];
    const header = readByte();
    if (header < 0) return vals;

    const nibbleI = [
      (header >> 6) & 3,
      (header >> 4) & 3,
      (header >> 2) & 3,
    ];

    for (let i = 0; i < 3; i++) {
      switch (nibbleI[i]) {
        case 0: vals[i] = 0; break;
        case 1: vals[i] = readSignedVB(); break;
        case 2: {
          const b0 = readByte(); const b1 = readByte();
          let v = b0 | (b1 << 8);
          if (v & 0x8000) v -= 0x10000;
          vals[i] = v;
          break;
        }
        case 3: {
          const b0 = readByte(); const b1 = readByte();
          const b2 = readByte(); const b3 = readByte();
          vals[i] = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
          break;
        }
      }
    }
    return vals;
  }

  function readTag8_4S16() {
    const vals = [0, 0, 0, 0];
    const header = readByte();
    if (header < 0) return vals;

    for (let i = 0; i < 4; i++) {
      const tag = (header >> (2 * (3 - i))) & 3;
      switch (tag) {
        case 0: vals[i] = 0; break;
        case 1: {
          const b = readByte();
          vals[i] = b > 127 ? b - 256 : b;
          break;
        }
        case 2: {
          const b0 = readByte(); const b1 = readByte();
          let v = b0 | (b1 << 8);
          if (v & 0x8000) v -= 0x10000;
          vals[i] = v;
          break;
        }
        case 3: vals[i] = readSignedVB(); break;
      }
    }
    return vals;
  }

  function readTag8_8SVB() {
    const header = readByte();
    if (header < 0) return [];
    const vals = [];
    for (let i = 0; i < 8; i++) {
      if (header & (1 << (7 - i))) {
        vals.push(readSignedVB());
      } else {
        vals.push(0);
      }
    }
    return vals;
  }

  // Decode values using specified encoding
  function decodeFieldGroup(encoding, count, startIdx) {
    const values = [];
    let remaining = count;
    let idx = 0;

    while (remaining > 0) {
      const enc = encoding[startIdx + idx] ?? 0;
      switch (enc) {
        case 0: // Signed VB
          values.push(readSignedVB());
          remaining--;
          idx++;
          break;
        case 1: // Unsigned VB
          values.push(readUnsignedVB());
          remaining--;
          idx++;
          break;
        case 2: // NEG_14BIT — negated signed VB
          values.push(-readSignedVB());
          remaining--;
          idx++;
          break;
        case 3: // TAG2_3SVARIABLE (groups of 3)
        case 6: { // TAG2_3S32
          const group = readTag2_3S32();
          for (let g = 0; g < 3 && remaining > 0; g++) {
            values.push(group[g]);
            remaining--;
            idx++;
          }
          break;
        }
        case 7: { // TAG8_4S16
          const group = readTag8_4S16();
          for (let g = 0; g < 4 && remaining > 0; g++) {
            values.push(group[g]);
            remaining--;
            idx++;
          }
          break;
        }
        case 8: // NULL
          values.push(0);
          remaining--;
          idx++;
          break;
        case 9: { // TAG2_3S32 (variable)
          const group = readTag2_3S32();
          for (let g = 0; g < 3 && remaining > 0; g++) {
            values.push(group[g]);
            remaining--;
            idx++;
          }
          break;
        }
        case 4: { // TAG8_8SVB
          const group = readTag8_8SVB();
          for (let g = 0; g < group.length && remaining > 0; g++) {
            values.push(group[g]);
            remaining--;
            idx++;
          }
          break;
        }
        case 5: { // TAG2_3S32 (motor variant)
          const group = readTag2_3S32();
          for (let g = 0; g < 3 && remaining > 0; g++) {
            values.push(group[g]);
            remaining--;
            idx++;
          }
          break;
        }
        default:
          values.push(readSignedVB());
          remaining--;
          idx++;
          break;
      }
    }
    return values;
  }

  // Apply prediction
  function applyPredictor(predictor, value, prevFrame, fieldIdx, prevPrevFrame) {
    switch (predictor) {
      case 0: return value; // Zero
      case 1: return (prevFrame?.[fieldIdx] ?? 0) + value; // Previous
      case 2: { // Straight line
        const p1 = prevFrame?.[fieldIdx] ?? 0;
        const p2 = prevPrevFrame?.[fieldIdx] ?? 0;
        return value + 2 * p1 - p2;
      }
      case 3: return (prevFrame?.[fieldIdx] ?? 0) + value; // Average 2
      case 5: return (prevFrame?.[fieldIdx] ?? 0) + value; // Motor
      case 6: return value; // Increment
      case 9: return value; // Last main frame value
      case 11: return (prevFrame?.[fieldIdx] ?? 0) + value; // Minthrottle
      default: return value;
    }
  }

  // Parse frames
  const data = [];
  let prevIFrame = null;
  let prevPrevIFrame = null;
  let prevPFrame = null;
  let prevPrevPFrame = null;
  const maxFrames = 500000; // Safety limit
  let frameCount = 0;
  let errorCount = 0;
  const maxErrors = 500000; // High limit for multi-session BBL files

  while (pos < bytes.length && frameCount < maxFrames) {
    const frameType = readByte();
    if (frameType < 0) break;

    try {
      if (frameType === 0x49) { // 'I' frame
        const rawValues = decodeFieldGroup(iFieldEncoding, fieldCount, 0);
        
        // Apply I-frame predictors
        const values = new Array(fieldCount);
        for (let i = 0; i < fieldCount; i++) {
          values[i] = applyPredictor(iFieldPredictor[i], rawValues[i], prevIFrame, i, prevPrevIFrame);
        }

        prevPrevIFrame = prevIFrame;
        prevIFrame = values;
        prevPFrame = values;
        prevPrevPFrame = null;

        const row = {};
        for (let i = 0; i < fieldCount; i++) {
          row[normalizedNames[i]] = values[i];
        }
        if (row.time !== undefined) row.time_seconds = row.time / 1e6;
        data.push(row);
        frameCount++;
        readByte(); // consume XOR checksum byte

      } else if (frameType === 0x50) { // 'P' frame
        if (!prevPFrame) { errorCount++; continue; }
        
        const rawValues = decodeFieldGroup(pFieldEncoding, fieldCount, 0);
        
        const values = new Array(fieldCount);
        for (let i = 0; i < fieldCount; i++) {
          values[i] = applyPredictor(pFieldPredictor[i], rawValues[i], prevPFrame, i, prevPrevPFrame);
        }

        prevPrevPFrame = prevPFrame;
        prevPFrame = values;

        const row = {};
        for (let i = 0; i < fieldCount; i++) {
          row[normalizedNames[i]] = values[i];
        }
        if (row.time !== undefined) row.time_seconds = row.time / 1e6;
        data.push(row);
        frameCount++;
        readByte(); // consume XOR checksum byte

      } else if (frameType === 0x45) { // 'E' event frame
        const eventType = readByte();
        if (eventType === 0xFF) {
          // Log session end — consume checksum then skip to next session
          readByte(); // checksum
          while (pos < bytes.length) {
            const b = bytes[pos];
            if (b === 0x48) { // 'H' — new header section, skip header lines
              while (pos < bytes.length && bytes[pos] === 0x48) {
                while (pos < bytes.length && bytes[pos] !== 0x0A) pos++;
                pos++;
              }
              break;
            }
            if (b === 0x49 || b === 0x50 || b === 0x45 || b === 0x53) break;
            pos++;
          }
          continue;
        }
        // Skip event payload based on type
        switch (eventType) {
          case 0: // SYNC_BEEP
            readUnsignedVB();
            break;
          case 10: // LOG_RESUME
            readUnsignedVB();
            readUnsignedVB();
            break;
          case 13: // FLIGHT_MODE
          case 14: // DISARM
            readUnsignedVB();
            readUnsignedVB();
            break;
          case 15: // INFLIGHT_ADJUSTMENT
            readUnsignedVB();
            readSignedVB();
            break;
          case 30: // CUSTOM_BLANK — no payload
            break;
          default:
            // Unknown event — read one VB as best guess
            readUnsignedVB();
            break;
        }
        readByte(); // consume XOR checksum byte
      } else if (frameType === 0x53) { // 'S' slow frame
        const sFieldCount = fieldDefs.S.name?.length ?? 0;
        const sFieldEncoding = (fieldDefs.S.encoding || []).map(Number);
        if (sFieldCount > 0) {
          decodeFieldGroup(sFieldEncoding, sFieldCount, 0);
        }
        readByte(); // consume XOR checksum byte
      } else {
        // Unknown byte — scan forward to next valid frame marker (resync)
        errorCount++;
        if (errorCount > maxErrors) break;
        while (pos < bytes.length) {
          const next = bytes[pos];
          if (next === 0x49 || next === 0x50 || next === 0x45 || next === 0x53 || next === 0x48) break;
          pos++;
        }
      }
    } catch (e) {
      errorCount++;
      if (errorCount > maxErrors) break;
      // Resync after parse error
      while (pos < bytes.length) {
        const next = bytes[pos];
        if (next === 0x49 || next === 0x50 || next === 0x45 || next === 0x53 || next === 0x48) break;
        pos++;
      }
    }
  }

  if (data.length === 0) {
    throw new Error('No data frames decoded from BBL file. File may be corrupted.');
  }

  // Estimate sample rate
  let sampleRate = 2000;
  if (data.length > 100) {
    const times = data.slice(0, 1000).map(r => r.time).filter(t => t !== undefined && t > 0);
    if (times.length > 10) {
      const deltas = [];
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
      const sorted = deltas.filter(d => d > 0).sort((a, b) => a - b);
      const medianDelta = sorted[Math.floor(sorted.length / 2)];
      if (medianDelta > 0) sampleRate = Math.round(1e6 / medianDelta);
    }
  }
  
  // Fallback from headers
  if (headers.looptime) {
    const lt = parseInt(headers.looptime);
    const denom = parseInt(headers.pid_process_denom || '1');
    if (lt > 0) sampleRate = Math.round(1e6 / (lt * denom));
  }

  const available = new Set();
  if (data.length > 0) Object.keys(data[0]).forEach(k => available.add(k));

  // ── Typed metadata (reference: blackbox-log-viewer parseHeaderLine) ──────
  // BBL headers are raw strings; parse key numeric/bool fields once here so
  // analyzers can safely use parsedMeta.motor_poles, .looptime, etc.
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
  // Boolean fields stored as 0/1 in headers
  if (headers.dshot_bidir !== undefined) parsedMeta.dshot_bidir = headers.dshot_bidir === '1' || headers.dshot_bidir === 'true' || headers.dshot_bidir === 'ON';
  // Firmware version string
  if (headers['Firmware revision']) parsedMeta.firmwareRevision = headers['Firmware revision'];
  if (headers['Firmware type'])     parsedMeta.firmwareType     = headers['Firmware type'];
  if (headers['Craft name'])        parsedMeta.craftName        = headers['Craft name'];

  return {
    data,
    headers: normalizedNames,
    columns: normalizedNames,
    metadata: headers,
    parsedMeta,          // typed numeric/bool values from BBL header fields
    sampleRate,
    available,
    rowCount: data.length,
    frameCount,
    errorCount,
    source: 'bbl'
  };
}

// Check if an ArrayBuffer looks like a BBL file
export function isBBLFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  // Check for "H Product:Blackbox" header
  const header = String.fromCharCode(...bytes.slice(0, 30));
  return header.startsWith('H Product:Blackbox');
}

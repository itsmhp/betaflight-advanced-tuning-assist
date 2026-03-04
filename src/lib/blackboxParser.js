// ─── Blackbox CSV Log Parser ───
// Parses Betaflight Blackbox logs (decoded CSV from blackbox_decode)
// Supports both raw BBL headers and decoded CSV

export function parseBlackboxCSV(text) {
  const lines = text.split('\n');
  const metadata = {};
  let headerLine = -1;
  let headers = [];

  // Find header row and extract metadata
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    const line = lines[i].trim();
    
    // Metadata lines
    if (line.startsWith('H ')) {
      const match = line.match(/^H\s+(.+?):(.*)/);
      if (match) metadata[match[1].trim()] = match[2].trim();
      continue;
    }

    // CSV header detection
    if (line.includes('time') && (line.includes('gyro') || line.includes('rcCommand') || line.includes('motor'))) {
      headerLine = i;
      headers = line.split(',').map(h => h.trim());
      break;
    }

    // Alternative: loopIteration as first column
    if (line.startsWith('loopIteration') || line.includes('loopIteration')) {
      headerLine = i;
      headers = line.split(',').map(h => h.trim());
      break;
    }
  }

  if (headerLine === -1) {
    throw new Error('Could not find CSV header in blackbox data. Make sure you decode .bbl to .csv first using blackbox_decode.');
  }

  // Map alternative column names to standard names
  const columnMap = {
    'gyroADC[0]': 'roll-gyro', 'gyroADC[1]': 'pitch-gyro', 'gyroADC[2]': 'yaw-gyro',
    'rcCommand[0]': 'roll-rc', 'rcCommand[1]': 'pitch-rc', 'rcCommand[2]': 'yaw-rc', 'rcCommand[3]': 'throttle',
    'motor[0]': 'motor0', 'motor[1]': 'motor1', 'motor[2]': 'motor2', 'motor[3]': 'motor3',
    'axisP[0]': 'roll-pterm', 'axisP[1]': 'pitch-pterm', 'axisP[2]': 'yaw-pterm',
    'axisI[0]': 'roll-iterm', 'axisI[1]': 'pitch-iterm', 'axisI[2]': 'yaw-iterm',
    'axisD[0]': 'roll-dterm', 'axisD[1]': 'pitch-dterm', 'axisD[2]': 'yaw-dterm',
    'axisF[0]': 'roll-fterm', 'axisF[1]': 'pitch-fterm', 'axisF[2]': 'yaw-fterm',
    'setpoint[0]': 'roll-setpoint', 'setpoint[1]': 'pitch-setpoint', 'setpoint[2]': 'yaw-setpoint', 'setpoint[3]': 'throttle-setpoint',
    'accSmooth[0]': 'accX', 'accSmooth[1]': 'accY', 'accSmooth[2]': 'accZ',
    'time (us)': 'time',
  };

  const normalizedHeaders = headers.map(h => columnMap[h] || h);

  // Parse data rows
  const data = [];
  let sampleRate = 0;
  const timeIdx = normalizedHeaders.indexOf('time');

  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('H ') || line.startsWith('#')) continue;

    const values = line.split(',');
    if (values.length < headers.length * 0.5) continue;

    const row = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      const v = values[j]?.trim();
      if (v === undefined || v === '') continue;
      row[normalizedHeaders[j]] = isNaN(v) ? v : parseFloat(v);
    }

    // Compute time_seconds if we have time in microseconds
    if (row.time !== undefined && typeof row.time === 'number') {
      row.time_seconds = row.time / 1e6;
    }

    data.push(row);
  }

  // Estimate sample rate from time data
  if (data.length > 100 && timeIdx >= 0) {
    const times = data.slice(0, 1000).map(r => r.time).filter(t => t !== undefined);
    if (times.length > 10) {
      const deltas = [];
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
      const avgDelta = deltas.reduce((a, b) => a + b) / deltas.length;
      sampleRate = Math.round(1e6 / avgDelta);
    }
  }
  if (!sampleRate) sampleRate = 2000; // Default assumption for BF 4.x

  // Detect available columns
  const available = new Set();
  if (data.length > 0) {
    Object.keys(data[0]).forEach(k => available.add(k));
  }

  return {
    data,
    headers: normalizedHeaders,
    metadata,
    sampleRate,
    available,
    rowCount: data.length
  };
}

// Extract column as typed array for performance
export function getColumn(parsedLog, colName) {
  return parsedLog.data.map(r => r[colName] ?? 0);
}

// Check what analysis tools can be run given available columns
export function detectCapabilities(available) {
  const has = (cols) => cols.every(c => available.has(c));
  return {
    antiGravity: has(['throttle', 'roll-gyro', 'pitch-gyro', 'yaw-gyro']),
    stickAnalyzer: has(['roll-rc', 'pitch-rc', 'yaw-rc']),
    pidContribution: has(['roll-pterm', 'pitch-pterm']) || has(['roll-dterm', 'pitch-dterm']),
    filterAnalyzer: has(['roll-gyro', 'pitch-gyro', 'yaw-gyro']),
    thrustLinear: has(['throttle', 'motor0']),
    feedforward: has(['roll-setpoint', 'roll-gyro']),
    tpaAnalyzer: has(['throttle']) && (has(['roll-dterm']) || has(['roll-gyro'])),
    itermBuildup: has(['roll-iterm', 'pitch-iterm', 'yaw-iterm']),
    throttleAxis: has(['throttle']),
    propWash: has(['roll-gyro', 'pitch-gyro', 'motor0']),
    pidMaster: true // Works from CLI dump, no blackbox needed
  };
}

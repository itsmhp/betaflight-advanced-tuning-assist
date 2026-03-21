// ─── WebSerial Helper ───
// Shared utilities for Betaflight FC communication via Web Serial API

/**
 * Check if Web Serial API is available in this browser.
 */
export function isSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Request and open a serial port connection.
 * @param {number} baudRate - Baud rate (default 115200)
 * @returns {{ port: SerialPort }} The opened port
 */
export async function connectToFC(baudRate = 115200) {
  if (!isSerialSupported()) {
    throw new Error('Web Serial API not supported. Use Chrome or Edge 89+.');
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });
  return port;
}

/**
 * Enter Betaflight CLI mode by sending '#\n'.
 * Waits until the CLI prompt '# ' is detected or timeout.
 * @param {SerialPort} port
 * @param {number} timeoutMs
 * @returns {string} Any text received during mode entry
 */
export async function enterCLIMode(port, timeoutMs = 5000) {
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  await writer.write(encoder.encode('#\n'));
  writer.releaseLock();

  // Read until we see the CLI prompt
  return await readUntilPrompt(port, timeoutMs);
}

/**
 * Send a command and capture the full response until the '# ' prompt reappears.
 * @param {SerialPort} port
 * @param {string} command
 * @param {number} timeoutMs - Max wait time (default 15s for dump all)
 * @returns {string} Complete response text
 */
export async function sendAndCapture(port, command, timeoutMs = 15000) {
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  await writer.write(encoder.encode(command + '\n'));
  writer.releaseLock();

  return await readUntilPrompt(port, timeoutMs);
}

/**
 * Exit CLI mode (sends 'exit\n' to reboot FC) and close the port.
 * @param {SerialPort} port
 */
export async function disconnectFC(port) {
  try {
    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();
    await writer.write(encoder.encode('exit\n'));
    writer.releaseLock();
  } catch { /* port may already be closing */ }

  // Give FC a moment to process exit before closing
  await new Promise(r => setTimeout(r, 200));

  try {
    await port.close();
  } catch { /* ignore close errors */ }
}

/**
 * Read from port until the Betaflight CLI prompt '# ' is detected.
 * @param {SerialPort} port
 * @param {number} timeoutMs
 * @returns {string} Accumulated text (excluding the final prompt line)
 */
async function readUntilPrompt(port, timeoutMs) {
  const decoder = new TextDecoder();
  const reader = port.readable.getReader();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      // Use a race between reader.read() and a timeout
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), remaining)
        ),
      ]);

      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      // Betaflight CLI prompt: line ending with '# ' or buffer ending with '\n# '
      if (isPromptDetected(buffer)) break;
    }
  } catch (err) {
    if (err.message !== 'timeout') throw err;
  } finally {
    reader.releaseLock();
  }

  return cleanResponse(buffer);
}

/**
 * Detect Betaflight CLI prompt in buffer.
 * The prompt is typically '# ' at the end of output after a newline.
 */
function isPromptDetected(buffer) {
  const trimmed = buffer.trimEnd();
  // After command output, BF sends '\r\n# ' or just ends with '# '
  if (trimmed.endsWith('\n#') || trimmed.endsWith('\r#')) return true;
  // Sometimes the prompt is '# ' with trailing space
  if (buffer.endsWith('# ')) {
    // Make sure it's on its own line (not part of a comment)
    const lastNewline = buffer.lastIndexOf('\n', buffer.length - 3);
    const lastLine = buffer.substring(lastNewline + 1).trim();
    if (lastLine === '#') return true;
  }
  return false;
}

/**
 * Clean up captured response: remove echo of command, trailing prompt, CR chars.
 */
function cleanResponse(buffer) {
  return buffer
    .replace(/\r/g, '')          // Remove carriage returns
    .replace(/# ?\s*$/, '')      // Remove trailing prompt
    .trim();
}

/**
 * SerialCLIPage.jsx — WebSerial Betaflight CLI terminal.
 * Compatible with Chrome 89+ and Edge 89+ only (Web Serial API).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Plug, PlugZap, Send, Trash2, Copy, AlertCircle, CheckCircle2, Info } from 'lucide-react';

const BAUD_RATES = [115200, 57600, 38400, 19200];

// ─────────────────────────────────────────────────────────────────────────────
// WebSerial helpers
// ─────────────────────────────────────────────────────────────────────────────
const isSupported = () => 'serial' in navigator;

// ─────────────────────────────────────────────────────────────────────────────
// Log entry component
// ─────────────────────────────────────────────────────────────────────────────
function LogLine({ entry }) {
  const cls = {
    sent:    'text-violet-300',
    recv:    'text-green-300',
    system:  'text-gray-400',
    error:   'text-red-400',
    success: 'text-emerald-300',
  }[entry.type] ?? 'text-gray-200';

  const prefix = {
    sent:    '> ',
    recv:    '',
    system:  '# ',
    error:   '✕ ',
    success: '✓ ',
  }[entry.type] ?? '';

  return (
    <div className={`font-mono text-xs leading-5 whitespace-pre-wrap break-all ${cls}`}>
      <span className="select-none text-gray-600 mr-1 text-[10px]">{entry.time}</span>
      {prefix}{entry.text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SerialCLIPage() {
  const [connected,   setConnected]   = useState(false);
  const [connecting,  setConnecting]  = useState(false);
  const [log,         setLog]         = useState([]);
  const [inputText,   setInputText]   = useState('');
  const [baudRate,    setBaudRate]    = useState(115200);
  const [pasteText,   setPasteText]   = useState('');
  const [showPaste,   setShowPaste]   = useState(false);

  const portRef      = useRef(null);
  const readerRef    = useRef(null);
  const writerRef    = useRef(null);
  const logEndRef    = useRef(null);
  const keepReadRef  = useRef(false);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  function addLog(text, type = 'recv') {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLog(prev => [...prev.slice(-800), { text, type, time, id: Date.now() + Math.random() }]);
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  async function handleConnect() {
    if (!isSupported()) {
      addLog('Web Serial API is not supported in this browser. Use Chrome or Edge 89+.', 'error');
      return;
    }
    try {
      setConnecting(true);
      addLog('Requesting serial port…', 'system');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setConnected(true);
      addLog(`Connected at ${baudRate} baud.`, 'success');

      // Start reading
      keepReadRef.current = true;
      readLoop(port);
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, 'error');
    } finally {
      setConnecting(false);
    }
  }

  // ── Read loop ────────────────────────────────────────────────────────────
  async function readLoop(port) {
    const decoder = new TextDecoder();
    try {
      while (port.readable && keepReadRef.current) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            addLog(text, 'recv');
          }
        } catch (err) {
          if (keepReadRef.current) addLog(`Read error: ${err.message}`, 'error');
        } finally {
          reader.releaseLock();
        }
      }
    } catch (err) {
      if (keepReadRef.current) addLog(`Reader init error: ${err.message}`, 'error');
    }
  }

  // ── Disconnect ───────────────────────────────────────────────────────────
  async function handleDisconnect() {
    keepReadRef.current = false;
    try { readerRef.current?.cancel(); } catch { /* ignore */ }
    try { writerRef.current?.close(); } catch { /* ignore */ }
    try { await portRef.current?.close(); } catch { /* ignore */ }
    portRef.current   = null;
    readerRef.current = null;
    writerRef.current = null;
    setConnected(false);
    addLog('Disconnected.', 'system');
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (cmd) => {
    if (!portRef.current?.writable) {
      addLog('Not connected.', 'error');
      return;
    }
    const encoder = new TextEncoder();
    const writer  = portRef.current.writable.getWriter();
    writerRef.current = writer;
    try {
      await writer.write(encoder.encode(cmd + '\n'));
      addLog(cmd, 'sent');
    } catch (err) {
      addLog(`Send error: ${err.message}`, 'error');
    } finally {
      writer.releaseLock();
      writerRef.current = null;
    }
  }, []);

  function handleSend() {
    const cmd = inputText.trim();
    if (!cmd) return;
    sendCommand(cmd);
    setInputText('');
  }

  // ── Paste CLI block ────────────────────────────────────────────────────────
  async function handlePasteBlock() {
    if (!connected) { addLog('Connect first before pasting.', 'error'); return; }
    const lines = pasteText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    addLog(`Sending ${lines.length} commands…`, 'system');
    for (const line of lines) {
      await sendCommand(line);
      await new Promise(r => setTimeout(r, 50));
    }
    addLog('All commands sent.', 'success');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const browserUnsupported = !isSupported();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Terminal size={22} className="text-green-400 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-white">CLI Terminal</h1>
          <p className="text-sm text-gray-400">Direct Betaflight CLI via WebSerial · Chrome / Edge only</p>
        </div>
      </div>

      {/* ── Browser warning ── */}
      {browserUnsupported && (
        <div className="flex items-start gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-sm text-red-200">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
          <div>
            <p className="font-semibold text-red-300 mb-1">Web Serial API not supported</p>
            <p>This feature requires Chrome 89+ or Edge 89+. Firefox and Safari do not support Web Serial.</p>
          </div>
        </div>
      )}

      {/* ── Info notice ── */}
      <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-200">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
        <div>
          <p className="font-medium text-blue-300 mb-1">How to use</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs text-blue-200/80">
            <li>Close Betaflight Configurator (it locks the port)</li>
            <li>Plug in your FC via USB</li>
            <li>Click <strong className="text-blue-200">Connect</strong> and select the FC COM port (e.g. STM32 Virtual COM)</li>
            <li>Type CLI commands, or paste a full preset CLI block below</li>
          </ol>
        </div>
      </div>

      {/* ── Connection bar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        {/* Status dot */}
        <div className="flex items-center gap-2 text-sm mr-auto">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className={connected ? 'text-emerald-300' : 'text-gray-400'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {/* Baud rate */}
        {!connected && (
          <select
            value={baudRate}
            onChange={e => setBaudRate(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1.5"
          >
            {BAUD_RATES.map(b => <option key={b} value={b}>{b} baud</option>)}
          </select>
        )}
        {/* Connect / Disconnect */}
        {connected ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs bg-red-800 hover:bg-red-700 text-red-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <Plug size={13} /> Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || browserUnsupported}
            className="flex items-center gap-1.5 text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <PlugZap size={13} />
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>

      {/* ── Terminal output ── */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
          <span className="text-xs text-gray-500 font-mono">betaflight&#35;</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const text = log.map(l => `${l.time} ${l.type === 'sent' ? '> ' : ''}${l.text}`).join('\n');
                navigator.clipboard.writeText(text);
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Copy log"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={() => setLog([])}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Clear log"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="p-3 h-72 overflow-y-auto space-y-0.5">
          {log.length === 0 ? (
            <p className="text-gray-600 text-xs font-mono">Waiting for connection…</p>
          ) : (
            log.map(entry => <LogLine key={entry.id} entry={entry} />)
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Send command ── */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          placeholder={connected ? 'Type a command and press Enter…' : 'Connect first…'}
          className="flex-1 bg-gray-800 border border-gray-700 disabled:opacity-40 text-gray-100 text-sm rounded-xl px-4 py-2.5 font-mono focus:outline-none focus:border-violet-500 placeholder-gray-600"
        />
        <button
          onClick={handleSend}
          disabled={!connected || !inputText.trim()}
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <Send size={14} />
        </button>
      </div>

      {/* ── Paste CLI block ── */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPaste(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-700/30 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium">
            <Terminal size={15} className="text-green-400" />
            Paste CLI Commands
          </span>
          <span className="text-gray-500 text-xs">{showPaste ? 'hide' : 'expand'}</span>
        </button>
        {showPaste && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
            <p className="text-xs text-gray-400 mt-3">
              Paste a full CLI block (from Presets page or manual edit). Lines starting with <code className="bg-gray-700 px-1 rounded">#</code> are skipped.
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="# Paste your Betaflight CLI commands here&#10;set p_roll = 45&#10;set i_roll = 80&#10;save"
              rows={8}
              className="w-full bg-gray-950 border border-gray-700 text-green-300 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-600 placeholder-gray-600 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handlePasteBlock}
                disabled={!connected || !pasteText.trim()}
                className="flex items-center gap-1.5 text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                <CheckCircle2 size={12} />
                Send {pasteText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length} Commands
              </button>
              <button
                onClick={() => setPasteText('')}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick commands ── */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400 mb-2.5 font-medium">Quick Commands</p>
        <div className="flex flex-wrap gap-2">
          {['version', 'status', 'dump all', 'get p_roll', 'get d_roll', 'save', 'defaults'].map(cmd => (
            <button
              key={cmd}
              onClick={() => sendCommand(cmd)}
              disabled={!connected}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 px-2.5 py-1 rounded-md font-mono transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * SerialCLIPage.jsx — WebSerial Betaflight CLI terminal.
 * Compatible with Chrome 89+ and Edge 89+ only (Web Serial API).
 *
 * Fixes: auto-enters CLI mode, line-buffered output, command history,
 * "Import to Analysis" integration with DataContext.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Plug, PlugZap, Send, Trash2, Copy, AlertCircle, CheckCircle2, Info, Download, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';

const BAUD_RATES = [115200, 57600, 38400, 19200];

const isSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

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
  const { loadCLI, cliParsed } = useData();
  const { t } = useLang();
  const navigate = useNavigate();

  const [connected,   setConnected]   = useState(false);
  const [connecting,  setConnecting]  = useState(false);
  const [log,         setLog]         = useState([]);
  const [inputText,   setInputText]   = useState('');
  const [baudRate,    setBaudRate]    = useState(115200);
  const [pasteText,   setPasteText]   = useState('');
  const [showPaste,   setShowPaste]   = useState(false);
  const [capturing,   setCapturing]   = useState(false);

  const portRef         = useRef(null);
  const readerRef       = useRef(null);
  const writerRef       = useRef(null);
  const logEndRef       = useRef(null);
  const keepReadRef     = useRef(false);
  const lineBufferRef   = useRef('');
  const historyRef      = useRef([]);
  const historyIdxRef   = useRef(-1);
  const captureBufRef   = useRef('');

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
      lineBufferRef.current = '';
      readLoop(port);

      // Auto-enter CLI mode after a short delay
      setTimeout(async () => {
        try {
          addLog('Entering CLI mode…', 'system');
          const encoder = new TextEncoder();
          const writer = port.writable.getWriter();
          await writer.write(encoder.encode('#\n'));
          writer.releaseLock();
        } catch { /* ignore if port closed */ }
      }, 300);
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, 'error');
    } finally {
      setConnecting(false);
    }
  }

  // ── Read loop (line-buffered) ──────────────────────────────────────────
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
            const chunk = decoder.decode(value, { stream: true });

            // Accumulate into line buffer
            lineBufferRef.current += chunk;

            // Also accumulate in capture buffer if capturing
            if (capturing || captureBufRef.current !== '') {
              captureBufRef.current += chunk;
            }

            // Split into complete lines
            const parts = lineBufferRef.current.split('\n');
            // Keep the last (possibly incomplete) part in the buffer
            lineBufferRef.current = parts.pop() || '';

            for (const part of parts) {
              const line = part.replace(/\r$/, '');
              if (line) addLog(line, 'recv');
            }
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
    lineBufferRef.current = '';
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
    // Add to history
    historyRef.current.push(cmd);
    historyIdxRef.current = -1;
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

  // ── Import to Analysis ──────────────────────────────────────────────────
  async function handleImportToAnalysis() {
    if (!connected) { addLog('Connect first.', 'error'); return; }
    setCapturing(true);
    captureBufRef.current = '';
    addLog('Reading FC config (dump all)…', 'system');

    await sendCommand('dump all');

    // Wait for the response to complete (detect CLI prompt or timeout)
    const deadline = Date.now() + 15000;
    await new Promise((resolve) => {
      const check = setInterval(() => {
        const buf = captureBufRef.current;
        const trimmed = buf.trimEnd();
        const promptDetected =
          trimmed.endsWith('\n#') || trimmed.endsWith('\r#') ||
          (buf.endsWith('# ') && buf.substring(buf.lastIndexOf('\n') + 1).trim() === '#');

        if (promptDetected || Date.now() > deadline) {
          clearInterval(check);
          resolve();
        }
      }, 200);
    });

    const captured = captureBufRef.current.replace(/\r/g, '');
    captureBufRef.current = '';
    setCapturing(false);

    if (captured.length < 50) {
      addLog('No data received. Make sure the FC is in CLI mode.', 'error');
      return;
    }

    const result = loadCLI(captured);
    if (result) {
      addLog(`Imported to analysis: ${result.craftName || 'Quad'} — BF ${result.version || '?'} (${Object.keys(result.master).length} settings)`, 'success');
    } else {
      addLog('Failed to parse CLI dump. Try again.', 'error');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Command history navigation
    const history = historyRef.current;
    if (history.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = historyIdxRef.current;
      const newIdx = idx < 0 ? history.length - 1 : Math.max(0, idx - 1);
      historyIdxRef.current = newIdx;
      setInputText(history[newIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = historyIdxRef.current;
      if (idx < 0) return;
      const newIdx = idx + 1;
      if (newIdx >= history.length) {
        historyIdxRef.current = -1;
        setInputText('');
      } else {
        historyIdxRef.current = newIdx;
        setInputText(history[newIdx]);
      }
    }
  }

  const browserUnsupported = !isSupported();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Terminal size={22} className="text-green-400 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-white">CLI Terminal</h1>
          <p className="text-sm text-gray-400">{t('subtitle_cli_terminal')}</p>
        </div>
      </div>

      {/* ── Browser warning ── */}
      {browserUnsupported && (
        <div className="flex items-start gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-sm text-red-200">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
          <div>
            <p className="font-semibold text-red-300 mb-1">{t('error_no_webserial')}</p>
            <p>{t('msg_no_webserial_support')}</p>
          </div>
        </div>
      )}

      {/* ── Info notice ── */}
      <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-200">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
        <div>
          <p className="font-medium text-blue-300 mb-1">{t('section_how_to_use')}</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs text-blue-200/80">
            <li>Close Betaflight Configurator (it locks the port)</li>
            <li>Plug in your FC via USB</li>
            <li>Click <strong className="text-blue-200">Connect</strong> and select the FC COM port (e.g. STM32 Virtual COM)</li>
            <li>CLI mode is entered automatically — type commands or use Quick Commands</li>
          </ol>
        </div>
      </div>

      {/* ── Connection bar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        {/* Status dot */}
        <div className="flex items-center gap-2 text-sm mr-auto">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className={connected ? 'text-emerald-300' : 'text-gray-400'}>
            {connected ? t('status_connected') : t('status_disconnected')}
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
        {/* Import to Analysis */}
        {connected && (
          <button
            onClick={handleImportToAnalysis}
            disabled={capturing}
            className="flex items-center gap-1.5 text-xs bg-violet-800 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-violet-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            {capturing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {capturing ? t('status_reading') : t('btn_import_analysis')}
          </button>
        )}
        {/* Connect / Disconnect */}
        {connected ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs bg-red-800 hover:bg-red-700 text-red-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <Plug size={13} /> {t('btn_disconnect')}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || browserUnsupported}
            className="flex items-center gap-1.5 text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <PlugZap size={13} />
            {connecting ? t('status_connecting') : t('btn_connect')}
          </button>
        )}
      </div>

      {/* ── Import success banner ── */}
      {cliParsed && (
        <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 size={16} />
            <span>CLI data loaded: <strong>{cliParsed.craftName || 'Quad'}</strong> — BF {cliParsed.version || '?'}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      )}

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
              title={t('title_copy_log')}
            >
              <Copy size={13} />
            </button>
            <button
              onClick={() => setLog([])}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title={t('title_clear_log')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="p-3 h-[28rem] overflow-y-auto space-y-0.5">
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
          placeholder={connected ? t('placeholder_command') : t('placeholder_connect_first')}
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
            {t('section_paste_cli')}
          </span>
          <span className="text-gray-500 text-xs">{showPaste ? t('toggle_hide') : t('toggle_expand')}</span>
        </button>
        {showPaste && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
            <p className="text-xs text-gray-400 mt-3">
              {t('help_paste_cli_block')}
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
          {['version', 'status', 'diff all', 'dump all', 'get p_roll', 'get d_roll', 'save', 'defaults'].map(cmd => (
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

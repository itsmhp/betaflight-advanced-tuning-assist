import { useState, useCallback, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useLang } from '../../i18n/LangContext';
import { Upload, FileText, X, Check, Terminal, Database, Usb, Loader2 } from 'lucide-react';
import { isSerialSupported, connectToFC, enterCLIMode, sendAndCapture, disconnectFC } from '../../lib/serialHelper';

export default function FileUpload({ compact = false }) {
  const { cliParsed, bbParsed, loadCLI, loadBlackbox, errors } = useData();
  const { t } = useLang();
  const [cliDrag, setCliDrag] = useState(false);
  const [bbDrag, setBbDrag] = useState(false);
  const [cliText, setCliText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [serialStatus, setSerialStatus] = useState(null); // null | 'connecting' | 'reading' | 'done' | 'error'
  const [serialError, setSerialError] = useState('');
  const cliRef = useRef(null);
  const bbRef = useRef(null);

  const handleCliFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => loadCLI(e.target.result);
    reader.readAsText(file);
  }, [loadCLI]);

  const handleBbFile = useCallback((file) => {
    const name = file.name.toLowerCase();
    const isBbl = name.endsWith('.bbl') || name.endsWith('.bfl');
    const reader = new FileReader();
    if (isBbl) {
      reader.onload = (e) => loadBlackbox(e.target.result, file.name);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => loadBlackbox(e.target.result, file.name);
      reader.readAsText(file);
    }
  }, [loadBlackbox]);

  const onDrop = (setter, handler) => (e) => {
    e.preventDefault();
    setter(false);
    const file = e.dataTransfer.files[0];
    if (file) handler(file);
  };

  const onDragOver = (setter) => (e) => {
    e.preventDefault();
    setter(true);
  };

  // ── Read from FC via WebSerial ──────────────────────────────────────────
  async function handleReadFromFC() {
    let port = null;
    try {
      setSerialStatus('connecting');
      setSerialError('');
      port = await connectToFC(115200);

      setSerialStatus('reading');
      await enterCLIMode(port, 5000);
      const dump = await sendAndCapture(port, 'dump all', 15000);

      if (dump.length < 50) {
        throw new Error('No data received from FC. Make sure the FC is powered and connected.');
      }

      const result = loadCLI(dump);
      if (!result) throw new Error('Failed to parse CLI dump.');

      setSerialStatus('done');
      // Auto-clear success status after a few seconds
      setTimeout(() => setSerialStatus(null), 4000);
    } catch (err) {
      setSerialError(err.message);
      setSerialStatus('error');
    } finally {
      if (port) {
        try { await disconnectFC(port); } catch { /* ignore */ }
      }
    }
  }

  const cliError = errors.find(e => e.source === 'cli');
  const bbError = errors.find(e => e.source === 'bb');
  const showSerial = isSerialSupported();

  return (
    <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
      {/* CLI Dump Input */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <Terminal size={14} className="text-violet-400" />
          {t('cliDump')}
        </label>
        <div
          className={`drop-zone ${cliDrag ? 'border-violet-400 bg-violet-950/20' : ''} ${cliParsed ? 'border-emerald-500/40 bg-emerald-950/10' : ''}`}
          onDrop={onDrop(setCliDrag, handleCliFile)}
          onDragOver={onDragOver(setCliDrag)}
          onDragLeave={() => setCliDrag(false)}
          onClick={() => !cliParsed && cliRef.current?.click()}
        >
          {cliParsed ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <Check size={18} />
              <div>
                <span className="text-sm font-medium">{cliParsed.craftName || 'Quad'}</span>
                <span className="text-xs text-gray-400 ml-2">BF {cliParsed.version || '?'} — {cliParsed.boardName || cliParsed.fcTarget || '?'}</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <FileText size={28} className="mx-auto mb-2 text-violet-500/50" />
              <p className="text-sm text-gray-400">{t('dragDropCli')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('clickBrowse')} • {t('cliFormats')}</p>
            </div>
          )}
          <input ref={cliRef} type="file" className="hidden" accept=".txt,.log,.cli"
            onChange={(e) => e.target.files[0] && handleCliFile(e.target.files[0])} />
        </div>

        {/* Action buttons below drop zone */}
        {!cliParsed && (
          <div className="flex items-center gap-3 mt-2">
            <button
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              onClick={() => setShowPaste(!showPaste)}
            >
              {showPaste ? t('hidePaste') : t('pasteCli')}
            </button>

            {showSerial && (
              <>
                <span className="text-gray-700 text-xs">|</span>
                <button
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
                  onClick={handleReadFromFC}
                  disabled={serialStatus === 'connecting' || serialStatus === 'reading'}
                >
                  {serialStatus === 'connecting' || serialStatus === 'reading' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Usb size={12} />
                  )}
                  {serialStatus === 'connecting' ? 'Connecting…'
                    : serialStatus === 'reading' ? 'Reading FC…'
                    : 'Read from FC'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Serial success/error */}
        {serialStatus === 'done' && (
          <p className="text-xs text-emerald-400 mt-1">FC config imported successfully.</p>
        )}
        {serialStatus === 'error' && (
          <p className="text-xs text-red-400 mt-1">{serialError}</p>
        )}

        {showPaste && !cliParsed && (
          <div className="mt-2">
            <textarea
              className="w-full h-28 bg-gray-900/80 border border-gray-700/50 rounded-lg text-xs font-mono p-2 text-gray-300 focus:border-violet-500 focus:outline-none resize-none placeholder:text-gray-600"
              placeholder={t('pasteHere')}
              value={cliText}
              onChange={e => setCliText(e.target.value)}
            />
            <button className="btn-primary text-xs mt-1" onClick={() => { loadCLI(cliText); setShowPaste(false); }}>
              {t('parseCli')}
            </button>
          </div>
        )}
        {cliError && <p className="text-xs text-red-400 mt-1">{cliError.message}</p>}
      </div>

      {/* Blackbox Log Input */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <Database size={14} className="text-violet-400" />
          {t('blackboxLog')}
        </label>
        <div
          className={`drop-zone ${bbDrag ? 'border-violet-400 bg-violet-950/20' : ''} ${bbParsed ? 'border-emerald-500/40 bg-emerald-950/10' : ''}`}
          onDrop={onDrop(setBbDrag, handleBbFile)}
          onDragOver={onDragOver(setBbDrag)}
          onDragLeave={() => setBbDrag(false)}
          onClick={() => !bbParsed && bbRef.current?.click()}
        >
          {bbParsed ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <Check size={18} />
              <div>
                <span className="text-sm font-medium">{bbParsed.data?.length ?? 0} {t('samples')}</span>
                <span className="text-xs text-gray-400 ml-2">@ {bbParsed.sampleRate || '?'} {t('hz')}</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Database size={28} className="mx-auto mb-2 text-violet-500/50" />
              <p className="text-sm text-gray-400">{t('dragDropBb')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('bbFormats')}</p>
              <p className="text-xs text-violet-500/70 mt-1">{t('builtInDecoder')}</p>
            </div>
          )}
          <input ref={bbRef} type="file" className="hidden" accept=".bbl,.bfl,.csv,.txt"
            onChange={(e) => e.target.files[0] && handleBbFile(e.target.files[0])} />
        </div>
        {bbError && <p className="text-xs text-red-400 mt-1">{bbError.message}</p>}
      </div>
    </div>
  );
}

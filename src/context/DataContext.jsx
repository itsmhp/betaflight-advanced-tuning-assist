import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { parseCLIDump, extractTuningParams } from '../lib/cliParser';
import { parseBlackboxCSV, detectCapabilities } from '../lib/blackboxParser';
import { decodeBBL, isBBLFile } from '../lib/bblDecoder';
import { applyTrim } from '../lib/flightTrimmer';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [cliRaw, setCliRaw] = useState('');
  const [cliParsed, setCliParsed] = useState(null);
  const [tuningParams, setTuningParams] = useState(null);
  const [bbRaw, setBbRaw] = useState('');
  const [bbParsed, setBbParsed] = useState(null);
  const [trimRange, setTrimRange] = useState(null); // { startIdx, endIdx } or null
  const [comparisonBlackboxRaw, setComparisonBlackboxRaw] = useState('');
  const [comparisonBlackboxData, setComparisonBlackboxData] = useState(null);
  const [comparisonLabel, setComparisonLabel] = useState('After');
  const [baselineLabel, setBaselineLabel] = useState('Before');
  const [capabilities, setCapabilities] = useState({});
  const [analysisResults, setAnalysisResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const loadCLI = useCallback((text) => {
    try {
      setCliRaw(text);
      const parsed = parseCLIDump(text);
      setCliParsed(parsed);
      const params = extractTuningParams(parsed);
      setTuningParams(params);
      setErrors(prev => prev.filter(e => e.source !== 'cli'));
      return parsed;
    } catch (err) {
      setErrors(prev => [...prev.filter(e => e.source !== 'cli'), { source: 'cli', message: err.message }]);
      return null;
    }
  }, []);

  const loadBlackbox = useCallback((textOrBuffer, fileName) => {
    try {
      setLoading(true);
      let parsed;

      // Check if it's an ArrayBuffer (binary .bbl file)
      if (textOrBuffer instanceof ArrayBuffer) {
        if (isBBLFile(textOrBuffer)) {
          parsed = decodeBBL(textOrBuffer);
        } else {
          // Try as text CSV
          const text = new TextDecoder().decode(textOrBuffer);
          parsed = parseBlackboxCSV(text);
        }
      } else if (typeof textOrBuffer === 'string') {
        // Check if it starts with BBL header
        if (textOrBuffer.startsWith('H Product:Blackbox')) {
          // Could be a text representation but let's try CSV parse first
          parsed = parseBlackboxCSV(textOrBuffer);
        } else {
          parsed = parseBlackboxCSV(textOrBuffer);
        }
      }

      if (!parsed) throw new Error('Could not parse blackbox data');
      
      setBbRaw(typeof textOrBuffer === 'string' ? textOrBuffer : `[BBL binary: ${parsed.rowCount} frames]`);
      setBbParsed(parsed);
      setTrimRange(null); // Reset trim when new file loaded
      const caps = detectCapabilities(parsed.available || new Set(parsed.headers || []));
      setCapabilities(caps);
      setErrors(prev => prev.filter(e => e.source !== 'bb'));
      return parsed;
    } catch (err) {
      setErrors(prev => [...prev.filter(e => e.source !== 'bb'), { source: 'bb', message: err.message }]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComparisonBlackbox = useCallback((textOrBuffer, fileName) => {
    try {
      setLoading(true);
      let parsed;

      if (textOrBuffer instanceof ArrayBuffer) {
        if (isBBLFile(textOrBuffer)) {
          parsed = decodeBBL(textOrBuffer);
        } else {
          const text = new TextDecoder().decode(textOrBuffer);
          parsed = parseBlackboxCSV(text);
        }
      } else if (typeof textOrBuffer === 'string') {
        parsed = parseBlackboxCSV(textOrBuffer);
      }

      if (!parsed) throw new Error('Could not parse comparison blackbox data');

      const rawLabel = typeof textOrBuffer === 'string'
        ? textOrBuffer
        : `[BBL binary: ${parsed.rowCount} frames${fileName ? ` - ${fileName}` : ''}]`;
      setComparisonBlackboxRaw(rawLabel);
      setComparisonBlackboxData(parsed);
      setErrors(prev => prev.filter(e => e.source !== 'bb-compare'));
      return parsed;
    } catch (err) {
      setErrors(prev => [...prev.filter(e => e.source !== 'bb-compare'), { source: 'bb-compare', message: err.message }]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearComparisonBlackbox = useCallback(() => {
    setComparisonBlackboxRaw('');
    setComparisonBlackboxData(null);
    setErrors(prev => prev.filter(e => e.source !== 'bb-compare'));
  }, []);

  const setResult = useCallback((toolKey, result) => {
    setAnalysisResults(prev => ({ ...prev, [toolKey]: result }));
  }, []);

  // Compute trimmed bbParsed — only recomputes when bbParsed or trimRange changes
  const bbParsedTrimmed = useMemo(() => {
    if (!bbParsed || !trimRange) return bbParsed;
    return applyTrim(bbParsed, trimRange.startIdx, trimRange.endIdx);
  }, [bbParsed, trimRange]);

  const updateTrimRange = useCallback((startIdx, endIdx) => {
    setTrimRange({ startIdx, endIdx });
  }, []);

  const clearAll = useCallback(() => {
    setCliRaw(''); setCliParsed(null); setTuningParams(null);
    setBbRaw(''); setBbParsed(null); setCapabilities({});
    setComparisonBlackboxRaw(''); setComparisonBlackboxData(null);
    setComparisonLabel('After'); setBaselineLabel('Before');
    setAnalysisResults({}); setErrors([]);
    setTrimRange(null);
  }, []);

  return (
    <DataContext.Provider value={{
      cliRaw, cliParsed, tuningParams,
      bbRaw, bbParsed, bbParsedTrimmed, capabilities,
      trimRange, updateTrimRange,
      comparisonBlackboxRaw,
      comparisonBlackboxData,
      comparisonLabel,
      baselineLabel,
      analysisResults, loading, errors,
      loadCLI,
      loadBlackbox,
      loadComparisonBlackbox,
      clearComparisonBlackbox,
      setComparisonLabel,
      setBaselineLabel,
      setResult,
      clearAll,
      setLoading
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}

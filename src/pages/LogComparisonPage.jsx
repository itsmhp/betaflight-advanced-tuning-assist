import { useMemo, useState } from 'react';
import { BarChart3, Upload, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Loader2, Copy } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';
import { runAllAnalyzers, computeOverallScore } from '../lib/analyzeAll';
import { parseBlackboxCSV } from '../lib/blackboxParser';
import { decodeBBL, isBBLFile } from '../lib/bblDecoder';

const parseBlackboxInput = async (file) => {
  const lower = file.name.toLowerCase();
  const isBinary = lower.endsWith('.bbl') || lower.endsWith('.bfl');

  if (isBinary) {
    const buffer = await file.arrayBuffer();
    if (isBBLFile(buffer)) return decodeBBL(buffer);
    const text = new TextDecoder().decode(buffer);
    return parseBlackboxCSV(text);
  }

  const text = await file.text();
  return parseBlackboxCSV(text);
};

const formatDelta = (before, after, inverse = false) => {
  if (before === null || before === undefined || after === null || after === undefined) {
    return { text: '—', improved: null };
  }
  if (before === 0) {
    return { text: `${after}`, improved: null };
  }
  const raw = ((after - before) / Math.abs(before)) * 100;
  const shown = `${raw > 0 ? '+' : ''}${raw.toFixed(1)}%`;
  const improved = inverse ? raw < 0 : raw > 0;
  return { text: shown, improved };
};

const getScore = (results, key) => {
  const value = results?.[key]?.score;
  return typeof value === 'number' ? Math.round(value) : null;
};

export default function LogComparisonPage() {
  const {
    bbParsed,
    comparisonBlackboxData,
    loadComparisonBlackbox,
    clearComparisonBlackbox,
    cliParsed,
    tuningParams,
    baselineLabel,
    comparisonLabel,
    setBaselineLabel,
    setComparisonLabel,
  } = useData();
  const { t } = useLang();

  const [baselineLocal, setBaselineLocal] = useState(null);
  const [comparisonLocal, setComparisonLocal] = useState(comparisonBlackboxData || null);
  const [baselineName, setBaselineName] = useState('Current baseline');
  const [comparisonName, setComparisonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [beforeResults, setBeforeResults] = useState(null);
  const [afterResults, setAfterResults] = useState(null);

  const baselineData = baselineLocal || bbParsed;
  const comparisonData = comparisonLocal || comparisonBlackboxData;

  const hasBothLogs = !!baselineData && !!comparisonData;

  const runComparison = async () => {
    if (!hasBothLogs) return;
    setLoading(true);
    setError('');
    try {
      const [before, after] = await Promise.all([
        runAllAnalyzers(baselineData, cliParsed, tuningParams),
        runAllAnalyzers(comparisonData, cliParsed, tuningParams),
      ]);
      setBeforeResults(before);
      setAfterResults(after);
    } catch (err) {
      setError(err?.message || 'Failed to compare logs');
    } finally {
      setLoading(false);
    }
  };

  const onUploadBaseline = async (file) => {
    setError('');
    try {
      const parsed = await parseBlackboxInput(file);
      setBaselineLocal(parsed);
      setBaselineName(file.name);
    } catch (err) {
      setError(err?.message || 'Failed to parse baseline log');
    }
  };

  const onUploadComparison = async (file) => {
    setError('');
    try {
      const parsed = await parseBlackboxInput(file);
      setComparisonLocal(parsed);
      setComparisonName(file.name);
      await loadComparisonBlackbox(file.name.toLowerCase().endsWith('.bbl') || file.name.toLowerCase().endsWith('.bfl') ? await file.arrayBuffer() : await file.text(), file.name);
    } catch (err) {
      setError(err?.message || 'Failed to parse comparison log');
    }
  };

  const rows = useMemo(() => {
    if (!beforeResults || !afterResults) return [];
    const beforeOverall = computeOverallScore(beforeResults);
    const afterOverall = computeOverallScore(afterResults);

    const baseRows = [
      { label: t('label_overall_health_score'), before: beforeOverall, after: afterOverall, inverse: false },
      { label: t('label_gyro_noise'), before: getScore(beforeResults, 'noise_profile'), after: getScore(afterResults, 'noise_profile'), inverse: false },
      { label: t('label_dterm_filter'), before: getScore(beforeResults, 'filter_analyzer'), after: getScore(afterResults, 'filter_analyzer'), inverse: false },
      { label: t('label_pid_stability'), before: getScore(beforeResults, 'advanced_pid'), after: getScore(afterResults, 'advanced_pid'), inverse: false },
      { label: t('label_propwash_handling'), before: getScore(beforeResults, 'prop_wash'), after: getScore(afterResults, 'prop_wash'), inverse: false },
      { label: t('label_motor_health'), before: getScore(beforeResults, 'motor_doctor'), after: getScore(afterResults, 'motor_doctor'), inverse: false },
      { label: t('label_ff_tracking'), before: getScore(beforeResults, 'feedforward'), after: getScore(afterResults, 'feedforward'), inverse: false },
    ];

    return baseRows.map((row) => ({ ...row, delta: formatDelta(row.before, row.after, row.inverse) }));
  }, [beforeResults, afterResults]);

  const copySummary = () => {
    if (!rows.length) return;
    const text = rows
      .map((r) => `${r.label}: ${baselineLabel}=${r.before ?? 'N/A'} | ${comparisonLabel}=${r.after ?? 'N/A'} | Δ=${r.delta.text}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Log Comparison</h1>
          <p className="text-sm text-gray-400">Compare before/after blackbox logs and quantify improvement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">{t('label_baseline_log')}</h3>
            <input value={baselineLabel} onChange={(e) => setBaselineLabel(e.target.value)} className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300 w-24" />
          </div>
          <p className="text-xs text-gray-500">{baselineName || t('status_current_baseline')}</p>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5">
              <Upload size={12} /> {t('btn_upload_new')}
              <input type="file" className="hidden" accept=".bbl,.bfl,.csv,.txt" onChange={(e) => e.target.files?.[0] && onUploadBaseline(e.target.files[0])} />
            </label>
            <button
              onClick={() => {
                setBaselineLocal(bbParsed || null);
                setBaselineName('Current loaded blackbox');
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg"
            >
              {t('btn_use_current')}
            </button>
          </div>
        </div>

        <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">{t('label_comparison_log')}</h3>
            <input value={comparisonLabel} onChange={(e) => setComparisonLabel(e.target.value)} className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300 w-24" />
          </div>
          <p className="text-xs text-gray-500">{comparisonName || t('status_post_tune')}</p>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5">
              <Upload size={12} /> {t('btn_upload')}
              <input type="file" className="hidden" accept=".bbl,.bfl,.csv,.txt" onChange={(e) => e.target.files?.[0] && onUploadComparison(e.target.files[0])} />
            </label>
            <button
              onClick={() => {
                setComparisonLocal(null);
                setComparisonName('');
                clearComparisonBlackbox();
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <Trash2 size={12} /> {t('btn_clear')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runComparison}
          disabled={!hasBothLogs || loading}
          className="text-sm bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-4 py-2 rounded-xl inline-flex items-center gap-2"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> {t('status_running_analyzers')}</> : <><RefreshCw size={14} /> {t('btn_overlay_compare')}</>}
        </button>
        {!!rows.length && (
          <button onClick={copySummary} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-xl inline-flex items-center gap-2">
            <Copy size={14} /> {t('btn_export_summary')}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!!rows.length && (
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700/40">
                <th className="text-left px-4 py-3">{t('header_metric')}</th>
                <th className="text-right px-4 py-3">{baselineLabel}</th>
                <th className="text-right px-4 py-3">{comparisonLabel}</th>
                <th className="text-right px-4 py-3">{t('header_change')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-gray-800/40">
                  <td className="px-4 py-2.5 text-gray-200">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{row.before ?? t('status_na')}</td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{row.after ?? t('status_na')}</td>
                  <td className="px-4 py-2.5 text-right">
                    {row.delta.improved === null ? (
                      <span className="text-gray-500">{row.delta.text}</span>
                    ) : row.delta.improved ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1 justify-end"><CheckCircle2 size={13} /> {row.delta.text}</span>
                    ) : (
                      <span className="text-red-400 inline-flex items-center gap-1 justify-end"><AlertTriangle size={13} /> {row.delta.text}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

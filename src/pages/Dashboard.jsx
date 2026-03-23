import { useState, useCallback, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LangContext';
import FileUpload from '../components/shared/FileUpload';
import FlightTrimControl from '../components/shared/FlightTrimControl';
import { runAllAnalyzers, computeOverallScore, aggregateResults, renderCLI, TOOL_DEFS } from '../lib/analyzeAll';
import { generateNoiseHeatmap } from '../lib/analyzers/noiseProfile';
import NoiseHeatmap from '../components/NoiseHeatmap';
import {
  HeartPulse, Cog, RotateCcw, Radio, Gauge, Wind, Flame,
  Activity, ArrowRight, Filter, Sliders, TrendingDown, BarChart3,
  Crosshair, Zap, CheckCircle2, AlertCircle, Play, RotateCw,
  Loader2, ChevronRight, Trash2, Copy, Check, ChevronDown, ChevronUp,
  Terminal, BookMarked, AlertTriangle, Info
} from 'lucide-react';

const ICONS = {
  advanced_pid: HeartPulse, motor_doctor: Cog, throttle_axis: RotateCcw,
  noise_profile: Radio, tpa: Gauge, prop_wash: Wind, anti_gravity: Flame,
  iterm: Activity, feedforward: ArrowRight, filter_analyzer: Filter,
  pid_multiplier: Sliders, thrust_linear: TrendingDown, pid_contribution: BarChart3,
  stick_analyzer: Crosshair, dynamic_idle: Zap,
};
const COLORS = {
  advanced_pid:'text-violet-400', motor_doctor:'text-fuchsia-400', throttle_axis:'text-amber-400',
  noise_profile:'text-indigo-400', tpa:'text-purple-400', prop_wash:'text-emerald-400',
  anti_gravity:'text-orange-400', iterm:'text-teal-400', feedforward:'text-pink-400',
  filter_analyzer:'text-yellow-400', pid_multiplier:'text-purple-300', thrust_linear:'text-red-400',
  pid_contribution:'text-green-400', stick_analyzer:'text-violet-300', dynamic_idle:'text-violet-400',
};

function hc(level) {
  return ({
    excellent:{ text:'text-emerald-400', bg:'bg-emerald-900/30', border:'border-emerald-500/30' },
    good:     { text:'text-violet-400',  bg:'bg-violet-900/30',  border:'border-violet-500/30' },
    warning:  { text:'text-amber-400',   bg:'bg-amber-900/30',   border:'border-amber-500/30' },
    critical: { text:'text-red-400',     bg:'bg-red-900/30',     border:'border-red-500/30' },
  })[level] ?? { text:'text-gray-500', bg:'bg-gray-800/30', border:'border-gray-700/30' };
}

function ScoreRing({ score, level, size=56 }) {
  const r=22, cx=28, cy=28, circ=2*Math.PI*r;
  const pct=score==null?0:Math.max(0,Math.min(100,score))/100;
  const dash=pct*circ;
  const colors={excellent:'#34d399',good:'#a78bfa',warning:'#fbbf24',critical:'#f87171',unknown:'#4b5563'};
  const stroke=colors[level??'unknown'];
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{transition:'stroke-dasharray 0.6s ease'}}/>
      <text x={cx} y={cy+5} textAnchor="middle" fontSize="12" fontWeight="bold" fill={stroke}>
        {score==null?'?':score}
      </text>
    </svg>
  );
}

export default function Dashboard() {
  const { cliParsed, bbParsed, bbParsedTrimmed, tuningParams, clearAll, trimRange, updateTrimRange } = useData();
  const navigate = useNavigate();
  const { t } = useLang();

  const [analyzing, setAnalyzing]       = useState(false);
  const [progress, setProgress]         = useState({ step:0, total:0, currentKey:null });
  const [summary, setSummary]           = useState(null);
  const [overallScore, setOverallScore] = useState(null);
  const [overallLevel, setOverallLevel] = useState('unknown');
  const [aggregated, setAggregated]     = useState(null);  // {allRecommendations, allCliChanges}
  const [cliText, setCliText]           = useState(null);
  const [showRecs, setShowRecs]         = useState(true);
  const [showCLI, setShowCLI]           = useState(true);
  const [copied, setCopied]             = useState(false);
  const [heatmapData, setHeatmapData]   = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const cliRef = useRef(null);

  const hasAnyData = !!(cliParsed || bbParsed);

  const handleAnalyze = useCallback(async () => {
    if (!hasAnyData || analyzing) return;
    setAnalyzing(true);
    setSummary(null);
    setAggregated(null);
    setCliText(null);
    setProgress({ step:0, total:0, currentKey:null });
    const dataForAnalysis = bbParsedTrimmed || bbParsed;
    const results = await runAllAnalyzers(
      dataForAnalysis, cliParsed, tuningParams,
      (step, total, key) => setProgress({ step, total, currentKey:key })
    );
    const score = computeOverallScore(results);
    const lvl = score==null?'unknown':score>=85?'excellent':score>=65?'good':score>=40?'warning':'critical';
    setOverallScore(score);
    setOverallLevel(lvl);
    setSummary(results);
    const agg = aggregateResults(results);
    setAggregated(agg);
    setCliText(renderCLI(agg.allCliChanges, cliParsed ? cliParsed.activeProfile ?? 0 : 0));
    setAnalyzing(false);
  }, [hasAnyData, analyzing, bbParsed, bbParsedTrimmed, cliParsed, tuningParams]);

  const handleCopy = useCallback(() => {
    if (!cliText) return;
    navigator.clipboard.writeText(cliText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [cliText]);

  const handleGenerateHeatmap = useCallback(async () => {
    if (!bbParsed || heatmapLoading) return;
    setHeatmapLoading(true);
    setHeatmapData(null);
    try {
      // Run in next tick to allow UI to update
      await new Promise(r => setTimeout(r, 30));
      const heatData = generateNoiseHeatmap(bbParsedTrimmed || bbParsed);
      setHeatmapData(heatData);
    } catch (e) {
      console.error('Heatmap error:', e);
    } finally {
      setHeatmapLoading(false);
    }
  }, [bbParsed, heatmapLoading]);

  const progressPct = progress.total>0 ? Math.round((progress.step/progress.total)*100) : 0;

  return (
    <div className="fade-in max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">
          <span className="accent-gradient">{t('appName')}</span>
        </h1>
        <p className="text-sm text-gray-400">{t('appSubtitle')}</p>
      </div>

      <div className="card mb-5">
        <FileUpload />
      </div>

      {bbParsed && (
        <div className="mb-5">
          <FlightTrimControl
            bbParsed={bbParsed}
            trimRange={trimRange}
            onTrimChange={updateTrimRange}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className={`card flex items-center gap-3 ${cliParsed?'border-emerald-500/30':'border-violet-900/20'}`}>
          {cliParsed
            ? <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0"/>
            : <AlertCircle  size={20} className="text-gray-600 flex-shrink-0"/>}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-200 truncate">
              {cliParsed ? t('cliLoaded') : t('cliDump')}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {cliParsed
                ? `${cliParsed.craftName||'Unnamed'}  BF ${cliParsed.version||'?'}  ${cliParsed.boardName||cliParsed.fcTarget||'?'}`
                : t('notLoaded')}
            </div>
          </div>
        </div>

        <div className={`card flex items-center gap-3 ${bbParsed?'border-emerald-500/30':'border-violet-900/20'}`}>
          {bbParsed
            ? <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0"/>
            : <AlertCircle  size={20} className="text-gray-600 flex-shrink-0"/>}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-200">
              {bbParsed ? t('bbLoaded') : t('blackboxLog')}
            </div>
            <div className="text-xs text-gray-500">
              {bbParsed
                ? `${(bbParsedTrimmed || bbParsed).data?.length??0} ${t('samples')} @ ${bbParsed.sampleRate||'?'} ${t('hz')}${trimRange ? ' (trimmed)' : ''}`
                : t('notLoaded')}
            </div>
          </div>
        </div>

        <div className="card flex flex-col items-center justify-center gap-2">
          {analyzing ? (
            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 size={16} className="text-violet-400 animate-spin"/>
                <span className="text-sm text-violet-300">{t('analyzing')}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden mb-1">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300"
                  style={{width:`${progressPct}%`}}
                />
              </div>
              <div className="text-xs text-gray-500">
                {progress.step} {t('of')} {progress.total} {t('done')}
                {progress.currentKey && (
                  <span className="ml-1 text-violet-400"> {t(`tool_${progress.currentKey}`)}</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleAnalyze}
                disabled={!hasAnyData}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  hasAnyData
                    ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-900/40 cursor-pointer'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {summary ? <><RotateCw size={15}/>{t('reAnalyze')}</> : <><Play size={15}/>{t('analyzeAll')}</>}
              </button>
              {!hasAnyData && (
                <p className="text-xs text-gray-600 text-center">{t('loadFilesFirst')}</p>
              )}
              {summary && hasAnyData && (
                <button
                  onClick={()=>{clearAll();setSummary(null);setOverallScore(null);}}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11}/>{t('clearAll')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {summary && !analyzing && (
        <div className="mb-6">
          <div className={`card mb-4 flex items-center gap-5 border-2 ${hc(overallLevel).border}`}>
            <ScoreRing score={overallScore} level={overallLevel} size={64}/>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{t('overallHealth')}</div>
              <div className="text-2xl font-bold text-gray-100">
                {overallScore!=null ? `${overallScore}/100` : ''}
              </div>
              <div className={`text-sm font-semibold capitalize ${hc(overallLevel).text}`}>
                {t(overallLevel)}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-gray-500">{t('analysisResultsSubtitle')}</div>
              <div className="text-xs text-gray-600 mt-0.5">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('analysisResults')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {TOOL_DEFS.map(def => {
              const r = summary[def.key];
              const Icon = ICONS[def.key]??Zap;
              const col = COLORS[def.key]??'text-violet-400';
              const isSkipped = r?.skipped;
              const isNoData = r?.noData;
              const isError = r?.error && !isSkipped && !isNoData;
              const canClick = !isSkipped && !isNoData && !isError;
              const c = hc(isSkipped || isNoData ? 'unknown' : r?.level);
              return (
                <div
                  key={def.key}
                  className={`card border ${c.border} flex items-center gap-3 transition-colors group
                    ${isSkipped ? 'opacity-35 cursor-default' : isNoData ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-violet-900/10'}`}
                  onClick={() => canClick && navigate(def.route)}
                  title={isSkipped ? r?.skipReason : isNoData ? (r?.noDataMessage || 'Insufficient flight data') : undefined}
                >
                  <ScoreRing score={canClick ? r?.score : null} level={canClick ? r?.level : 'unknown'} size={48}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon size={13} className={isSkipped || isNoData ? 'text-gray-600' : col}/>
                      <span className="text-xs font-semibold text-gray-200 truncate">{t(def.labelKey)}</span>
                    </div>
                    {isSkipped ? (
                      <div className="text-[10px] text-gray-600 leading-tight">
                        <span className="text-amber-700">{r?.skipReason}</span>
                        {r?.dataHint && <span className="block text-gray-700 mt-0.5">{r.dataHint}</span>}
                      </div>
                    ) : isNoData ? (
                      <div className="text-[10px] leading-tight">
                        <span className="text-blue-600">Needs more flight data</span>
                        {r?.noDataMessage && <span className="block text-gray-700 mt-0.5">{r.noDataMessage}</span>}
                      </div>
                    ) : isError ? (
                      <span className="text-[10px] text-red-400">Analysis error</span>
                    ) : (
                      <span className={`text-[10px] font-medium capitalize ${c.text}`}>{t(r?.level??'unknown')}</span>
                    )}
                  </div>
                  {canClick && (
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0"/>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Recommendations Panel ──────────────────────────────── */}
          {aggregated?.allRecommendations?.length > 0 && (
            <div className="card mb-4 border border-amber-900/30">
              <button
                onClick={() => setShowRecs(v => !v)}
                className="w-full flex items-center gap-2 text-left"
              >
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0"/>
                <span className="text-sm font-semibold text-gray-200 flex-1">
                  Recommendations
                  <span className="ml-2 text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded-full">
                    {aggregated.allRecommendations.length}
                  </span>
                </span>
                {showRecs ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
              </button>
              {showRecs && (
                <div className="mt-3 space-y-2">
                  {aggregated.allRecommendations.map((rec, i) => {
                    const Icon = rec.level === 'critical' ? AlertCircle : rec.level === 'warning' ? AlertTriangle : Info;
                    const color = rec.level === 'critical' ? 'text-red-400 border-red-900/30 bg-red-900/10'
                      : rec.level === 'warning' ? 'text-amber-400 border-amber-900/30 bg-amber-900/10'
                      : 'text-blue-400 border-blue-900/30 bg-blue-900/10';
                    return (
                      <div key={i} className={`flex gap-2 p-2.5 rounded border text-xs ${color}`}>
                        <Icon size={12} className="flex-shrink-0 mt-0.5"/>
                        <div>
                          <span className="font-medium mr-1.5">[{rec.tool}]</span>
                          <span className="text-gray-200">{typeof rec.text === 'string' ? rec.text : (rec.text?.message ?? rec.text?.text ?? JSON.stringify(rec.text))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CLI Suggested Changes ─────────────────────────────── */}
          {cliText && (
            <div className="card mb-6 border border-violet-900/40">
              <div className="flex items-center gap-2 mb-3">
                <Terminal size={14} className="text-violet-400"/>
                <span className="text-sm font-semibold text-gray-200 flex-1">
                  Suggested CLI Changes
                  <span className="ml-2 text-[10px] text-gray-500">
                    ({Object.keys(aggregated.allCliChanges).length} settings)
                  </span>
                </span>
                <button
                  onClick={() => setShowCLI(v => !v)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  {showCLI ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
                    copied
                      ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/30'
                      : 'bg-violet-800/30 text-violet-300 border border-violet-700/30 hover:bg-violet-700/30'
                  }`}
                >
                  {copied ? <><Check size={12}/>Copied!</> : <><Copy size={12}/>Copy CLI</>}
                </button>
              </div>
              {showCLI && (
                <>
                  <div className="text-[10px] text-amber-400 bg-amber-900/15 border border-amber-900/30 rounded px-3 py-2 mb-3 flex gap-2">
                    <AlertTriangle size={11} className="flex-shrink-0 mt-0.5"/>
                    <span>Always review before applying. Test one change at a time. These are AI-generated suggestions based on your flight data.</span>
                  </div>
                  <pre
                    ref={cliRef}
                    className="text-[11px] font-mono text-gray-300 bg-gray-950/60 rounded p-3 overflow-x-auto whitespace-pre border border-gray-800/50 leading-5 max-h-96 overflow-y-auto"
                  >
                    {cliText}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Noise Heatmap ─────────────────────────────────────── */}
      {bbParsed && (
        <div className="card mb-6 border border-indigo-900/40">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={14} className="text-indigo-400"/>
            <span className="text-sm font-semibold text-gray-200 flex-1">Noise Heatmap</span>
            <span className="text-[10px] text-gray-500">Throttle % vs Frequency</span>
          </div>
          {!heatmapData && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <div className="text-xs text-gray-500 text-center">
                Visualize noise distribution across throttle and frequency ranges.<br/>
                <span className="text-gray-600">Computation may take a few seconds for large logs.</span>
              </div>
              <button
                onClick={handleGenerateHeatmap}
                disabled={heatmapLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-800/40 text-indigo-300 border border-indigo-700/40 hover:bg-indigo-700/40 transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {heatmapLoading
                  ? <><Loader2 size={12} className="animate-spin"/>Generating...</>
                  : <><Activity size={12}/>Generate Noise Heatmap</>}
              </button>
            </div>
          )}
          {heatmapData && (
            <div>
              <NoiseHeatmap heatmapData={heatmapData} width={580} height={280} />
              <button
                onClick={() => setHeatmapData(null)}
                className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear heatmap
              </button>
            </div>
          )}
        </div>
      )}

      {tuningParams && !summary && (
        <div className="card mb-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Current PID Profile</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[['Roll P/I/D','roll'],['Pitch P/I/D','pitch'],['Yaw P/I/D','yaw']].map(([label,axis])=>{
              const pid = tuningParams.pid?.[axis];
              return (
                <div key={axis} className="bg-gray-900/50 rounded p-2">
                  <div className="text-gray-500 mb-0.5">{label}</div>
                  <div className="text-gray-200 font-mono">
                    {pid ? `${pid.p ?? '?'} / ${pid.i ?? '?'} / ${pid.d ?? '?'}` : '—'}
                  </div>
                </div>
              );
            })}
            <div className="bg-gray-900/50 rounded p-2">
              <div className="text-gray-500 mb-0.5">D-Min R/P/Y</div>
              <div className="text-gray-200 font-mono">
                {tuningParams.pid?.roll?.dMin ?? '?'} / {tuningParams.pid?.pitch?.dMin ?? '?'} / {tuningParams.pid?.yaw?.dMin ?? '?'}
              </div>
            </div>
          </div>
        </div>
      )}

      {!summary && (
        <>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">
            {t('toolsGrid')}  <span className="text-violet-400">16</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">{t('toolsGridSub')}</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {TOOL_DEFS.map(def => {
              const Icon = ICONS[def.key]??Zap;
              const col = COLORS[def.key]??'text-violet-400';
              const ready = (!def.needsCli||!!cliParsed)&&(!def.needsBb||!!bbParsed);
              return (
                <button
                  key={def.key}
                  onClick={()=>navigate(def.route)}
                  className={`card text-left transition-all hover:border-violet-500/40 hover:bg-violet-900/10 group ${!ready?'opacity-50':''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={15} className={col}/>
                    <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate">{t(def.labelKey)}</span>
                    {!ready && <AlertCircle size={11} className="text-gray-600 ml-auto flex-shrink-0"/>}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{t(`desc_${def.key}`)}</p>
                  <div className="flex gap-1">
                    {def.needsCli && <span className={`text-[10px] px-1.5 py-0.5 rounded ${cliParsed?'bg-emerald-900/30 text-emerald-400':'bg-gray-800 text-gray-600'}`}>CLI</span>}
                    {def.needsBb  && <span className={`text-[10px] px-1.5 py-0.5 rounded ${bbParsed?'bg-emerald-900/30 text-emerald-400':'bg-gray-800 text-gray-600'}`}>BBL</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

import { useReducer, useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waypoints, CheckCircle2, AlertCircle, AlertTriangle,
  ChevronRight, Loader2, Info,
  Lock, Copy, Check, Play, RotateCw, Cpu, X, SkipForward,
  ClipboardList, Rocket, FileDown, RotateCcw, Sparkles
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useDroneProfile } from '../context/DroneProfileContext';
import { useLang } from '../i18n/LangContext';
import { runAllAnalyzers, aggregateResults, renderCLI } from '../lib/analyzeAll';
import { generateAIInsight } from '../lib/aiInterpreter';
import FileUpload from '../components/shared/FileUpload';
import {
  createInitialPipelineState,
  pipelineReducer,
  getStageRecommendations,
  stageDataReady,
  getStageHealthScore,
  getStageHealthLevel,
  getStageIssues,
  countCompleted,
  STAGE_STATUS,
  TUNING_STAGES,
  SKIP_WARNINGS,
  savePipelineState,
  loadPipelineState,
  clearPipelineState,
} from '../lib/tuningPipeline';

// ─────────────────────────────────────────────────────────────────────────────
// Tool labels for display
// ─────────────────────────────────────────────────────────────────────────────
const TOOL_LABELS = {
  noise_profile: 'Noise Profile',
  motor_doctor: 'Motor Doctor',
  filter_analyzer: 'Filter Analyzer',
  dynamic_idle: 'Dynamic Idle',
  advanced_pid: 'Advanced PID',
  pid_contribution: 'PID Contribution',
  pid_multiplier: 'PID Multiplier',
  feedforward: 'Feedforward',
  stick_analyzer: 'Stick Analyzer',
  tpa: 'TPA',
  thrust_linear: 'Thrust Linear',
  anti_gravity: 'Anti-Gravity',
  iterm: 'I-Term',
  prop_wash: 'Prop Wash',
  throttle_axis: 'Throttle Axis',
};

// ─────────────────────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
  excellent: { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-600/40', dot: 'bg-emerald-400' },
  good:      { text: 'text-violet-400',  bg: 'bg-violet-900/30',  border: 'border-violet-600/40',  dot: 'bg-violet-400'  },
  warning:   { text: 'text-amber-400',   bg: 'bg-amber-900/30',   border: 'border-amber-600/40',   dot: 'bg-amber-400'   },
  critical:  { text: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-600/40',     dot: 'bg-red-400'     },
  unknown:   { text: 'text-gray-500',    bg: 'bg-gray-800/40',    border: 'border-gray-700/40',    dot: 'bg-gray-600'    },
};

const STAGE_ICON_COLORS = [
  'text-indigo-400',   // noise
  'text-yellow-400',   // filters
  'text-violet-400',   // pids
  'text-pink-400',     // feedforward
  'text-purple-400',   // tpa
  'text-orange-400',   // antiGravity
  'text-emerald-400',  // verification
];

const STAGE_BORDER_COLORS = [
  'border-indigo-700/50',
  'border-yellow-700/50',
  'border-violet-700/50',
  'border-pink-700/50',
  'border-purple-700/50',
  'border-orange-700/50',
  'border-emerald-700/50',
];

// ─────────────────────────────────────────────────────────────────────────────
// Copy-to-clipboard hook
// ─────────────────────────────────────────────────────────────────────────────
function useCopyClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    });
  }, [timeout]);
  return { copied, copy };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skip Warning Modal
// ─────────────────────────────────────────────────────────────────────────────
function SkipWarningModal({ stageId, stageTitle, onConfirmSkip, onCancel }) {
  const warning = SKIP_WARNINGS[stageId] || 'Skipping this stage may lead to suboptimal tuning results.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-red-800/50 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold text-base">Skip {stageTitle}?</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{warning}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 text-sm bg-violet-700 hover:bg-violet-600 text-white px-4 py-2.5 rounded-xl transition-colors font-medium"
          >
            <RotateCcw size={14} /> Go Back
          </button>
          <button
            onClick={onConfirmSkip}
            className="flex-1 flex items-center justify-center gap-2 text-sm bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 px-4 py-2.5 rounded-xl transition-colors font-medium"
          >
            <SkipForward size={14} /> Skip Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Data Detected Banner
// ─────────────────────────────────────────────────────────────────────────────
function NewDataBanner({ onReset, onKeep, onDismiss }) {
  return (
    <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
      <Info size={16} className="text-blue-400 flex-shrink-0" />
      <span className="text-sm text-blue-200 flex-1 min-w-0">
        New data detected. Reset pipeline to re-analyze from Stage 1?
      </span>
      <div className="flex gap-2">
        <button onClick={onReset} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
          Reset from Stage 1
        </button>
        <button onClick={onKeep} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
          Keep Progress
        </button>
        <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 p-1">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Card
// ─────────────────────────────────────────────────────────────────────────────
function RecommendationCard({ rec, isApplied, onToggle }) {
  const { copied, copy } = useCopyClipboard();
  const severityColors = {
    critical: 'border-red-700/40 bg-red-900/20',
    warning: 'border-amber-700/40 bg-amber-900/20',
    info: 'border-gray-700/40 bg-gray-800/30',
  };
  const colorClass = severityColors[rec.severity] || severityColors.info;

  return (
    <div className={`border rounded-lg p-3 space-y-2 transition-all ${colorClass} ${isApplied ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={onToggle}
          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            isApplied
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'border-gray-600 hover:border-gray-400'
          }`}
        >
          {isApplied && <Check size={10} />}
        </button>
        <p className={`text-xs leading-relaxed flex-1 ${isApplied ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
          {rec.message}
        </p>
        <span className="text-[10px] text-gray-600 flex-shrink-0">{TOOL_LABELS[rec.tool] || rec.tool}</span>
      </div>
      {rec.cliCommand && (
        <div className="flex items-center gap-2 ml-6">
          <code className="text-[11px] text-cyan-300 bg-gray-900/60 px-2 py-1 rounded font-mono flex-1 truncate">
            {rec.cliCommand}
          </code>
          <button
            onClick={() => copy(rec.cliCommand)}
            className="text-gray-500 hover:text-gray-300 p-1 flex-shrink-0"
            title="Copy command"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      )}
      {(rec.currentValue !== null && rec.currentValue !== undefined) && (
        <div className="flex items-center gap-3 ml-6 text-[10px]">
          <span className="text-gray-500">Current: <span className="text-gray-400">{rec.currentValue}</span></span>
          {rec.suggestedValue !== null && rec.suggestedValue !== undefined && (
            <span className="text-gray-500">→ Suggested: <span className="text-cyan-400">{rec.suggestedValue}</span></span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Badge (mini result inside a stage)
// ─────────────────────────────────────────────────────────────────────────────
function ToolResultBadge({ toolKey, analysisResults }) {
  const r = analysisResults?.[toolKey];
  if (!r) return null;

  const level = r.skipped ? 'unknown' : r.noData ? 'unknown' : (r.level || 'unknown');
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.unknown;
  const label = TOOL_LABELS[toolKey] || toolKey;
  const score = r.score;

  return (
    <div className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${color.bg} ${color.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
      <span className={`font-medium ${color.text}`}>{label}</span>
      {score !== null && score !== undefined && (
        <span className={`ml-auto font-semibold ${color.text}`}>{score}</span>
      )}
      {r.skipped && <span className="ml-auto text-gray-500 italic">skipped</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Stage Content
// ─────────────────────────────────────────────────────────────────────────────
function VerificationContent({ pipeline, analysisResults }) {
  const navigate = useNavigate();
  const { copied, copy } = useCopyClipboard();
  const [checks, setChecks] = useState({
    hover: false,
    slowRoll: false,
    fastRoll: false,
    hardStop: false,
    fullThrottle: false,
    invertedHover: false,
  });

  // Full CLI from aggregateResults
  const fullCLI = useMemo(() => {
    if (!analysisResults) return null;
    try {
      const { allCliChanges } = aggregateResults(analysisResults);
      return renderCLI(allCliChanges);
    } catch { return null; }
  }, [analysisResults]);

  const toggleCheck = (key) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  const allChecked = Object.values(checks).every(Boolean);

  const FLIGHT_CHECKS = [
    { key: 'hover', label: 'Hover test — check for oscillation while hovering' },
    { key: 'slowRoll', label: 'Slow roll — check P oscillation' },
    { key: 'fastRoll', label: 'Fast roll — check I washout' },
    { key: 'hardStop', label: 'Hard stop — check D overshoot' },
    { key: 'fullThrottle', label: 'Full throttle punch — check TPA + Anti-Gravity' },
    { key: 'invertedHover', label: 'Inverted hover / drops — check propwash recovery' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary table */}
      <div>
        <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
          <ClipboardList size={13} /> Stage Summary
        </h4>
        <div className="bg-gray-900/50 rounded-lg border border-gray-700/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700/40 text-gray-500">
                <th className="text-left px-3 py-2 font-medium">Stage</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Applied</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.stages.slice(0, -1).map((s) => (
                <tr key={s.id} className="border-b border-gray-800/40">
                  <td className="px-3 py-1.5 text-gray-300">{s.icon} {s.title}</td>
                  <td className="px-3 py-1.5">
                    {s.status === STAGE_STATUS.COMPLETED && !s.skippedWithWarning && (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Done</span>
                    )}
                    {s.skippedWithWarning && (
                      <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> Skipped</span>
                    )}
                    {s.status === STAGE_STATUS.LOCKED && (
                      <span className="text-gray-600 flex items-center gap-1"><Lock size={11} /> Locked</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-400">{s.appliedRecommendations.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLI commands dump */}
      {fullCLI && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <FileDown size={13} /> CLI Commands
            </h4>
            <button
              onClick={() => copy(fullCLI)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              {copied ? <><Check size={11} className="text-emerald-400" /> Copied!</> : <><Copy size={11} /> Copy All</>}
            </button>
          </div>
          <pre className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3 text-[11px] text-cyan-300 font-mono max-h-48 overflow-auto whitespace-pre-wrap">
            {fullCLI}
          </pre>
        </div>
      )}

      {/* Test Flight Checklist */}
      <div>
        <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
          <Rocket size={13} /> Test Flight Checklist
        </h4>
        <div className="space-y-1.5">
          {FLIGHT_CHECKS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleCheck(key)}
              className={`w-full flex items-center gap-2.5 text-xs px-3 py-2 rounded-lg border transition-all text-left ${
                checks[key]
                  ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                  : 'bg-gray-800/30 border-gray-700/40 text-gray-400 hover:border-gray-600'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                checks[key] ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-gray-600'
              }`}>
                {checks[key] && <Check size={10} />}
              </span>
              {label}
            </button>
          ))}
        </div>
        {allChecked && (
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> All flight tests completed — your tune is verified!
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/compare-logs')}
          className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg"
        >
          Upload post-tune log & compare
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage Card
// ─────────────────────────────────────────────────────────────────────────────
function StageCard({
  stage,
  stageIndex,
  pipeline,
  analysisResults,
  bbParsed,
  cliParsed,
  dispatch,
  onSkipRequest,
}) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { profile } = useDroneProfile();
  const [expanded, setExpanded] = useState(false);
  const { copied, copy } = useCopyClipboard();
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiApiKey, setAiApiKey] = useState(() => {
    try {
      return localStorage.getItem('btfl_anthropic_api_key') || '';
    } catch {
      return '';
    }
  });

  const status = stage.status;
  const isLocked = status === STAGE_STATUS.LOCKED;
  const isActive = status === STAGE_STATUS.ACTIVE;
  const isCompleted = status === STAGE_STATUS.COMPLETED;
  const dataReady = stageDataReady(stage, bbParsed, cliParsed);

  // Get analysis data for this stage
  const healthScore = useMemo(
    () => getStageHealthScore(stage, analysisResults),
    [stage, analysisResults]
  );
  const healthLevel = getStageHealthLevel(healthScore);
  const issues = useMemo(
    () => getStageIssues(stage, analysisResults),
    [stage, analysisResults]
  );
  const recommendations = useMemo(
    () => getStageRecommendations(stage, analysisResults),
    [stage, analysisResults]
  );

  const stageAnalysisData = useMemo(() => {
    if (!analysisResults) return null;
    const picked = {};
    for (const analyzerKey of stage.analyzerKeys) {
      if (analysisResults[analyzerKey]) picked[analyzerKey] = analysisResults[analyzerKey];
    }
    return Object.keys(picked).length ? picked : null;
  }, [analysisResults, stage.analyzerKeys]);

  const color = LEVEL_COLORS[healthLevel] || LEVEL_COLORS.unknown;
  const borderColor = STAGE_BORDER_COLORS[stageIndex] || 'border-gray-700/50';

  // Copy all CLI commands from recommendations
  const allCLI = recommendations.filter(r => r.cliCommand).map(r => r.cliCommand);
  const handleCopyAll = () => copy(allCLI.join('\n'));

  const handleToggleRec = (rec) => {
    const isApplied = stage.appliedRecommendations.includes(rec.cliCommand || rec.message);
    if (isApplied) {
      dispatch({ type: 'UNMARK_RECOMMENDATION', payload: { stageIndex, command: rec.cliCommand || rec.message } });
    } else {
      dispatch({ type: 'MARK_RECOMMENDATION_APPLIED', payload: { stageIndex, command: rec.cliCommand || rec.message } });
    }
  };

  const handleSaveApiKey = () => {
    try {
      if (aiApiKey?.trim()) {
        localStorage.setItem('btfl_anthropic_api_key', aiApiKey.trim());
      } else {
        localStorage.removeItem('btfl_anthropic_api_key');
      }
    } catch {
      // ignore localStorage errors
    }
  };

  const handleGetAIInsight = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const result = await generateAIInsight({
        stageId: stage.id,
        analysisData: stageAnalysisData,
        droneProfile: profile,
        cliData: cliParsed,
        lang,
        apiKey: aiApiKey,
      });

      if (!result.ok) {
        setAiError(result.error || 'Failed to generate AI insight.');
        return;
      }

      setAiText(result.text || 'No AI output.');
      setAiExpanded(true);
    } catch (err) {
      setAiError(err?.message || 'Failed to generate AI insight.');
    } finally {
      setAiLoading(false);
    }
  };

  // ── LOCKED STATE ──
  if (isLocked) {
    return (
      <div className="flex gap-3 sm:gap-5">
        <div className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full border-2 border-gray-700 bg-gray-800/60 flex items-center justify-center flex-shrink-0 z-10">
            <Lock size={14} className="text-gray-600" />
          </div>
          {stageIndex < TUNING_STAGES.length - 1 && (
            <div className="w-px flex-1 mt-1 min-h-[20px] bg-gray-800/40" />
          )}
        </div>
        <div className="flex-1 mb-4 bg-gray-800/20 border border-gray-800/40 rounded-xl p-4 opacity-50">
          <div className="flex items-center gap-2">
            <span className="text-lg">{stage.icon}</span>
            <span className="text-sm text-gray-500 font-medium">{stage.title}</span>
            <span className="ml-auto text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock size={9} /> Locked
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">Complete previous stages to unlock</p>
        </div>
      </div>
    );
  }

  // ── COMPLETED STATE (collapsed) ──
  if (isCompleted && !expanded) {
    return (
      <div className="flex gap-3 sm:gap-5">
        <div className="flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${
            stage.skippedWithWarning ? 'border-amber-600 bg-amber-900/40' : 'border-emerald-600 bg-emerald-900/40'
          }`}>
            {stage.skippedWithWarning
              ? <AlertTriangle size={14} className="text-amber-400" />
              : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
          {stageIndex < TUNING_STAGES.length - 1 && (
            <div className={`w-px flex-1 mt-1 min-h-[20px] ${
              stage.skippedWithWarning ? 'bg-amber-700/30' : 'bg-emerald-700/30'
            }`} />
          )}
        </div>
        <div className={`flex-1 mb-4 bg-gray-800/30 border rounded-xl overflow-hidden transition-all ${
          stage.skippedWithWarning ? 'border-amber-800/40' : 'border-emerald-800/40'
        }`}>
          <button
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
            onClick={() => setExpanded(true)}
          >
            <span className="text-lg">{stage.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold text-sm">{stage.title}</span>
                {stage.skippedWithWarning ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-900/40 text-amber-300 flex items-center gap-1">
                    <AlertTriangle size={10} /> Skipped
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Completed
                  </span>
                )}
                {healthScore !== null && (
                  <span className={`text-[11px] font-semibold ${color.text}`}>{healthScore}/100</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {stage.appliedRecommendations.length} recommendation{stage.appliedRecommendations.length !== 1 ? 's' : ''} applied
              </p>
            </div>
            <ChevronRight size={15} className="text-gray-500 flex-shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE STATE (or expanded completed) ──
  const connectorColor = isCompleted
    ? (stage.skippedWithWarning ? 'bg-amber-700/30' : 'bg-emerald-700/30')
    : healthLevel === 'critical' ? 'bg-red-700/40'
    : healthLevel === 'warning' ? 'bg-amber-700/40'
    : 'bg-violet-700/30';

  return (
    <div className="flex gap-3 sm:gap-5">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-colors ${
          isCompleted
            ? (stage.skippedWithWarning ? 'border-amber-600 bg-amber-900/40' : 'border-emerald-600 bg-emerald-900/40')
            : 'border-violet-500 bg-violet-900/50 ring-2 ring-violet-500/20'
        }`}>
          {isCompleted
            ? (stage.skippedWithWarning ? <AlertTriangle size={14} className="text-amber-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />)
            : <span className="text-sm font-bold text-violet-300">{stageIndex + 1}</span>}
        </div>
        {stageIndex < TUNING_STAGES.length - 1 && (
          <div className={`w-px flex-1 mt-1 min-h-[20px] ${connectorColor}`} />
        )}
      </div>
      <div className={`flex-1 mb-4 bg-gray-800/40 border rounded-xl overflow-hidden shadow-lg transition-all ${
        isActive ? `${borderColor} shadow-lg` : (stage.skippedWithWarning ? 'border-amber-800/40' : 'border-emerald-800/40')
      }`}>
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-gray-700/40">
          <span className="text-lg mt-0.5">{stage.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{stage.title}</span>
              {isActive && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-violet-900/40 text-violet-300 flex items-center gap-1">
                  <Play size={9} /> Active
                </span>
              )}
              {isCompleted && !stage.skippedWithWarning && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Completed
                </span>
              )}
              {isCompleted && stage.skippedWithWarning && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-900/40 text-amber-300 flex items-center gap-1">
                  <AlertTriangle size={10} /> Skipped
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{stage.description}</p>
          </div>
          {/* Health Score Gauge */}
          {healthScore !== null && (
            <div className={`text-center flex-shrink-0 px-3 py-1 rounded-lg ${color.bg} ${color.border} border`}>
              <div className={`text-lg font-bold ${color.text}`}>{healthScore}</div>
              <div className="text-[10px] text-gray-500">score</div>
            </div>
          )}
          {isCompleted && (
            <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-300 p-1">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body content */}
        <div className="px-4 pb-4 pt-3 space-y-4">
          {/* Data readiness check */}
          {!dataReady && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle size={13} className="flex-shrink-0" />
              <span>Missing required data. Upload {stage.requiredData.includes('blackbox') && !bbParsed ? '.bbl blackbox log' : ''}{stage.requiredData.includes('blackbox') && !bbParsed && stage.requiredData.includes('cli') && !cliParsed ? ' and ' : ''}{stage.requiredData.includes('cli') && !cliParsed ? 'CLI dump' : ''} to proceed.</span>
              <button
                onClick={() => navigate('/')}
                className="ml-auto text-red-400 hover:text-red-200 underline flex-shrink-0"
              >
                Upload
              </button>
            </div>
          )}

          {/* Tool results */}
          {stage.analyzerKeys.length > 0 && analysisResults && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-500 mb-1">Analysis Results</h4>
              {stage.analyzerKeys.map(k => (
                <ToolResultBadge key={k} toolKey={k} analysisResults={analysisResults} />
              ))}
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-500">Issues Found</h4>
              {issues.map((issue, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                  issue.level === 'critical' ? 'bg-red-900/20 border-red-700/40 text-red-300' : 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                }`}>
                  {issue.level === 'critical' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                  <span className="flex-1">{issue.summary}</span>
                  {issue.score !== null && <span className="font-semibold">{issue.score}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Verification stage special content */}
          {stage.id === 'verification' && (
            <VerificationContent pipeline={pipeline} analysisResults={analysisResults} />
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && stage.id !== 'verification' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-gray-500">
                  Recommendations ({recommendations.length})
                </h4>
                {allCLI.length > 0 && (
                  <button
                    onClick={handleCopyAll}
                    className="text-[11px] text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copied ? <><Check size={10} className="text-emerald-400" /> Copied!</> : <><Copy size={10} /> Copy All CLI</>}
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {recommendations.map((rec, idx) => (
                  <RecommendationCard
                    key={rec.id || idx}
                    rec={rec}
                    isApplied={stage.appliedRecommendations.includes(rec.cliCommand || rec.message)}
                    onToggle={() => handleToggleRec(rec)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No recommendations placeholder */}
          {recommendations.length === 0 && stage.id !== 'verification' && dataReady && analysisResults && Object.keys(analysisResults).length > 0 && (
            <div className="text-xs text-gray-500 italic flex items-center gap-1.5 py-2">
              <Info size={12} />
              {healthScore === null
                ? 'Run analysis to see recommendations for this stage.'
                : 'No specific recommendations — this stage looks good!'}
            </div>
          )}

          {/* No analysis yet */}
          {(!analysisResults || Object.keys(analysisResults).length === 0) && stage.id !== 'verification' && (
            <p className="text-xs text-gray-500 italic flex items-center gap-1.5 py-1">
              <Info size={12} /> Run &quot;Analyze All&quot; above to see results for this stage.
            </p>
          )}

          {/* AI Interpretation */}
          {stage.id !== 'verification' && isActive && (
            <div className="space-y-2 border-t border-gray-700/30 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGetAIInsight}
                  disabled={aiLoading || !stageAnalysisData}
                  className="text-xs bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                >
                  {aiLoading ? <><Loader2 size={12} className="animate-spin" /> Analyzing...</> : <><Sparkles size={12} /> Get AI Insight</>}
                </button>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  onBlur={handleSaveApiKey}
                  placeholder="Anthropic API Key"
                  className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300 min-w-[180px]"
                />
              </div>
              {aiError && (
                <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                  {aiError} (fallback: keep using rule-based recommendations above)
                </div>
              )}
              {aiText && aiExpanded && (
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-2.5 space-y-1.5">
                  <div className="text-xs font-semibold text-blue-300">AI Interpretation</div>
                  <p className="text-xs text-blue-100 whitespace-pre-wrap leading-relaxed">{aiText}</p>
                  <p className="text-[10px] text-blue-300/80">AI suggestions are advisory; verify with test flight.</p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {isActive && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700/30">
              <button
                onClick={() => dispatch({ type: 'CONFIRM_STAGE', payload: { stageIndex } })}
                className="flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors font-medium"
              >
                <CheckCircle2 size={13} />
                {stage.id === 'verification' ? 'Complete Tuning Session' : "I've Applied Changes — Continue"}
              </button>
              {stage.id !== 'verification' && (
                <button
                  onClick={() => onSkipRequest(stageIndex)}
                  className="flex items-center gap-1.5 text-xs bg-gray-700/60 hover:bg-gray-600/60 text-gray-400 hover:text-gray-200 px-3 py-2 rounded-xl transition-colors"
                >
                  <SkipForward size={12} /> Skip This Stage
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────────────────────────────────────
function PipelineProgressBar({ pipeline }) {
  const total = pipeline.stages.length;
  const completed = countCompleted(pipeline.stages);
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pipeline.allCompleted ? 'bg-emerald-500' : 'bg-violet-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{completed}/{total}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TuneWorkflowPage() {
  const { cliParsed, bbParsed, tuningParams, analysisResults, setResult } = useData();
  const { profile } = useDroneProfile();
  const navigate = useNavigate();

  // Pipeline state — load from localStorage or create fresh
  const [pipeline, dispatch] = useReducer(pipelineReducer, null, () => {
    const saved = loadPipelineState();
    return saved || createInitialPipelineState();
  });

  // Persist pipeline state on every change
  useEffect(() => {
    savePipelineState(pipeline);
  }, [pipeline]);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 0 });

  // Skip warning modal
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [pendingSkipIndex, setPendingSkipIndex] = useState(null);

  // New data detection
  const [showNewDataBanner, setShowNewDataBanner] = useState(false);
  const [dataFingerprint, setDataFingerprint] = useState(null);
  const [showUploadPanel, setShowUploadPanel] = useState(true);

  // Track data changes for re-upload detection
  useEffect(() => {
    const newFingerprint = `${!!bbParsed}-${!!cliParsed}-${bbParsed?.rowCount || 0}`;
    if (dataFingerprint !== null && newFingerprint !== dataFingerprint && pipeline.activeStageIndex > 0) {
      setShowNewDataBanner(true);
    }
    setDataFingerprint(newFingerprint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbParsed, cliParsed]);

  const hasAnyData = !!(cliParsed || bbParsed);
  const hasResults = !!analysisResults && Object.keys(analysisResults).length > 0;
  const progressPct = progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 0;

  // Run analysis
  const handleAnalyze = useCallback(async () => {
    if (!hasAnyData || analyzing) return;
    setAnalyzing(true);
    setProgress({ step: 0, total: 0 });
    const results = await runAllAnalyzers(
      bbParsed, cliParsed, tuningParams,
      (step, total) => setProgress({ step, total }),
    );
    Object.entries(results).forEach(([key, val]) => setResult(key, val));
    setAnalyzing(false);
  }, [hasAnyData, analyzing, bbParsed, cliParsed, tuningParams, setResult]);

  // Skip handlers
  const handleSkipRequest = (stageIndex) => {
    setPendingSkipIndex(stageIndex);
    setShowSkipWarning(true);
  };

  const handleConfirmSkip = () => {
    if (pendingSkipIndex !== null) {
      dispatch({ type: 'SKIP_STAGE_WITH_WARNING', payload: { stageIndex: pendingSkipIndex } });
    }
    setShowSkipWarning(false);
    setPendingSkipIndex(null);
  };

  const handleCancelSkip = () => {
    setShowSkipWarning(false);
    setPendingSkipIndex(null);
  };

  // New data handlers
  const handleResetPipeline = () => {
    dispatch({ type: 'RESET_ALL' });
    setShowNewDataBanner(false);
  };

  const handleKeepProgress = () => {
    setShowNewDataBanner(false);
  };

  // New session
  const handleNewSession = () => {
    clearPipelineState();
    dispatch({ type: 'RESET_ALL' });
  };

  const completed = countCompleted(pipeline.stages);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Skip Warning Modal */}
      {showSkipWarning && pendingSkipIndex !== null && (
        <SkipWarningModal
          stageId={pipeline.stages[pendingSkipIndex].id}
          stageTitle={pipeline.stages[pendingSkipIndex].title}
          onConfirmSkip={handleConfirmSkip}
          onCancel={handleCancelSkip}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Waypoints size={24} className="text-violet-400 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">Sequential Tuning Pipeline</h1>
            <p className="text-sm text-gray-400">Complete each stage in order for best results</p>
          </div>
        </div>
        {profile?.craftName && (
          <div className="flex items-center gap-2 text-xs text-violet-200 bg-violet-900/30 border border-violet-700/40 rounded-xl px-3 py-1.5">
            <Cpu size={12} className="text-violet-400" />
            <span>{profile.craftName}{profile.frameSize ? ` · ${profile.frameSize}` : ''}</span>
          </div>
        )}
      </div>

      {/* ── Progress ── */}
      <PipelineProgressBar pipeline={pipeline} />

      {/* ── Inline Upload Panel ── */}
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Flight Data Upload</h3>
            <p className="text-xs text-gray-500">Upload / replace CLI and blackbox directly from this sequential tuning tab.</p>
          </div>
          <button
            onClick={() => setShowUploadPanel(prev => !prev)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg"
          >
            {showUploadPanel ? 'Hide Upload' : 'Show Upload'}
          </button>
        </div>
        {showUploadPanel && <FileUpload compact />}
      </div>

      {/* ── Data Status Banners ── */}
      {!bbParsed && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">No blackbox data. Upload a <strong>.bbl</strong> file to enable analysis.</span>
          <button
            onClick={() => navigate('/')}
            className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex-shrink-0"
          >
            Upload Now
          </button>
        </div>
      )}
      {!cliParsed && bbParsed && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="flex-1">No CLI dump loaded. Some recommendations may be incomplete.</span>
          <button
            onClick={() => navigate('/')}
            className="text-xs bg-amber-800 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex-shrink-0"
          >
            Upload
          </button>
        </div>
      )}

      {/* New Data Banner */}
      {showNewDataBanner && (
        <NewDataBanner
          onReset={handleResetPipeline}
          onKeep={handleKeepProgress}
          onDismiss={() => setShowNewDataBanner(false)}
        />
      )}

      {/* ── Analyze bar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mr-auto text-sm">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cliParsed ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          <span className={cliParsed ? 'text-gray-300' : 'text-gray-500'}>CLI {cliParsed ? 'loaded' : 'missing'}</span>
          <span className="text-gray-700">·</span>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bbParsed ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          <span className={bbParsed ? 'text-gray-300' : 'text-gray-500'}>BBL {bbParsed ? 'loaded' : 'missing'}</span>
        </div>

        {analyzing ? (
          <div className="flex items-center gap-2 text-xs text-violet-300">
            <Loader2 size={14} className="animate-spin" />
            {progressPct}% — analyzing…
          </div>
        ) : hasResults ? (
          <button
            onClick={handleAnalyze}
            disabled={!hasAnyData}
            className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCw size={12} /> Re-analyze
          </button>
        ) : (
          <button
            onClick={handleAnalyze}
            disabled={!hasAnyData}
            className="flex items-center gap-1.5 text-xs bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
          >
            <Play size={12} /> Analyze All
          </button>
        )}
      </div>

      {/* ── Progress bar (while analyzing) ── */}
      {analyzing && progress.total > 0 && (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* ── Pipeline Stages ── */}
      <div className="pt-1">
        {pipeline.stages.map((stage, i) => (
          <StageCard
            key={stage.id}
            stage={stage}
            stageIndex={i}
            pipeline={pipeline}
            analysisResults={analysisResults}
            bbParsed={bbParsed}
            cliParsed={cliParsed}
            dispatch={dispatch}
            onSkipRequest={handleSkipRequest}
          />
        ))}
      </div>

      {/* ── All Complete Banner ── */}
      {pipeline.allCompleted && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-emerald-300">
            <CheckCircle2 size={20} />
            <span className="font-semibold">Tuning Pipeline Complete!</span>
          </div>
          <p className="text-xs text-gray-400">
            All {TUNING_STAGES.length} stages have been reviewed. Fly a test pack and record a new blackbox log to fine-tune further.
          </p>
          <button
            onClick={handleNewSession}
            className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-xl transition-colors font-medium inline-flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> Start New Tuning Session
          </button>
        </div>
      )}

      {/* ── Footer tip ── */}
      <div className="text-center text-xs text-gray-600 pb-4">
        The correct tuning order ensures each layer is solid before the next is built on it.
        <br />
        Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification
      </div>
    </div>
  );
}
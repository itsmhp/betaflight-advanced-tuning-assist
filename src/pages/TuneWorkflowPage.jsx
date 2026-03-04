import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waypoints, Upload, CheckCircle2, AlertCircle, AlertTriangle,
  ChevronRight, Loader2, ExternalLink, RotateCcw, Info,
  Cog, Radio, Filter, Zap, HeartPulse, ArrowRight, Gauge,
  TrendingDown, Flame, Activity, Wind, BarChart3, Crosshair,
  BookMarked, Terminal, Cpu, Play, RotateCw
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useDroneProfile } from '../context/DroneProfileContext';
import { runAllAnalyzers, computeOverallScore } from '../lib/analyzeAll';
import FileUpload from '../components/shared/FileUpload';

// ─────────────────────────────────────────────────────────────────────────────
// Workflow definition — ordered by best-practice tuning sequence
// ─────────────────────────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    id: 'setup',
    number: 1,
    title: 'Setup & Profile',
    subtitle: 'Upload files and configure your drone',
    icon: Upload,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-700/50',
    accentGlow: 'shadow-cyan-900/30',
    toolKeys: [],
    why: 'Everything downstream depends on having the right data. A CLI dump tells us your current settings; a blackbox log shows us how the quad actually flew. Neither alone is enough for full analysis.',
    actions: [{ label: 'Configure Drone', icon: Cpu, route: '/my-drone', color: 'bg-cyan-800 hover:bg-cyan-700' }],
    special: 'upload',
  },
  {
    id: 'noise',
    number: 2,
    title: 'Motor & Noise',
    subtitle: 'Identify noise sources before touching filters or PIDs',
    icon: Radio,
    color: 'text-indigo-400',
    borderColor: 'border-indigo-700/50',
    accentGlow: 'shadow-indigo-900/30',
    toolKeys: ['motor_doctor', 'noise_profile', 'throttle_axis'],
    why: 'You cannot tune PIDs on a noisy quad. If motors are imbalanced or props are damaged, every PID change will fight against vibration. Fix the mechanical layer first.',
    actions: [
      { label: 'Motor Doctor',   icon: Cog,       route: '/motor-doctor',  color: 'bg-indigo-800 hover:bg-indigo-700' },
      { label: 'Noise Profile',  icon: Radio,     route: '/noise-profile', color: 'bg-indigo-800 hover:bg-indigo-700' },
    ],
  },
  {
    id: 'filters',
    number: 3,
    title: 'Filter Tuning',
    subtitle: 'Set filter cutoffs to clean signal without adding latency',
    icon: Filter,
    color: 'text-yellow-400',
    borderColor: 'border-yellow-700/50',
    accentGlow: 'shadow-yellow-900/30',
    toolKeys: ['filter_analyzer', 'dynamic_idle'],
    why: 'Filters reduce D-term noise and protect motors. Too aggressive = latency and propwash. Too loose = motor heat and oscillation. Get this right before touching P/D.',
    actions: [
      { label: 'Filter Analyzer', icon: Filter, route: '/filter-analyzer', color: 'bg-yellow-800 hover:bg-yellow-700' },
      { label: 'Dynamic Idle',    icon: Zap,    route: '/dynamic-idle',    color: 'bg-yellow-800 hover:bg-yellow-700' },
    ],
  },
  {
    id: 'pid',
    number: 4,
    title: 'PID Baseline',
    subtitle: 'Tune P, I, D for stability and responsiveness',
    icon: HeartPulse,
    color: 'text-violet-400',
    borderColor: 'border-violet-700/50',
    accentGlow: 'shadow-violet-900/30',
    toolKeys: ['advanced_pid', 'pid_contribution', 'pid_multiplier'],
    why: 'P-term sets authority, D-term damps oscillation, I-term corrects drift. The analysis tells you if any term is saturating, oscillating, or underperforming relative to the others.',
    actions: [
      { label: 'Advanced PID',    icon: HeartPulse, route: '/advanced-pid',      color: 'bg-violet-800 hover:bg-violet-700' },
      { label: 'PID Contribution',icon: BarChart3,  route: '/pid-contribution',  color: 'bg-violet-800 hover:bg-violet-700' },
      { label: 'PID Multiplier',  icon: Crosshair,  route: '/pid-multiplier',    color: 'bg-violet-800 hover:bg-violet-700' },
    ],
  },
  {
    id: 'feedforward',
    number: 5,
    title: 'Feedforward',
    subtitle: 'Dial stick feel and tracking response',
    icon: ArrowRight,
    color: 'text-pink-400',
    borderColor: 'border-pink-700/50',
    accentGlow: 'shadow-pink-900/30',
    toolKeys: ['feedforward', 'stick_analyzer'],
    why: 'Feedforward makes the quad react to stick movement before error builds. Too high = overshoots; too low = sluggish feel. Smooth factor and boost tune the edge cases.',
    actions: [
      { label: 'Feedforward',    icon: ArrowRight,  route: '/feedforward',     color: 'bg-pink-800 hover:bg-pink-700' },
      { label: 'Stick Analyzer', icon: Crosshair,   route: '/stick-analyzer',  color: 'bg-pink-800 hover:bg-pink-700' },
    ],
  },
  {
    id: 'tpa',
    number: 6,
    title: 'TPA & Thrust',
    subtitle: 'Prevent high-throttle oscillation and motor linearisation',
    icon: Gauge,
    color: 'text-purple-400',
    borderColor: 'border-purple-700/50',
    accentGlow: 'shadow-purple-900/30',
    toolKeys: ['tpa', 'thrust_linear'],
    why: 'At full throttle, motors respond faster — PIDs tuned at mid-throttle will oscillate. TPA reduces D (and optionally P/I) above the breakpoint. Thrust linear linearises motor response.',
    actions: [
      { label: 'TPA',           icon: Gauge,       route: '/tpa',            color: 'bg-purple-800 hover:bg-purple-700' },
      { label: 'Thrust Linear', icon: TrendingDown, route: '/thrust-linear', color: 'bg-purple-800 hover:bg-purple-700' },
    ],
  },
  {
    id: 'antigrav',
    number: 7,
    title: 'Anti-Gravity & I-term',
    subtitle: 'Throttle punch stability and I-term windup protection',
    icon: Flame,
    color: 'text-orange-400',
    borderColor: 'border-orange-700/50',
    accentGlow: 'shadow-orange-900/30',
    toolKeys: ['anti_gravity', 'iterm'],
    why: 'Hard throttle inputs spike I-term, causing attitude wobbles. Anti-gravity boosts I-term multiplicatively on rapid throttle change. I-term relax prevents windup during flips.',
    actions: [
      { label: 'Anti-Gravity', icon: Flame,    route: '/anti-gravity', color: 'bg-orange-800 hover:bg-orange-700' },
      { label: 'I-term Relax', icon: Activity, route: '/iterm',        color: 'bg-orange-800 hover:bg-orange-700' },
    ],
  },
  {
    id: 'verification',
    number: 8,
    title: 'Prop Wash & Verification',
    subtitle: 'Final check — recovery after hard manoeuvres',
    icon: Wind,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-700/50',
    accentGlow: 'shadow-emerald-900/30',
    toolKeys: ['prop_wash'],
    why: 'Prop wash is the acid test. If the quad recovers cleanly after a flip or drop, the full chain — motors, filters, PIDs, feedforward — is working together. Apply a smart preset and verify with a fresh log.',
    actions: [
      { label: 'Prop Wash',     icon: Wind,       route: '/prop-wash', color: 'bg-emerald-800 hover:bg-emerald-700' },
      { label: 'Apply Preset',  icon: BookMarked, route: '/presets',   color: 'bg-teal-800 hover:bg-teal-700' },
      { label: 'CLI Terminal',  icon: Terminal,   route: '/serial',    color: 'bg-teal-800 hover:bg-teal-700' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
  excellent: { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-600/40', dot: 'bg-emerald-400' },
  good:      { text: 'text-violet-400',  bg: 'bg-violet-900/30',  border: 'border-violet-600/40',  dot: 'bg-violet-400'  },
  warning:   { text: 'text-amber-400',   bg: 'bg-amber-900/30',   border: 'border-amber-600/40',   dot: 'bg-amber-400'   },
  critical:  { text: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-600/40',     dot: 'bg-red-400'     },
  skipped:   { text: 'text-gray-500',    bg: 'bg-gray-800/40',    border: 'border-gray-700/40',    dot: 'bg-gray-600'    },
  no_data:   { text: 'text-blue-400',    bg: 'bg-blue-900/20',    border: 'border-blue-700/30',    dot: 'bg-blue-500'    },
};

function getStepStatus(toolKeys, results) {
  if (!results || !toolKeys.length) return 'not_started';
  const relevant = toolKeys.map(k => results[k]).filter(Boolean);
  if (!relevant.length) return 'not_started';
  if (relevant.every(r => r.isSkipped)) return 'skipped';
  if (relevant.every(r => r.noData || r.isSkipped)) return 'no_data';
  const active = relevant.filter(r => !r.isSkipped && !r.noData);
  if (active.some(r => r.level === 'critical'))  return 'critical';
  if (active.some(r => r.level === 'warning'))   return 'warning';
  if (active.some(r => r.level === 'excellent' || r.level === 'good')) return 'ok';
  return 'no_data';
}

const STATUS_META = {
  not_started: { label: 'Not analyzed',  icon: null,           ringColor: 'border-gray-700',          numBg: 'bg-gray-800 text-gray-500',    badgeBg: '' },
  skipped:     { label: 'Missing data',  icon: AlertCircle,    ringColor: 'border-gray-600',          numBg: 'bg-gray-800 text-gray-400',    badgeBg: 'bg-gray-700/60 text-gray-400' },
  no_data:     { label: 'No flight data',icon: Info,           ringColor: 'border-blue-700',          numBg: 'bg-blue-900/50 text-blue-300', badgeBg: 'bg-blue-900/40 text-blue-300' },
  ok:          { label: 'All good',      icon: CheckCircle2,   ringColor: 'border-emerald-600',       numBg: 'bg-emerald-900/60 text-emerald-300', badgeBg: 'bg-emerald-900/40 text-emerald-300' },
  warning:     { label: 'Needs attention',icon: AlertTriangle, ringColor: 'border-amber-600',         numBg: 'bg-amber-900/60 text-amber-300',   badgeBg: 'bg-amber-900/40 text-amber-300' },
  critical:    { label: 'Action required',icon: AlertCircle,  ringColor: 'border-red-600',           numBg: 'bg-red-900/60 text-red-300',      badgeBg: 'bg-red-900/40 text-red-300' },
};

const TOOL_LABELS = {
  motor_doctor:'Motor Doctor', noise_profile:'Noise Profile', throttle_axis:'Throttle / Style',
  filter_analyzer:'Filter Analyzer', dynamic_idle:'Dynamic Idle',
  advanced_pid:'Advanced PID', pid_contribution:'PID Contribution', pid_multiplier:'PID Multiplier',
  feedforward:'Feedforward', stick_analyzer:'Stick Analyzer',
  tpa:'TPA', thrust_linear:'Thrust Linear',
  anti_gravity:'Anti-Gravity', iterm:'I-term Relax',
  prop_wash:'Prop Wash',
};

function ToolBadge({ toolKey, result }) {
  const level  = result ? (result.isSkipped ? 'skipped' : result.noData ? 'no_data' : result.level ?? 'no_data') : 'not_started';
  const colors = LEVEL_COLORS[level] ?? LEVEL_COLORS.skipped;
  const label  = TOOL_LABELS[toolKey] ?? toolKey;
  const summary = result?.summary ?? result?.skipReason ?? (result?.noData ? 'Needs more flight data' : null);
  return (
    <div className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${colors.bg} ${colors.border}`} title={summary ?? ''}>
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
      <div className="min-w-0">
        <span className={`font-medium ${colors.text}`}>{label}</span>
        {summary && <div className="text-gray-500 truncate mt-0.5 leading-tight max-w-[18rem]">{summary}</div>}
      </div>
      {level !== 'not_started' && level !== 'no_data' && (
        <span className={`ml-auto flex-shrink-0 font-semibold capitalize ${colors.text}`}>{level}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Card
// ─────────────────────────────────────────────────────────────────────────────
function StepCard({ step, results, isLast, isActive, setActiveStep }) {
  const navigate = useNavigate();
  const [showWhy, setShowWhy] = useState(false);
  const status    = step.special === 'upload' ? 'setup' : getStepStatus(step.toolKeys, results);
  const meta      = STATUS_META[status] ?? STATUS_META.not_started;
  const StatusIcon = meta.icon;
  const expanded  = isActive;

  const hasResults = !!results && Object.keys(results).length > 0;

  return (
    <div className="flex gap-3 sm:gap-5">
      {/* ── Left: connector + number ── */}
      <div className="flex flex-col items-center gap-0">
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-colors
          ${meta.ringColor} ${meta.numBg} font-bold text-sm`}>
          {step.number}
        </div>
        {!isLast && (
          <div className={`w-px flex-1 mt-1 mb-0 min-h-[28px] ${
            status === 'ok' ? 'bg-emerald-700/50' :
            status === 'warning' ? 'bg-amber-700/40' :
            status === 'critical' ? 'bg-red-700/40' :
            'bg-gray-700/40'
          }`} />
        )}
      </div>

      {/* ── Right: card content ── */}
      <div className={`flex-1 mb-6 bg-gray-800/40 border rounded-xl overflow-hidden transition-all ${step.borderColor}`}>
        {/* Header row */}
        <button
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/5 transition-colors"
          onClick={() => setActiveStep(isActive ? null : step.id)}
        >
          <step.icon size={17} className={`${step.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{step.title}</span>
              {/* Status badge */}
              {status !== 'setup' && status !== 'not_started' && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${meta.badgeBg}`}>
                  {StatusIcon && <StatusIcon size={10} />} {meta.label}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{step.subtitle}</p>
          </div>
          <ChevronRight
            size={15}
            className={`flex-shrink-0 mt-0.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="border-t border-gray-700/60 px-4 pb-4 pt-3 space-y-3">

            {/* Upload widget for step 1 */}
            {step.special === 'upload' && (
              <div className="rounded-xl overflow-hidden">
                <FileUpload />
              </div>
            )}

            {/* Tool results grid */}
            {step.toolKeys.length > 0 && (
              <div className="space-y-1.5">
                {step.toolKeys.map(k => (
                  <ToolBadge
                    key={k}
                    toolKey={k}
                    result={results?.[k]}
                  />
                ))}
                {!hasResults && (
                  <p className="text-xs text-gray-500 italic">Upload files and run analysis to see results here.</p>
                )}
              </div>
            )}

            {/* Why this step matters */}
            <div>
              <button
                onClick={() => setShowWhy(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Info size={12} />
                <span>{showWhy ? 'Hide' : 'Why this order?'}</span>
              </button>
              {showWhy && (
                <p className="mt-2 text-xs text-gray-400 leading-relaxed bg-gray-700/30 rounded-lg px-3 py-2 border border-gray-700/40">
                  {step.why}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {step.actions.map(a => (
                <button
                  key={a.route}
                  onClick={() => navigate(a.route)}
                  className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors font-medium ${a.color}`}
                >
                  <a.icon size={12} />
                  {a.label}
                  <ExternalLink size={10} className="opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overall mini score bar
// ─────────────────────────────────────────────────────────────────────────────
function OverallScoreBar({ results }) {
  if (!results || !Object.keys(results).length) return null;
  const score  = computeOverallScore(results);
  const levels = Object.values(results).map(r => r.level).filter(Boolean);
  const critical = levels.filter(l => l === 'critical').length;
  const warning  = levels.filter(l => l === 'warning').length;
  const good     = levels.filter(l => l === 'good' || l === 'excellent').length;
  const lvl   = score == null ? 'unknown' : score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'warning' : 'critical';
  const col   = { excellent:'text-emerald-400', good:'text-violet-400', warning:'text-amber-400', critical:'text-red-400', unknown:'text-gray-500' }[lvl];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${col}`}>{score ?? '–'}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
      {critical > 0 && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11}/>{critical} critical</span>}
      {warning  > 0 && <span className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle size={11}/>{warning} warnings</span>}
      {good     > 0 && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11}/>{good} good</span>}
      <span className="ml-auto text-xs text-gray-500">{Object.keys(results).length} tools analyzed</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TuneWorkflowPage() {
  const { cliParsed, bbParsed, tuningParams, analysisResults, setResult, setLoading } = useData();
  const { profile } = useDroneProfile();

  const [analyzing,   setAnalyzing]   = useState(false);
  const [progress,    setProgress]    = useState({ step: 0, total: 0 });
  const [activeStep,  setActiveStep]  = useState('setup');

  const hasAnyData = !!(cliParsed || bbParsed);
  const hasResults = !!analysisResults && Object.keys(analysisResults).length > 0;
  const progressPct = progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 0;

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
    // Auto-open first non-ok step
    const firstBad = WORKFLOW_STEPS.find(s => {
      const st = getStepStatus(s.toolKeys, results);
      return st === 'critical' || st === 'warning';
    });
    setActiveStep(firstBad?.id ?? null);
  }, [hasAnyData, analyzing, bbParsed, cliParsed, tuningParams, setResult]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Waypoints size={24} className="text-violet-400 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">Tune Your Quad</h1>
            <p className="text-sm text-gray-400">Step-by-step guided tuning · Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification</p>
          </div>
        </div>
        {/* Drone chip */}
        {profile?.craftName && (
          <div className="flex items-center gap-2 text-xs text-violet-200 bg-violet-900/30 border border-violet-700/40 rounded-xl px-3 py-1.5">
            <Cpu size={12} className="text-violet-400" />
            <span>{profile.craftName}{profile.frameSize ? ` · ${profile.frameSize}` : ''}</span>
          </div>
        )}
      </div>

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

      {/* ── Overall score ── */}
      {hasResults && <OverallScoreBar results={analysisResults} />}

      {/* ── Workflow steps ── */}
      <div className="pt-1">
        {WORKFLOW_STEPS.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            results={analysisResults}
            isLast={i === WORKFLOW_STEPS.length - 1}
            isActive={activeStep === step.id}
            setActiveStep={setActiveStep}
          />
        ))}
      </div>

      {/* ── Footer tip ── */}
      <div className="text-center text-xs text-gray-600 pb-4">
        The correct tuning order ensures each layer is solid before the next is built on it.
        Skip steps at your own risk — noisy motors will make PID tuning impossible.
      </div>
    </div>
  );
}

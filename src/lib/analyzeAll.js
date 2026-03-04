/**
 * analyzeAll.js
 * Orchestrates all 15 analyzers and returns summary results with scores for 
 * the Dashboard "Analyze All" flow.
 */
import { analyzeAdvancedPidHealth } from './analyzers/advancedPidHealth';
import { analyzeMotors } from './analyzers/motorDoctor';
import { analyzeNoiseProfile } from './analyzers/noiseProfile';
import { analyzeDynamicIdle } from './analyzers/dynamicIdle';
import { analyzeAntiGravity } from './analyzers/antiGravity';
import { analyzeStickMovement } from './analyzers/stickAnalyzer';
import { applyPIDMultiplier } from './analyzers/pidMultiplier';
import { analyzePIDContribution } from './analyzers/pidContribution';
import { analyzeFilters } from './analyzers/filterAnalyzer';
import { analyzeThrustLinearization } from './analyzers/thrustLinearization';
import { analyzeFeedforward } from './analyzers/feedforward';
import { analyzeTPA } from './analyzers/tpaAnalyzer';
import { analyzeITermBuildup } from './analyzers/itermBuildup';
import { analyzeThrottleAxis } from './analyzers/throttleAxis';
import { analyzePropWash } from './analyzers/propWash';

/** 
 * Tool definitions — each has a key, route, label key, and required data.
 * `needsCli` / `needsBb` determines whether the tool can run.
 * `dataHint` describes what flight data is required (shown when skipped).
 */
export const TOOL_DEFS = [
  { key: 'advanced_pid',    route: '/advanced-pid',     labelKey: 'tool_advanced_pid',    needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL' },
  { key: 'motor_doctor',    route: '/motor-doctor',     labelKey: 'tool_motor_doctor',    needsCli: false, needsBb: true,  dataHint: 'BBL with motor RPM data' },
  { key: 'throttle_axis',   route: '/throttle-axis',    labelKey: 'tool_throttle_axis',   needsCli: false, needsBb: true,  dataHint: 'BBL with throttle data' },
  { key: 'noise_profile',   route: '/noise-profile',    labelKey: 'tool_noise_profile',   needsCli: false, needsBb: true,  dataHint: 'BBL with gyro data' },
  { key: 'tpa',             route: '/tpa',              labelKey: 'tool_tpa',             needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL with full throttle range' },
  { key: 'prop_wash',       route: '/prop-wash',        labelKey: 'tool_prop_wash',       needsCli: false, needsBb: true,  dataHint: 'BBL — fly flips/rolls' },
  { key: 'anti_gravity',    route: '/anti-gravity',     labelKey: 'tool_anti_gravity',    needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL — fly throttle punches' },
  { key: 'iterm',           route: '/iterm',            labelKey: 'tool_iterm',           needsCli: false, needsBb: true,  dataHint: 'BBL — fly saturation moves' },
  { key: 'feedforward',     route: '/feedforward',      labelKey: 'tool_feedforward',     needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL with setpoint data' },
  { key: 'filter_analyzer', route: '/filter-analyzer',  labelKey: 'tool_filter_analyzer', needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL with gyro data' },
  { key: 'pid_multiplier',  route: '/pid-multiplier',   labelKey: 'tool_pid_multiplier',  needsCli: true,  needsBb: false, dataHint: 'CLI with simplified PID settings' },
  { key: 'thrust_linear',   route: '/thrust-linear',    labelKey: 'tool_thrust_linear',   needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL with motor data' },
  { key: 'pid_contribution',route: '/pid-contribution', labelKey: 'tool_pid_contribution',needsCli: false, needsBb: true,  dataHint: 'BBL with P/I/D term data' },
  { key: 'stick_analyzer',  route: '/stick-analyzer',   labelKey: 'tool_stick_analyzer',  needsCli: false, needsBb: true,  dataHint: 'BBL with RC setpoint data' },
  { key: 'dynamic_idle',    route: '/dynamic-idle',     labelKey: 'tool_dynamic_idle',    needsCli: true,  needsBb: true,  dataHint: 'CLI + BBL with motor RPM' },
];

/**
 * Normalize/extract a numeric score (0-100) and health level from any analyzer result.
 * Also detects "ran but got no useful flight data" situations.
 */
function extractScore(result) {
  if (!result) return { score: null, level: 'unknown', noData: false };

  // Detect "ran but flight data was insufficient" — analyzer returned early
  const noDataStatus = result.status === 'No Data' || result.status === 'Insufficient Data';
  if (noDataStatus) {
    return { score: null, level: 'no_flight_data', noData: true, noDataMessage: result.message ?? '' };
  }

  const score =
    result.overallScore ?? result.healthScore ?? result.score ?? null;
  const level =
    result.healthLevel ?? result.severity ?? result.flightStyle ?? null;

  // Derive a numeric score from ranges if missing
  let numericScore = typeof score === 'number' ? Math.round(score) : null;
  if (numericScore === null && typeof level === 'string') {
    const map = { excellent: 95, good: 78, warning: 45, critical: 15 };
    numericScore = map[level.toLowerCase()] ?? null;
  }

  // Normalize level string to one of 4 categories
  let healthLevel = 'unknown';
  if (typeof level === 'string') {
    const l = level.toLowerCase();
    if (['excellent', 'great', 'optimal'].some(w => l.includes(w))) healthLevel = 'excellent';
    else if (['good', 'ok', 'normal', 'acceptable'].some(w => l.includes(w))) healthLevel = 'good';
    else if (['warning', 'degraded', 'moderate'].some(w => l.includes(w))) healthLevel = 'warning';
    else if (['critical', 'poor', 'bad', 'failed'].some(w => l.includes(w))) healthLevel = 'critical';
    else healthLevel = 'good'; // default
  }
  if (numericScore !== null) {
    if (numericScore >= 85) healthLevel = 'excellent';
    else if (numericScore >= 65) healthLevel = 'good';
    else if (numericScore >= 40) healthLevel = 'warning';
    else healthLevel = 'critical';
  }

  return { score: numericScore, level: healthLevel, noData: false };
}

const RUNNERS = {
  advanced_pid:     (bb, cli, params) => analyzeAdvancedPidHealth(bb, params),
  motor_doctor:     (bb)              => analyzeMotors(bb),
  throttle_axis:    (bb)              => analyzeThrottleAxis(bb),
  noise_profile:    (bb)              => analyzeNoiseProfile(bb),
  tpa:              (bb, cli, params) => analyzeTPA(bb, params),
  prop_wash:        (bb)              => analyzePropWash(bb),
  anti_gravity:     (bb, cli, params) => analyzeAntiGravity(bb, params),
  iterm:            (bb)              => analyzeITermBuildup(bb),
  feedforward:      (bb, cli, params) => analyzeFeedforward(bb, params),
  filter_analyzer:  (bb, cli, params) => analyzeFilters(bb, params),
  pid_multiplier:  (bb, cli, params) => params?.pid ? applyPIDMultiplier(params, 1.0) : null,
  thrust_linear:    (bb, cli, params) => analyzeThrustLinearization(bb, params),
  pid_contribution: (bb)              => analyzePIDContribution(bb),
  stick_analyzer:   (bb)              => analyzeStickMovement(bb),
  dynamic_idle:     (bb, cli, params) => analyzeDynamicIdle(bb, params),
};

/**
 * Run all eligible analyzers and report progress via `onProgress(step, total, toolKey)`.
 * Returns an object map: { toolKey: { score, level, result, error } }
 */
export async function runAllAnalyzers(bbParsed, cliParsed, tuningParams, onProgress) {
  const results = {};
  const hasCli = !!cliParsed && !!tuningParams;
  const hasBb  = !!bbParsed;

  const eligible = TOOL_DEFS.filter(def => {
    if (def.needsCli && !hasCli) return false;
    if (def.needsBb  && !hasBb)  return false;
    return true;
  });

  for (let i = 0; i < eligible.length; i++) {
    const def = eligible[i];
    onProgress?.(i, eligible.length, def.key);
    // Yield to event loop so progress bar re-renders
    await new Promise(r => setTimeout(r, 0));

    try {
      const raw = RUNNERS[def.key]?.(bbParsed, cliParsed, tuningParams ?? {});
      const { score, level, noData, noDataMessage } = extractScore(raw);
      results[def.key] = { score, level, result: raw, error: null, skipped: false, noData: noData ?? false, noDataMessage };
    } catch (err) {
      console.warn(`[analyzeAll] ${def.key} failed:`, err);
      results[def.key] = { score: null, level: 'unknown', result: null, error: err.message, skipped: false, noData: false };
    }
  }

  // Mark ineligible tools as skipped — include WHY
  TOOL_DEFS.filter(def => !eligible.includes(def)).forEach(def => {
    let skipReason = 'Upload required files';
    if (def.needsCli && !hasCli && def.needsBb && !hasBb) skipReason = 'Needs CLI dump + BBL log';
    else if (def.needsCli && !hasCli) skipReason = 'Needs CLI dump';
    else if (def.needsBb  && !hasBb)  skipReason = 'Needs BBL log';
    results[def.key] = { score: null, level: 'unknown', result: null, error: null, skipped: true, skipReason, dataHint: def.dataHint };
  });

  onProgress?.(eligible.length, eligible.length, null);
  return results;
}

/**
 * Compute an overall score from all tool results (0-100).
 */
export function computeOverallScore(summaryResults) {
  const scored = Object.values(summaryResults).filter(r => r.score !== null && !r.skipped);
  if (!scored.length) return null;
  return Math.round(scored.reduce((acc, r) => acc + r.score, 0) / scored.length);
}

/**
 * Collect all recommendations and cliChanges from every tool result.
 * Returns { allRecommendations: [{tool, text, level}], allCliChanges: {key:value} }
 */
export function aggregateResults(summaryResults) {
  const allRecommendations = [];
  const allCliChanges = {};

  const LABEL = {
    advanced_pid:'Advanced PID', motor_doctor:'Motor Doctor', throttle_axis:'Throttle Axis',
    noise_profile:'Noise Profile', tpa:'TPA', prop_wash:'Prop Wash', anti_gravity:'Anti-Gravity',
    iterm:'I-Term', feedforward:'Feedforward', filter_analyzer:'Filter Analyzer',
    pid_multiplier:'PID Multiplier', thrust_linear:'Thrust Linear', pid_contribution:'PID Contribution',
    stick_analyzer:'Stick Analyzer', dynamic_idle:'Dynamic Idle',
  };

  for (const [key, r] of Object.entries(summaryResults)) {
    if (r.skipped || r.error || !r.result) continue;
    const res = r.result;

    // Recommendations
    if (Array.isArray(res.recommendations)) {
      for (const text of res.recommendations) {
        allRecommendations.push({ tool: LABEL[key] ?? key, text, level: r.level ?? 'good' });
      }
    }
    // Axis-level recommendations (e.g. advancedPidHealth.axes[].healthScore)
    if (res.axes) {
      for (const [, axRes] of Object.entries(res.axes)) {
        if (Array.isArray(axRes.recommendations)) {
          for (const text of axRes.recommendations) {
            allRecommendations.push({ tool: LABEL[key] ?? key, text, level: r.level ?? 'good' });
          }
        }
      }
    }

    // CLI changes — later entries overwrite earlier ones for the same key
    if (res.cliChanges && typeof res.cliChanges === 'object') {
      Object.assign(allCliChanges, res.cliChanges);
    }
  }

  return { allRecommendations, allCliChanges };
}

/**
 * Render aggregated cliChanges as a copy-paste Betaflight CLI snippet.
 * profileSettings: keys that must go inside `profile N` block.
 */
export function renderCLI(allCliChanges, profileNum = 0) {
  if (!allCliChanges || !Object.keys(allCliChanges).length) return null;

  const PROFILE_KEYS = new Set([
    'p_roll','i_roll','d_roll','f_roll','d_min_roll',
    'p_pitch','i_pitch','d_pitch','f_pitch','d_min_pitch',
    'p_yaw','i_yaw','d_yaw','f_yaw','d_min_yaw',
    'tpa_rate','tpa_breakpoint','tpa_mode','tpa_low_rate','tpa_low_breakpoint',
    'anti_gravity_gain','anti_gravity_cutoff_hz','anti_gravity_p_gain',
    'feedforward_transition','feedforward_averaging','feedforward_smooth_factor',
    'feedforward_jitter_factor','feedforward_boost','feedforward_max_rate_limit',
    'iterm_relax','iterm_relax_type','iterm_relax_cutoff','iterm_windup','iterm_limit',
    'dterm_lpf1_static_hz','dterm_lpf1_dyn_min_hz','dterm_lpf1_dyn_max_hz','dterm_lpf1_type',
    'dterm_lpf2_static_hz','dterm_lpf2_type',
    'dyn_idle_min_rpm','dyn_idle_p_gain','dyn_idle_i_gain','dyn_idle_d_gain','dyn_idle_max_increase',
    'thrust_linear','throttle_boost','throttle_boost_cutoff',
    'simplified_master_multiplier','simplified_i_gain','simplified_d_gain','simplified_pi_gain',
    'pidsum_limit','pidsum_limit_yaw',
  ]);

  const profileEntries = Object.entries(allCliChanges).filter(([k]) => PROFILE_KEYS.has(k));
  const masterEntries  = Object.entries(allCliChanges).filter(([k]) => !PROFILE_KEYS.has(k));

  const lines = [
    `# Generated by Betaflight Tuning Assist — ${new Date().toISOString().slice(0, 10)}`,
    `# Review all values before applying!`,
    '',
    'batch start',
    '',
  ];

  if (profileEntries.length) {
    lines.push(`profile ${profileNum}`, '');
    for (const [k, v] of profileEntries) lines.push(`set ${k} = ${v}`);
    lines.push('');
  }
  if (masterEntries.length) {
    lines.push('# Master settings (apply outside profile)');
    for (const [k, v] of masterEntries) lines.push(`set ${k} = ${v}`);
    lines.push('');
  }

  lines.push('batch end', '', 'save');
  return lines.join('\n');
}

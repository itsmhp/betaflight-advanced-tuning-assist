/**
 * tuningPipeline.js
 * State machine for the sequential gate-locked tuning pipeline.
 * Enforces the correct tuning order:
 *   Noise → Filters → PIDs → Feedforward → TPA → Anti-Gravity → Verification
 *
 * No UI code in this file — pure logic.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Stage definitions
// ─────────────────────────────────────────────────────────────────────────────
export const TUNING_STAGES = [
  {
    id: 'noise',
    index: 0,
    title: 'Noise Analysis',
    icon: '🔊',
    description:
      'Identify motor/ESC noise sources before anything else. Noisy motors make PID tuning impossible.',
    analyzerKeys: ['noise_profile', 'motor_doctor'],
    requiredData: ['blackbox'],
  },
  {
    id: 'filters',
    index: 1,
    title: 'Filter Tuning',
    icon: '🎛️',
    description:
      'Set gyro/D-term lowpass and RPM filters. Filters must be correct before PIDs are touched.',
    analyzerKeys: ['filter_analyzer', 'dynamic_idle'],
    requiredData: ['blackbox', 'cli'],
  },
  {
    id: 'pids',
    index: 2,
    title: 'PID Tuning',
    icon: '⚙️',
    description:
      'Tune P, I, D gains per axis. Only accurate after noise and filters are resolved.',
    analyzerKeys: ['advanced_pid', 'pid_contribution', 'pid_multiplier'],
    requiredData: ['blackbox', 'cli'],
  },
  {
    id: 'feedforward',
    index: 3,
    title: 'Feedforward',
    icon: '🎯',
    description:
      'Tune stick response and feedforward transition for the desired feel.',
    analyzerKeys: ['feedforward', 'stick_analyzer'],
    requiredData: ['blackbox'],
  },
  {
    id: 'tpa',
    index: 4,
    title: 'TPA & Thrust',
    icon: '📈',
    description:
      'Throttle PID Attenuation — prevent oscillation at full throttle. Linearise motor response.',
    analyzerKeys: ['tpa', 'thrust_linear'],
    requiredData: ['blackbox', 'cli'],
  },
  {
    id: 'antiGravity',
    index: 5,
    title: 'Anti-Gravity & I-term',
    icon: '🚀',
    description:
      'Compensate for I-term drop during quick throttle punches. Prevent I-term windup.',
    analyzerKeys: ['anti_gravity', 'iterm'],
    requiredData: ['blackbox'],
  },
  {
    id: 'verification',
    index: 6,
    title: 'Verification',
    icon: '✅',
    description:
      'Final review — compare all before/after values, generate CLI output, and plan test flight.',
    analyzerKeys: ['prop_wash', 'throttle_axis'],
    requiredData: ['blackbox', 'cli'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stage status enum
// ─────────────────────────────────────────────────────────────────────────────
export const STAGE_STATUS = {
  LOCKED: 'locked',
  ACTIVE: 'active',
  PENDING_CONFIRM: 'pending',
  COMPLETED: 'completed',
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state factory
// ─────────────────────────────────────────────────────────────────────────────
export const createInitialPipelineState = () => ({
  stages: TUNING_STAGES.map((stage, i) => ({
    ...stage,
    status: i === 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.LOCKED,
    userConfirmed: false,
    appliedRecommendations: [],
    skippedWithWarning: false,
    completedAt: null,
  })),
  activeStageIndex: 0,
  sessionStarted: new Date().toISOString(),
  allCompleted: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
export const pipelineReducer = (state, action) => {
  switch (action.type) {
    case 'CONFIRM_STAGE': {
      const { stageIndex } = action.payload;
      const newStages = [...state.stages];

      newStages[stageIndex] = {
        ...newStages[stageIndex],
        status: STAGE_STATUS.COMPLETED,
        userConfirmed: true,
        completedAt: new Date().toISOString(),
      };

      if (stageIndex + 1 < newStages.length) {
        newStages[stageIndex + 1] = {
          ...newStages[stageIndex + 1],
          status: STAGE_STATUS.ACTIVE,
        };
      }

      const nextIndex =
        stageIndex + 1 < newStages.length ? stageIndex + 1 : stageIndex;
      const allCompleted = newStages.every(
        (s) => s.status === STAGE_STATUS.COMPLETED
      );

      return {
        ...state,
        stages: newStages,
        activeStageIndex: nextIndex,
        allCompleted,
      };
    }

    case 'SKIP_STAGE_WITH_WARNING': {
      const { stageIndex } = action.payload;
      const newStages = [...state.stages];

      newStages[stageIndex] = {
        ...newStages[stageIndex],
        status: STAGE_STATUS.COMPLETED,
        skippedWithWarning: true,
        completedAt: new Date().toISOString(),
      };

      if (stageIndex + 1 < newStages.length) {
        newStages[stageIndex + 1] = {
          ...newStages[stageIndex + 1],
          status: STAGE_STATUS.ACTIVE,
        };
      }

      const nextIndex =
        stageIndex + 1 < newStages.length ? stageIndex + 1 : stageIndex;
      const allCompleted = newStages.every(
        (s) => s.status === STAGE_STATUS.COMPLETED
      );

      return {
        ...state,
        stages: newStages,
        activeStageIndex: nextIndex,
        allCompleted,
      };
    }

    case 'MARK_RECOMMENDATION_APPLIED': {
      const { stageIndex, command } = action.payload;
      const newStages = [...state.stages];
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        appliedRecommendations: [
          ...newStages[stageIndex].appliedRecommendations,
          command,
        ],
      };
      return { ...state, stages: newStages };
    }

    case 'UNMARK_RECOMMENDATION': {
      const { stageIndex, command } = action.payload;
      const newStages = [...state.stages];
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        appliedRecommendations: newStages[stageIndex].appliedRecommendations.filter(
          (c) => c !== command
        ),
      };
      return { ...state, stages: newStages };
    }

    case 'RESET_FROM_STAGE': {
      const { fromIndex } = action.payload;
      const newStages = state.stages.map((stage, i) => {
        if (i < fromIndex) return stage;
        if (i === fromIndex)
          return {
            ...stage,
            status: STAGE_STATUS.ACTIVE,
            userConfirmed: false,
            appliedRecommendations: [],
            skippedWithWarning: false,
            completedAt: null,
          };
        return {
          ...stage,
          status: STAGE_STATUS.LOCKED,
          userConfirmed: false,
          appliedRecommendations: [],
          skippedWithWarning: false,
          completedAt: null,
        };
      });
      return {
        ...state,
        stages: newStages,
        activeStageIndex: fromIndex,
        allCompleted: false,
      };
    }

    case 'RESET_ALL': {
      return createInitialPipelineState();
    }

    case 'LOAD_STATE': {
      return { ...action.payload };
    }

    default:
      return state;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recommendations from analysisResults for a specific stage.
 * Merges recommendations from all analyzerKeys of the stage.
 */
export const getStageRecommendations = (stage, analysisResults) => {
  if (!analysisResults || !stage.analyzerKeys) return [];

  const recs = [];
  for (const key of stage.analyzerKeys) {
    const toolResult = analysisResults[key];
    if (!toolResult || toolResult.skipped || !toolResult.result) continue;

    const raw = toolResult.result;

    // Top-level recommendations
    if (Array.isArray(raw.recommendations)) {
      for (const rec of raw.recommendations) {
        recs.push({
          id: `${key}-${recs.length}`,
          tool: key,
          message: typeof rec === 'string' ? rec : rec.message ?? String(rec),
          cliCommand: typeof rec === 'object' ? rec.command : null,
          severity: typeof rec === 'object' ? rec.severity : 'info',
          param: typeof rec === 'object' ? rec.param : null,
          currentValue: typeof rec === 'object' ? rec.currentValue : null,
          suggestedValue: typeof rec === 'object' ? rec.suggestedValue : null,
        });
      }
    }

    // Per-axis recommendations (advancedPidHealth style)
    if (raw.axes) {
      for (const [axis, axRes] of Object.entries(raw.axes)) {
        if (Array.isArray(axRes.recommendations)) {
          for (const rec of axRes.recommendations) {
            recs.push({
              id: `${key}-${axis}-${recs.length}`,
              tool: key,
              message: typeof rec === 'string' ? rec : rec.message ?? String(rec),
              cliCommand: typeof rec === 'object' ? rec.command : null,
              severity: typeof rec === 'object' ? rec.severity : 'info',
            });
          }
        }
      }
    }

    // CLI changes as recommendations
    if (raw.cliChanges && typeof raw.cliChanges === 'object') {
      for (const [param, value] of Object.entries(raw.cliChanges)) {
        const existing = recs.find(
          (r) => r.cliCommand && r.cliCommand.includes(param)
        );
        if (!existing) {
          recs.push({
            id: `${key}-cli-${param}`,
            tool: key,
            message: `Set ${param} = ${value}`,
            cliCommand: `set ${param} = ${value}`,
            severity: 'info',
            param,
            currentValue: null,
            suggestedValue: value,
          });
        }
      }
    }
  }

  return recs;
};

/**
 * Check if data required by a stage is available.
 */
export const stageDataReady = (stage, bbParsed, cliParsed) => {
  if (stage.requiredData.includes('blackbox') && !bbParsed) return false;
  if (stage.requiredData.includes('cli') && !cliParsed) return false;
  return true;
};

/**
 * Get stage health score (average of its analyzer scores).
 */
export const getStageHealthScore = (stage, analysisResults) => {
  if (!analysisResults || !stage.analyzerKeys) return null;
  const scores = [];
  for (const key of stage.analyzerKeys) {
    const r = analysisResults[key];
    if (r && r.score !== null && !r.skipped) scores.push(r.score);
  }
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

/**
 * Get stage health level from score.
 */
export const getStageHealthLevel = (score) => {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
};

/**
 * Get stage issues (critical + warning findings) from analysisResults.
 */
export const getStageIssues = (stage, analysisResults) => {
  if (!analysisResults || !stage.analyzerKeys) return [];
  const issues = [];
  for (const key of stage.analyzerKeys) {
    const r = analysisResults[key];
    if (!r || r.skipped || !r.level) continue;
    if (r.level === 'critical' || r.level === 'warning') {
      issues.push({
        tool: key,
        level: r.level,
        score: r.score,
        summary: r.result?.message || r.result?.summary || `${key}: ${r.level}`,
      });
    }
  }
  return issues;
};

/**
 * Count completed stages.
 */
export const countCompleted = (stages) =>
  stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length;

/**
 * Skip warning messages per stage — explains why skipping is dangerous.
 */
export const SKIP_WARNINGS = {
  noise:
    'Skipping noise analysis means your PIDs and filters will be tuned on top of unresolved noise. This often leads to motor heating, oscillations, and incorrect PID values that feel "off". Strongly not recommended.',
  filters:
    'Filters must be correct before PID values mean anything. PIDs tuned without proper filtering are unreliable and may cause motor overheating.',
  pids:
    'PID values are the core of how your quad flies. Skipping this stage means relying on defaults or previous values. Proceed only if you are experimenting.',
  feedforward:
    'Feedforward affects stick responsiveness. Skipping it means the quad may feel sluggish or overshoot on quick moves.',
  tpa:
    'Without TPA tuning, the quad may oscillate at high throttle. This is especially dangerous on powerful builds.',
  antiGravity:
    'Skipping Anti-Gravity tuning may cause attitude wobbles during rapid throttle changes like punch-outs and drops.',
  verification:
    'The verification stage summarizes all changes and provides a test flight checklist. Skipping it means flying without a final review.',
};

// ─────────────────────────────────────────────────────────────────────────────
// localStorage persistence helpers
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tuningPipeline';

export const savePipelineState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
};

export const loadPipelineState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic validation
    if (parsed && Array.isArray(parsed.stages) && parsed.stages.length === TUNING_STAGES.length) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

export const clearPipelineState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

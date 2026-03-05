const AI_CACHE_KEY = 'btfl_ai_insight_cache_v1';

const normalizeForHash = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeForHash(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const makeCacheKey = (stageId, analysisData, droneProfile, cliData, lang) => {
  const normalized = normalizeForHash({ stageId, analysisData, droneProfile, cliData, lang });
  return btoa(unescape(encodeURIComponent(JSON.stringify(normalized)))).slice(0, 180);
};

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeCache = (cache) => {
  try {
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / privacy errors
  }
};

const formatAnalysisForAI = (analysisData) => {
  if (!analysisData) return 'No analysis data available';
  const summary = {
    score: analysisData.score,
    level: analysisData.level,
    recommendationCount: analysisData.recommendations?.length || 0,
    noData: !!analysisData.noData,
    skipped: !!analysisData.skipped,
    summary: analysisData.summary,
    metrics: analysisData.metrics || null,
  };
  return JSON.stringify(summary, null, 2);
};

const formatCLIForAI = (stageId, cliData) => {
  if (!cliData) return 'No CLI data available';

  const relevantParams = {
    noise: ['gyro_lowpass_hz', 'gyro_lowpass2_hz', 'motor_pwm_protocol', 'dshot_idle_value', 'rpm_filter_harmonics'],
    filters: ['gyro_lowpass_hz', 'gyro_lowpass2_hz', 'dterm_lowpass_hz', 'dterm_lowpass2_hz', 'dyn_notch_count', 'dyn_notch_min_hz', 'dyn_notch_max_hz'],
    pids: ['p_roll', 'i_roll', 'd_roll', 'f_roll', 'p_pitch', 'i_pitch', 'd_pitch', 'f_pitch', 'p_yaw', 'i_yaw', 'd_yaw'],
    feedforward: ['feedforward_transition', 'feedforward_averaging', 'feedforward_smooth_factor', 'f_roll', 'f_pitch'],
    tpa: ['tpa_rate', 'tpa_breakpoint', 'tpa_mode'],
    antiGravity: ['anti_gravity_gain', 'anti_gravity_mode', 'anti_gravity_cutoff_hz'],
  };

  const params = relevantParams[stageId] || [];
  return params.map((param) => `${param} = ${cliData[param] ?? 'not set'}`).join('\n');
};

const buildStagePrompt = (stageId, analysisData, droneProfile, cliData) => {
  const hardwareContext = `
Drone Hardware:
- Craft Name: ${droneProfile?.craftName || 'N/A'}
- Frame: ${droneProfile?.frameSize || 'N/A'}
- Motor: ${droneProfile?.motorStator || 'N/A'} ${droneProfile?.motorKv || ''}KV
- Props: ${droneProfile?.propSize || 'N/A'}
- Battery: ${droneProfile?.batteryCells || 'N/A'}S
- ESC Protocol: ${droneProfile?.escProtocol || 'N/A'}
- FC: ${droneProfile?.fcName || 'N/A'}
- Weight: ${droneProfile?.auwGrams || 'N/A'}g
- Flying Style: ${droneProfile?.flyingStyle || 'N/A'}
  `.trim();

  const analysisContext = formatAnalysisForAI(analysisData);
  const cliContext = formatCLIForAI(stageId, cliData);

  return `
${hardwareContext}

Current ${stageId.toUpperCase()} Analysis Results:
${analysisContext}

Current Betaflight Settings (from CLI dump):
${cliContext}

Please analyze this data and provide:
1. Main issue and WHY it matters for this build
2. Specific recommended changes with exact values
3. What pilot should expect to feel/hear after applying changes
4. Risks or things to watch out for

Be specific to this drone hardware and avoid generic advice.
  `.trim();
};

export const generateAIInsight = async ({
  stageId,
  analysisData,
  droneProfile,
  cliData,
  lang = 'en',
  apiKey,
}) => {
  if (!apiKey) {
    return {
      ok: false,
      error: 'Missing Anthropic API key. Set one in the AI panel first.',
      text: null,
      cached: false,
    };
  }

  const cacheKey = makeCacheKey(stageId, analysisData, droneProfile, cliData, lang);
  const cache = readCache();
  if (cache[cacheKey]) {
    return { ok: true, text: cache[cacheKey], cached: true, error: null };
  }

  const systemPrompt = `You are an expert FPV drone tuning assistant with deep knowledge of Betaflight.
You analyze blackbox flight data and provide specific, actionable recommendations.
Always explain WHY a change is needed, not just WHAT to change.
Be concise but technical. Target audience: intermediate to advanced FPV pilots.
Always output in the same language as the user's app language setting (${lang}).`;

  const userPrompt = buildStagePrompt(stageId, analysisData, droneProfile, cliData);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false,
      error: `Anthropic API error (${response.status}): ${errText.slice(0, 300)}`,
      text: null,
      cached: false,
    };
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text || 'No AI output returned.';

  cache[cacheKey] = text;
  writeCache(cache);

  return {
    ok: true,
    text,
    cached: false,
    error: null,
  };
};

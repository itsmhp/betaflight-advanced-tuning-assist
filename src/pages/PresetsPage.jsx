import { useState, useMemo } from 'react';
import {
  Copy, Check, Terminal, BookMarked, Info, ChevronDown, ChevronUp,
  Cpu, Sparkles, AlertTriangle
} from 'lucide-react';
import { FRAME_SIZE_META, getPresetsForSize, renderPresetCLI } from '../lib/presets';
import { applySmartAdjustments } from '../lib/smartPresets';
import { useDroneProfile } from '../context/DroneProfileContext';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/LangContext';

const SIZE_KEYS = Object.keys(FRAME_SIZE_META);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function CopyButton({ cli }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(cli).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
        copied ? 'bg-green-700 text-green-100' : 'bg-indigo-700 hover:bg-indigo-600 text-white'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy CLI'}
    </button>
  );
}

function SettingsGrid({ title, settings, color }) {
  if (!settings || Object.keys(settings).length === 0) return null;
  const colorMap = {
    violet: 'border-violet-700/50 bg-violet-900/20 text-violet-400',
    blue:   'border-blue-700/50 bg-blue-900/20 text-blue-400',
    cyan:   'border-cyan-700/50 bg-cyan-900/20 text-cyan-400',
  };
  const c = colorMap[color] ?? colorMap.violet;
  return (
    <div className={`border rounded-lg overflow-hidden ${c.split(' ')[0]}`}>
      <div className={`px-3 py-1 text-xs font-medium ${c.split(' ').slice(1).join(' ')}`}>{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-700/30">
        {Object.entries(settings).map(([k, v]) => (
          <div key={k} className="bg-gray-800/60 px-2.5 py-1.5">
            <div className="text-xs font-mono text-gray-400 truncate">{k}</div>
            <div className="text-sm font-semibold text-white">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Level Preset Card
// ─────────────────────────────────────────────────────────────────────────────
function PresetCard({ preset }) {
  const [expanded, setExpanded] = useState(false);
  const [showCli, setShowCli] = useState(false);
  const cli = useMemo(() => renderPresetCLI(preset), [preset]);

  const levelColors = {
    low:    'from-blue-600/20 to-blue-500/10 border-blue-700/40',
    medium: 'from-violet-600/20 to-violet-500/10 border-violet-700/40',
    high:   'from-orange-600/20 to-orange-500/10 border-orange-700/40',
    ultra:  'from-red-600/20 to-red-500/10 border-red-700/40',
  };
  const bg = levelColors[preset.level] ?? levelColors.medium;

  const settingCount = Object.keys({
    ...(preset.profileSettings ?? {}),
    ...(preset.masterSettings  ?? {}),
  }).length;

  return (
    <div className={`bg-gradient-to-br ${bg} border rounded-xl overflow-hidden`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl select-none">{preset.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold text-sm">{preset.levelLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${preset.badgeColor}`}>
                  {preset.badge}
                </span>
                {preset.isAdjusted && (
                  <span className="flex items-center gap-1 text-xs text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40">
                    <Sparkles size={10} />
                    Smart
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{preset.subtitle}</p>
            </div>
          </div>
          <span className="text-gray-500 mt-1 shrink-0">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-2">{settingCount} parameters</div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">

          {/* Smart adjustments */}
          {(preset.adjustments ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                <Sparkles size={12} /> Smart Adjustments ({preset.adjustments.length})
              </p>
              {preset.adjustments.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                  a.type === 'warning'
                    ? 'bg-amber-900/30 text-amber-200 border border-amber-700/40'
                    : 'bg-blue-900/30 text-blue-200 border border-blue-700/40'
                }`}>
                  {a.type === 'warning' ? <AlertTriangle size={11} className="mt-0.5 shrink-0" /> : <Info size={11} className="mt-0.5 shrink-0" />}
                  <span><strong>{a.topic}:</strong> {a.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warning */}
          {preset.highlight && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-2.5 py-1.5">
              <Info size={11} className="shrink-0" />
              <span>{preset.highlight}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCli(v => !v)}
              className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Terminal size={12} />
              {showCli ? 'Hide' : `View ${settingCount} Settings`}
            </button>
            <CopyButton cli={cli} />
          </div>

          {/* Settings sections */}
          {showCli && (
            <div className="space-y-3">
              <SettingsGrid title="Profile / PID Settings" settings={preset.profileSettings} color="violet" />
              <SettingsGrid title="Master / Gyro Settings" settings={preset.masterSettings}  color="blue"   />
              <div>
                <p className="text-xs text-gray-400 mb-1">CLI Preview</p>
                <pre className="bg-gray-950 rounded-lg p-3 text-xs text-green-300 font-mono overflow-x-auto max-h-52 select-all">
                  {cli}
                </pre>
              </div>
            </div>
          )}

          {/* Paste instruction */}
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-700/30 rounded-lg p-2.5">
            <Terminal size={11} className="mt-0.5 shrink-0 text-indigo-400" />
            <span>
              Betaflight Configurator → <strong className="text-gray-200">CLI</strong> tab → paste → press Enter. Auto-saves via <code className="bg-gray-700 px-1 rounded">save</code>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame Size Panel (4 level cards)
// ─────────────────────────────────────────────────────────────────────────────
function FrameSizePanel({ sizeKey, analysisResults }) {
  const basePresets = useMemo(() => getPresetsForSize(sizeKey), [sizeKey]);
  const smart = useMemo(
    () => basePresets.map(p => applySmartAdjustments(p, analysisResults)),
    [basePresets, analysisResults]
  );
  const hasAny = smart.some(p => p.isAdjusted);

  return (
    <div className="space-y-3">
      {hasAny && (
        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-3 py-2">
          <Sparkles size={12} className="shrink-0" />
          <span>Smart adjustments applied from your blackbox analysis.</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {smart.map(p => <PresetCard key={p.id} preset={p} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PresetsPage() {
  const { profile, inferredFrameClass } = useDroneProfile();
  const { analysisResults } = useData();
  const { t } = useLang();

  // Default active tab = drone's inferred frame class (or 5inch)
  const defaultTab = SIZE_KEYS.includes(inferredFrameClass) ? inferredFrameClass : '5inch';
  const [activeSize, setActiveSize] = useState(defaultTab);

  const sizeMeta = FRAME_SIZE_META[activeSize];

  const hasAnalysis = analysisResults && Object.keys(analysisResults).length > 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BookMarked size={22} className="text-cyan-400 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">Tuning Presets</h1>
            <p className="text-sm text-gray-400">{t('subtitle_presets')}</p>
          </div>
        </div>
        {/* Drone profile badge */}
        {profile.craftName && (
          <div className="flex items-center gap-2 bg-violet-900/30 border border-violet-700/40 rounded-xl px-3 py-2 text-xs text-violet-200">
            <Cpu size={13} className="text-violet-400 shrink-0" />
            <span>
              <strong>{profile.craftName}</strong>
              {profile.frameSize ? ` · ${profile.frameSize}` : ''}
              {profile.motorStator ? ` · ${profile.motorStator}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Safety notice ── */}
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-200 leading-relaxed">
        <strong className="text-amber-300">⚠ {t('label_safety')}</strong> {t('warning_presets_safety')}
        {hasAnalysis && (
          <span className="text-emerald-300">
            {' '}{t('msg_smart_active')}
          </span>
        )}
      </div>

      {/* ── Frame size tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {SIZE_KEYS.map(key => {
          const meta       = FRAME_SIZE_META[key];
          const isActive   = key === activeSize;
          const isDrone    = key === inferredFrameClass;
          return (
            <button
              key={key}
              onClick={() => setActiveSize(key)}
              className={`relative text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                isActive
                  ? 'bg-violet-700 border-violet-500 text-white shadow-lg shadow-violet-900/40'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {meta.label.split(' ')[0]}
              {isDrone && (
                <span className="absolute -top-1. -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-gray-950 text-[0px]">·</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active size header ── */}
      <div className={`bg-gradient-to-r ${sizeMeta.accentColor} p-px rounded-xl`}>
        <div className="bg-gray-900 rounded-[calc(0.75rem-1px)] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-base">{sizeMeta.label}</h2>
              {activeSize === inferredFrameClass && (
                <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                  {t('badge_your_quad')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {sizeMeta.tags.map(t => (
                <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">{t}</span>
              ))}
            </div>
          </div>
          {hasAnalysis && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300">
              <Sparkles size={12} /> {t('label_smart_presets_active')}
            </span>
          )}
        </div>
      </div>

      {/* ── Preset cards for selected size ── */}
      <FrameSizePanel sizeKey={activeSize} analysisResults={analysisResults} />

      {/* ── Footer ── */}
      <div className="border-t border-gray-800 pt-4 text-xs text-gray-500 space-y-2">
        <p>
          {t('footer_presets_info')}
        </p>
        <p>
          {t('link_rate_profiles')}? <a href="#/rates" className="text-violet-400 hover:underline">{t('link_rate_profiles')}</a>
        </p>
      </div>
    </div>
  );
}

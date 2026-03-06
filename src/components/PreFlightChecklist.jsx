import { useState, useEffect } from 'react';
import {
  CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp,
  Wifi, HardDrive, Settings, Plane, Wrench
} from 'lucide-react';

const STORAGE_KEY = 'preFlightChecklist';

const CHECKLIST_SECTIONS = [
  {
    id: 'blackbox',
    title: 'Blackbox Setup',
    icon: HardDrive,
    color: 'text-violet-400',
    items: [
      { id: 'bb_enabled',  label: 'Blackbox logging enabled in Betaflight',     hint: 'Configuration → Other Features → BLACKBOX' },
      { id: 'bb_rate',     label: 'Logging rate set (recommended: 2kHz+)',       hint: 'Higher rate = better data, but larger file' },
      { id: 'bb_storage',  label: 'SD card / flash chip has free space',         hint: 'Check in CLI: "flash_info" or insert SD card' },
      { id: 'bb_debug',    label: 'Debug mode set (GYRO_SCALED recommended)',    hint: 'set debug_mode = GYRO_SCALED for noise analysis' },
    ],
  },
  {
    id: 'flight',
    title: 'Flight Conditions',
    icon: Plane,
    color: 'text-cyan-400',
    items: [
      { id: 'fl_wind',     label: 'Low wind conditions (< 10 km/h)',            hint: 'Wind adds noise that isn\'t from your quad' },
      { id: 'fl_battery',  label: 'Fresh fully charged battery',                hint: 'Low battery = inconsistent motor performance' },
      { id: 'fl_props',    label: 'Props balanced and undamaged',               hint: 'Damaged props create vibrations that skew data' },
      { id: 'fl_hover',    label: 'Plan: include hover + forward flight + flips', hint: 'Varied flying gives analyzers best data' },
    ],
  },
  {
    id: 'settings',
    title: 'Betaflight Settings',
    icon: Settings,
    color: 'text-amber-400',
    items: [
      { id: 'bf_stock',    label: 'Start with stock / default PID settings',    hint: 'Reset to defaults first for clean baseline' },
      { id: 'bf_filters',  label: 'Filters at default (or note custom ones)',   hint: 'Pipeline will recommend filter changes' },
      { id: 'bf_cli',      label: 'CLI dump saved (paste "dump" in CLI tab)',    hint: 'Upload CLI dump on the Dashboard for full analysis' },
      { id: 'bf_motor',    label: 'Motor direction & ESC protocol verified',    hint: 'Wrong motor direction = immediate crash' },
    ],
  },
  {
    id: 'hardware',
    title: 'Hardware Check',
    icon: Wrench,
    color: 'text-green-400',
    items: [
      { id: 'hw_fc_mount', label: 'FC soft-mounted / no loose screws',          hint: 'FC vibration = noisy gyro data' },
      { id: 'hw_motors',   label: 'Motors spin freely, no bearing noise',       hint: 'Bad bearings add noise at specific frequencies' },
      { id: 'hw_frame',    label: 'Frame tight, no cracked arms',               hint: 'Loose frame = resonance spikes in blackbox' },
      { id: 'hw_antenna',  label: 'VTX / RX antenna secured',                   hint: 'Dangling antennas = vibrations in flight' },
    ],
  },
];

function loadChecked() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveChecked(checked) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)); } catch {}
}

export default function PreFlightChecklist({ onReady }) {
  const [checked, setChecked] = useState(() => loadChecked());
  const [expandedSections, setExpandedSections] = useState(() =>
    Object.fromEntries(CHECKLIST_SECTIONS.map(s => [s.id, true]))
  );

  useEffect(() => { saveChecked(checked); }, [checked]);

  const totalItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allDone = checkedCount === totalItems;
  const pct = Math.round((checkedCount / totalItems) * 100);

  const toggleItem = (id) => setChecked(prev => {
    const next = { ...prev, [id]: !prev[id] };
    return next;
  });

  const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const resetAll = () => {
    if (confirm('Reset all checklist items?')) setChecked({});
  };

  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            Pre-Tune Checklist
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Complete these before flying for best analysis results.
          </p>
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold ${allDone ? 'text-emerald-400' : 'text-gray-300'}`}>{pct}%</span>
          <p className="text-[10px] text-gray-500">{checkedCount}/{totalItems} items</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Sections */}
      {CHECKLIST_SECTIONS.map(section => {
        const Icon = section.icon;
        const sectionChecked = section.items.filter(i => checked[i.id]).length;
        const sectionDone = sectionChecked === section.items.length;
        const isOpen = expandedSections[section.id];

        return (
          <div key={section.id} className="border border-gray-700/40 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <Icon size={14} className={section.color} />
              <span className="flex-1 text-sm font-medium text-gray-200">{section.title}</span>
              <span className={`text-xs font-medium ${sectionDone ? 'text-emerald-400' : 'text-gray-500'}`}>
                {sectionChecked}/{section.items.length}
              </span>
              {isOpen ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-3 space-y-1">
                {section.items.map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group"
                  >
                    <button
                      onClick={(e) => { e.preventDefault(); toggleItem(item.id); }}
                      className="mt-0.5 shrink-0"
                    >
                      {checked[item.id]
                        ? <CheckCircle2 size={15} className="text-emerald-400" />
                        : <Circle size={15} className="text-gray-600 group-hover:text-gray-400" />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium ${checked[item.id] ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                        {item.label}
                      </p>
                      {item.hint && (
                        <p className="text-[10px] text-gray-600 mt-0.5">{item.hint}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button onClick={resetAll} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Reset checklist
        </button>
        {allDone && (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={12} /> All checks complete — ready to tune!
          </span>
        )}
      </div>
    </div>
  );
}

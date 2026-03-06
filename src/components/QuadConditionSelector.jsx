import { useState } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Skull } from 'lucide-react';

/**
 * QuadConditionSelector — Lets pilot describe hardware condition.
 * Affects noise/filter stage recommendations (filter aggressiveness).
 */

const CONDITIONS = [
  {
    id: 'new',
    label: 'Brand New',
    emoji: '✨',
    icon: Sparkles,
    color: 'emerald',
    desc: 'Fresh build or newly rebuilt. Everything tight and clean.',
    filterMultiplier: 0.85,
    noiseExpected: 'low',
    hints: [
      'Filters can be less aggressive',
      'Lower D-term filtering possible',
      'Expect clean gyro signal',
    ],
  },
  {
    id: 'good',
    label: 'Good Condition',
    emoji: '👍',
    icon: ThumbsUp,
    color: 'cyan',
    desc: 'Well maintained. Some flights but no known issues.',
    filterMultiplier: 1.0,
    noiseExpected: 'moderate',
    hints: [
      'Standard filter recommendations',
      'Normal D-term filtering',
      'Typical noise levels expected',
    ],
  },
  {
    id: 'worn',
    label: 'Worn / Used',
    emoji: '⚠️',
    icon: AlertTriangle,
    color: 'amber',
    desc: 'Many flights. Props may be nicked, bearings getting rough.',
    filterMultiplier: 1.15,
    noiseExpected: 'elevated',
    hints: [
      'More aggressive filtering recommended',
      'Higher D-term filtering needed',
      'Expect elevated noise from bearings/props',
    ],
  },
  {
    id: 'damaged',
    label: 'Battle Damaged',
    emoji: '💀',
    icon: Skull,
    color: 'red',
    desc: 'Many crashes. Bent arms, rough motors, chipped props.',
    filterMultiplier: 1.3,
    noiseExpected: 'high',
    hints: [
      'Aggressive filtering required',
      'Consider RPM filtering if not enabled',
      'May need motor notch filters',
      'Repair hardware as soon as possible',
    ],
  },
];

const COLORS = {
  emerald: { bg: 'bg-emerald-900/30', border: 'border-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-300' },
  cyan:    { bg: 'bg-cyan-900/30',    border: 'border-cyan-500',    ring: 'ring-cyan-500/30',    text: 'text-cyan-300' },
  amber:   { bg: 'bg-amber-900/30',   border: 'border-amber-500',   ring: 'ring-amber-500/30',   text: 'text-amber-300' },
  red:     { bg: 'bg-red-900/30',     border: 'border-red-500',     ring: 'ring-red-500/30',     text: 'text-red-300' },
};

export function getConditionMultiplier(conditionId) {
  return CONDITIONS.find(c => c.id === conditionId)?.filterMultiplier ?? 1.0;
}

export function getConditionLabel(conditionId) {
  return CONDITIONS.find(c => c.id === conditionId)?.label ?? '';
}

export function getConditionHints(conditionId) {
  return CONDITIONS.find(c => c.id === conditionId)?.hints ?? [];
}

export default function QuadConditionSelector({ value, onChange }) {
  const selected = CONDITIONS.find(c => c.id === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-200">Quad Condition</span>
        <span className="text-[10px] text-gray-500">Affects noise & filter recommendations</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CONDITIONS.map(cond => {
          const isSelected = value === cond.id;
          const c = COLORS[cond.color];
          return (
            <button
              key={cond.id}
              onClick={() => onChange(cond.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? `${c.bg} ${c.border} ring-1 ${c.ring}`
                  : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{cond.emoji}</span>
                <span className={`text-xs font-semibold ${isSelected ? c.text : 'text-gray-300'}`}>{cond.label}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{cond.desc}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="bg-gray-800/30 border border-gray-700/40 rounded-lg p-3 space-y-2">
          <div className="flex gap-4 text-xs text-gray-400">
            <span>
              Filter aggression: <span className={selected.filterMultiplier > 1 ? 'text-amber-400' : selected.filterMultiplier < 1 ? 'text-green-400' : 'text-gray-300'}>
                {selected.filterMultiplier > 1 ? '+' : ''}{Math.round((selected.filterMultiplier - 1) * 100)}%
              </span>
            </span>
            <span>
              Expected noise: <span className="text-gray-300">{selected.noiseExpected}</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {selected.hints.map(h => (
              <span key={h} className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" /> {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

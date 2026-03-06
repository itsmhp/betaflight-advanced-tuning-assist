import { useState } from 'react';
import { Crosshair, Zap, Wind, Mountain, Flag, Film } from 'lucide-react';

/**
 * FlyingStyleSelector — Lets pilot choose their preferred flying feel.
 * Returns PID multipliers that adjust recommendations from the PID stage.
 */

const STYLES = [
  {
    id: 'locked',
    label: 'Locked In',
    emoji: '🎯',
    icon: Crosshair,
    color: 'violet',
    desc: 'Maximum authority. Quad snaps exactly where you point it.',
    multipliers: { p: 1.15, i: 1.1, d: 1.05, ff: 1.0 },
    traits: ['Sharp response', 'Minimal overshoot', 'Higher D needed'],
  },
  {
    id: 'flow',
    label: 'Flow',
    emoji: '🌊',
    icon: Wind,
    color: 'cyan',
    desc: 'Smooth transitions with gentle momentum. Great for gaps and lines.',
    multipliers: { p: 0.95, i: 0.9, d: 1.0, ff: 1.05 },
    traits: ['Smooth transitions', 'Slight momentum', 'Forgiving'],
  },
  {
    id: 'juicy',
    label: 'Juicy',
    emoji: '🧃',
    icon: Zap,
    color: 'orange',
    desc: 'Aggressive freestyle feel. Bouncy, energetic, with good pop.',
    multipliers: { p: 1.1, i: 0.85, d: 0.9, ff: 1.15 },
    traits: ['Bouncy feel', 'Fast FF response', 'Low I for float'],
  },
  {
    id: 'hangtime',
    label: 'Hangtime',
    emoji: '🪂',
    icon: Mountain,
    color: 'emerald',
    desc: 'Floaty feel with extended hangtime. Low I-term, gentle corrections.',
    multipliers: { p: 0.9, i: 0.7, d: 1.0, ff: 1.0 },
    traits: ['Low I-term float', 'Gentle corrections', 'Inverted float'],
  },
  {
    id: 'race',
    label: 'Race',
    emoji: '🏁',
    icon: Flag,
    color: 'red',
    desc: 'Precise and responsive. Maximum control authority for racing.',
    multipliers: { p: 1.1, i: 1.15, d: 1.1, ff: 0.95 },
    traits: ['Precise tracking', 'High authority', 'Fast corrections'],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    emoji: '🎬',
    icon: Film,
    color: 'blue',
    desc: 'Ultra smooth for filming. Dampened response, minimal jitter.',
    multipliers: { p: 0.85, i: 1.0, d: 1.15, ff: 0.85 },
    traits: ['Ultra smooth', 'High D filtering', 'Dampened response'],
  },
];

const COLORS = {
  violet: { bg: 'bg-violet-900/30', border: 'border-violet-500', ring: 'ring-violet-500/30', text: 'text-violet-300' },
  cyan:   { bg: 'bg-cyan-900/30',   border: 'border-cyan-500',   ring: 'ring-cyan-500/30',   text: 'text-cyan-300' },
  orange: { bg: 'bg-orange-900/30', border: 'border-orange-500', ring: 'ring-orange-500/30', text: 'text-orange-300' },
  emerald:{ bg: 'bg-emerald-900/30',border: 'border-emerald-500',ring: 'ring-emerald-500/30',text: 'text-emerald-300' },
  red:    { bg: 'bg-red-900/30',    border: 'border-red-500',    ring: 'ring-red-500/30',    text: 'text-red-300' },
  blue:   { bg: 'bg-blue-900/30',   border: 'border-blue-500',   ring: 'ring-blue-500/30',   text: 'text-blue-300' },
};

export function getStyleMultipliers(styleId) {
  return STYLES.find(s => s.id === styleId)?.multipliers ?? { p: 1, i: 1, d: 1, ff: 1 };
}

export function getStyleLabel(styleId) {
  return STYLES.find(s => s.id === styleId)?.label ?? '';
}

export default function FlyingStyleSelector({ value, onChange }) {
  const selected = STYLES.find(s => s.id === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-200">Flying Style</span>
        <span className="text-[10px] text-gray-500">Adjusts PID recommendations to match your feel</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STYLES.map(style => {
          const isSelected = value === style.id;
          const c = COLORS[style.color];
          return (
            <button
              key={style.id}
              onClick={() => onChange(style.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? `${c.bg} ${c.border} ring-1 ${c.ring}`
                  : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{style.emoji}</span>
                <span className={`text-xs font-semibold ${isSelected ? c.text : 'text-gray-300'}`}>{style.label}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{style.desc}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="bg-gray-800/30 border border-gray-700/40 rounded-lg p-3 space-y-2">
          <div className="flex gap-3 text-xs">
            {Object.entries(selected.multipliers).map(([k, v]) => (
              <span key={k} className="text-gray-400">
                <span className="text-gray-500 uppercase">{k}:</span>{' '}
                <span className={v > 1 ? 'text-green-400' : v < 1 ? 'text-amber-400' : 'text-gray-300'}>
                  {v > 1 ? '+' : ''}{Math.round((v - 1) * 100)}%
                </span>
              </span>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {selected.traits.map(t => (
              <span key={t} className="text-[10px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

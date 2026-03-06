import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Copy, Check, ChevronDown, ChevronUp, Plus, Trash2, Edit3, Save, X,
  Search, Filter, Tag, User, Award, Terminal, BarChart3, GitCompare
} from 'lucide-react';
import { COMMUNITY_RATES, QUAD_TYPES, RATE_TYPES, createEmptyRateProfile, loadCustomRates, saveCustomRates } from '../lib/communityRates';
import { calculateRateCurve, getPeakRate, generateRateCLI } from '../lib/rateCalculator';

// ─── Rate Curve Canvas ──────────────────────────────────────────────────────
function RateCurveCanvas({ rateProfile, height = 160 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = height * 2;
    ctx.scale(2, 2);
    const dw = w / 2;
    const dh = h / 2;

    ctx.clearRect(0, 0, dw, dh);

    // Background
    ctx.fillStyle = '#0f0e17';
    ctx.fillRect(0, 0, dw, dh);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (dh / 4) * i;
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(dw - 10, y); ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = 30 + ((dw - 40) / 4) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dh - 20); ctx.stroke();
    }

    // Axes labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0%', 30, dh - 5);
    ctx.fillText('50%', 30 + (dw - 40) / 2, dh - 5);
    ctx.fillText('100%', dw - 10, dh - 5);

    // Calculate curves
    const colors = { roll: '#6366f1', pitch: '#22c55e', yaw: '#f59e0b' };
    const axes = ['roll', 'pitch', 'yaw'];
    let maxDeg = 100;

    const allCurves = {};
    for (const axis of axes) {
      allCurves[axis] = calculateRateCurve(rateProfile, axis, 100);
      const peak = allCurves[axis][allCurves[axis].length - 1]?.output ?? 0;
      if (peak > maxDeg) maxDeg = peak;
    }
    maxDeg = Math.ceil(maxDeg / 100) * 100;
    if (maxDeg < 200) maxDeg = 200;

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'right';
    ctx.fillText(`${maxDeg}°/s`, 28, 10);
    ctx.fillText(`${Math.round(maxDeg / 2)}`, 28, dh / 2);
    ctx.fillText('0', 28, dh - 22);

    // Draw curves
    for (const axis of axes) {
      const curve = allCurves[axis];
      if (!curve.length) continue;
      ctx.strokeStyle = colors[axis];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < curve.length; i++) {
        const x = 30 + (curve[i].input / 100) * (dw - 40);
        const y = (dh - 22) - (curve[i].output / maxDeg) * (dh - 32);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Legend
    let lx = 40;
    for (const axis of axes) {
      ctx.fillStyle = colors[axis];
      ctx.fillRect(lx, 6, 10, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left';
      ctx.font = '8px sans-serif';
      ctx.fillText(axis.charAt(0).toUpperCase() + axis.slice(1), lx + 13, 10);
      lx += 50;
    }
  }, [rateProfile, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="rounded-lg"
    />
  );
}

// ─── Copy Button ────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy CLI' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
      copied ? 'bg-green-700 text-green-100' : 'bg-indigo-700 hover:bg-indigo-600 text-white'
    }`}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Row-based Rate Values Table ────────────────────────────────────────────
function RateValuesTable({ profile, compact = false }) {
  const isActual = profile.rateType === 'actual';
  const headers = isActual
    ? ['Center Sens', 'Max Rate', 'Expo', 'Peak']
    : ['RC Rate', 'Super Rate', 'Expo', 'Peak'];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr>
          <th className="text-left px-2 py-1.5 text-gray-500 font-semibold text-[11px]">Axis</th>
          {headers.map(h => (
            <th key={h} className="text-right px-2 py-1.5 text-gray-500 font-semibold text-[11px]">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {['roll', 'pitch', 'yaw'].map(axis => {
          const p = profile[axis] || {};
          const peak = getPeakRate(profile, axis);
          const val1 = isActual ? (p.center_sensitivity ?? '-') : (p.rc_rate ?? '-');
          const val2 = isActual ? (p.max_rate ?? '-') : (p.rate ?? '-');
          const val3 = p.expo ?? 0;
          return (
            <tr key={axis} className="border-t border-white/5">
              <td className="px-2 py-1.5 text-gray-300 font-medium capitalize">{axis}</td>
              <td className="px-2 py-1.5 text-white font-mono text-right">{val1}</td>
              <td className="px-2 py-1.5 text-white font-mono text-right">{val2}</td>
              <td className="px-2 py-1.5 text-white font-mono text-right">{val3}</td>
              <td className="px-2 py-1.5 text-cyan-300 font-mono font-semibold text-right">{peak}°/s</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Rate Detail Modal ──────────────────────────────────────────────────────
function RateDetailModal({ rate, onClose, compareList, onToggleCompare }) {
  const cli = useMemo(() => generateRateCLI(rate), [rate]);
  const rateTypeLabel = RATE_TYPES.find(t => t.id === rate.rateType)?.label ?? rate.rateType;
  const quadLabel = QUAD_TYPES.find(t => t.value === rate.quadType)?.label ?? rate.quadType;
  const inCompare = compareList?.some(r => r.id === rate.id);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">{rate.name || 'Unnamed Rates'}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {rate.pilotName || 'Unknown Pilot'}
              {rate.quadName ? ` · ${rate.quadName}` : ''}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-900/40 text-violet-300">{rateTypeLabel}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-cyan-900/40 text-cyan-300">{quadLabel}</span>
              {rate.source === 'community' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-900/40 text-amber-300">🏆 Community</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 shrink-0"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {rate.notes && <p className="text-xs text-gray-400 italic">{rate.notes}</p>}
          <RateCurveCanvas rateProfile={rate} height={180} />
          <RateValuesTable profile={rate} />
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Throttle Mid: <span className="text-white font-mono">{rate.thr_mid ?? 0.5}</span></span>
            <span>Throttle Expo: <span className="text-white font-mono">{rate.thr_expo ?? 0}</span></span>
          </div>
          {rate.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {rate.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-300 flex items-center gap-1.5">
              <Terminal size={11} /> CLI Commands
            </summary>
            <pre className="bg-gray-950 rounded-lg p-3 text-green-300 font-mono overflow-x-auto max-h-48 mt-2 select-all text-[11px]">{cli}</pre>
          </details>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 p-5 pt-3 border-t border-gray-800">
          <CopyBtn text={cli} />
          {onToggleCompare && (
            <button
              onClick={() => onToggleCompare(rate)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                inCompare ? 'bg-amber-700 text-amber-100' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}>
              <GitCompare size={12} />
              {inCompare ? 'Remove from Compare' : 'Add to Compare'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rate Compare Modal ─────────────────────────────────────────────────────
function RateCompareModal({ rates, onClose }) {
  if (rates.length < 2) return null;

  const getMax = (axis, field) => {
    const vals = rates.map(r => {
      const p = r[axis] || {};
      if (field === 'peak') return getPeakRate(r, axis);
      return p[field] ?? 0;
    });
    return Math.max(...vals);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <GitCompare size={18} className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Rate Comparison</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-6">
          <div className={`grid gap-4 ${rates.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {rates.map(r => (
              <div key={r.id} className="space-y-2">
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{r.name}</div>
                  <div className="text-[10px] text-gray-500">{r.pilotName}</div>
                </div>
                <RateCurveCanvas rateProfile={r} height={140} />
              </div>
            ))}
          </div>
          {['roll', 'pitch', 'yaw'].map(axis => {
            const isActual = rates[0].rateType === 'actual';
            const fields = isActual
              ? [{ key: 'center_sensitivity', label: 'Center Sens' }, { key: 'max_rate', label: 'Max Rate' }, { key: 'expo', label: 'Expo' }]
              : [{ key: 'rc_rate', label: 'RC Rate' }, { key: 'rate', label: 'Super Rate' }, { key: 'expo', label: 'Expo' }];
            return (
              <div key={axis} className="space-y-1">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">{axis}</h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1 text-gray-500 font-medium">Param</th>
                      {rates.map(r => (
                        <th key={r.id} className="text-right px-2 py-1 text-gray-400 font-medium truncate max-w-[120px]">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(f => {
                      const maxVal = getMax(axis, f.key);
                      return (
                        <tr key={f.key} className="border-t border-white/5">
                          <td className="px-2 py-1 text-gray-400">{f.label}</td>
                          {rates.map(r => {
                            const val = r[axis]?.[f.key] ?? 0;
                            const isMax = val === maxVal && rates.length > 1;
                            return (
                              <td key={r.id} className={`px-2 py-1 text-right font-mono ${isMax ? 'text-green-400 font-bold' : 'text-white'}`}>
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="border-t border-white/5">
                      <td className="px-2 py-1 text-gray-400 font-semibold">Peak</td>
                      {rates.map(r => {
                        const peak = getPeakRate(r, axis);
                        const maxPeak = getMax(axis, 'peak');
                        const isMax = peak === maxPeak && rates.length > 1;
                        return (
                          <td key={r.id} className={`px-2 py-1 text-right font-mono font-semibold ${isMax ? 'text-green-400' : 'text-cyan-300'}`}>
                            {peak}°/s
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Rate Card ──────────────────────────────────────────────────────────────
function RateCard({ profile, onEdit, onDelete, isCommunity, onClick, compareList, onToggleCompare }) {
  const rateTypeLabel = RATE_TYPES.find(t => t.id === profile.rateType)?.label ?? profile.rateType;
  const quadLabel = QUAD_TYPES.find(t => t.value === profile.quadType)?.label ?? profile.quadType;
  const inCompare = compareList?.some(r => r.id === profile.id);

  return (
    <div className={`bg-gray-800/50 border rounded-xl overflow-hidden transition-all hover:border-gray-500/60 ${
      isCommunity ? 'border-violet-700/30' : 'border-cyan-700/30'}`}>
      {/* Clickable header area */}
      <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onClick?.(profile)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl select-none">{isCommunity ? '🏆' : '✏️'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold text-sm">{profile.name || 'Unnamed Rates'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-900/40 text-violet-300">
                  {rateTypeLabel}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {profile.pilotName || 'Unknown Pilot'}
                {profile.quadName ? ` · ${profile.quadName}` : ''}
                {quadLabel ? ` · ${quadLabel}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <RateValuesTable profile={profile} compact />
        </div>
        {profile.tags?.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {profile.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Quick action bar */}
      <div className="flex items-center gap-1 px-4 pb-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCompare?.(profile); }}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors ${
            inCompare ? 'bg-amber-800/60 text-amber-300' : 'bg-gray-700/50 text-gray-500 hover:text-gray-300'
          }`}>
          <GitCompare size={10} /> {inCompare ? 'Comparing' : 'Compare'}
        </button>
        {!isCommunity && onEdit && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(profile); }}
            className="flex items-center gap-1 text-[10px] bg-gray-700/50 text-gray-500 hover:text-gray-300 px-2 py-1 rounded-md transition-colors">
            <Edit3 size={10} /> Edit
          </button>
        )}
        {!isCommunity && onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(profile.id); }}
            className="flex items-center gap-1 text-[10px] bg-gray-700/50 text-red-400/60 hover:text-red-300 px-2 py-1 rounded-md transition-colors">
            <Trash2 size={10} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Rate Editor Form ───────────────────────────────────────────────────────
function RateEditor({ initial, onSave, onCancel }) {
  const [profile, setProfile] = useState(() => ({
    ...createEmptyRateProfile(),
    ...(initial || {}),
    updatedAt: new Date().toISOString(),
  }));
  const [linkRP, setLinkRP] = useState(true);
  const [tagInput, setTagInput] = useState('');

  const update = (path, value) => {
    setProfile(prev => {
      const next = { ...prev };
      if (path.includes('.')) {
        const [axis, param] = path.split('.');
        next[axis] = { ...next[axis], [param]: value };
        // Link roll+pitch
        if (linkRP && (axis === 'roll' || axis === 'pitch')) {
          const other = axis === 'roll' ? 'pitch' : 'roll';
          next[other] = { ...next[other], [param]: value };
        }
      } else {
        next[path] = value;
      }
      return next;
    });
  };

  const isActual = profile.rateType === 'actual';
  const paramLabels = isActual
    ? ['center_sensitivity', 'max_rate', 'expo']
    : ['rc_rate', 'rate', 'expo'];
  const paramNames = isActual
    ? ['Center Sensitivity', 'Max Rate (°/s)', 'Expo']
    : ['RC Rate', 'Super Rate', 'Expo'];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !profile.tags.includes(t)) {
      setProfile(p => ({ ...p, tags: [...p.tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setProfile(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">
          {initial?.id ? 'Edit Rate Profile' : 'New Rate Profile'}
        </h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 p-1"><X size={16} /></button>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Profile Name *</label>
          <input type="text" value={profile.name} onChange={e => update('name', e.target.value)} placeholder="My Flow Rates"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Pilot Name</label>
          <input type="text" value={profile.pilotName} onChange={e => update('pilotName', e.target.value)} placeholder="Your name"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Quad Name</label>
          <input type="text" value={profile.quadName} onChange={e => update('quadName', e.target.value)} placeholder='5" Freestyle'
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Quad Type</label>
          <select value={profile.quadType} onChange={e => update('quadType', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 appearance-none">
            {QUAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Rate System</label>
          <select value={profile.rateType} onChange={e => update('rateType', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 appearance-none">
            {RATE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-300">Tags</label>
          <div className="flex gap-1 flex-wrap items-center">
            {profile.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-violet-900/40 text-violet-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                {tag} <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={8} /></button>
              </span>
            ))}
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="+ add tag" className="text-xs bg-transparent border-none outline-none text-gray-400 w-20" />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-300">Notes</label>
        <textarea value={profile.notes ?? ''} onChange={e => update('notes', e.target.value)} rows={2} placeholder="How does this rate feel?"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 resize-none" />
      </div>

      {/* Rate Values */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">Rate Values</h3>
          <button onClick={() => setLinkRP(v => !v)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${linkRP ? 'bg-violet-700 text-violet-200' : 'bg-gray-700 text-gray-400'}`}>
            {linkRP ? '🔗 Roll+Pitch linked' : '🔓 Independent'}
          </button>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-gray-500 font-medium">Axis</th>
              {paramNames.map(n => (
                <th key={n} className="text-center px-2 py-2 text-gray-400 font-medium">{n}</th>
              ))}
              <th className="text-right px-2 py-2 text-gray-500 font-medium">Peak</th>
            </tr>
          </thead>
          <tbody>
            {['roll', 'pitch', 'yaw'].map(axis => (
              <tr key={axis} className="border-t border-white/5">
                <td className="px-2 py-2 text-gray-300 font-medium capitalize">{axis}</td>
                {paramLabels.map((param, pi) => (
                  <td key={param} className="px-1 py-1">
                    <input
                      type="number"
                      step={isActual && pi < 2 ? 10 : 0.01}
                      min={0}
                      value={profile[axis]?.[param] ?? ''}
                      onChange={e => update(`${axis}.${param}`, parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white font-mono text-center focus:outline-none focus:border-violet-500 [appearance:textfield]"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-cyan-300 font-mono font-semibold text-right">
                  {getPeakRate(profile, axis)}°/s
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Throttle */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Throttle Mid</label>
            <input type="number" step={0.05} min={0} max={1} value={profile.thr_mid ?? 0.5} onChange={e => update('thr_mid', parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500 [appearance:textfield]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Throttle Expo</label>
            <input type="number" step={0.05} min={0} max={1} value={profile.thr_expo ?? 0} onChange={e => update('thr_expo', parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500 [appearance:textfield]" />
          </div>
        </div>
      </div>

      {/* Curve Preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-200">Curve Preview</h3>
        <RateCurveCanvas rateProfile={profile} height={160} />
        <div className="flex gap-4 text-xs text-gray-400">
          <span>Peak Roll: <span className="text-white font-semibold">{getPeakRate(profile, 'roll')}°/s</span></span>
          <span>Peak Pitch: <span className="text-white font-semibold">{getPeakRate(profile, 'pitch')}°/s</span></span>
          <span>Peak Yaw: <span className="text-white font-semibold">{getPeakRate(profile, 'yaw')}°/s</span></span>
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => {
          if (!profile.name?.trim()) { alert('Please enter a profile name'); return; }
          onSave({ ...profile, updatedAt: new Date().toISOString() });
        }} className="flex items-center gap-1.5 text-sm font-medium px-5 py-2.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-colors">
          <Save size={14} /> Save Rate Profile
        </button>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2.5">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function RatesPage() {
  const [customRates, setCustomRates] = useState(() => loadCustomRates());
  const [editing, setEditing] = useState(null); // null | 'new' | rateProfile object
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterQuad, setFilterQuad] = useState('all');
  const [detailRate, setDetailRate] = useState(null);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  // Persist custom rates
  useEffect(() => { saveCustomRates(customRates); }, [customRates]);

  const handleSave = useCallback((profile) => {
    setCustomRates(prev => {
      const exists = prev.find(r => r.id === profile.id);
      if (exists) return prev.map(r => r.id === profile.id ? profile : r);
      return [...prev, { ...profile, createdAt: profile.createdAt || new Date().toISOString() }];
    });
    setEditing(null);
  }, []);

  const handleDelete = useCallback((id) => {
    if (!confirm('Delete this rate profile?')) return;
    setCustomRates(prev => prev.filter(r => r.id !== id));
  }, []);

  const toggleCompare = useCallback((rate) => {
    setCompareList(prev => {
      if (prev.find(r => r.id === rate.id)) return prev.filter(r => r.id !== rate.id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, rate];
    });
  }, []);

  const filterFn = useCallback((profile) => {
    if (filterType !== 'all' && profile.rateType !== filterType) return false;
    if (filterQuad !== 'all' && profile.quadType !== filterQuad) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const haystack = `${profile.name} ${profile.pilotName} ${profile.quadName} ${(profile.tags || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }, [filterType, filterQuad, searchTerm]);

  const filteredCommunity = useMemo(() => COMMUNITY_RATES.filter(filterFn), [filterFn]);
  const filteredCustom = useMemo(() => customRates.filter(filterFn), [customRates, filterFn]);

  // Editor view
  if (editing) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <RateEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Award size={22} className="text-cyan-400 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">Rate Profiles</h1>
            <p className="text-sm text-gray-400">
              {COMMUNITY_RATES.length} community · {customRates.length} custom · {RATE_TYPES.length} rate systems
            </p>
          </div>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-colors">
          <Plus size={14} /> New Rate Profile
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search pilots, names, tags…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 appearance-none">
          <option value="all">All Rate Types</option>
          {RATE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filterQuad} onChange={e => setFilterQuad(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 appearance-none">
          <option value="all">All Quad Types</option>
          {QUAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* ── MY RATES (first) ───────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <User size={13} className="text-cyan-400" /> My Rates ({filteredCustom.length})
        </h2>
        {filteredCustom.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
            <p className="text-sm">No custom rates yet.</p>
            <button onClick={() => setEditing('new')} className="text-xs text-violet-400 hover:text-violet-300 underline">
              Create your first rate profile
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredCustom.map(r => (
            <RateCard key={r.id} profile={r} onEdit={setEditing} onDelete={handleDelete}
              onClick={setDetailRate} compareList={compareList} onToggleCompare={toggleCompare} />
          ))}
        </div>
      </div>

      {/* ── COMMUNITY RATES (second) ─────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Award size={13} className="text-violet-400" /> Community Rates ({filteredCommunity.length})
        </h2>
        {filteredCommunity.length === 0 && (
          <p className="text-xs text-gray-500 italic">No community rates match your filters.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredCommunity.map(r => (
            <RateCard key={r.id} profile={r} isCommunity
              onClick={setDetailRate} compareList={compareList} onToggleCompare={toggleCompare} />
          ))}
        </div>
      </div>

      {/* Compare bar */}
      {compareList.length >= 1 && (
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-700 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap z-30">
          <span className="text-xs text-gray-400">
            <GitCompare size={12} className="inline mr-1" />
            Comparing: <span className="text-white font-medium">{compareList.map(r => r.name).join(' vs ')}</span>
          </span>
          <div className="flex-1" />
          {compareList.length >= 2 && (
            <button onClick={() => setShowCompare(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white transition-colors">
              Compare {compareList.length} Rates
            </button>
          )}
          <button onClick={() => setCompareList([])}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5">
            Clear
          </button>
        </div>
      )}

      {/* Note about PID presets */}
      <div className="text-xs text-gray-500 border-t border-gray-800 pt-4 text-center">
        Rates are separate from PID presets. Visit the <a href="#/presets" className="text-violet-400 hover:underline">Presets page</a> for PID tuning presets.
      </div>

      {/* Detail Modal */}
      {detailRate && (
        <RateDetailModal
          rate={detailRate}
          onClose={() => setDetailRate(null)}
          compareList={compareList}
          onToggleCompare={toggleCompare}
        />
      )}

      {/* Compare Modal */}
      {showCompare && compareList.length >= 2 && (
        <RateCompareModal
          rates={compareList}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

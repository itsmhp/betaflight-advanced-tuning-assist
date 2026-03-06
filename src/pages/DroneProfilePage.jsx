import { useState, useRef, useEffect } from 'react';
import {
  Cpu, ChevronDown, Save, RotateCcw, CheckCircle2, Zap, Settings,
  Plus, Copy, Trash2, MoreVertical, Edit3, Star, X, ArrowLeft, Battery, Gauge
} from 'lucide-react';
import {
  useDroneProfile, createEmptyDrone,
  FRAME_SIZES, MOTOR_STATORS, PROP_SIZES, BATTERY_CELLS, FLYING_STYLES, ESC_PROTOCOLS
} from '../context/DroneProfileContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      {hint && <p className="text-[10px] text-gray-500 -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

/** Dropdown with preset options plus a "Custom…" free-text option */
function FlexibleInput({ value, onChange, options, placeholder = 'Select…', customPlaceholder = 'Type custom value…' }) {
  const isCustom = value && !options.some(o => String(o.value) === String(value));
  const [mode, setMode] = useState(isCustom ? 'custom' : 'select');

  useEffect(() => {
    if (value && !options.some(o => String(o.value) === String(value))) setMode('custom');
  }, [value, options]);

  if (mode === 'custom') {
    return (
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={customPlaceholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={() => { setMode('select'); onChange(''); }}
          className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-xs text-gray-300"
          title="Switch to preset list"
        >
          <ChevronDown size={13}/>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => {
          if (e.target.value === '__custom__') { setMode('custom'); onChange(''); }
          else onChange(e.target.value);
        }}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 appearance-none pr-8"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value="__custom__">Custom…</option>
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-3 text-gray-500 pointer-events-none"/>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, placeholder, suffix }) {
  return (
    <div className="relative">
      <input
        type="number" min={min} max={max}
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 pr-12 [appearance:textfield]"
      />
      {suffix && <span className="absolute right-3 top-2 text-xs text-gray-500">{suffix}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
    />
  );
}

// ─── Three-dot menu ─────────────────────────────────────────────────────────
function DroneCardMenu({ droneId, isActive, onSetActive, onEdit, onDuplicate, onDelete, isOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-white transition-colors">
        <MoreVertical size={14}/>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 text-sm">
          {!isActive && (
            <button onClick={() => { onSetActive(droneId); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-700 text-gray-200 flex items-center gap-2">
              <Star size={12} className="text-yellow-400"/> Set Active
            </button>
          )}
          <button onClick={() => { onEdit(droneId); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-700 text-gray-200 flex items-center gap-2">
            <Edit3 size={12}/> Edit
          </button>
          <button onClick={() => { onDuplicate(droneId); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-700 text-gray-200 flex items-center gap-2">
            <Copy size={12}/> Duplicate
          </button>
          {!isOnly && (
            <button onClick={() => { onDelete(droneId); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-red-900/40 text-red-400 flex items-center gap-2">
              <Trash2 size={12}/> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drone Card ─────────────────────────────────────────────────────────────
function DroneCard({ drone, isActive, onSetActive, onEdit, onDuplicate, onDelete, isOnly }) {
  const styleLabel = FLYING_STYLES.find(s => s.value === drone.flying_style)?.label ?? drone.flying_style ?? '';
  const frameLabel = FRAME_SIZES.find(f => f.value === drone.frame_size)?.label ?? drone.frame_size ?? '';

  return (
    <div
      onClick={() => onEdit(drone.id)}
      className={`group relative bg-gray-800/50 border rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-800/80
        ${isActive ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-gray-700 hover:border-gray-600'}`}
    >
      {isActive && (
        <span className="absolute -top-2 left-3 bg-violet-600 text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          Active
        </span>
      )}

      <div className="flex justify-between items-start mb-3">
        <h3 className="text-sm font-semibold text-white truncate pr-2">{drone.name || 'Unnamed Drone'}</h3>
        <DroneCardMenu
          droneId={drone.id} isActive={isActive} isOnly={isOnly}
          onSetActive={onSetActive} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete}
        />
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        {frameLabel && <p className="text-gray-300">{frameLabel}</p>}
        {drone.motor?.kv && <p>Motor: {drone.motor.kv}KV</p>}
        {drone.battery?.cells && <p>Battery: {drone.battery.cells}</p>}
        {styleLabel && <p className="text-violet-400/80">{styleLabel}</p>}
      </div>

      <p className="text-[10px] text-gray-600 mt-2">
        Updated {new Date(drone.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DroneProfilePage() {
  const {
    profiles, activeDroneId, droneProfile,
    switchDrone, addDroneProfile, updateDroneProfile, deleteDroneProfile, duplicateDroneProfile,
  } = useDroneProfile();

  const [editingId, setEditingId] = useState(null);
  const [saved, setSaved] = useState(false);

  const editingDrone = editingId ? profiles.find(p => p.id === editingId) : null;

  // ── Form helpers ──
  function updateField(path, value) {
    if (!editingId) return;
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      const existing = editingDrone?.[parent] ?? {};
      updateDroneProfile(editingId, { [parent]: { ...existing, [child]: value } });
    } else {
      updateDroneProfile(editingId, { [path]: value });
    }
  }

  function handleAddDrone() {
    const id = addDroneProfile({ name: `Drone ${profiles.length + 1}` });
    setEditingId(id);
  }

  function handleDelete(id) {
    if (!confirm('Delete this drone profile?')) return;
    deleteDroneProfile(id);
    if (editingId === id) setEditingId(null);
  }

  function handleEdit(id) { setEditingId(id); }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EDITING VIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (editingDrone) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setEditingId(null)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18}/>
          </button>
          <Cpu size={22} className="text-cyan-400 shrink-0"/>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{editingDrone.name || 'Edit Drone'}</h1>
            <p className="text-xs text-gray-500">ID: {editingDrone.id.slice(0, 8)}…</p>
          </div>
        </div>

        {/* ── Identity ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Cpu size={14} className="text-cyan-400"/> Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Drone Name" hint="Give your drone a recognizable name">
              <TextInput value={editingDrone.name} onChange={v => updateField('name', v)} placeholder="e.g. Race Quad 5inch"/>
            </Field>
            <Field label="Flying Style">
              <FlexibleInput value={editingDrone.flying_style} onChange={v => updateField('flying_style', v)} options={FLYING_STYLES} placeholder="Select style…"/>
            </Field>
          </div>
        </div>

        {/* ── Frame & Props ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Settings size={14} className="text-violet-400"/> Frame & Props
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Frame Size" hint="Measured by prop size / diagonal">
              <FlexibleInput value={editingDrone.frame_size} onChange={v => updateField('frame_size', v)} options={FRAME_SIZES} placeholder="Select frame size…" customPlaceholder="e.g. 5.5inch custom"/>
            </Field>
            <Field label="All-Up Weight" hint="Includes battery (AUW)">
              <NumberInput value={editingDrone.weight} onChange={v => updateField('weight', v)} min={20} max={5000} placeholder="e.g. 520" suffix="g"/>
            </Field>
            <Field label="Prop Size" hint="Diameter × pitch">
              <FlexibleInput value={editingDrone.propeller?.diameter} onChange={v => updateField('propeller.diameter', v)} options={PROP_SIZES} placeholder="Select prop size…" customPlaceholder="e.g. 5145"/>
            </Field>
            <Field label="Blade Count">
              <FlexibleInput value={editingDrone.propeller?.blade_count} onChange={v => updateField('propeller.blade_count', v)}
                options={[{value:'2',label:'2 blades'},{value:'3',label:'3 blades'},{value:'4',label:'4 blades'}]}
                placeholder="Blade count…"/>
            </Field>
          </div>
        </div>

        {/* ── Motor ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Gauge size={14} className="text-orange-400"/> Motor
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Motor KV" hint="Revolutions per volt at no load">
              <NumberInput value={editingDrone.motor?.kv} onChange={v => updateField('motor.kv', v)} min={500} max={12000} placeholder="e.g. 1960" suffix="KV"/>
            </Field>
            <Field label="Motor Brand / Model" hint="Optional">
              <TextInput value={editingDrone.motor?.brand} onChange={v => updateField('motor.brand', v)} placeholder="e.g. EMAX ECO II 2207"/>
            </Field>
          </div>
        </div>

        {/* ── Battery ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Battery size={14} className="text-green-400"/> Battery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Battery Cells" hint="1S–6S">
              <FlexibleInput value={editingDrone.battery?.cells} onChange={v => updateField('battery.cells', v)} options={BATTERY_CELLS} placeholder="Select cell count…"/>
            </Field>
            <Field label="Capacity (mAh)">
              <NumberInput value={editingDrone.battery?.mah} onChange={v => updateField('battery.mah', v)} min={100} max={10000} placeholder="e.g. 1300" suffix="mAh"/>
            </Field>
          </div>
        </div>

        {/* ── Electronics ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Zap size={14} className="text-fuchsia-400"/> Electronics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="FC Name" hint="Flight controller model">
              <TextInput value={editingDrone.fc?.model} onChange={v => updateField('fc.model', v)} placeholder="e.g. Foxeer F745"/>
            </Field>
            <Field label="ESC Name" hint="ESC model">
              <TextInput value={editingDrone.esc?.model} onChange={v => updateField('esc.model', v)} placeholder="e.g. Foxeer Reaper 45A"/>
            </Field>
            <Field label="ESC Protocol">
              <FlexibleInput value={editingDrone.esc?.protocol} onChange={v => updateField('esc.protocol', v)} options={ESC_PROTOCOLS} placeholder="Select protocol…"/>
            </Field>
            <Field label="Betaflight Version">
              <FlexibleInput value={editingDrone.fc?.betaflight_version} onChange={v => updateField('fc.betaflight_version', v)}
                options={[{value:'4.4',label:'4.4.x'},{value:'4.3',label:'4.3.x'},{value:'4.2',label:'4.2.x'},{value:'4.5',label:'4.5.x (dev)'}]}
                placeholder="Select version…"/>
            </Field>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Notes</h2>
          <textarea
            value={editingDrone.notes ?? ''}
            onChange={e => updateField('notes', e.target.value)}
            placeholder="e.g. 4S 800mAh, carbon frame, soft-mounted FC, sticky props…"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 resize-none"
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button onClick={() => { if (confirm('Reset this drone?')) { updateDroneProfile(editingId, { ...createEmptyDrone(editingDrone.name), id: editingId }); } }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-2">
            <RotateCcw size={12}/> Reset Fields
          </button>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
              saved ? 'bg-emerald-700 text-emerald-100' : 'bg-violet-700 hover:bg-violet-600 text-white'}`}>
            {saved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Profile</>}
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center">
          Profile is saved automatically and used for smart preset recommendations.
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CARD GRID VIEW
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Cpu size={22} className="text-cyan-400 shrink-0"/>
          <div>
            <h1 className="text-xl font-bold text-white">My Drones</h1>
            <p className="text-sm text-gray-400">{profiles.length} drone profile{profiles.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={handleAddDrone}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-colors">
          <Plus size={14}/> Add Drone
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(drone => (
          <DroneCard
            key={drone.id}
            drone={drone}
            isActive={drone.id === activeDroneId}
            isOnly={profiles.length === 1}
            onSetActive={switchDrone}
            onEdit={handleEdit}
            onDuplicate={duplicateDroneProfile}
            onDelete={handleDelete}
          />
        ))}

        {/* Add card placeholder */}
        <button onClick={handleAddDrone}
          className="flex flex-col items-center justify-center gap-2 bg-gray-800/20 border border-dashed border-gray-700 rounded-xl p-6 text-gray-500 hover:text-violet-400 hover:border-violet-500/40 transition-all cursor-pointer min-h-[140px]">
          <Plus size={24}/>
          <span className="text-xs font-medium">Add New Drone</span>
        </button>
      </div>
    </div>
  );
}

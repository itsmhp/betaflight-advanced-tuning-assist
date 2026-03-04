import { useState } from 'react';
import { Cpu, ChevronDown, Save, RotateCcw, CheckCircle2, Zap, Settings } from 'lucide-react';
import {
  useDroneProfile,
  FRAME_SIZES, MOTOR_STATORS, PROP_SIZES, BATTERY_CELLS, FLYING_STYLES, ESC_PROTOCOLS
} from '../context/DroneProfileContext';

// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      {hint && <p className="text-[10px] text-gray-500 -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = 'Select…' }) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                   focus:outline-none focus:border-violet-500 appearance-none pr-8"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-3 text-gray-500 pointer-events-none"/>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, placeholder, suffix }) {
  return (
    <div className="relative">
      <input
        type="number"
        min={min}
        max={max}
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                   focus:outline-none focus:border-violet-500 pr-12 [appearance:textfield]"
      />
      {suffix && (
        <span className="absolute right-3 top-2 text-xs text-gray-500">{suffix}</span>
      )}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                 focus:outline-none focus:border-violet-500"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DroneProfilePage() {
  const { profile, setProfile, resetProfile } = useDroneProfile();
  const [saved, setSaved] = useState(false);

  function update(key) {
    return (val) => setProfile({ [key]: val });
  }

  function handleReset() {
    if (confirm('Reset all drone profile fields?')) resetProfile();
  }

  function handleSave() {
    // Profile is auto-saved on每 field change via context.
    // This just shows feedback.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const frameLabel = FRAME_SIZES.find(f => f.value === profile.frameSize)?.label ?? profile.frameSize ?? '—';
  const motorLabel = MOTOR_STATORS.find(m => m.value === profile.motorStator)?.label ?? '—';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* ── Title ── */}
      <div className="flex items-center gap-3">
        <Cpu size={22} className="text-cyan-400 shrink-0"/>
        <div>
          <h1 className="text-xl font-bold text-white">My Drone Profile</h1>
          <p className="text-sm text-gray-400">
            Fill in your quad's hardware details for smarter preset recommendations and analysis.
          </p>
        </div>
      </div>

      {/* ── Summary badge ── */}
      {profile.frameSize && (
        <div className="bg-violet-900/20 border border-violet-700/30 rounded-xl px-4 py-3 flex gap-3 items-center text-sm">
          <Zap size={16} className="text-violet-400 shrink-0"/>
          <span className="text-gray-300">
            <span className="font-semibold text-violet-300">{frameLabel}</span>
            {profile.motorStator && <>, motor <span className="font-medium text-white">{profile.motorStator}</span></>}
            {profile.motorKv > 0 && <> <span className="font-medium text-white">{profile.motorKv}KV</span></>}
            {profile.batteryCells > 0 && <> on <span className="font-medium text-white">{profile.batteryCells}S</span></>}
            {profile.flyingStyle && <>, <span className="text-violet-300">{FLYING_STYLES.find(s => s.value === profile.flyingStyle)?.label ?? profile.flyingStyle}</span></>}
          </span>
        </div>
      )}

      {/* ── Form ── */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Settings size={14} className="text-violet-400"/>
          Hardware Specs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Craft Name" hint="Optional — pulled from CLI if available">
            <TextInput value={profile.craftName} onChange={update('craftName')} placeholder="My 5inch Freestyle"/>
          </Field>

          <Field label="Frame Size" hint="Measured by prop size / diagonal">
            <Select value={profile.frameSize} onChange={update('frameSize')} options={FRAME_SIZES} placeholder="Select frame size…"/>
          </Field>

          <Field label="Motor Stator Size" hint="e.g. 2207 = 22mm wide × 7mm tall">
            <Select value={profile.motorStator} onChange={update('motorStator')} options={MOTOR_STATORS} placeholder="Select motor size…"/>
          </Field>

          <Field label="Motor KV" hint="Revolutions per volt at no load">
            <NumberInput value={profile.motorKv} onChange={update('motorKv')} min={500} max={12000} placeholder="e.g. 1960" suffix="KV"/>
          </Field>

          <Field label="Prop Size" hint="Diameter × pitch, e.g. 5045">
            <Select value={profile.propSize} onChange={update('propSize')} options={PROP_SIZES} placeholder="Select prop size…"/>
          </Field>

          <Field label="Battery Cells" hint="Number of LiPo cells (1S–6S)">
            <Select
              value={profile.batteryCells}
              onChange={v => update('batteryCells')(Number(v))}
              options={BATTERY_CELLS}
              placeholder="Select cell count…"
            />
          </Field>

          <Field label="All-Up Weight" hint="Includes battery (AUW)">
            <NumberInput value={profile.auwGrams} onChange={update('auwGrams')} min={20} max={5000} placeholder="e.g. 520" suffix="g"/>
          </Field>

          <Field label="Flying Style">
            <Select value={profile.flyingStyle} onChange={update('flyingStyle')} options={FLYING_STYLES} placeholder="Select style…"/>
          </Field>
        </div>
      </div>

      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Zap size={14} className="text-fuchsia-400"/>
          Electronics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="FC Name" hint="Flight controller model (optional)">
            <TextInput value={profile.fcName} onChange={update('fcName')} placeholder="e.g. SpeedyBee F405 V4"/>
          </Field>

          <Field label="ESC Name" hint="ESC model (optional)">
            <TextInput value={profile.escName} onChange={update('escName')} placeholder="e.g. SpeedyBee BLS 55A"/>
          </Field>

          <Field label="ESC Protocol">
            <Select value={profile.escProtocol} onChange={update('escProtocol')} options={ESC_PROTOCOLS} placeholder="Select protocol…"/>
          </Field>

          <Field label="RPM Filter / Bidir DShot">
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!profile.hasBidirDshot}
                  onChange={e => update('hasBidirDshot')(e.target.checked)}
                  className="accent-violet-600 w-4 h-4"
                />
                Bidirectional DShot enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!profile.hasRpmFilter}
                  onChange={e => update('hasRpmFilter')(e.target.checked)}
                  className="accent-violet-600 w-4 h-4"
                />
                RPM Filter enabled
              </label>
            </div>
          </Field>
        </div>
      </div>

      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Notes</h2>
        <textarea
          value={profile.notes ?? ''}
          onChange={e => update('notes')(e.target.value)}
          placeholder="e.g. 4S 800mAh, carbon frame, soft-mounted FC, sticky props…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                     focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-2"
        >
          <RotateCcw size={12}/>
          Reset Profile
        </button>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
            saved
              ? 'bg-emerald-700 text-emerald-100'
              : 'bg-violet-700 hover:bg-violet-600 text-white'
          }`}
        >
          {saved ? <><CheckCircle2 size={14}/>Saved!</> : <><Save size={14}/>Save Profile</>}
        </button>
      </div>

      <p className="text-xs text-gray-600 text-center">
        Profile is saved automatically and used for smart preset recommendations.
      </p>
    </div>
  );
}

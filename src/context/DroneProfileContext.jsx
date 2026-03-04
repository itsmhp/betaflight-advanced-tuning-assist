/**
 * DroneProfileContext.jsx
 * Global context for user's quad hardware specs.
 * Persisted to localStorage so it survives page refreshes.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────
export const FRAME_SIZES = [
  { value: '65mm',           label: '65mm Tiny Whoop' },
  { value: '75mm',           label: '75mm Tiny Whoop' },
  { value: '3inch',          label: '3" Toothpick / Micro' },
  { value: '3inch_cinewhoop',label: '3" CineWhoop (ducted)' },
  { value: '4inch',          label: '4" Micro / Freestyle' },
  { value: '5inch',          label: '5" Freestyle' },
  { value: '5inch_race',     label: '5" Racing' },
  { value: '6inch',          label: '6" Long Range' },
  { value: '7inch',          label: '7" Long Range' },
  { value: '8inch_plus',     label: '8"+ X-Class / Heavy' },
];

export const MOTOR_STATORS = [
  {value:'0802', label:'0802 (Tiny Whoop 1S)'},
  {value:'1002', label:'1002 (Micro 1S)'},
  {value:'1103', label:'1103 (Whoop 2S)'},
  {value:'1104', label:'1104 (Whoop 2S)'},
  {value:'1105', label:'1105 (Whoop/Micro)'},
  {value:'1204', label:'1204 (Toothpick)'},
  {value:'1303', label:'1303 (Toothpick)'},
  {value:'1306', label:'1306 (Toothpick/3")'},
  {value:'1404', label:'1404 (3")'},
  {value:'1406', label:'1406 (3"/4")'},
  {value:'1507', label:'1507 (3"/4")'},
  {value:'2004', label:'2004 (4"/5" LR)'},
  {value:'2205', label:'2205 (5" classic)'},
  {value:'2206', label:'2206 (5" freestyle)'},
  {value:'2207', label:'2207 (5" standard)'},
  {value:'2208', label:'2208 (5" high torque)'},
  {value:'2306', label:'2306 (5" race)'},
  {value:'2307', label:'2307 (5" race/freestyle)'},
  {value:'2407', label:'2407 (4"/5")'},
  {value:'2506', label:'2506 (5"/6")'},
  {value:'2508', label:'2508 (5"/6")'},
  {value:'3110', label:'3110 (6"/7")'},
  {value:'3115', label:'3115 (7")'},
  {value:'other', label:'Other'},
];

export const PROP_SIZES = [
  {value:'31mm', label:'31mm (Tiny Whoop)'},
  {value:'40mm', label:'40mm (Micro)'},
  {value:'3016', label:'3016 (3")'},
  {value:'3018', label:'3018 (3")'},
  {value:'3520', label:'3520 (3.5")'},
  {value:'4024', label:'4024 (4")'},
  {value:'4330', label:'4330 (4")'},
  {value:'5040', label:'5040 (5")'},
  {value:'5043', label:'5043 (5")'},
  {value:'5045', label:'5045 (5")'},
  {value:'5050', label:'5050 (5")'},
  {value:'5130', label:'51303 (5.1" 3-blade)'},
  {value:'6030', label:'6030 (6")'},
  {value:'7035', label:'7035 (7")'},
  {value:'other', label:'Other'},
];

export const BATTERY_CELLS = [
  {value:1, label:'1S (3.7V)'},
  {value:2, label:'2S (7.4V)'},
  {value:3, label:'3S (11.1V)'},
  {value:4, label:'4S (14.8V)'},
  {value:6, label:'6S (22.2V)'},
];

export const FLYING_STYLES = [
  {value:'freestyle', label:'Freestyle'},
  {value:'racing',    label:'Racing'},
  {value:'cinematic', label:'Cinematic / FPV Filming'},
  {value:'long_range',label:'Long Range'},
  {value:'beginner',  label:'Learning / Beginner'},
];

export const ESC_PROTOCOLS = [
  {value:'DSHOT600', label:'DShot 600'},
  {value:'DSHOT300', label:'DShot 300'},
  {value:'DSHOT150', label:'DShot 150'},
  {value:'PROSHOT',  label:'ProShot'},
  {value:'ONESHOT125',label:'Oneshot 125'},
  {value:'MULTISHOT',label:'Multishot'},
  {value:'PWM',      label:'PWM'},
];

// ─────────────────────────────────────────────────────────────────────────────
// Default profile
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  craftName:    '',
  frameSize:    '5inch',
  motorStator:  '2207',
  motorKv:      0,
  propSize:     '5045',
  batteryCells: 4,
  auwGrams:     0,
  flyingStyle:  'freestyle',
  escProtocol:  'DSHOT600',
  fcName:       '',
  escName:      '',
  hasBidirDshot: false,
  hasRpmFilter:  false,
  notes:        '',
};

const STORAGE_KEY = 'btfl_drone_profile';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const DroneProfileContext = createContext(null);

export function DroneProfileProvider({ children }) {
  const [profile, setProfileState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const setProfile = useCallback((updates) => {
    setProfileState(prev => {
      const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetProfile = useCallback(() => {
    setProfileState(DEFAULT_PROFILE);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  /** Infer frame class string (matches Python presets key) for preset lookups */
  const inferredFrameClass = (() => {
    const f = profile.frameSize;
    if (!f) {
      if (profile.auwGrams) {
        if (profile.auwGrams < 60)  return '65mm';
        if (profile.auwGrams < 150) return '75mm';
        if (profile.auwGrams < 250) return '3inch';
        if (profile.auwGrams < 400) return '4inch';
        if (profile.auwGrams < 700) return '5inch';
        return '6inch';
      }
      return '5inch';
    }
    return f;
  })();

  return (
    <DroneProfileContext.Provider value={{ profile, setProfile, resetProfile, inferredFrameClass }}>
      {children}
    </DroneProfileContext.Provider>
  );
}

export function useDroneProfile() {
  const ctx = useContext(DroneProfileContext);
  if (!ctx) throw new Error('useDroneProfile must be inside DroneProfileProvider');
  return ctx;
}

/**
 * DroneProfileContext.jsx — v5 Multi-Drone Profile System
 * Supports multiple drone profiles with add/remove/switch/duplicate.
 * Backward compatible: `profile` exposes the active drone in legacy shape.
 * Migrates legacy single-profile localStorage format automatically.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Option presets (kept for backward compat imports)
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
// Template for a new drone profile
// ─────────────────────────────────────────────────────────────────────────────
export const createEmptyDrone = (name = 'My Drone') => ({
  id: crypto.randomUUID(),
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  frame_size: '',
  frame_size_custom: '',
  weight: '',
  motor: { kv: '', amperage: '', brand: '' },
  propeller: { diameter: '', diameter_custom: '', blade_count: '3', pitch: '', brand: '' },
  battery: { cells: '', mah: '', brand: '', c_rating: '' },
  esc: { model: '', amperage: '', protocol: 'DShot600', brand: '' },
  fc: { model: '', brand: '', betaflight_version: '4.4' },
  estimated_flight_time: '',
  flying_style: 'freestyle',
  notes: '',
  cliSnapshot: null,
  cliSnapshotRaw: '',
  cliSnapshotDate: null,
});

const PROFILES_KEY = 'droneProfiles_v2';
const ACTIVE_KEY   = 'activeDroneId';
const LEGACY_KEY   = 'btfl_drone_profile';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const DroneProfileContext = createContext(null);

export function DroneProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [activeDroneId, setActiveDroneId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Active drone (computed)
  const droneProfile = profiles.find(p => p.id === activeDroneId) ?? profiles[0] ?? null;

  // Backward compat: `profile` in the shape older pages expect
  const profile = droneProfile ? {
    ...droneProfile,
    craftName:    droneProfile.name || '',
    frameSize:    droneProfile.frame_size || '',
    motorKv:      droneProfile.motor?.kv || 0,
    motorStator:  '',
    propSize:     droneProfile.propeller?.diameter || '',
    batteryCells: droneProfile.battery?.cells || 4,
    auwGrams:     droneProfile.weight || 0,
    flyingStyle:  droneProfile.flying_style || 'freestyle',
    escProtocol:  droneProfile.esc?.protocol || 'DSHOT600',
    fcName:       droneProfile.fc?.model || '',
    escName:      droneProfile.esc?.model || '',
    hasBidirDshot: false,
    hasRpmFilter:  false,
  } : null;

  // ── Load from localStorage + migrate legacy ──
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(PROFILES_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_KEY);

      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
          setActiveDroneId(
            (savedActiveId && parsed.find(p => p.id === savedActiveId)) ? savedActiveId : parsed[0].id
          );
          setLoaded(true);
          return;
        }
      }

      // Migration: try legacy single-profile format
      const legacyRaw = localStorage.getItem(LEGACY_KEY) || localStorage.getItem('droneProfile');
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          const migrated = {
            ...createEmptyDrone(legacy.craftName || legacy.name || 'My Drone'),
            frame_size: legacy.frameSize || '',
            motor: { kv: legacy.motorKv || '', amperage: '', brand: '' },
            propeller: { diameter: legacy.propSize || '', diameter_custom: '', blade_count: '3', pitch: '', brand: '' },
            battery: { cells: legacy.batteryCells || 4, mah: '', brand: '', c_rating: '' },
            esc: { model: legacy.escName || '', amperage: '', protocol: legacy.escProtocol || 'DSHOT600', brand: '' },
            fc: { model: legacy.fcName || '', brand: '', betaflight_version: '4.4' },
            weight: legacy.auwGrams || '',
            flying_style: legacy.flyingStyle || 'freestyle',
            notes: legacy.notes || '',
          };
          setProfiles([migrated]);
          setActiveDroneId(migrated.id);
          setLoaded(true);
          return;
        } catch { /* ignore */ }
      }

      // First time: create default drone
      const def = createEmptyDrone('My First Drone');
      def.frame_size = '5inch';
      def.battery.cells = '4S';
      setProfiles([def]);
      setActiveDroneId(def.id);
    } catch (e) {
      console.error('DroneProfile load error:', e);
      const fb = createEmptyDrone('My First Drone');
      setProfiles([fb]);
      setActiveDroneId(fb.id);
    }
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    if (profiles.length > 0) localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    if (activeDroneId)       localStorage.setItem(ACTIVE_KEY, activeDroneId);
  }, [profiles, activeDroneId, loaded]);

  // ── Multi-profile API ──
  const addDroneProfile = useCallback((data = {}) => {
    const nd = { ...createEmptyDrone(data.name || 'New Drone'), ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setProfiles(prev => [...prev, nd]);
    setActiveDroneId(nd.id);
    return nd.id;
  }, []);

  const updateDroneProfile = useCallback((id, data) => {
    setProfiles(prev => prev.map(p =>
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    ));
  }, []);

  const deleteDroneProfile = useCallback((id) => {
    setProfiles(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (remaining.length === 0) {
        const fb = createEmptyDrone('My Drone');
        setActiveDroneId(fb.id);
        return [fb];
      }
      if (activeDroneId === id) setActiveDroneId(remaining[0].id);
      return remaining;
    });
  }, [activeDroneId]);

  const duplicateDroneProfile = useCallback((id) => {
    const src = profiles.find(p => p.id === id);
    if (!src) return null;
    const dupe = { ...src, id: crypto.randomUUID(), name: `${src.name} (Copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setProfiles(prev => [...prev, dupe]);
    setActiveDroneId(dupe.id);
    return dupe.id;
  }, [profiles]);

  const switchDrone = useCallback((id) => {
    if (profiles.find(p => p.id === id)) setActiveDroneId(id);
  }, [profiles]);

  // Backward-compat: setProfile updates active drone
  const setProfile = useCallback((updates) => {
    if (!activeDroneId) return;
    const data = typeof updates === 'function' ? updates(droneProfile) : updates;
    updateDroneProfile(activeDroneId, data);
  }, [activeDroneId, droneProfile, updateDroneProfile]);

  const resetProfile = useCallback(() => {
    if (!activeDroneId || !droneProfile) return;
    updateDroneProfile(activeDroneId, { ...createEmptyDrone(droneProfile.name || 'My Drone'), id: activeDroneId });
  }, [activeDroneId, droneProfile, updateDroneProfile]);

  const inferredFrameClass = (() => {
    const f = profile?.frameSize || profile?.frame_size;
    if (!f) {
      const w = profile?.auwGrams || profile?.weight;
      if (w) {
        if (w < 60)  return '65mm';
        if (w < 150) return '75mm';
        if (w < 250) return '3inch';
        if (w < 400) return '4inch';
        if (w < 700) return '5inch';
        return '6inch';
      }
      return '5inch';
    }
    return f;
  })();

  return (
    <DroneProfileContext.Provider value={{
      profile, droneProfile, setProfile, resetProfile, inferredFrameClass,
      profiles, activeDroneId, addDroneProfile, updateDroneProfile,
      deleteDroneProfile, duplicateDroneProfile, switchDrone, createEmptyDrone,
    }}>
      {children}
    </DroneProfileContext.Provider>
  );
}

export function useDroneProfile() {
  const ctx = useContext(DroneProfileContext);
  if (!ctx) throw new Error('useDroneProfile must be inside DroneProfileProvider');
  return ctx;
}

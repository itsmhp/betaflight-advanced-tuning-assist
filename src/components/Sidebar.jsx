import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Waypoints, HeartPulse, BookMarked, Cpu, Terminal, BarChart3,
  Globe, ChevronDown, Plus, Award
} from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { LANGUAGES } from '../i18n/translations';
import { loadPipelineState, countCompleted, TUNING_STAGES } from '../lib/tuningPipeline';
import { useDroneProfile } from '../context/DroneProfileContext';

const NAV_ITEMS = [
  { path: '/tune',     labelKey: 'tune_quad',       icon: Waypoints,  color: 'text-violet-400' },
  { path: '/',         labelKey: 'adv_pid_health',  icon: HeartPulse, color: 'text-violet-300', end: true },
  { path: '/presets',  labelKey: 'presets',         icon: BookMarked, color: 'text-cyan-400' },
  { path: '/rates',    labelKey: 'rate_profiles',   icon: Award,      color: 'text-cyan-300' },
  { path: '/compare-logs', labelKey: 'compare_logs', icon: BarChart3, color: 'text-blue-400' },
  { path: '/my-drone', labelKey: 'my_drone',        icon: Cpu,        color: 'text-cyan-300' },
  { path: '/serial',   labelKey: 'serial_cli',      icon: Terminal,   color: 'text-green-400' },
];

export default function Sidebar() {
  const { lang, setLang, t } = useLang();
  const { profiles, activeDroneId, switchDrone, addDroneProfile, droneProfile } = useDroneProfile();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const droneRef = useRef(null);
  const currentLang = LANGUAGES.find(l => l.code === lang);

  // Close drone dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (droneRef.current && !droneRef.current.contains(e.target)) setDroneOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Read pipeline progress from localStorage on mount + interval
  const [pipelineProgress, setPipelineProgress] = useState({ completed: 0, total: TUNING_STAGES.length });
  useEffect(() => {
    const read = () => {
      const state = loadPipelineState();
      if (state?.stages) {
        setPipelineProgress({ completed: countCompleted(state.stages), total: state.stages.length });
      }
    };
    read();
    const id = setInterval(read, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="w-56 flex-shrink-0 bg-[#0c0b14]/90 border-r border-violet-900/20 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-violet-900/20">
        <h1 className="text-sm font-bold tracking-wide accent-gradient">BETAFLIGHT</h1>
        <h2 className="text-xs text-gray-400">Tuning Assist <span className="text-violet-400">by iFlyQuad</span></h2>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-2">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-violet-500/10 text-violet-300 border-l-2 border-violet-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-violet-900/15 border-l-2 border-transparent'
              }`
            }
          >
            <item.icon size={16} className={item.color} />
            <span className="truncate flex-1">{t(item.labelKey)}</span>
            {item.path === '/tune' && pipelineProgress.completed > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${
                pipelineProgress.completed >= pipelineProgress.total
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-violet-900/40 text-violet-300'
              }`}>
                {pipelineProgress.completed}/{pipelineProgress.total}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Drone Switcher ── */}
      <div className="px-3 pb-1 relative" ref={droneRef}>
        <button
          onClick={() => setDroneOpen(o => !o)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-400 hover:bg-violet-900/20 hover:text-gray-200 transition-colors"
        >
          <Cpu size={13} className="text-cyan-400 flex-shrink-0"/>
          <span className="flex-1 text-left truncate">{droneProfile?.name || 'No Drone'}</span>
          <ChevronDown size={12} className={`transition-transform ${droneOpen ? 'rotate-180' : ''}`}/>
        </button>
        {droneOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-[#14112a] border border-violet-900/40 rounded-lg shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => { switchDrone(p.id); setDroneOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  p.id === activeDroneId
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-gray-400 hover:bg-violet-900/20 hover:text-gray-200'
                }`}
              >
                <Cpu size={11} className={p.id === activeDroneId ? 'text-violet-400' : 'text-gray-600'}/>
                <span className="truncate">{p.name || 'Unnamed'}</span>
                {p.id === activeDroneId && <span className="ml-auto text-[9px] text-violet-500 font-medium">ACTIVE</span>}
              </button>
            ))}
            <button
              onClick={() => { addDroneProfile({ name: `Drone ${profiles.length + 1}` }); setDroneOpen(false); navigate('/my-drone'); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-cyan-400 hover:bg-violet-900/20 transition-colors border-t border-violet-900/30"
            >
              <Plus size={11}/> Add New Drone
            </button>
          </div>
        )}
      </div>

      {/* Language Switcher */}
      <div className="p-3 border-t border-violet-900/20 relative">
        <button
          onClick={() => setLangOpen(o => !o)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-400 hover:bg-violet-900/20 hover:text-gray-200 transition-colors"
        >
          <Globe size={13} className="text-violet-400 flex-shrink-0" />
          <span className="flex-1 text-left">{currentLang?.flag} {currentLang?.label}</span>
          <ChevronDown size={12} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
        </button>
        {langOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-[#14112a] border border-violet-900/40 rounded-lg shadow-xl overflow-hidden z-50">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setLangOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  lang === l.code
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-gray-400 hover:bg-violet-900/20 hover:text-gray-200'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-700 text-center mt-1">v1.0 — iFlyQuad</p>
      </div>
    </nav>
  );
}

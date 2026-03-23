/**
 * DroneProfileModal.jsx
 * Shown when a blackbox file is uploaded — prompts user to select or create
 * a drone profile before analysis proceeds.
 */
import { useState } from 'react';
import { useDroneProfile, FRAME_SIZES, FLYING_STYLES, BATTERY_CELLS, createEmptyDrone } from '../context/DroneProfileContext';
import { useLang } from '../i18n/LangContext';
import { X, Plus, Crosshair, ChevronRight } from 'lucide-react';

export default function DroneProfileModal({ onConfirm, onClose, detectedInfo }) {
  const { profiles, activeDroneId, switchDrone, addDroneProfile } = useDroneProfile();
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState(activeDroneId);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(detectedInfo?.craftName || '');
  const [newFrameSize, setNewFrameSize] = useState(detectedInfo?.frameSize || '5inch');
  const [newFlyingStyle, setNewFlyingStyle] = useState('freestyle');
  const [newBatteryCells, setNewBatteryCells] = useState(detectedInfo?.batteryCells || '4');

  const handleConfirm = () => {
    if (showCreate) {
      const id = addDroneProfile({
        name: newName || 'New Drone',
        frame_size: newFrameSize,
        flying_style: newFlyingStyle,
        battery: { cells: newBatteryCells, mah: '', brand: '', c_rating: '' },
        fc: {
          model: detectedInfo?.fcTarget || '',
          brand: detectedInfo?.fcManufacturer || '',
          betaflight_version: detectedInfo?.bfVersion || '4.5',
        },
      });
      onConfirm(id);
    } else {
      if (selectedId) switchDrone(selectedId);
      onConfirm(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('modal_select_drone')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('modal_select_drone_desc')}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Detected info from BBL header */}
        {detectedInfo && (detectedInfo.craftName || detectedInfo.fcTarget || detectedInfo.bfVersion) && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-violet-950/30 border border-violet-800/30">
            <p className="text-xs text-violet-300 font-medium mb-1">{t('modal_detected_info')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
              {detectedInfo.craftName && <span>Craft: <strong>{detectedInfo.craftName}</strong></span>}
              {detectedInfo.fcTarget && <span>FC: <strong>{detectedInfo.fcTarget}</strong></span>}
              {detectedInfo.bfVersion && <span>BF: <strong>{detectedInfo.bfVersion}</strong></span>}
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          {!showCreate ? (
            <>
              {/* Existing profiles */}
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selectedId === p.id
                        ? 'border-violet-500 bg-violet-950/30 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{p.name || t('sidebar_unnamed')}</span>
                        <div className="flex gap-2 mt-0.5">
                          {p.frame_size && (
                            <span className="text-xs text-gray-500">
                              {FRAME_SIZES.find(f => f.value === p.frame_size)?.label || p.frame_size}
                            </span>
                          )}
                          {p.flying_style && (
                            <span className="text-xs text-gray-500">{p.flying_style}</span>
                          )}
                        </div>
                      </div>
                      {selectedId === p.id && (
                        <Crosshair size={14} className="text-violet-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Create new button */}
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
              >
                <Plus size={14} />
                {t('modal_create_new')}
              </button>
            </>
          ) : (
            <>
              {/* Create new profile form */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('field_drone_name')}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="My FPV Quad"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{t('field_frame_size')}</label>
                  <select
                    value={newFrameSize}
                    onChange={e => setNewFrameSize(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {FRAME_SIZES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{t('field_flying_style')}</label>
                    <select
                      value={newFlyingStyle}
                      onChange={e => setNewFlyingStyle(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      {FLYING_STYLES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{t('field_battery')}</label>
                    <select
                      value={newBatteryCells}
                      onChange={e => setNewBatteryCells(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      {BATTERY_CELLS.map(b => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('btn_back')} {t('modal_select_drone').toLowerCase()}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t('btn_cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('modal_continue_analysis')}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

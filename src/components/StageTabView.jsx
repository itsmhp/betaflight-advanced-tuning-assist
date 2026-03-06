/**
 * StageTabView.jsx — Tab wrapper for active tuning stages
 * Tabs: [📊 Analysis] [📈 Charts] [💻 CLI Commands]
 */
import { useState } from 'react';

export default function StageTabView({ tabs, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (!tabs?.length) return null;

  return (
    <div className="mt-3">
      {/* Tab bar */}
      <div className="flex gap-0.5 mb-4 border-b border-gray-700/60 overflow-x-auto scrollbar-none">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(i)}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === i
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
            }`}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
            {tab.badge != null && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-900/40 text-violet-300">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[100px]">
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
}

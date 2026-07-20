// 二级分段控件（segmented）：浅灰底，选中态白底 + 近黑字，克制无高饱和色。
export default function SecondaryTabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`inline-flex gap-0.5 p-0.5 bg-gray-100 rounded-lg w-fit ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === t.key
              ? 'bg-white text-gray-900 font-medium shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.label}
          {t.badge != null && t.badge > 0 && (
            <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// 三级 Tab：下划线式，较小号，选中态近黑。
export default function TertiaryTabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`border-b border-[#ececec] ${className}`}>
      <div className="flex gap-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`py-2 text-[13px] -mb-px border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-gray-900 text-gray-900 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

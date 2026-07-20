// 一级 Tab：下划线式，选中态用近黑（克制主色），不使用高饱和蓝。
export default function TabBar({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`border-b border-[#ececec] bg-white px-6 ${className}`}>
      <div className="flex gap-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative py-2.5 text-[13px] -mb-px border-b-2 transition-colors ${
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
